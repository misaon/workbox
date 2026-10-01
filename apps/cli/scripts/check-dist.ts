import { readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { BUILD_TARGETS, outfileFor } from '../src/build-targets.ts';

const EXIT_FAILURE = 1;
const EMPTY_FILE_SIZE = 0;
const NO_PROBLEMS = 0;
/** `process.argv` starts with the runtime and the script path, so the directory argument is at 2. */
const DIST_ARGUMENT_INDEX = 2;

/** Release binaries are `workbox-<os>-<arch>[.exe]`; the checksums and the Sigstore bundle start with `workbox_`. */
const BINARY_PREFIX = 'workbox-';

const expectedNames = BUILD_TARGETS.map((target) => basename(outfileFor(target)));

async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function isEmptyFile(path: string): Promise<boolean> {
  const info = await stat(path);
  return info.size === EMPTY_FILE_SIZE;
}

/** The problem lines of one expected binary: none, `missing` when it is absent, `empty` when it has no bytes. */
async function problemsOfBinary(
  dist: string,
  name: string,
  present: readonly string[],
): Promise<string[]> {
  if (!present.includes(name)) {
    return [`missing: ${name}`];
  }
  return (await isEmptyFile(join(dist, name))) ? [`empty: ${name}`] : [];
}

async function problemsIn(dist: string): Promise<string[]> {
  if (!(await isDirectory(dist))) {
    return [`not a directory: ${dist}`];
  }
  const present = await readdir(dist);
  const ofBinaries = await Promise.all(
    expectedNames.map((name) => problemsOfBinary(dist, name, present)),
  );
  const unexpected = present
    .filter((name) => name.startsWith(BINARY_PREFIX) && !expectedNames.includes(name))
    .map((name) => `unexpected: ${name}`);
  return [...ofBinaries.flat(), ...unexpected];
}

const dist = resolve(process.argv[DIST_ARGUMENT_INDEX] ?? 'dist');
const problems = await problemsIn(dist);
if (problems.length > NO_PROBLEMS) {
  for (const problem of problems) {
    process.stderr.write(`${problem}\n`);
  }
  process.exitCode = EXIT_FAILURE;
} else {
  for (const name of expectedNames) {
    process.stdout.write(`ok: ${name}\n`);
  }
}
