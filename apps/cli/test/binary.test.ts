import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { buildCommand, hostTarget, outfileFor } from '../src/build-targets.ts';

const cliRoot = join(import.meta.dir, '..');

describe.skipIf(process.env['WORKBOX_BINARY_TEST'] !== '1')('compiled binary', () => {
  test('--version prints the injected version', async () => {
    const target = hostTarget();
    const build = Bun.spawn(buildCommand(target, '9.9.9-test', 'src/main.ts'), {
      cwd: cliRoot,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    expect(await build.exited).toBe(0);
    const run = Bun.spawn([join(cliRoot, outfileFor(target)), '--version'], {
      cwd: cliRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      run.stdout.text(),
      run.stderr.text(),
      run.exited,
    ]);
    // One object, so a failing binary shows its own stderr next to its exit code in the diff.
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
    expect(stdout.trim()).toBe('9.9.9-test');
  }, 120_000);
});
