import { describe, expect, test } from 'bun:test';

import { DEV_VERSION, resolveVersion } from '../src/version.ts';

describe('resolveVersion', () => {
  test('falls back to the development version when no build-time define exists', () => {
    expect(resolveVersion()).toBe(DEV_VERSION);
    expect(DEV_VERSION).toBe('0.0.0-dev');
  });
});
