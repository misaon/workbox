/**
 * Runs the external tools that the CLI needs (`git --version`, `claude auth status`). `run()` never
 * rejects, and every phase of a run is bounded:
 *
 * 1. Timeout: a command that has not ended `timeoutMs` after the spawn is asked to end with
 *    `kill()` (SIGTERM on Unix; on Windows this already terminates the process).
 * 2. Kill grace: a command that has still not ended `killGraceMs` later is killed with SIGKILL.
 * 3. Drain grace: once the command has ended, the runner waits at most `drainGraceMs` for its pipes
 *    to close, because a grandchild that inherited them can hold them open. It then cancels both
 *    readers and keeps what they had read.
 *
 * When Bun cannot start the command, the exit code is 127. A command that was not found (ENOENT:
 * not on PATH, or a script whose interpreter is missing) has an empty stderr, so that the report
 * says "not found" in the user's language; any other spawn error (EACCES for a file that is not
 * executable, for example) puts Bun's message on stderr.
 */

/**
 * The shell convention for "command not found"; also used when the process cannot be spawned at
 * all, and when the runner could not run the command to completion.
 */
const EXIT_CODE_COMMAND_NOT_FOUND = 127;

/** Bun's error code for a missing executable (not on PATH, or no such file) or script interpreter. */
const ERROR_CODE_NOT_FOUND = 'ENOENT';

/** Far more than `git --version` or `claude auth status` need; a wedged command must not hang `doctor`. */
const COMMAND_TIMEOUT_MS = 15_000;
/** After SIGTERM, how long a command may take to end before it is killed outright. */
const KILL_GRACE_MS = 2000;
/** After the command has ended, how long the runner waits for its pipes to close (a grandchild may hold them). */
const DRAIN_GRACE_MS = 1000;

/** The bounds of the three phases described at the top of the file; tests shorten them. */
export interface CommandRunnerOptions {
  readonly timeoutMs?: number;
  readonly killGraceMs?: number;
  readonly drainGraceMs?: number;
}

/** The options with their defaults filled in. */
type Limits = Required<CommandRunnerOptions>;

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  /**
   * What the command printed on stderr, because callers show it as the reason a command failed. If
   * its pipes were still open when the drain grace ran out, it is what had arrived by then. When
   * the runner's timeout stopped the command, it is `timed out after <N> ms`, followed by `: ` and
   * what the command had printed, if anything. When Bun could not start the command, it is Bun's
   * error message, except for a command that was not found, whose stderr is empty. It is also
   * empty when the runner could not run the command to completion.
   */
  readonly stderr: string;
}

export interface CommandRunner {
  readonly run: (command: readonly string[]) => Promise<CommandResult>;
}

/**
 * What the runner reads from a started command (Bun's `Subprocess` has all of it). `exitCode` and
 * `signalCode` stay `null` until the command exits or a signal ends it.
 */
interface StartedCommand {
  readonly stdout: Readonly<ReadableStream<Uint8Array>>;
  readonly stderr: Readonly<ReadableStream<Uint8Array>>;
  readonly exited: Readonly<Promise<number>>;
  readonly exitCode: number | null;
  readonly signalCode: string | null;
  readonly kill: (signal?: 'SIGKILL') => void;
}

/** Whether Bun's spawn error says that the command was not found. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === ERROR_CODE_NOT_FOUND
  );
}

/**
 * What goes on stderr when Bun cannot start the command. Nothing for a command that was not found:
 * Bun's error is its own English text, and the report says "not found" in the user's language. Any
 * other error is more than a plain "not found", so its message is kept.
 */
function spawnFailureText(error: unknown): string {
  if (isNotFound(error)) {
    return '';
  }
  return error instanceof Error ? error.message.trim() : '';
}

/** The subprocess, or what goes on stderr when Bun cannot start the command. */
function spawnCommand(command: readonly string[]) {
  try {
    return Bun.spawn([...command], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  } catch (error) {
    return { failure: spawnFailureText(error) };
  }
}

/** A pipe being read: all the text it delivered, or what had arrived when `cancel` was called. */
interface Collector {
  readonly text: Promise<string>;
  readonly cancel: () => void;
}

/**
 * Reads the stream to its end. `cancel` stops early: the pending read then reports the end of the
 * stream, so `text` is what had arrived by then.
 */
function collect(stream: Readonly<ReadableStream<Uint8Array>>): Collector {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  // One chunk per call, so that no `await` sits in a loop.
  const readRest = async (text: string): Promise<string> => {
    const chunk = await reader.read();
    if (chunk.done) {
      return text + decoder.decode();
    }
    return readRest(text + decoder.decode(chunk.value, { stream: true }));
  };
  const cancelQuietly = async () => {
    try {
      await reader.cancel();
    } catch {
      // A stream that has failed rejects the cancel too; its pending read has rejected `text`.
    }
  };
  return {
    text: readRest(''),
    cancel: () => {
      void cancelQuietly();
    },
  };
}

/** Both pipes being read: `text` settles with `[stdout, stderr]`, and `cancel` stops both readers. */
interface Output {
  readonly text: Readonly<Promise<readonly [string, string]>>;
  readonly cancel: () => void;
}

/**
 * Starts reading both pipes before anything is awaited: a command that fills a pipe nobody reads
 * blocks, so the pipes are drained while it runs.
 */
function collectOutput(proc: StartedCommand): Output {
  const stdout = collect(proc.stdout);
  const stderr = collect(proc.stderr);
  return {
    text: Promise.all([stdout.text, stderr.text]),
    cancel: () => {
      stdout.cancel();
      stderr.cancel();
    },
  };
}

/** Settles like `exited` once `output` has been read, and rejects as soon as reading it fails. */
async function exitAfterOutput(
  output: Readonly<Promise<unknown>>,
  exited: Readonly<Promise<number>>,
): Promise<number> {
  await output;
  return exited;
}

/**
 * The exit code once the command has ended. A failure to read the output rejects at once instead,
 * while the command may still be running, so that the caller stops it. The output gets its handler
 * here, before anything is awaited, so that a read that fails early is not an unhandled rejection.
 */
function waitForExit(proc: StartedCommand, output: Output): Promise<number> {
  const { exited } = proc;
  return Promise.race([exited, exitAfterOutput(output.text, exited)]);
}

/**
 * The output once both pipes have closed, but no later than `drainGraceMs` from now: a grandchild
 * that inherited the pipes can hold them open long after the command has ended. When the grace
 * runs out, both readers are cancelled, and the output is what they had read by then.
 */
async function drain(output: Output, drainGraceMs: number): Promise<readonly [string, string]> {
  const timer = setTimeout(output.cancel, drainGraceMs);
  try {
    return await output.text;
  } finally {
    clearTimeout(timer);
  }
}

/** Whether the command has ended: Bun sets `exitCode` when it exits and `signalCode` when a signal ends it. */
function hasEnded(proc: StartedCommand): boolean {
  return proc.exitCode !== null || proc.signalCode !== null;
}

/**
 * Asks the command to end, or ends it outright with `SIGKILL`. Failing to signal it must not
 * become an exception of its own.
 */
function stopCommand(proc: StartedCommand, signal?: 'SIGKILL'): void {
  try {
    proc.kill(signal);
  } catch {
    // An EPERM, or the command ending at that moment on Windows, must not be an uncaught exception.
  }
}

/** `timed out after <N> ms`, then what the command printed before it was cut off, if anything. */
function timeoutNote(timeoutMs: number, stderr: string): string {
  const note = `timed out after ${timeoutMs} ms`;
  const printed = stderr.trim();
  return printed === '' ? note : `${note}: ${printed}`;
}

/**
 * Asks the command to end when `timeoutMs` have passed, unless it has ended by then, and kills it
 * when it has still not ended `killGraceMs` later (it may ignore SIGTERM). The runner keeps its own
 * timers instead of using Bun's `timeout` option, so it knows that it sent the signal itself: a
 * signal from outside is not a timeout. `exitCode` and `signalCode` are read only to see whether
 * the command has already ended.
 */
function startTimeout(proc: StartedCommand, limits: Limits) {
  let timedOut = false;
  const killIfRunning = () => {
    if (!hasEnded(proc)) {
      stopCommand(proc, 'SIGKILL');
    }
  };
  // The kill grace starts when the timeout fires, so one timer is pending at a time.
  let timer = setTimeout(() => {
    // A command that has already ended is not cut off, even if a grandchild still holds a pipe.
    if (hasEnded(proc)) {
      return;
    }
    timedOut = true;
    stopCommand(proc);
    timer = setTimeout(killIfRunning, limits.killGraceMs);
  }, limits.timeoutMs);
  return {
    timedOut: () => timedOut,
    cancel: () => {
      clearTimeout(timer);
    },
  };
}

/** Runs a started command through the three phases described at the top of the file. */
async function superviseCommand(proc: StartedCommand, limits: Limits): Promise<CommandResult> {
  const output = collectOutput(proc);
  const timeout = startTimeout(proc, limits);
  try {
    const exitCode = await waitForExit(proc, output);
    const [stdout, stderr] = await drain(output, limits.drainGraceMs);
    return {
      exitCode,
      stdout,
      stderr: timeout.timedOut() ? timeoutNote(limits.timeoutMs, stderr) : stderr,
    };
  } catch {
    // Reading the output or the exit status failed after the spawn: stop the command and report
    // it like one that could not be run, so that doctor still prints every check.
    stopCommand(proc);
    return { exitCode: EXIT_CODE_COMMAND_NOT_FOUND, stdout: '', stderr: '' };
  } finally {
    timeout.cancel();
    // A reader still waiting on a pipe would keep the CLI from exiting.
    output.cancel();
  }
}

export function createBunCommandRunner(options: CommandRunnerOptions = {}): CommandRunner {
  const limits: Limits = {
    timeoutMs: options.timeoutMs ?? COMMAND_TIMEOUT_MS,
    killGraceMs: options.killGraceMs ?? KILL_GRACE_MS,
    drainGraceMs: options.drainGraceMs ?? DRAIN_GRACE_MS,
  };
  return {
    run(command) {
      const proc = spawnCommand(command);
      if ('failure' in proc) {
        return Promise.resolve({
          exitCode: EXIT_CODE_COMMAND_NOT_FOUND,
          stdout: '',
          stderr: proc.failure,
        });
      }
      return superviseCommand(proc, limits);
    },
  };
}

export const bunCommandRunner: CommandRunner = createBunCommandRunner();
