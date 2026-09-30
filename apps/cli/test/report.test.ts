import { describe, expect, test } from 'bun:test';

import { formatDoctorReport } from '../src/doctor/report.ts';
import type { DoctorReport } from '../src/doctor/run-doctor.ts';

const report: DoctorReport = {
  version: '1.2.3',
  ok: false,
  checks: [
    { id: 'git', status: 'ok', detail: '2.51.0' },
    { id: 'claude-binary', status: 'warn', detail: 'not found' },
    { id: 'claude-login', status: 'warn', detail: 'skipped' },
    { id: 'workbox-home', status: 'fail', detail: '/x: EACCES' },
  ],
};

/** Claude Code is installed but nobody is logged in: the hint must be the login one, not the install one. */
const loggedOutReport: DoctorReport = {
  version: '1.2.3',
  ok: true,
  checks: [
    { id: 'git', status: 'ok', detail: '2.51.0' },
    { id: 'claude-binary', status: 'ok', detail: '2.1.285' },
    { id: 'claude-login', status: 'warn', detail: 'not logged in' },
    { id: 'workbox-home', status: 'ok', detail: '/home/u/.workbox' },
  ],
};

describe('formatDoctorReport', () => {
  test('English', () => {
    const text = formatDoctorReport(report, 'en');
    expect(text).toContain('Workbox doctor 1.2.3');
    expect(text).toContain('✓ git: 2.51.0');
    expect(text).toContain('! Claude Code binary: not found');
    expect(text).toContain('✗ Workbox home directory: /x: EACCES');
    expect(text).toContain('1 of 4 checks passed');
    expect(text).toContain('Install Claude Code');
  });

  test('Czech', () => {
    const text = formatDoctorReport(report, 'cs');
    expect(text).toContain('Workbox doktor 1.2.3');
    expect(text).toContain('Prošlo 1 z 4 kontrol');
  });

  test('English login hint when Claude Code is installed but not logged in', () => {
    const text = formatDoctorReport(loggedOutReport, 'en');
    expect(text).toContain('! Claude Code login: not logged in');
    expect(text).toContain('Run `claude auth login`');
    expect(text).not.toContain('Install Claude Code');
  });

  test('Czech login hint when Claude Code is installed but not logged in', () => {
    const text = formatDoctorReport(loggedOutReport, 'cs');
    expect(text).toContain('Spusťte v terminálu');
    expect(text).not.toContain('Nainstalujte Claude Code');
  });
});
