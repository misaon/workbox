import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BUILD_TARGETS, buildCommand, isBuildTarget } from '../src/build-targets.ts';
import type { BuildTarget } from '../src/build-targets.ts';

const EXIT_CODE_SUCCESS = 0;
const NO_TARGET_ARGUMENTS = 0;
/** `process.argv` starts with the runtime and the script path, so the first target argument is at 2. */
const FIRST_TARGET_ARGUMENT_INDEX = 2;

const cliRoot = join(import.meta.dir, '..');
const rootPackageJson = join(cliRoot, '..', '..', 'package.json');

function requestedTargets(argv: readonly string[]): BuildTarget[] {
  if (argv.length === NO_TARGET_ARGUMENTS) {
    return [...BUILD_TARGETS];
  }
  return argv.map((value) => {
    if (!isBuildTarget(value)) {
      throw new Error(`Unknown target "${value}". Known targets: ${BUILD_TARGETS.join(', ')}`);
    }
    return value;
  });
}

/** The `version` of a package.json text; a manifest without one must stop the build, not compile "undefined". */
function readVersion(packageJson: string): string {
  const manifest: unknown = JSON.parse(packageJson);
  if (
    typeof manifest === 'object' &&
    manifest !== null &&
    'version' in manifest &&
    typeof manifest.version === 'string'
  ) {
    return manifest.version;
  }
  throw new Error(`${rootPackageJson} has no "version" string`);
}

const version = readVersion(await readFile(rootPackageJson, 'utf8'));
for (const target of requestedTargets(process.argv.slice(FIRST_TARGET_ARGUMENT_INDEX))) {
  const proc = Bun.spawn(buildCommand(target, version, 'src/main.ts'), {
    cwd: cliRoot,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  // oxlint-disable-next-line no-await-in-loop -- targets compile one after the other on purpose: each run is CPU- and memory-heavy and parallel runs would interleave their logs
  if ((await proc.exited) !== EXIT_CODE_SUCCESS) {
    throw new Error(`bun build failed for ${target}`);
  }
}
