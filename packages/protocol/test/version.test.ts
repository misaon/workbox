import { describe, expect, test } from 'bun:test';

import { PROTOCOL_VERSION, protocolMajor } from '../src/index.ts';

describe('PROTOCOL_VERSION', () => {
  test('is a semver string', () => {
    expect(PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  test('protocolMajor extracts the major number', () => {
    expect(protocolMajor('3.14.1')).toBe(3);
    expect(protocolMajor(PROTOCOL_VERSION)).toBe(Number(PROTOCOL_VERSION.split('.')[0]));
  });
});

describe('protocolMajor', () => {
  // Each input used to be coerced by Number() (for example '' to 0 and '0x10.0.0' to 16) or
  // rounded silently (the last one is 2 ** 53 + 1), so none of them may come back as a number.
  test.each([
    '',
    'abc',
    '-1.0.0',
    '1',
    '1.0',
    '0x10.0.0',
    '1e2.0.0',
    ' 3.0.0',
    '9007199254740993.0.0',
  ])('throws for the invalid version %j', (version) => {
    expect(() => protocolMajor(version)).toThrow(`Invalid protocol version "${version}"`);
  });
});
