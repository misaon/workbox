import { describe, expect, test } from 'bun:test';

import { isLocale, resolveLocale } from '../src/index.ts';

describe('resolveLocale', () => {
  test('uses WORKBOX_LOCALE when supported', () => {
    expect(resolveLocale({ WORKBOX_LOCALE: 'cs' })).toBe('cs');
    expect(resolveLocale({ WORKBOX_LOCALE: 'EN' })).toBe('en');
  });

  test('falls back to English for missing or unsupported values', () => {
    expect(resolveLocale({})).toBe('en');
    expect(resolveLocale({ WORKBOX_LOCALE: 'de' })).toBe('en');
    expect(resolveLocale({ WORKBOX_LOCALE: '' })).toBe('en');
  });
});

describe('isLocale', () => {
  test('accepts only the supported locales', () => {
    expect(isLocale('cs')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(1)).toBe(false);
  });
});
