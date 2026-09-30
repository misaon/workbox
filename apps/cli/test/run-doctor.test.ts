import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDoctor } from '../src/doctor/run-doctor.ts';
import type { CommandResult, CommandRunner } from '../src/process/command-runner.ts';

function runnerReturning(results: Readonly<Record<string, CommandResult>>): CommandRunner {
  return {
    run: (command) =>
      Promise.resolve(
        results[command.join(' ')] ?? { exitCode: 127, stdout: '', stderr: 'not found' },
      ),
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
  });

  test('missing git fails the report', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-doctor-'));
    const report = await runDoctor({
      runner: runnerReturning({}),
      env: { WORKBOX_HOME: home },
      version: '1.2.3',
    });
    expect(report.ok).toBe(false);
  });
});
