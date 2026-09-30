/** The shell convention for "command not found"; also used when the process cannot be spawned at all. */
const EXIT_CODE_COMMAND_NOT_FOUND = 127;

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CommandRunner {
  readonly run: (command: readonly string[]) => Promise<CommandResult>;
}

export const bunCommandRunner: CommandRunner = {
  async run(command) {
    try {
      const proc = Bun.spawn([...command], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
      const [stdout, stderr, exitCode] = await Promise.all([
        proc.stdout.text(),
        proc.stderr.text(),
        proc.exited,
      ]);
      return { exitCode, stdout, stderr };
    } catch (error) {
      return {
        exitCode: EXIT_CODE_COMMAND_NOT_FOUND,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
