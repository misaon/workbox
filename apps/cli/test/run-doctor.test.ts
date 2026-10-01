import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CheckDetail } from '../src/doctor/checks.ts';
import { runDoctor } from '../src/doctor/run-doctor.ts';
import type { CommandResult, CommandRunner } from '../src/process/command-runner.ts';

/**
 * A command that is not listed behaves like a missing executable: exit code 127 and no stderr, as
 * `bunCommandRunner` returns it.
 */
function runnerReturning(results: Readonly<Record<string, CommandResult>>): CommandRunner {
  return {
    run: (command) =>
      Promise.resolve(results[command.join(' ')] ?? { exitCode: 127, stdout: '', stderr: '' }),
  };
}

describe('runDoctor', () => {
  test('all green', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-doctor-'));
    const report = await runDoctor({
      runner: runnerReturning({
        'git --version': { exitCode: 0, stdout: 'git version 2.51.0', stderr: '' },
        'claude --version': { exitCode: 0, stdout: '2.1.285 (Claude Code)', stderr: '' },
        'claude auth status': {
          exitCode: 0,
          stdout: '{"configDirectory":"/home/u/.claude"}',
          stderr: '',
        },
      }),
      env: { WORKBOX_HOME: home },
      version: '1.2.3',
    });
    expect(report.version).toBe('1.2.3');
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.status)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(report.checks.map((check) => check.detail)).toEqual([
      { code: 'version', value: '2.51.0' },
      { code: 'version', value: '2.1.285' },
      { code: 'logged-in', value: '/home/u/.claude' },
      { code: 'path', value: home },
    ]);
  });

  test('missing claude skips the login check but does not fail the report', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-doctor-'));
    const report = await runDoctor({
      runner: runnerReturning({
        'git --version': { exitCode: 0, stdout: 'git version 2.51.0', stderr: '' },
      }),
      env: { WORKBOX_HOME: home },
      version: '1.2.3',
    });
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => `${check.id}:${check.status}`)).toEqual([
      'git:ok',
      'claude-binary:warn',
      'claude-login:warn',
      'workbox-home:ok',
    ]);
    expect(report.checks.map((check) => check.detail.code)).toEqual([
      'version',
      'not-found',
      'skipped-no-binary',
      'path',
    ]);
  });

  test('missing git fails the report', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-doctor-'));
    const report = await runDoctor({
      runner: runnerReturning({}),
      env: { WORKBOX_HOME: home },
      version: '1.2.3',
    });
    expect(report.ok).toBe(false);
    expect(report.checks[0]).toEqual({ id: 'git', status: 'fail', detail: { code: 'not-found' } });
  });

  test('a git that runs but fails keeps its error text in the report and in its JSON', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-doctor-'));
    const report = await runDoctor({
      runner: runnerReturning({
        'git --version': {
          exitCode: 1,
          stdout: '',
          stderr: 'xcrun: error: invalid active developer path\n',
        },
      }),
      env: { WORKBOX_HOME: home },
      version: '1.2.3',
    });
    const detail: CheckDetail = {
      code: 'not-found',
      value: 'xcrun: error: invalid active developer path',
    };
    expect(report.ok).toBe(false);
    expect(report.checks[0]).toEqual({ id: 'git', status: 'fail', detail });
    // `doctor --json` prints this report object through JSON.stringify.
    const json = JSON.stringify(report);
    const printed: unknown = JSON.parse(json);
    expect(printed).toHaveProperty(['checks', 0, 'detail'], detail);
  });
});
