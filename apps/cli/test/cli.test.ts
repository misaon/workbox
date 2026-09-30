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
    expect(parsed).toMatchObject({ version: '0.0.0-dev' });
    expect(parsed).toHaveProperty('checks.length', 4);
    expect(result.stderr).toContain('doctor');
  });

  test('doctor with an unwritable home exits 1 and still prints JSON', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-cli-'));
    const file = join(base, 'file-as-home');
    await writeFile(file, 'x');
    const result = await runCli(['doctor', '--json', '--debug'], { WORKBOX_HOME: file });
    expect(result.exitCode).toBe(1);
    const parsed: unknown = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({ ok: false });
  });

  test('doctor honours WORKBOX_LOCALE', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-cli-'));
    const result = await runCli(['doctor'], { WORKBOX_HOME: home, WORKBOX_LOCALE: 'cs' });
    expect(result.stdout).toContain('Workbox doktor');
  });
});
