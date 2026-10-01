import { describe, expect, test } from 'bun:test';

import { assert, bigInt, constantFrom, nat, oneof, property, string, tuple } from 'fast-check';

import { PROTOCOL_VERSION, protocolMajor } from '../src/version.ts';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

// Random text is never close to a version, so most of the arbitraries below start from a valid one and
// damage it in exactly one way. That is what lets the rejection property see a pattern that has become
// too lenient, for example one that lost an anchor or accepts an empty or a non-digit segment.
const segments = tuple(nat(), nat(), nat());
const plainVersion = segments.map(
  ([major, minor, patch]: readonly [number, number, number]) => `${major}.${minor}.${patch}`,
);
const junk = string({ minLength: 1 });
const position = constantFrom(0, 1, 2);

/** Joins `parts` with dots after swapping the part at `slot` for `text`. */
function replaceSegment(parts: readonly number[], slot: number, text: string): string {
  return parts.map((part, index) => (index === slot ? text : `${part}`)).join('.');
}

// Something after or before a valid version: 1.2.3-beta, "1.2.3 ", v1.2.3, " 1.2.3".
const suffix = oneof(constantFrom('-beta', '+build', ' ', '\n'), junk);
const prefix = oneof(constantFrom('v', ' ', '\t'), junk);
const withSuffix = tuple(plainVersion, suffix).map(
  ([version, tail]: readonly [string, string]) => `${version}${tail}`,
);
const withPrefix = tuple(prefix, plainVersion).map(
  ([head, version]: readonly [string, string]) => `${head}${version}`,
);

// A segment too many or too few: 1.2.3.4 and 1.2.
const extraSegment = tuple(plainVersion, nat()).map(
  ([version, extra]: readonly [string, number]) => `${version}.${extra}`,
);
const twoSegments = tuple(nat(), nat()).map(
  ([major, minor]: readonly [number, number]) => `${major}.${minor}`,
);

// A segment that is empty (1..3) or has a non-digit inside it (1.2x2.3, 1e1.2.3, 0x0.1.2).
const emptySegment = tuple(segments, position).map(
  ([parts, slot]: readonly [readonly number[], number]) => replaceSegment(parts, slot, ''),
);
const brokenSegment = tuple(nat(), constantFrom('x', 'e', 'a', '_', '+', '-', ' '), nat()).map(
  ([left, char, right]: readonly [number, string, number]) => `${left}${char}${right}`,
);
const nonDigitSegment = tuple(segments, position, brokenSegment).map(
  ([parts, slot, text]: readonly [readonly number[], number, string]) =>
    replaceSegment(parts, slot, text),
);

// Some of these can accidentally be valid (a junk prefix of digits), so the pattern has the last word.
const notAVersion = oneof(
  string(),
  withSuffix,
  withPrefix,
  extraSegment,
  twoSegments,
  emptySegment,
  nonDigitSegment,
).filter((value) => !VERSION_PATTERN.test(value));

describe('protocolMajor (properties)', () => {
  test('returns the first number of every plain major.minor.patch version', () => {
    assert(
      property(nat({ max: Number.MAX_SAFE_INTEGER }), nat(), nat(), (major, minor, patch) => {
        expect(protocolMajor(`${major}.${minor}.${patch}`)).toBe(major);
      }),
    );
  });

  test('rejects every string that is not three dot-separated digit runs', () => {
    // Seven shapes share the runs and a damaged segment only matters in one of three positions, so the
    // default 100 runs would leave some of them with only a few samples.
    assert(
      property(notAVersion, (value) => {
        expect(() => protocolMajor(value)).toThrow(TypeError);
      }),
      { numRuns: 500 },
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
