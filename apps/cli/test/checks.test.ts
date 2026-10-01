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

/**
 * A command that is not listed behaves like a missing executable: exit code 127 and no stderr, as
 * `bunCommandRunner` returns it.
 */
function runnerReturning(results: Readonly<Record<string, CommandResult>>): CommandRunner {
  return {
    run: (command) => {
      const result = results[command.join(' ')];
      return Promise.resolve(result ?? { exitCode: 127, stdout: '', stderr: '' });
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
    expect(await checkGit(runner)).toEqual({
      id: 'git',
      status: 'ok',
      detail: { code: 'version', value: '2.51.0' },
    });
  });

  test('git missing is a failure', async () => {
    expect(await checkGit(runnerReturning({}))).toEqual({
      id: 'git',
      status: 'fail',
      detail: { code: 'not-found' },
    });
  });

  test('git that runs but fails keeps the error text it printed', async () => {
    const runner = runnerReturning({
      'git --version': {
        exitCode: 1,
        stdout: '',
        stderr: 'xcrun: error: invalid active developer path\n',
      },
    });
    expect(await checkGit(runner)).toEqual({
      id: 'git',
      status: 'fail',
      detail: { code: 'not-found', value: 'xcrun: error: invalid active developer path' },
    });
  });

  test('git that exits 0 without a version still reports its error text', async () => {
    const runner = runnerReturning({
      'git --version': { exitCode: 0, stdout: 'usage: git', stderr: 'shim: no real git\n' },
    });
    expect(await checkGit(runner)).toEqual({
      id: 'git',
      status: 'fail',
      detail: { code: 'not-found', value: 'shim: no real git' },
    });
  });

  test('claude binary present reports its version', async () => {
    const runner = runnerReturning({
      'claude --version': { exitCode: 0, stdout: '2.1.285 (Claude Code)\n', stderr: '' },
    });
    expect(await checkClaudeBinary(runner)).toEqual({
      id: 'claude-binary',
      status: 'ok',
      detail: { code: 'version', value: '2.1.285' },
    });
  });

  test('claude binary missing is a warning', async () => {
    expect(await checkClaudeBinary(runnerReturning({}))).toEqual({
      id: 'claude-binary',
      status: 'warn',
      detail: { code: 'not-found' },
    });
  });

  test('claude binary that runs but fails keeps the error text it printed', async () => {
    const runner = runnerReturning({
      'claude --version': {
        exitCode: 126,
        stdout: '',
        stderr: 'asdf: No version is set for command claude\n',
      },
    });
    expect(await checkClaudeBinary(runner)).toEqual({
      id: 'claude-binary',
      status: 'warn',
      detail: { code: 'not-found', value: 'asdf: No version is set for command claude' },
    });
  });

  test('a failing git or claude binary whose stderr is blank has no value', async () => {
    const blank: CommandResult = { exitCode: 1, stdout: '', stderr: ' \n' };
    const git = await checkGit(runnerReturning({ 'git --version': blank }));
    const claude = await checkClaudeBinary(runnerReturning({ 'claude --version': blank }));
    expect(git.detail).toEqual({ code: 'not-found' });
    expect(claude.detail).toEqual({ code: 'not-found' });
    // A missing value is an absent property, not `value: undefined`.
    expect(git.detail).not.toHaveProperty('value');
    expect(claude.detail).not.toHaveProperty('value');
  });

  test('claude login uses the exit code as the source of truth', async () => {
    const loggedIn = runnerReturning({
      'claude auth status': { exitCode: 0, stdout: 'Logged in', stderr: '' },
    });
    // Text output names no directory, so the detail carries no value.
    expect(await checkClaudeLogin(loggedIn)).toEqual({
      id: 'claude-login',
      status: 'ok',
      detail: { code: 'logged-in' },
    });
    const loggedOut = runnerReturning({
      'claude auth status': { exitCode: 1, stdout: '', stderr: '' },
    });
    expect(await checkClaudeLogin(loggedOut)).toEqual({
      id: 'claude-login',
      status: 'warn',
      detail: { code: 'not-logged-in' },
    });
  });

  test('claude login carries the configuration directory that the JSON status names', async () => {
    const runner = runnerReturning({
      'claude auth status': {
        exitCode: 0,
        stdout: '{"configDirectory":"/Users/x/.claude"}',
        stderr: '',
      },
    });
    expect(await checkClaudeLogin(runner)).toEqual({
      id: 'claude-login',
      status: 'ok',
      detail: { code: 'logged-in', value: '/Users/x/.claude' },
    });
  });

  test('workbox home is created when missing', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-home-'));
    const home = join(base, 'nested', '.workbox');
    expect(await checkWorkboxHome(home)).toEqual({
      id: 'workbox-home',
      status: 'ok',
      detail: { code: 'path', value: home },
    });
  });

  test('workbox home that is a file fails with the path and the OS error', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-home-'));
    const file = join(base, 'not-a-directory');
    await writeFile(file, 'x');
    const result = await checkWorkboxHome(file);
    expect(result).toMatchObject({
      id: 'workbox-home',
      status: 'fail',
      detail: { code: 'os-error' },
    });
    expect(result.detail).toHaveProperty('value', expect.stringContaining(`${file}: `));
    // The OS error code (EEXIST, ENOTDIR, ...) follows the path, not just the path alone.
    expect(result.detail).toHaveProperty('value', expect.stringMatching(/: E[A-Z]+/u));
  });
});
