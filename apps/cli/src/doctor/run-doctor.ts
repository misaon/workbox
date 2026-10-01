import type { EnvLike } from '@workbox/observability';

import { resolveWorkboxHome } from '../home.ts';
import type { CommandRunner } from '../process/command-runner.ts';
import { checkClaudeBinary, checkClaudeLogin, checkGit, checkWorkboxHome } from './checks.ts';
import type { CheckResult } from './checks.ts';

export interface DoctorReport {
  readonly version: string;
  readonly checks: readonly CheckResult[];
  readonly ok: boolean;
}

export interface DoctorDependencies {
  readonly runner: CommandRunner;
  readonly env: EnvLike;
  readonly version: string;
}

export async function runDoctor(deps: DoctorDependencies): Promise<DoctorReport> {
  const git = await checkGit(deps.runner);
  const claudeBinary = await checkClaudeBinary(deps.runner);
  const claudeLogin: CheckResult =
    claudeBinary.status === 'ok'
      ? await checkClaudeLogin(deps.runner)
      : { id: 'claude-login', status: 'warn', detail: { code: 'skipped-no-binary' } };
  const home = await checkWorkboxHome(resolveWorkboxHome(deps.env));
  const checks = [git, claudeBinary, claudeLogin, home];
  return { version: deps.version, checks, ok: checks.every((check) => check.status !== 'fail') };
}
