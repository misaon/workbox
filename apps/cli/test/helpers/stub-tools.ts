/**
 * Stand-ins for the tools that `workbox doctor` runs, so that the CLI integration tests do not
 * depend on the `git` and `claude` of the host. `createStubTools(spec)` makes a directory with one
 * executable per tool of the spec, each running `../fixtures/stub-tool.ts`, and the environment
 * that puts that directory alone on the PATH of the CLI:
 *
 * - On POSIX, each tool is a `#!/bin/sh` wrapper that runs the stub with the Bun that runs the
 *   tests.
 * - On Windows, Bun cannot spawn a `.cmd` or `.bat` file without a shell, so the stub is compiled
 *   into a real executable, once per test process, and each tool is a copy of it named
 *   `<tool>.exe`. The compiled stub outlives every stub directory, and Bun's test runner emits no
 *   `exit` event to remove it on, so a test file that uses stubs calls `removeCompiledStub()` in
 *   its `afterAll`.
 */
import { chmod, copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { hostTarget } from '../../src/build-targets.ts';

/** What a stubbed tool does when it is called with one first argument. */
interface StubBehaviour {
  /** The exit code; 0 when left out. */
  readonly exit?: number;
  /** Written to stdout as it is. */
  readonly stdout?: string;
  /** Written to stderr as it is. */
  readonly stderr?: string;
}

/** For each tool, what it does for its first argument, or for any other one under `'*'`. */
export type StubSpec = Readonly<Record<string, Readonly<Record<string, StubBehaviour>>>>;

export interface StubTools {
  /** The directory with one executable per tool of the spec. */
  readonly dir: string;
  /**
   * What the environment of the CLI needs: `PATH` with the stub directory alone (plus
   * `%SystemRoot%\System32` on Windows, the minimum that child processes need there) and
   * `WORKBOX_STUB_SPEC` with the spec as JSON.
   */
  readonly env: Readonly<Record<string, string>>;
  /** Removes the stub directory. */
  readonly cleanup: () => Promise<void>;
}

const STUB_SOURCE = join(import.meta.dir, '..', 'fixtures', 'stub-tool.ts');
const IS_WINDOWS = process.platform === 'win32';
/** Everyone may read and run the wrapper, and the CLI can spawn it only when it is executable. */
const EXECUTABLE_MODE = 0o755;
const EXIT_CODE_SUCCESS = 0;

/**
 * What the stub directories of a test process share on Windows, from the first one that needs a
 * compiled stub until `removeCompiledStub()`: the compiled stub, and the directory it was built in.
 */
const shared: { compiledStub?: Promise<string>; buildDir?: string } = {};

/** `tool` on POSIX: the stub, run by the Bun that runs the tests, with the tool name first. */
function posixWrapper(tool: string): string {
  return `#!/bin/sh\nexec "${process.execPath}" "${STUB_SOURCE}" ${tool} "$@"\n`;
}

/**
 * Compiles the stub for this host into a directory of its own. The build runs in that directory
 * because `bun build --compile` leaves a `.bun-build` file in its working directory.
 */
async function compileStub(): Promise<string> {
  const buildDir = await mkdtemp(join(tmpdir(), 'workbox-stub-build-'));
  shared.buildDir = buildDir;
  const executable = join(buildDir, 'stub.exe');
  const build = Bun.spawn(
    [
      process.execPath,
      'build',
      '--compile',
      `--target=${hostTarget()}`,
      '--outfile',
      executable,
      STUB_SOURCE,
    ],
    { cwd: buildDir, stdout: 'pipe', stderr: 'pipe' },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    build.stdout.text(),
    build.stderr.text(),
    build.exited,
  ]);
  if (exitCode !== EXIT_CODE_SUCCESS) {
    throw new Error(`Compiling the stub failed with exit code ${exitCode}:\n${stdout}${stderr}`);
  }
  return executable;
}

async function installStub(dir: string, tool: string): Promise<void> {
  if (IS_WINDOWS) {
    shared.compiledStub ??= compileStub();
    await copyFile(await shared.compiledStub, join(dir, `${tool}.exe`));
    return;
  }
  const wrapper = join(dir, tool);
  await writeFile(wrapper, posixWrapper(tool));
  await chmod(wrapper, EXECUTABLE_MODE);
}

/** The stub directory alone, and on Windows `%SystemRoot%\System32` after it. */
function searchPath(dir: string): string {
  if (!IS_WINDOWS) {
    return dir;
  }
  // Bun reads the environment case-insensitively on Windows, as Windows does.
  const systemRoot = process.env['SystemRoot'];
  if (systemRoot === undefined) {
    throw new Error('SystemRoot is not set');
  }
  return [dir, join(systemRoot, 'System32')].join(delimiter);
}

/**
 * Makes a stub directory for `spec`. A setup that fails half-way removes what it made; otherwise
 * the caller removes the directory with `cleanup()`.
 */
export async function createStubTools(spec: StubSpec): Promise<StubTools> {
  const dir = await mkdtemp(join(tmpdir(), 'workbox-stubs-'));
  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true });
  };
  try {
    await Promise.all(Object.keys(spec).map((tool) => installStub(dir, tool)));
    return {
      dir,
      env: { PATH: searchPath(dir), WORKBOX_STUB_SPEC: JSON.stringify(spec) },
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * Removes the compiled stub and its build directory, if this test process has made them (only
 * Windows does); a later stub directory compiles a new one.
 */
export async function removeCompiledStub(): Promise<void> {
  const { buildDir } = shared;
  delete shared.compiledStub;
  delete shared.buildDir;
  if (buildDir !== undefined) {
    await rm(buildDir, { recursive: true, force: true });
  }
}
