import { describe, expect, test } from 'bun:test';

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
});
