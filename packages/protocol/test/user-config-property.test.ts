import { describe, expect, test } from 'bun:test';

import {
  anything,
  array,
  assert,
  boolean,
  constantFrom,
  double,
  integer,
  mixedCase,
  oneof,
  property,
  string,
  stringMatching,
  subarray,
  tuple,
} from 'fast-check';

import { DEFAULT_USER_CONFIG, LOCALES, parseUserConfig } from '../src/user-config.ts';
import type { UserConfig } from '../src/user-config.ts';

const topLevelKeys = Object.keys(DEFAULT_USER_CONFIG);

// The schema is exact, so apart from the plain spelling of a locale none of these is accepted. Other
// letter case (EN, cS) and whitespace around a supported locale are the near-misses that a schema which
// lowercases or trims before the enum would let through.
const supported = constantFrom(...LOCALES);
const whitespace = string({ unit: constantFrom(' ', '\t', '\n'), maxLength: 3 });
const padding = tuple(whitespace, whitespace);
const caseVariant = mixedCase(supported);
const padded = tuple(supported, padding).map(
  ([locale, [before, after]]: readonly [string, readonly [string, string]]) =>
    `${before}${locale}${after}`,
);
const localeCandidate = oneof(string(), supported, caseVariant, padded);

/** Parses `input` and fails the property with the parser's own message when the input is rejected. */
function parseOrThrow(input: unknown): UserConfig {
  const result = parseUserConfig(input);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

/** Parses `input` and fails the property when the input is accepted; returns the rejection message. */
function rejectionOf(input: unknown): string {
  const result = parseUserConfig(input);
  if (result.ok) {
    throw new Error('Expected the config to be rejected, but it was accepted');
  }
  return result.message;
}

describe('parseUserConfig (properties)', () => {
  test('omitting any subset of sections still yields the full defaults', () => {
    assert(
      property(subarray(topLevelKeys), (omitted: readonly string[]) => {
        const input: Record<string, unknown> = structuredClone(DEFAULT_USER_CONFIG);
        for (const key of omitted) {
          delete input[key];
        }
        const value = parseOrThrow(input);
        expect(value).toEqual(DEFAULT_USER_CONFIG);
        expect(value).not.toBe(DEFAULT_USER_CONFIG);
      }),
    );
  });

  test('every non-object input is rejected with a non-empty message', () => {
    const notAnObject = oneof(
      string(),
      integer(),
      double(),
      boolean(),
      // oxlint-disable-next-line unicorn/no-null -- null is one of the non-object inputs under test
      constantFrom(undefined, null),
      array(anything()),
    );
    assert(
      property(notAnObject, (input: unknown) => {
        expect(rejectionOf(input).length).toBeGreaterThan(0);
      }),
    );
  });

  test('an unknown top-level key is rejected and named in the message', () => {
    const unknownKey = stringMatching(/^[a-z][a-zA-Z0-9]{0,15}$/u).filter(
      (key) => !topLevelKeys.includes(key),
    );
    assert(
      property(unknownKey, (key) => {
        const message = rejectionOf({ ...structuredClone(DEFAULT_USER_CONFIG), [key]: 1 });
        expect(message).toContain(key);
      }),
    );
  });

  test('a locale is accepted exactly when it is one of LOCALES', () => {
    assert(
      property(localeCandidate, (locale) => {
        const result = parseUserConfig({ locale });
        expect(result.ok).toBe((LOCALES as readonly string[]).includes(locale));
      }),
    );
  });
});
