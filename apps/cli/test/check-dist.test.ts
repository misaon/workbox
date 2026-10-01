import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { BUILD_TARGETS, outfileFor } from '../src/build-targets.ts';

const cliRoot = join(import.meta.dir, '..');
const expectedNames = BUILD_TARGETS.map((target) => basename(outfileFor(target)));
/** Every temporary directory a test made; nothing else cleans the OS temp directory, so `afterEach` does. */
const tempDirectories: string[] = [];

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'workbox-dist-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  const directories = tempDirectories.splice(0);
  await Promise.all(
    directories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

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
  const dist = await makeTempDirectory();
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
    expect(result.stderr).toBe(`missing: ${missing}\n`);
  });

  test('fails when a binary is empty', async () => {
    const [empty] = expectedNames;
    const result = await runCheck(await distWith(expectedNames, { empty }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(`empty: ${empty}\n`);
  });

  test('fails when an unexpected workbox- file is present', async () => {
    const result = await runCheck(await distWith([...expectedNames, 'workbox-freebsd-x64']));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('unexpected: workbox-freebsd-x64\n');
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
    const missing = join(await makeTempDirectory(), 'does-not-exist');
    const result = await runCheck(missing);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(`not a directory: ${missing}\n`);
  });
});
