import { describe, expect, test } from 'bun:test';

import { LOCALES } from '@workbox/protocol';
import {
  anything,
  array,
  assert,
  boolean,
  constantFrom,
  option,
  property,
  string,
  tuple,
} from 'fast-check';

import { isLocale, resolveLocale } from '../src/locale.ts';

const supported = constantFrom(...LOCALES);
const whitespace = string({ unit: constantFrom(' ', '\t', '\n'), maxLength: 3 });
const padding = tuple(whitespace, whitespace);
const casing = array(boolean(), { minLength: 2, maxLength: 2 });
const workboxLocaleValue = option(string(), { nil: undefined });

function withCasing(locale: string, upper: readonly boolean[]): string {
  return Array.from(locale, (char, index) =>
    upper[index] === true ? char.toUpperCase() : char.toLowerCase(),
  ).join('');
}

/**
 * Membership in LOCALES, spelled out on its own so that neither the `isLocale` property nor the filter
 * of the fallback property depends on the code under test.
 */
function isListedLocale(value: unknown): boolean {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

describe('resolveLocale (properties)', () => {
  test('always returns a supported locale, whatever WORKBOX_LOCALE holds', () => {
    assert(
      property(workboxLocaleValue, (value) => {
        expect(isLocale(resolveLocale({ WORKBOX_LOCALE: value }))).toBe(true);
      }),
    );
  });

  test('ignores surrounding whitespace and letter case of a supported locale', () => {
    assert(
      property(
        supported,
        padding,
        casing,
        (locale, [before, after]: readonly [string, string], upper: readonly boolean[]) => {
          const env = { WORKBOX_LOCALE: `${before}${withCasing(locale, upper)}${after}` };
          expect(resolveLocale(env)).toBe(locale);
        },
      ),
    );
  });

  test('falls back to English for every unsupported value', () => {
    // The filter must not ask isLocale: if isLocale accepted every string, no value would pass the
    // filter and fast-check would loop forever instead of failing the property.
    const unsupported = string().filter((value) => !isListedLocale(value.trim().toLowerCase()));
    assert(
      property(unsupported, (value) => {
        expect(resolveLocale({ WORKBOX_LOCALE: value })).toBe('en');
      }),
    );
  });
});

describe('isLocale (properties)', () => {
  test('accepts exactly the strings in LOCALES', () => {
    assert(
      property(anything(), (value) => {
        expect(isLocale(value)).toBe(isListedLocale(value));
      }),
    );
  });
});
