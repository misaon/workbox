import { describe, expect, test } from 'bun:test';

import {
  anything,
  array,
  assert,
  boolean,
  constantFrom,
  double,
  integer,
  oneof,
  property,
  string,
  stringMatching,
  subarray,
} from 'fast-check';

import { DEFAULT_USER_CONFIG, LOCALES, parseUserConfig } from '../src/user-config.ts';
import type { UserConfig } from '../src/user-config.ts';

const topLevelKeys = Object.keys(DEFAULT_USER_CONFIG);

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
    const candidate = oneof(string(), constantFrom(...LOCALES));
    assert(
      property(candidate, (locale) => {
        const result = parseUserConfig({ locale });
        expect(result.ok).toBe((LOCALES as readonly string[]).includes(locale));
      }),
    );
  });
});
