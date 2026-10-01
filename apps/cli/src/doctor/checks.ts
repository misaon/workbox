import { access, constants, mkdir } from 'node:fs/promises';

import type { CommandRunner } from '../process/command-runner.ts';

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type CheckId = 'git' | 'claude-binary' | 'claude-login' | 'workbox-home';

/**
 * What a check found, as data: `--json` prints it as is and `report.ts` turns it into text in the
 * user's locale. `version`, `path` and `os-error` carry what they report (`os-error` as
 * `<path>: <reason>`), `logged-in` carries the configuration directory when `claude auth status`
 * names one, and the other codes stand for a fixed message.
 */
export type CheckDetail =
  | { readonly code: 'version'; readonly value: string }
  | { readonly code: 'path'; readonly value: string }
  | { readonly code: 'os-error'; readonly value: string }
  | { readonly code: 'logged-in'; readonly value?: string }
  | { readonly code: 'not-found' }
  | { readonly code: 'not-logged-in' }
  | { readonly code: 'skipped-no-binary' };

/** Every code a check can report, from `version` to `skipped-no-binary`. */
export type DetailCode = CheckDetail['code'];

export interface CheckResult {
  readonly id: CheckId;
  readonly status: CheckStatus;
  readonly detail: CheckDetail;
}

const EXIT_CODE_SUCCESS = 0;

const GIT_VERSION_PATTERN = /git version (?<version>\d+\.\d+\.\d+)/u;
const CLAUDE_VERSION_PATTERN = /(?<version>\d+\.\d+\.\d+)/u;

/** The "no value" result of the parsers below: their callers and tests expect `null`, not `undefined`. */
// oxlint-disable-next-line unicorn/no-null -- the parsers' contract is `string | null` (pinned by toBeNull in the tests); the literal is named once here
const NOT_FOUND = null;

export function parseGitVersion(output: string): string | null {
  return GIT_VERSION_PATTERN.exec(output)?.groups?.['version'] ?? NOT_FOUND;
}

export function parseClaudeVersion(output: string): string | null {
  return CLAUDE_VERSION_PATTERN.exec(output)?.groups?.['version'] ?? NOT_FOUND;
}

/** `claude auth status` prints JSON with `configDirectory` on v2.1.268+; older CLIs print text. The exit code decides. */
export function readConfigDirectory(stdout: string): string | null {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (typeof parsed === 'object' && parsed !== null && 'configDirectory' in parsed) {
      const value = parsed.configDirectory;
      return typeof value === 'string' ? value : NOT_FOUND;
    }
  } catch {
    // Non-JSON output from an older CLI: nothing to read.
  }
  return NOT_FOUND;
}

export async function checkGit(runner: CommandRunner): Promise<CheckResult> {
  const result = await runner.run(['git', '--version']);
  const version =
    result.exitCode === EXIT_CODE_SUCCESS ? parseGitVersion(result.stdout) : NOT_FOUND;
  if (version === null) {
    return { id: 'git', status: 'fail', detail: { code: 'not-found' } };
  }
  return { id: 'git', status: 'ok', detail: { code: 'version', value: version } };
}

export async function checkClaudeBinary(runner: CommandRunner): Promise<CheckResult> {
  const result = await runner.run(['claude', '--version']);
  const version =
    result.exitCode === EXIT_CODE_SUCCESS ? parseClaudeVersion(result.stdout) : NOT_FOUND;
  if (version === null) {
    return { id: 'claude-binary', status: 'warn', detail: { code: 'not-found' } };
  }
  return { id: 'claude-binary', status: 'ok', detail: { code: 'version', value: version } };
}

export async function checkClaudeLogin(runner: CommandRunner): Promise<CheckResult> {
  const result = await runner.run(['claude', 'auth', 'status']);
  if (result.exitCode === EXIT_CODE_SUCCESS) {
    const configDirectory = readConfigDirectory(result.stdout);
    return {
      id: 'claude-login',
      status: 'ok',
      detail:
        configDirectory === null
          ? { code: 'logged-in' }
          : { code: 'logged-in', value: configDirectory },
    };
  }
  return { id: 'claude-login', status: 'warn', detail: { code: 'not-logged-in' } };
}

export async function checkWorkboxHome(home: string): Promise<CheckResult> {
  try {
    await mkdir(home, { recursive: true });
    await access(home, constants.W_OK);
    return { id: 'workbox-home', status: 'ok', detail: { code: 'path', value: home } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      id: 'workbox-home',
      status: 'fail',
      detail: { code: 'os-error', value: `${home}: ${reason}` },
    };
  }
}
