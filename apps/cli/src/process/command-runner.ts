/**
 * The shell convention for "command not found"; also used when the process cannot be spawned at
 * all, and when the runner could not run the command to completion.
 */
const EXIT_CODE_COMMAND_NOT_FOUND = 127;

/** Far more than `git --version` or `claude auth status` need; a wedged command must not hang `doctor`. */
const COMMAND_TIMEOUT_MS = 15_000;

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  /**
   * What the command printed on stderr, because callers show it as the reason a command failed. It
   * is empty when the runner could not start the command or could not run it to completion. When
   * the runner's timeout stopped the command, it is `timed out after <N> ms`, followed by `: ` and
   * what the command had printed, if anything.
   */
  readonly stderr: string;
}

export interface CommandRunner {
  readonly run: (command: readonly string[]) => Promise<CommandResult>;
}

/** What the timer reads from a started command: whether it has ended, and a way to stop it. */
interface StartedCommand {
  readonly exitCode: number | null;
  readonly signalCode: string | null;
  readonly kill: () => void;
}

/**
 * What `spawnCommand` returns when Bun cannot start the command. It is a named constant because the
 * lint rules accept neither a bare `return` nor `return undefined`.
 */
const NOT_STARTED = undefined;

/** The subprocess, or `undefined` when Bun cannot start the command (not on PATH, for example). */
function spawnCommand(command: readonly string[]) {
  try {
    return Bun.spawn([...command], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  } catch {
    return NOT_STARTED;
  }
}

/** Asks the command to end. Failing to signal it must not become an exception of its own. */
function stopCommand(proc: StartedCommand): void {
  try {
    proc.kill();
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
 * Stops the command when `timeoutMs` have passed, unless it has ended by then. The runner keeps its
 * own timer instead of using Bun's `timeout` option, so it knows that it sent the signal itself: a
 * signal from outside is not a timeout. `exitCode` and `signalCode` are read only to see whether
 * the command has already ended.
 */
function startTimeout(proc: StartedCommand, timeoutMs: number) {
  let timedOut = false;
  const timer = setTimeout(() => {
    // A command that has already ended is not cut off, even if a grandchild still holds a pipe.
    if (proc.exitCode !== null || proc.signalCode !== null) {
      return;
    }
    timedOut = true;
    stopCommand(proc);
  }, timeoutMs);
  return {
    timedOut: () => timedOut,
    cancel: () => {
      clearTimeout(timer);
    },
  };
}

export function createBunCommandRunner(
  options: { readonly timeoutMs?: number } = {},
): CommandRunner {
  const { timeoutMs = COMMAND_TIMEOUT_MS } = options;
  return {
    async run(command) {
      const proc = spawnCommand(command);
      if (proc === undefined) {
        // Bun's error is its own English text, not output of the command, so stderr stays empty and
        // the report says a plain "not found" in the user's language.
        return { exitCode: EXIT_CODE_COMMAND_NOT_FOUND, stdout: '', stderr: '' };
      }
      const timeout = startTimeout(proc, timeoutMs);
      try {
        const [stdout, stderr, exitCode] = await Promise.all([
          proc.stdout.text(),
          proc.stderr.text(),
          proc.exited,
        ]);
        return {
          exitCode,
          stdout,
          stderr: timeout.timedOut() ? timeoutNote(timeoutMs, stderr) : stderr,
        };
      } catch {
        // Reading the output or the exit status failed after the spawn: stop the command and report
        // it like one that could not be run, so that doctor still prints every check.
        stopCommand(proc);
        return { exitCode: EXIT_CODE_COMMAND_NOT_FOUND, stdout: '', stderr: '' };
      } finally {
        timeout.cancel();
      }
    },
  };
}

export const bunCommandRunner: CommandRunner = createBunCommandRunner();
