import { describe, expect, test } from 'bun:test';

import { PROTOCOL_VERSION, protocolMajor } from '../src/index.ts';

describe('PROTOCOL_VERSION', () => {
  test('is a semver string', () => {
    expect(PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('protocolMajor extracts the major number', () => {
    expect(protocolMajor('3.14.1')).toBe(3);
    expect(protocolMajor(PROTOCOL_VERSION)).toBe(Number(PROTOCOL_VERSION.split('.')[0]));
  });
});
