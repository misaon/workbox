import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bunCommandRunner, createBunCommandRunner } from '../src/process/command-runner.ts';

describe('bunCommandRunner', () => {
  test('a missing executable yields exit code 127 and no stderr instead of throwing', async () => {
    const result = await bunCommandRunner.run(['workbox-no-such-binary-xyz']);
    expect(result.exitCode).toBe(127);
    expect(result.stdout).toBe('');
    // Bun's spawn error is its own English text, not output of the command: doctor then shows a
    // plain "not found" in the user's language.
    expect(result.stderr).toBe('');
  });

  test('a successful command yields exit code 0 and its stdout', async () => {
    const result = await bunCommandRunner.run(['bun', '--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });

  test('a failing command keeps its own exit code and stderr', async () => {
    const result = await bunCommandRunner.run([
      'bun',
      '-e',
      'console.error("boom"); process.exitCode = 3',
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('boom');
  });

  test('a failing command that printed nothing has an empty stderr, not a timeout note', async () => {
    const result = await bunCommandRunner.run(['bun', '-e', 'process.exitCode = 3']);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBe('');
  });

  test('a command that a signal ended keeps the stderr it printed first', async () => {
    const result = await bunCommandRunner.run([
      'bun',
      '-e',
      'require("node:fs").writeSync(2, "partial"); process.kill(process.pid, "SIGKILL")',
    ]);
    expect(result.stderr).toBe('partial');
  });

  test('a command that a signal ended without printing has an empty stderr, not a timeout note', async () => {
    const result = await bunCommandRunner.run([
      'bun',
      '-e',
      'process.kill(process.pid, "SIGKILL")',
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toBe('');
  });
});

describe('createBunCommandRunner', () => {
  test('cuts off a command that outlives its timeout', async () => {
    const runner = createBunCommandRunner({ timeoutMs: 200 });
    const started = performance.now();
    const result = await runner.run(['bun', '-e', 'await Bun.sleep(60_000)']);
    // Bun reports a process killed by the timeout with a non-zero code (143 after SIGTERM on Unix).
    expect(result.exitCode).not.toBe(0);
    expect(performance.now() - started).toBeLessThan(3000);
  });

  test('says on stderr that it cut a silent command off', async () => {
    const runner = createBunCommandRunner({ timeoutMs: 200 });
    const result = await runner.run(['bun', '-e', 'await Bun.sleep(60_000)']);
    expect(result.stderr).toBe('timed out after 200 ms');
  });

  test('a timed-out command that printed first keeps its text after the timeout note', async () => {
    // The child's start-up counts against the timeout, so this one is generous: a slow runner must
    // not cut the child off before it has printed.
    const runner = createBunCommandRunner({ timeoutMs: 2000 });
    const result = await runner.run([
      'bun',
      '-e',
      'require("node:fs").writeSync(2, "warming up"); await Bun.sleep(60_000)',
    ]);
    expect(result.stderr).toBe('timed out after 2000 ms: warming up');
  });
});

describe('createBunCommandRunner escalation and drain', () => {
  test('a command that ignores SIGTERM is killed after the grace period', async () => {
    const runner = createBunCommandRunner({ timeoutMs: 200, killGraceMs: 300 });
    const started = performance.now();
    const result = await runner.run([
      'bun',
      '-e',
      'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)',
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toBe('timed out after 200 ms');
    expect(performance.now() - started).toBeLessThan(3000);
  });

  test('a grandchild holding the pipes does not keep the result past the drain grace', async () => {
    const runner = createBunCommandRunner({ timeoutMs: 5000, drainGraceMs: 300 });
    const started = performance.now();
    const result = await runner.run([
      'bun',
      '-e',
      'Bun.spawn(["bun", "-e", "await Bun.sleep(4000)"], { stdout: "inherit", stderr: "inherit" }); process.stderr.write("real error"); process.exit(3)',
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBe('real error');
    expect(performance.now() - started).toBeLessThan(2500);
  });

  test.skipIf(process.platform === 'win32')(
    'a file that exists but is not executable surfaces the spawn error',
    async () => {
      // Windows has no execute bit; its spawn errors for a text file differ and are not part of
      // this contract.
      const dir = await mkdtemp(join(tmpdir(), 'workbox-runner-'));
      const file = join(dir, 'not-executable');
      await writeFile(file, 'plain text');
      const result = await bunCommandRunner.run([file]);
      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain('EACCES');
    },
  );

  test('a missing executable still has an empty stderr', async () => {
    const result = await bunCommandRunner.run(['workbox-no-such-binary-xyz']);
    expect(result).toEqual({ exitCode: 127, stdout: '', stderr: '' });
  });
});

const realSpawn = Bun.spawn;

/** Bun reports `null` for the exit code and the signal of a command that has not ended that way. */
// oxlint-disable-next-line unicorn/no-null -- Subprocess.exitCode and signalCode are null until the command ends, and the fake has to say the same
const UNSET = null;

/**
 * A command that a test scripts instead of spawning: the runner reads only its two streams, its exit
 * status, `exitCode`, `signalCode` and `kill`, so that is all the fake has. `exitCode` is set for a
 * command that has already exited, `signalCode` for one that a signal has already ended, and both
 * are left out for one that is still running.
 */
interface FakeCommand {
  readonly exitCode?: number;
  readonly signalCode?: string;
  readonly exited: () => Promise<number>;
  readonly stdout: () => Promise<string>;
  readonly stderr: () => Promise<string>;
  readonly kill?: () => void;
}

/** A pipe that delivers what `text` settles with as one chunk and then closes, or fails as it does. */
function pipeOf(text: () => Promise<string>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller: Readonly<ReadableStreamDefaultController<Uint8Array>>) {
      controller.enqueue(new TextEncoder().encode(await text()));
      controller.close();
    },
  });
}

/** Settles with `value` once `delayMs` have passed since it was called. */
function settlesAfter<Value>(delayMs: number, value: Value): () => Promise<Value> {
  return async () => {
    await Bun.sleep(delayMs);
    return value;
  };
}

function fakeSubprocess(command: FakeCommand) {
  const kill = mock(command.kill);
  const proc = {
    exitCode: command.exitCode ?? UNSET,
    signalCode: command.signalCode ?? UNSET,
    stdout: pipeOf(command.stdout),
    stderr: pipeOf(command.stderr),
    get exited() {
      return command.exited();
    },
    kill,
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fake has only what the runner reads, so Bun's full Subprocess type is claimed on purpose
  return { proc: proc as unknown as Bun.Subprocess, kill };
}

describe('createBunCommandRunner with a scripted command', () => {
  afterEach(() => {
    mock.restore();
  });

  test('stops a command whose output cannot be read and reports it as not run', async () => {
    const { proc, kill } = fakeSubprocess({
      exited: () => Promise.resolve(0),
      stdout: () => Promise.resolve(''),
      stderr: () => Promise.reject(new Error('EIO: i/o error, read')),
    });
    spyOn(Bun, 'spawn').mockReturnValue(proc);
    const result = await createBunCommandRunner().run(['git', '--version']);
    expect(result).toEqual({ exitCode: 127, stdout: '', stderr: '' });
    expect(kill).toHaveBeenCalledTimes(1);
  });

  test('a command that has already exited is not reported as timed out', async () => {
    // A grandchild still holds the stderr pipe open, so the text arrives long after the exit.
    const { proc, kill } = fakeSubprocess({
      exitCode: 3,
      exited: () => Promise.resolve(3),
      stdout: () => Promise.resolve(''),
      stderr: settlesAfter(300, 'real error\n'),
    });
    spyOn(Bun, 'spawn').mockReturnValue(proc);
    const result = await createBunCommandRunner({ timeoutMs: 50 }).run(['git', '--version']);
    expect(result).toEqual({ exitCode: 3, stdout: '', stderr: 'real error\n' });
    expect(kill).not.toHaveBeenCalled();
  });

  test('the timeout note trims what the command printed', async () => {
    const { proc, kill } = fakeSubprocess({
      exited: settlesAfter(300, 143),
      stdout: () => Promise.resolve(''),
      stderr: settlesAfter(300, 'warming up\n'),
    });
    spyOn(Bun, 'spawn').mockReturnValue(proc);
    const result = await createBunCommandRunner({ timeoutMs: 50 }).run(['git', '--version']);
    expect(result.stderr).toBe('timed out after 50 ms: warming up');
    expect(kill).toHaveBeenCalledTimes(1);
  });

  test('a kill that fails does not escape the timer', async () => {
    const { proc, kill } = fakeSubprocess({
      exited: settlesAfter(300, 143),
      stdout: () => Promise.resolve(''),
      stderr: settlesAfter(300, ''),
      kill: () => {
        throw new Error('EPERM: operation not permitted');
      },
    });
    spyOn(Bun, 'spawn').mockReturnValue(proc);
    const result = await createBunCommandRunner({ timeoutMs: 50 }).run(['git', '--version']);
    expect(result).toEqual({ exitCode: 143, stdout: '', stderr: 'timed out after 50 ms' });
    expect(kill).toHaveBeenCalledTimes(1);
  });

  test('a kill that fails while stopping an unreadable command does not reject', async () => {
    // The command is still running when its stderr cannot be read, so the runner has to stop it.
    const { proc, kill } = fakeSubprocess({
      exited: settlesAfter(300, 143),
      stdout: () => Promise.resolve(''),
      stderr: () => Promise.reject(new Error('EIO: i/o error, read')),
      kill: () => {
        throw new Error('EPERM: operation not permitted');
      },
    });
    spyOn(Bun, 'spawn').mockReturnValue(proc);
    const result = await createBunCommandRunner().run(['git', '--version']);
    expect(result).toEqual({ exitCode: 127, stdout: '', stderr: '' });
    expect(kill).toHaveBeenCalledTimes(1);
  });

  test('a command that a signal has already ended is not reported as timed out', async () => {
    // A grandchild still holds the stderr pipe open, so the text arrives long after the signal.
    const { proc, kill } = fakeSubprocess({
      signalCode: 'SIGKILL',
      exited: () => Promise.resolve(137),
      stdout: () => Promise.resolve(''),
      stderr: settlesAfter(300, 'partial'),
    });
    spyOn(Bun, 'spawn').mockReturnValue(proc);
    const result = await createBunCommandRunner({ timeoutMs: 50 }).run(['git', '--version']);
    expect(result).toEqual({ exitCode: 137, stdout: '', stderr: 'partial' });
    expect(kill).not.toHaveBeenCalled();
  });

  // `bun test` runs every file in one process, so a spy left behind would break later files.
  test('leaves Bun.spawn as it found it', () => {
    expect(Bun.spawn).toBe(realSpawn);
  });
});
