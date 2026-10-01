import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cliRoot = join(import.meta.dir, '..');

async function runCli(args: readonly string[], env: Readonly<Record<string, string>>) {
  const proc = Bun.spawn(['bun', 'run', 'src/main.ts', ...args], {
    cwd: cliRoot,
    env: { ...process.env, ...env },
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

describe('workbox', () => {
  test('--version prints the development version', async () => {
    const result = await runCli(['--version'], {});
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('0.0.0-dev');
  });

  test('doctor --json --debug keeps stdout pure JSON and logs to stderr', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-cli-'));
    const result = await runCli(['doctor', '--json', '--debug'], { WORKBOX_HOME: home });
    const parsed: unknown = JSON.parse(result.stdout);
    // Each detail is data, a code plus a value for some codes, never text in one locale. git and
    // Claude Code depend on the host, so only the home check pins exact values.
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
    expect(await Bun.file(join(home, 'logs', 'workbox.log')).text()).toContain(
      'running doctor checks',
    );
  });

  test('doctor with an unwritable home exits 1 and still prints JSON', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-cli-'));
    const file = join(base, 'file-as-home');
    await writeFile(file, 'x');
    const result = await runCli(['doctor', '--json', '--debug'], { WORKBOX_HOME: file });
    expect(result.exitCode).toBe(1);
    const parsed: unknown = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      ok: false,
      checks: [
        { id: 'git' },
        { id: 'claude-binary' },
        { id: 'claude-login' },
        { id: 'workbox-home', status: 'fail', detail: { code: 'os-error' } },
      ],
    });
    // The value is "<path>: <OS error>".
    expect(parsed).toHaveProperty(['checks', 3, 'detail', 'value'], expect.stringContaining(file));
    // A file cannot hold a logs directory: the debug file sink is skipped with a warning.
    expect(result.stderr).toContain('debug log file disabled');
  });

  test('doctor honours WORKBOX_LOCALE', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-cli-'));
    const result = await runCli(['doctor'], { WORKBOX_HOME: home, WORKBOX_LOCALE: 'cs' });
    expect(result.stdout).toContain('Workbox doktor');
    expect(result.stdout).toContain(`domovský adresář Workboxu: ${home}`);
    // Whatever git and Claude Code look like on this host, no English detail text may leak through.
    expect(result.stdout).not.toMatch(/not found|logged in|skipped/u);
  });
});
