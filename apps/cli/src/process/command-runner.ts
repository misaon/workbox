/** The shell convention for "command not found"; also used when the process cannot be spawned at all. */
const EXIT_CODE_COMMAND_NOT_FOUND = 127;

/** Far more than `git --version` or `claude auth status` need; a wedged command must not hang `doctor`. */
const COMMAND_TIMEOUT_MS = 15_000;

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  /**
   * What the command printed on stderr, because callers show it as the reason a command failed. It
   * is empty when the command could not be spawned, and `timed out after <N> ms` when the timeout
   * cut off a command that had printed nothing.
   */
  readonly stderr: string;
}

export interface CommandRunner {
  readonly run: (command: readonly string[]) => Promise<CommandResult>;
}

export function createBunCommandRunner(
  options: { readonly timeoutMs?: number } = {},
): CommandRunner {
  const { timeoutMs = COMMAND_TIMEOUT_MS } = options;
  return {
    async run(command) {
      try {
        const proc = Bun.spawn([...command], {
          stdin: 'ignore',
          stdout: 'pipe',
          stderr: 'pipe',
          timeout: timeoutMs,
        });
        const [stdout, stderr, exitCode] = await Promise.all([
          proc.stdout.text(),
          proc.stderr.text(),
          proc.exited,
        ]);
        // The timeout is the only signal this runner sends, so a command that a signal ended
        // without a word was cut off by it.
        const timedOut = proc.signalCode !== null && stderr.trim() === '';
        return { exitCode, stdout, stderr: timedOut ? `timed out after ${timeoutMs} ms` : stderr };
      } catch {
        // Bun could not spawn the command, for example because it is not on PATH. The error is
        // Bun's English text, not output of the command, so stderr stays empty and the report says
        // a plain "not found" in the user's language.
        return { exitCode: EXIT_CODE_COMMAND_NOT_FOUND, stdout: '', stderr: '' };
      }
    },
  };
}

export const bunCommandRunner: CommandRunner = createBunCommandRunner();
