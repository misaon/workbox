import { describe, expect, test } from 'bun:test';

import czechMessages from '../messages/cs.json' with { type: 'json' };
import englishMessages from '../messages/en.json' with { type: 'json' };
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
    try {
      expect(getLocale()).toBe('cs');
      // No per-call locale: the text must come from the global locale.
      expect<string>(m.cli_doctor_title()).toBe('Workbox doktor');
    } finally {
      await setLocale('en', { reload: false });
    }
  });
});

describe('message files', () => {
  test('English and Czech define exactly the same keys', () => {
    expect(Object.keys(czechMessages).toSorted()).toEqual(Object.keys(englishMessages).toSorted());
  });
});
