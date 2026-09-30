import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  checkClaudeBinary,
  checkClaudeLogin,
  checkGit,
  checkWorkboxHome,
  parseClaudeVersion,
  parseGitVersion,
  readConfigDirectory,
} from '../src/doctor/checks.ts';
import type { CommandResult, CommandRunner } from '../src/process/command-runner.ts';

function runnerReturning(results: Readonly<Record<string, CommandResult>>): CommandRunner {
  return {
    run: (command) => {
      const key = command.join(' ');
      const result = results[key];
      return Promise.resolve(result ?? { exitCode: 127, stdout: '', stderr: `not found: ${key}` });
    },
  };
}

describe('parsers', () => {
  test('parseGitVersion accepts plain and suffixed output', () => {
    expect(parseGitVersion('git version 2.51.0\n')).toBe('2.51.0');
    expect(parseGitVersion('git version 2.51.0.windows.1')).toBe('2.51.0');
    expect(parseGitVersion('zsh: command not found: git')).toBeNull();
  });

  test('parseClaudeVersion reads the leading semver', () => {
    expect(parseClaudeVersion('2.1.285 (Claude Code)\n')).toBe('2.1.285');
    expect(parseClaudeVersion('')).toBeNull();
  });

  test('readConfigDirectory tolerates non-JSON output', () => {
    expect(readConfigDirectory('{"configDirectory":"/Users/x/.claude"}')).toBe('/Users/x/.claude');
    expect(readConfigDirectory('Logged in')).toBeNull();
    expect(readConfigDirectory('{"other":1}')).toBeNull();
  });
});

describe('checks', () => {
  test('git ok', async () => {
    const runner = runnerReturning({
      'git --version': { exitCode: 0, stdout: 'git version 2.51.0', stderr: '' },
    });
    expect(await checkGit(runner)).toEqual({ id: 'git', status: 'ok', detail: '2.51.0' });
  });

  test('git missing is a failure', async () => {
    const result = await checkGit(runnerReturning({}));
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('git');
  });

  test('claude binary missing is a warning', async () => {
    const result = await checkClaudeBinary(runnerReturning({}));
    expect(result).toMatchObject({ id: 'claude-binary', status: 'warn' });
  });

  test('claude login uses the exit code as the source of truth', async () => {
    const loggedIn = runnerReturning({
      'claude auth status': { exitCode: 0, stdout: 'Logged in', stderr: '' },
    });
    expect(await checkClaudeLogin(loggedIn)).toEqual({
      id: 'claude-login',
      status: 'ok',
      detail: 'logged in',
    });
    const loggedOut = runnerReturning({
      'claude auth status': { exitCode: 1, stdout: '', stderr: '' },
    });
    const loggedOutResult = await checkClaudeLogin(loggedOut);
    expect(loggedOutResult.status).toBe('warn');
  });

  test('workbox home is created when missing', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-home-'));
    const home = join(base, 'nested', '.workbox');
    expect(await checkWorkboxHome(home)).toEqual({
      id: 'workbox-home',
      status: 'ok',
      detail: home,
    });
  });

  test('workbox home that is a file fails with the path and the OS error', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-home-'));
    const file = join(base, 'not-a-directory');
    await writeFile(file, 'x');
    const result = await checkWorkboxHome(file);
    expect(result.status).toBe('fail');
    expect(result.detail).toContain(file);
  });
});
