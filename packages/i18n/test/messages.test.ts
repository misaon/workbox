import { describe, expect, test } from 'bun:test';

import { getLocale, m, setLocale } from '../src/index.ts';

// Paraglide types every message as the branded `LocalizedString`, so the tests widen the subject
// with `expect<string>` to let `toBe` take a plain string literal.
describe('messages', () => {
  test('English is the base locale', () => {
    expect(getLocale()).toBe('en');
    expect<string>(m.cli_doctor_title()).toBe('Workbox doctor');
  });

  test('a locale can be requested per call', () => {
    expect<string>(m.cli_doctor_title({}, { locale: 'cs' })).toBe('Workbox doktor');
  });

  test('inputs are interpolated', () => {
    expect<string>(m.cli_doctor_summary({ passed: '3', total: '4' })).toBe('3 of 4 checks passed');
    expect<string>(m.cli_doctor_summary({ passed: '3', total: '4' }, { locale: 'cs' })).toBe(
      'Prošlo 3 z 4 kontrol',
    );
  });

  test('setLocale switches the global locale', async () => {
    await setLocale('cs', { reload: false });
    expect<string>(m.app_title()).toBe('Workbox');
    expect<string>(m.cli_doctor_check_git({}, { locale: getLocale() })).toBe('git');
    await setLocale('en', { reload: false });
  });
});
