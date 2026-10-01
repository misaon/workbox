import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { BUILD_TARGETS, outfileFor } from '../src/build-targets.ts';

const cliRoot = join(import.meta.dir, '..');
const expectedNames = BUILD_TARGETS.map((target) => basename(outfileFor(target)));

async function runCheck(dist: string) {
  const proc = Bun.spawn(['bun', 'run', 'scripts/check-dist.ts', dist], {
    cwd: cliRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout.text(),
    proc.stderr.text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function distWith(
  names: readonly string[],
  options: { readonly empty?: string | undefined } = {},
) {
  const dist = await mkdtemp(join(tmpdir(), 'workbox-dist-'));
  await Promise.all(
    names.map((name) =>
      writeFile(join(dist, name), name === options.empty ? '' : `binary ${name}`),
    ),
  );
  return dist;
}

describe('check-dist', () => {
  test('accepts exactly the eight expected binaries', async () => {
    const result = await runCheck(await distWith(expectedNames));
    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: '',
    });
    for (const name of expectedNames) {
      expect(result.stdout).toContain(name);
    }
  });

  test('fails when a binary is missing and names it', async () => {
    const [missing, ...rest] = expectedNames;
    const result = await runCheck(await distWith(rest));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`missing: ${missing}`);
  });

  test('fails when a binary is empty', async () => {
    const [empty] = expectedNames;
    const result = await runCheck(await distWith(expectedNames, { empty }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`empty: ${empty}`);
  });

  test('fails when an unexpected workbox- file is present', async () => {
    const result = await runCheck(await distWith([...expectedNames, 'workbox-freebsd-x64']));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('unexpected: workbox-freebsd-x64');
  });

  test('ignores the checksums and bundle files that later steps add', async () => {
    const result = await runCheck(
      await distWith([
        ...expectedNames,
        'workbox_0.2.0_checksums.txt',
        'workbox_0.2.0.sigstore.json',
      ]),
    );
    expect(result.exitCode).toBe(0);
  });

  test('fails when the directory does not exist', async () => {
    const result = await runCheck(join(tmpdir(), 'workbox-dist-does-not-exist'));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not a directory');
  });
});
