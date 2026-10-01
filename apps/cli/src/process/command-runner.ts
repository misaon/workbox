/** The shell convention for "command not found"; also used when the process cannot be spawned at all. */
const EXIT_CODE_COMMAND_NOT_FOUND = 127;

/** Far more than `git --version` or `claude auth status` need; a wedged command must not hang `doctor`. */
const COMMAND_TIMEOUT_MS = 15_000;

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  /**
   * What the command printed on stderr, because callers show it as the reason a command failed. It
   * is empty when the command could not be spawned. When the runner's timeout cut the command off,
   * it is `timed out after <N> ms`, followed by `: ` and what the command had printed, if anything.
   */
  readonly stderr: string;
}

export interface CommandRunner {
  readonly run: (command: readonly string[]) => Promise<CommandResult>;
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

/** `timed out after <N> ms`, then what the command printed before it was cut off, if anything. */
function timeoutNote(timeoutMs: number, stderr: string): string {
  const note = `timed out after ${timeoutMs} ms`;
  const printed = stderr.trim();
  return printed === '' ? note : `${note}: ${printed}`;
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
      // The runner keeps its own timer instead of using Bun's `timeout` option, so it knows that it
      // cut the command off: a signal from outside is not a timeout, and no platform's way of
      // reporting signals comes into it.
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, timeoutMs);
      try {
        const [stdout, stderr, exitCode] = await Promise.all([
          proc.stdout.text(),
          proc.stderr.text(),
          proc.exited,
        ]);
        return { exitCode, stdout, stderr: timedOut ? timeoutNote(timeoutMs, stderr) : stderr };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export const bunCommandRunner: CommandRunner = createBunCommandRunner();
