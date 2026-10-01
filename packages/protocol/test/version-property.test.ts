import { describe, expect, test } from 'bun:test';

import { assert, bigInt, nat, property, string } from 'fast-check';

import { PROTOCOL_VERSION, protocolMajor } from '../src/version.ts';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

describe('protocolMajor (properties)', () => {
  test('returns the first number of every plain major.minor.patch version', () => {
    assert(
      property(nat({ max: Number.MAX_SAFE_INTEGER }), nat(), nat(), (major, minor, patch) => {
        expect(protocolMajor(`${major}.${minor}.${patch}`)).toBe(major);
      }),
    );
  });

  test('rejects every string that is not three dot-separated digit runs', () => {
    const notAVersion = string().filter((value) => !VERSION_PATTERN.test(value));
    assert(
      property(notAVersion, (value) => {
        expect(() => protocolMajor(value)).toThrow(TypeError);
      }),
    );
  });

  test('rejects a major above the safe-integer range even when the pattern matches', () => {
    const hugeMajor = bigInt({ min: BigInt(Number.MAX_SAFE_INTEGER) + 1n, max: 10n ** 30n }).map(
      (major) => `${major}.0.0`,
    );
    assert(
      property(hugeMajor, (value) => {
        expect(() => protocolMajor(value)).toThrow(TypeError);
      }),
    );
  });

  test('the shipped PROTOCOL_VERSION is itself accepted', () => {
    expect(protocolMajor(PROTOCOL_VERSION)).toBe(Number(PROTOCOL_VERSION.split('.')[0]));
  });
});
