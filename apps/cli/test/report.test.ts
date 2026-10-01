import { describe, expect, test } from 'bun:test';

import type { Locale } from '@workbox/i18n';

import type { CheckDetail, DetailCode } from '../src/doctor/checks.ts';
import { formatDoctorReport } from '../src/doctor/report.ts';
import type { DoctorReport } from '../src/doctor/run-doctor.ts';

const report: DoctorReport = {
  version: '1.2.3',
  ok: false,
  checks: [
    { id: 'git', status: 'ok', detail: { code: 'version', value: '2.51.0' } },
    { id: 'claude-binary', status: 'warn', detail: { code: 'not-found' } },
    { id: 'claude-login', status: 'warn', detail: { code: 'skipped-no-binary' } },
    { id: 'workbox-home', status: 'fail', detail: { code: 'os-error', value: '/x: EACCES' } },
  ],
};

/** Claude Code is installed but nobody is logged in: the hint must be the login one, not the install one. */
const loggedOutReport: DoctorReport = {
  version: '1.2.3',
  ok: true,
  checks: [
    { id: 'git', status: 'ok', detail: { code: 'version', value: '2.51.0' } },
    { id: 'claude-binary', status: 'ok', detail: { code: 'version', value: '2.1.285' } },
    { id: 'claude-login', status: 'warn', detail: { code: 'not-logged-in' } },
    { id: 'workbox-home', status: 'ok', detail: { code: 'path', value: '/home/u/.workbox' } },
  ],
};

interface DetailTexts {
  readonly detail: CheckDetail;
  readonly en: string;
  readonly cs: string;
}

/** Every detail code in both locales; a code added without a row here does not compile. */
const DETAIL_TEXTS: Record<DetailCode, DetailTexts> = {
  version: { detail: { code: 'version', value: '2.51.0' }, en: '2.51.0', cs: '2.51.0' },
  path: {
    detail: { code: 'path', value: '/home/u/.workbox' },
    en: '/home/u/.workbox',
    cs: '/home/u/.workbox',
  },
  'os-error': {
    detail: { code: 'os-error', value: '/x: EACCES' },
    en: '/x: EACCES',
    cs: '/x: EACCES',
  },
  'logged-in': { detail: { code: 'logged-in' }, en: 'logged in', cs: 'přihlášeno' },
  'not-found': { detail: { code: 'not-found' }, en: 'not found', cs: 'nenalezeno' },
  'not-logged-in': { detail: { code: 'not-logged-in' }, en: 'not logged in', cs: 'nepřihlášeno' },
  'skipped-no-binary': {
    detail: { code: 'skipped-no-binary' },
    en: 'skipped: Claude Code binary not found',
    cs: 'přeskočeno: binárka Claude Code nebyla nalezena',
  },
};

/** The check line of a one-check report; the Claude Code login check stands in for any check. */
function checkLine(detail: CheckDetail, locale: Locale): string | undefined {
  const single: DoctorReport = {
    version: '1.2.3',
    ok: true,
    checks: [{ id: 'claude-login', status: 'ok', detail }],
  };
  return formatDoctorReport(single, locale).split('\n')[1];
}

describe('formatDoctorReport', () => {
  test('English', () => {
    const text = formatDoctorReport(report, 'en');
    expect(text).toContain('Workbox doctor 1.2.3');
    expect(text).toContain('✓ git: 2.51.0');
    expect(text).toContain('! Claude Code binary: not found');
    expect(text).toContain('! Claude Code login: skipped: Claude Code binary not found');
    expect(text).toContain('✗ Workbox home directory: /x: EACCES');
    expect(text).toContain('1 of 4 checks passed');
    expect(text).toContain('Install Claude Code');
  });

  test('Czech', () => {
    const text = formatDoctorReport(report, 'cs');
    expect(text).toContain('Workbox doktor 1.2.3');
    expect(text).toContain('✓ git: 2.51.0');
    expect(text).toContain('! binárka Claude Code: nenalezeno');
    expect(text).toContain(
      '! přihlášení Claude Code: přeskočeno: binárka Claude Code nebyla nalezena',
    );
    expect(text).toContain('✗ domovský adresář Workboxu: /x: EACCES');
    expect(text).toContain('Prošlo 1 z 4 kontrol');
    expect(text).not.toMatch(/not found|skipped/u);
  });

  test('English login hint when Claude Code is installed but not logged in', () => {
    const text = formatDoctorReport(loggedOutReport, 'en');
    expect(text).toContain('! Claude Code login: not logged in');
    expect(text).toContain('Run `claude auth login`');
    expect(text).not.toContain('Install Claude Code');
  });

  test('Czech login hint when Claude Code is installed but not logged in', () => {
    const text = formatDoctorReport(loggedOutReport, 'cs');
    expect(text).toContain('! přihlášení Claude Code: nepřihlášeno');
    expect(text).toContain('Spusťte v terminálu');
    expect(text).not.toContain('Nainstalujte Claude Code');
    expect(text).not.toContain('logged in');
  });
});

describe('detail texts', () => {
  test.each(Object.entries(DETAIL_TEXTS))('%s in English and Czech', (code, texts) => {
    expect(code).toBe(texts.detail.code);
    expect(checkLine(texts.detail, 'en')).toBe(`✓ Claude Code login: ${texts.en}`);
    expect(checkLine(texts.detail, 'cs')).toBe(`✓ přihlášení Claude Code: ${texts.cs}`);
  });

  test('logged-in prints the configuration directory instead of the message when there is one', () => {
    const detail: CheckDetail = { code: 'logged-in', value: '/home/u/.claude' };
    expect(checkLine(detail, 'en')).toBe('✓ Claude Code login: /home/u/.claude');
    expect(checkLine(detail, 'cs')).toBe('✓ přihlášení Claude Code: /home/u/.claude');
  });
});
