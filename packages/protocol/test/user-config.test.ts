import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_USER_CONFIG,
  parseUserConfig,
  userConfigJsonSchema,
  type UserConfig,
} from '../src/index.ts';

/** The documented defaults, written by hand so they do not depend on the code under test. */
const EXPECTED_DEFAULTS: UserConfig = {
  locale: 'en',
  notifications: { desktop: true, sound: true },
  office: { renderer: 'webgl' },
  harness: { claude: { pinSystemBinary: false } },
};

/** Parses `input` and fails the test with the parser's own message when the input is rejected. */
function parseOrThrow(input: unknown): UserConfig {
  const result = parseUserConfig(input);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

describe('DEFAULT_USER_CONFIG', () => {
  test('pins the documented defaults', () => {
    expect(DEFAULT_USER_CONFIG).toEqual(EXPECTED_DEFAULTS);
  });

  test('is deeply frozen', () => {
    expect(Object.isFrozen(DEFAULT_USER_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_USER_CONFIG.notifications)).toBe(true);
    expect(Object.isFrozen(DEFAULT_USER_CONFIG.office)).toBe(true);
    expect(Object.isFrozen(DEFAULT_USER_CONFIG.harness)).toBe(true);
    expect(Object.isFrozen(DEFAULT_USER_CONFIG.harness.claude)).toBe(true);
  });
});

describe('parseUserConfig', () => {
  test('fills defaults for an empty object', () => {
    const result = parseUserConfig({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(DEFAULT_USER_CONFIG);
    }
  });

  test('accepts a full config', () => {
    const result = parseUserConfig({
      locale: 'cs',
      notifications: { desktop: false, sound: true },
      office: { renderer: 'webgpu' },
      harness: { claude: { pinSystemBinary: true } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.locale).toBe('cs');
      expect(result.value.office.renderer).toBe('webgpu');
      expect(result.value.harness.claude.pinSystemBinary).toBe(true);
    }
  });

  test('fills the missing leaf of a partial notifications section', () => {
    expect(parseOrThrow({ notifications: { desktop: false } }).notifications).toEqual({
      desktop: false,
      sound: true,
    });
  });

  test('fills the missing leaf of an empty office section', () => {
    expect(parseOrThrow({ office: {} }).office).toEqual({ renderer: 'webgl' });
  });

  test('fills the missing section of an empty harness section', () => {
    expect(parseOrThrow({ harness: {} }).harness).toEqual({ claude: { pinSystemBinary: false } });
  });

  test('fills the missing leaf of an empty harness.claude section', () => {
    expect(parseOrThrow({ harness: { claude: {} } }).harness.claude).toEqual({
      pinSystemBinary: false,
    });
  });

  test('gives every parse its own nested objects', () => {
    const first = parseOrThrow({});
    const second = parseOrThrow({});
    expect(first.notifications).not.toBe(second.notifications);
    expect(first.office).not.toBe(second.office);
    expect(first.harness).not.toBe(second.harness);
    expect(first.harness.claude).not.toBe(second.harness.claude);
    expect(first.harness.claude).not.toBe(DEFAULT_USER_CONFIG.harness.claude);
  });

  test('keeps a mutated result away from later parses and from the defaults', () => {
    const first = parseOrThrow({});
    first.notifications.sound = false;
    first.office.renderer = 'webgpu';
    first.harness.claude.pinSystemBinary = true;
    expect(parseOrThrow({})).toEqual(EXPECTED_DEFAULTS);
    expect(DEFAULT_USER_CONFIG).toEqual(EXPECTED_DEFAULTS);
  });

  test('accepts the $schema key that editors add', () => {
    const result = parseUserConfig({ $schema: 'https://example.invalid/schema.json' });
    expect(result.ok).toBe(true);
  });

  test('rejects a $schema that is not a string', () => {
    expect(parseUserConfig({ $schema: 42 }).ok).toBe(false);
  });

  test('rejects unknown keys and names the key', () => {
    const result = parseUserConfig({ colour: 'blue' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('colour');
    }
  });

  test('reports a nested error under its dotted path', () => {
    expect(parseUserConfig({ office: { renderer: 'canvas' } })).toEqual({
      ok: false,
      message: expect.stringMatching(/^office\.renderer:/),
    });
  });

  test('rejects an unsupported locale', () => {
    const result = parseUserConfig({ locale: 'de' });
    expect(result.ok).toBe(false);
  });

  test('rejects non-objects', () => {
    expect(parseUserConfig('nope').ok).toBe(false);
    expect(parseUserConfig(null).ok).toBe(false);
  });
});

describe('userConfigJsonSchema', () => {
  test('exports a strict draft-07 JSON Schema with the four sections and $schema', () => {
    const schema = userConfigJsonSchema();
    expect(schema['$schema']).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema['additionalProperties']).toBe(false);
    expect(schema['required']).toBeUndefined();
    const properties = schema['properties'] as Record<string, unknown>;
    expect(Object.keys(properties).sort()).toEqual([
      '$schema',
      'harness',
      'locale',
      'notifications',
      'office',
    ]);
    expect(properties['$schema']).toEqual({ type: 'string' });
  });

  test('advertises the same defaults as DEFAULT_USER_CONFIG', () => {
    const schema = userConfigJsonSchema();
    const properties = schema['properties'] as Record<string, { default?: unknown }>;
    expect(properties['locale']?.default).toBe(DEFAULT_USER_CONFIG.locale);
    expect(properties['notifications']?.default).toEqual(DEFAULT_USER_CONFIG.notifications);
    expect(properties['office']?.default).toEqual(DEFAULT_USER_CONFIG.office);
    expect(properties['harness']?.default).toEqual(DEFAULT_USER_CONFIG.harness);
  });
});
