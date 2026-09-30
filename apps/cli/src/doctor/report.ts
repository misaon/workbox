import { m } from '@workbox/i18n';
import type { Locale } from '@workbox/i18n';

import type { CheckId, CheckResult, CheckStatus } from './checks.ts';
import type { DoctorReport } from './run-doctor.ts';

const SYMBOLS: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✗' };

/** One entry per check id, so adding an id without a label does not compile. */
const LABELS: Record<CheckId, (locale: Locale) => string> = {
  git: (locale) => m.cli_doctor_check_git({}, { locale }),
  'claude-binary': (locale) => m.cli_doctor_check_claude_binary({}, { locale }),
  'claude-login': (locale) => m.cli_doctor_check_claude_login({}, { locale }),
  'workbox-home': (locale) => m.cli_doctor_check_workbox_home({}, { locale }),
};

function label(id: CheckId, locale: Locale): string {
  return LABELS[id](locale);
}

function hints(checks: readonly CheckResult[], locale: Locale): string[] {
  const out: string[] = [];
  if (checks.some((check) => check.id === 'claude-binary' && check.status !== 'ok')) {
    out.push(m.cli_doctor_hint_install_claude({}, { locale }));
  } else if (checks.some((check) => check.id === 'claude-login' && check.status !== 'ok')) {
    out.push(m.cli_doctor_hint_login({}, { locale }));
  }
  return out;
}

export function formatDoctorReport(report: DoctorReport, locale: Locale): string {
  const passed = report.checks.filter((check) => check.status === 'ok').length;
  const lines = [
    `${m.cli_doctor_title({}, { locale })} ${report.version}`,
    ...report.checks.map(
      (check) => `${SYMBOLS[check.status]} ${label(check.id, locale)}: ${check.detail}`,
    ),
    m.cli_doctor_summary(
      { passed: String(passed), total: String(report.checks.length) },
      { locale },
    ),
    ...hints(report.checks, locale),
  ];
  return lines.join('\n');
}
