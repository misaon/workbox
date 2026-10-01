import { m } from '@workbox/i18n';
import type { Locale } from '@workbox/i18n';

import type { CheckDetail, CheckId, CheckResult, CheckStatus } from './checks.ts';
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

/**
 * A tool's own error text can span several lines, and a check line must stay one line: every run of
 * whitespace, line breaks included, becomes one space and both ends are trimmed. Only the text
 * report does this; `--json` prints the check detail as the check produced it.
 */
function collapseWhitespace(text: string): string {
  return text.replaceAll(/\s+/gu, ' ').trim();
}

/**
 * A code without a value prints its message; `not-found` follows it with what the runner reported
 * on stderr (the tool's own text, or the runner's timeout note) when there is any, collapsed onto
 * one line, and `logged-in` prints the configuration directory when there is one. What is left
 * prints the value the check read: a version, a path or an OS error, so a new code without a value
 * does not compile until it gets a branch here.
 */
function detailText(detail: CheckDetail, locale: Locale): string {
  if (detail.code === 'not-found') {
    const message = m.cli_doctor_detail_not_found({}, { locale });
    return detail.value === undefined ? message : `${message}: ${collapseWhitespace(detail.value)}`;
  }
  if (detail.code === 'not-logged-in') {
    return m.cli_doctor_detail_not_logged_in({}, { locale });
  }
  if (detail.code === 'skipped-no-binary') {
    return m.cli_doctor_detail_skipped_no_binary({}, { locale });
  }
  if (detail.code === 'logged-in') {
    return detail.value ?? m.cli_doctor_detail_logged_in({}, { locale });
  }
  return detail.value;
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
      (check) =>
        `${SYMBOLS[check.status]} ${label(check.id, locale)}: ${detailText(check.detail, locale)}`,
    ),
    m.cli_doctor_summary(
      { passed: String(passed), total: String(report.checks.length) },
      { locale },
    ),
    ...hints(report.checks, locale),
  ];
  return lines.join('\n');
}
