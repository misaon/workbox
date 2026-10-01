import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createStubTools, removeCompiledStub } from './helpers/stub-tools.ts';
import type { StubSpec, StubTools } from './helpers/stub-tools.ts';

const cliRoot = join(import.meta.dir, '..');

// On Windows every stub is a compiled Bun executable, which a virus scanner may inspect when it
// first runs, and a doctor run starts up to three of them: Bun's default of 5 s may not be enough.
// oxlint-disable-next-line jest/require-hook -- setDefaultTimeout works only while Bun collects the file: called from a hook, it no longer reaches the tests (checked with Bun 1.4.2)
setDefaultTimeout(30_000);
/** On Windows, the first `beforeAll` that makes stubs also compiles the stub. */
const STUB_SETUP_TIMEOUT_MS = 60_000;

const CLAUDE_DIR = '/home/user/.claude';
/** Modelled on a Mac without the Command Line Tools; the two-line split is artificial, so the report has a line break to collapse. */
const XCRUN_ERROR = [
  'xcrun: error: invalid active developer path',
  'missing xcrun at: /Library/Developer/CommandLineTools/usr/bin/xcrun',
];

/** Every tool working and Claude Code logged in. `claude auth status` is keyed by `auth`. */
const ALL_GREEN: StubSpec = {
  git: { '--version': { stdout: 'git version 2.50.0\n' } },
  claude: {
    '--version': { stdout: '2.1.285 (Claude Code)\n' },
    auth: { stdout: `{"loggedIn":true,"configDirectory":"${CLAUDE_DIR}"}\n` },
  },
};
const BROKEN_GIT: StubSpec = {
  ...ALL_GREEN,
  git: { '--version': { exit: 1, stderr: `${XCRUN_ERROR.join('\n')}\n` } },
};
/** `claude auth status` exits 1 when nobody is logged in. */
const NOT_LOGGED_IN: StubSpec = {
  ...ALL_GREEN,
  claude: { ...ALL_GREEN['claude'], auth: { exit: 1, stdout: '{"loggedIn":false}\n' } },
};

/** Every directory that the tests make for the CLI lives here, and `afterAll` removes it. */
const scratch = await mkdtemp(join(tmpdir(), 'workbox-cli-'));

type Env = Readonly<Record<string, string>>;

/**
 * The environment of the test process without its search path, however its name is spelled:
 * Windows spells it `Path`, and that next to the `PATH` of the stubs would hand the CLI two.
 */
function hostEnvWithoutPath(): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]: readonly [string, unknown]) => name.toUpperCase() !== 'PATH',
    ),
  );
}

/**
 * Runs the CLI from source with the Bun that runs the tests, so no `bun` needs to be on PATH.
 * `env` goes on top of the environment of the test process, whose search path is left out: with
 * the env of a stub directory, the CLI finds the stubs and no tool of the host.
 */
async function runCli(args: readonly string[], env: Env) {
  const proc = Bun.spawn([process.execPath, 'run', 'src/main.ts', ...args], {
    cwd: cliRoot,
    env: { ...hostEnvWithoutPath(), ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([proc.stdout.text(), proc.stderr.text()]);
  return { exitCode: await proc.exited, stdout, stderr };
}

/** Runs `workbox doctor` with `args`, the env of the stubs, and `env` on top of that. */
type StubbedDoctor = (args: readonly string[], env: Env) => ReturnType<typeof runCli>;

/**
 * `workbox doctor` against stubs for `spec`, which the `beforeAll` of the describe block makes and
 * its `afterAll` removes, even when a test fails. The tests check the report before the exit code,
 * so that a call the spec does not cover shows the message of the stub in the diff.
 */
function useStubbedDoctor(spec: StubSpec): StubbedDoctor {
  const made: { stubs?: StubTools } = {};
  beforeAll(async () => {
    made.stubs = await createStubTools(spec);
  }, STUB_SETUP_TIMEOUT_MS);
  afterAll(async () => {
    await made.stubs?.cleanup();
  });
  return (args, env) => {
    if (made.stubs === undefined) {
      throw new Error('The stubs are made in beforeAll');
    }
    return runCli(['doctor', ...args], { ...made.stubs.env, ...env });
  };
}

/** A new, empty directory under `scratch`. */
function scratchDir(): Promise<string> {
  return mkdtemp(join(scratch, 'dir-'));
}

/** The lines of a text report or a JSON Lines log. */
function linesOf(text: string): string[] {
  return text.trimEnd().split(/\r?\n/u);
}

afterAll(async () => {
  await rm(scratch, { recursive: true, force: true });
  await removeCompiledStub();
});

describe('workbox --version', () => {
  test('prints the development version', async () => {
    const result = await runCli(['--version'], {});
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('0.0.0-dev');
  });
});

describe('workbox doctor with git and Claude Code installed and logged in', () => {
  const doctor = useStubbedDoctor(ALL_GREEN);

  test('--json reports every check as ok', async () => {
    const home = await scratchDir();
    const result = await doctor(['--json'], { WORKBOX_HOME: home });
    const parsed: unknown = JSON.parse(result.stdout);
    expect(parsed).toEqual({
      version: '0.0.0-dev',
      checks: [
        { id: 'git', status: 'ok', detail: { code: 'version', value: '2.50.0' } },
        { id: 'claude-binary', status: 'ok', detail: { code: 'version', value: '2.1.285' } },
        { id: 'claude-login', status: 'ok', detail: { code: 'logged-in', value: CLAUDE_DIR } },
        { id: 'workbox-home', status: 'ok', detail: { code: 'path', value: home } },
      ],
      ok: true,
    });
    expect(result.exitCode).toBe(0);
  });

  test('the Czech report passes every check', async () => {
    const home = await scratchDir();
    const result = await doctor([], { WORKBOX_HOME: home, WORKBOX_LOCALE: 'cs' });
    expect(linesOf(result.stdout)).toEqual([
      'Workbox doktor 0.0.0-dev',
      '✓ git: 2.50.0',
      '✓ binárka Claude Code: 2.1.285',
      '✓ přihlášení Claude Code: /home/user/.claude',
      `✓ domovský adresář Workboxu: ${home}`,
      'Prošlo 4 z 4 kontrol',
    ]);
    expect(result.exitCode).toBe(0);
  });

  test('--json --debug keeps stdout pure JSON and logs every check', async () => {
    const home = await scratchDir();
    const result = await doctor(['--json', '--debug'], { WORKBOX_HOME: home });
    const parsed: unknown = JSON.parse(result.stdout);
    // Each detail is data, a code plus a value for some codes, never text in one locale.
    expect(parsed).toMatchObject({
      version: '0.0.0-dev',
      checks: [
        { id: 'git' },
        { id: 'claude-binary' },
        { id: 'claude-login' },
        { id: 'workbox-home', status: 'ok', detail: { code: 'path', value: home } },
      ],
    });
    for (const index of [0, 1, 2]) {
      expect(parsed).toHaveProperty(['checks', index, 'detail', 'code'], expect.any(String));
    }
    expect(result.stderr).toContain('doctor');
    // The debug file sink must exist and hold what the stderr sink printed.
    const logText = await Bun.file(join(home, 'logs', 'workbox.log')).text();
    expect(logText).toContain('running doctor checks');
    // Every check gets a debug record of its own. In JSON Lines, LogTape quotes the string
    // placeholders of the message, and the properties of the record hold the values as they are.
    const records = linesOf(logText).map((line): unknown => JSON.parse(line));
    expect(records).toContainEqual(
      expect.objectContaining({
        message: 'doctor check "git": "ok" ("version")',
        properties: { id: 'git', status: 'ok', code: 'version', value: '2.50.0' },
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        message: 'doctor check "workbox-home": "ok" ("path")',
        properties: { id: 'workbox-home', status: 'ok', code: 'path', value: home },
      }),
    );
  });

  test('an unwritable home exits 1 and still prints JSON', async () => {
    const file = join(await scratchDir(), 'file-as-home');
    await writeFile(file, 'x');
    const result = await doctor(['--json', '--debug'], { WORKBOX_HOME: file });
    const parsed: unknown = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      ok: false,
      checks: [
        { id: 'git', status: 'ok' },
        { id: 'claude-binary', status: 'ok' },
        { id: 'claude-login', status: 'ok' },
        { id: 'workbox-home', status: 'fail', detail: { code: 'os-error' } },
      ],
    });
    expect(result.exitCode).toBe(1);
    // The value is "<path>: <OS error>".
    expect(parsed).toHaveProperty(['checks', 3, 'detail', 'value'], expect.stringContaining(file));
    // A file cannot hold a logs directory: the debug file sink is skipped with a warning.
    expect(result.stderr).toContain('debug log file disabled');
  });
});

describe('workbox doctor without git and Claude Code on PATH', () => {
  const doctor = useStubbedDoctor({});

  test('--json fails git and skips the login check', async () => {
    const home = await scratchDir();
    const result = await doctor(['--json'], { WORKBOX_HOME: home });
    const parsed: unknown = JSON.parse(result.stdout);
    // A tool missing from PATH has no value: nothing on stderr explains it.
    expect(parsed).toEqual({
      version: '0.0.0-dev',
      checks: [
        { id: 'git', status: 'fail', detail: { code: 'not-found' } },
        { id: 'claude-binary', status: 'warn', detail: { code: 'not-found' } },
        { id: 'claude-login', status: 'warn', detail: { code: 'skipped-no-binary' } },
        { id: 'workbox-home', status: 'ok', detail: { code: 'path', value: home } },
      ],
      ok: false,
    });
    expect(result.exitCode).toBe(1);
  });

  test('the English report ends with the install hint', async () => {
    const home = await scratchDir();
    const result = await doctor([], { WORKBOX_HOME: home, WORKBOX_LOCALE: 'en' });
    expect(linesOf(result.stdout)).toEqual([
      'Workbox doctor 0.0.0-dev',
      '✗ git: not found',
      '! Claude Code binary: not found',
      '! Claude Code login: skipped: Claude Code binary not found',
      `✓ Workbox home directory: ${home}`,
      '1 of 4 checks passed',
      'Install Claude Code: https://code.claude.com/docs/en/setup',
    ]);
    expect(result.exitCode).toBe(1);
  });
});

describe('workbox doctor with a broken git', () => {
  const doctor = useStubbedDoctor(BROKEN_GIT);

  test('--json keeps what git printed, line break included', async () => {
    const result = await doctor(['--json'], { WORKBOX_HOME: await scratchDir() });
    const parsed: unknown = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty(['checks', 0], {
      id: 'git',
      status: 'fail',
      detail: { code: 'not-found', value: XCRUN_ERROR.join('\n') },
    });
    expect(parsed).toHaveProperty('ok', false);
    expect(result.exitCode).toBe(1);
  });

  test('the Czech report shows that text on the one line of the git check', async () => {
    const home = await scratchDir();
    const result = await doctor([], { WORKBOX_HOME: home, WORKBOX_LOCALE: 'cs' });
    expect(linesOf(result.stdout)).toContain(`✗ git: nenalezeno: ${XCRUN_ERROR.join(' ')}`);
    expect(result.exitCode).toBe(1);
  });
});

describe('workbox doctor with Claude Code installed but logged out', () => {
  const doctor = useStubbedDoctor(NOT_LOGGED_IN);

  test('the English report says so and how to log in', async () => {
    const home = await scratchDir();
    const result = await doctor([], { WORKBOX_HOME: home, WORKBOX_LOCALE: 'en' });
    expect(linesOf(result.stdout)).toEqual([
      'Workbox doctor 0.0.0-dev',
      '✓ git: 2.50.0',
      '✓ Claude Code binary: 2.1.285',
      '! Claude Code login: not logged in',
      `✓ Workbox home directory: ${home}`,
      '3 of 4 checks passed',
      'Run `claude auth login` in a terminal. Workbox never handles your credentials.',
    ]);
    // A warning does not fail doctor.
    expect(result.exitCode).toBe(0);
  });
});
