import { describe, expect, test } from 'bun:test';

import { DEFAULT_USER_CONFIG, parseUserConfig, userConfigJsonSchema } from '../src/index.ts';

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

  test('rejects unknown keys with a path in the message', () => {
    const result = parseUserConfig({ colour: 'blue' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('colour');
    }
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
  test('exports draft-07 JSON Schema with all four top-level properties', () => {
    const schema = userConfigJsonSchema();
    expect(schema['$schema']).toBe('http://json-schema.org/draft-07/schema#');
    const properties = schema['properties'] as Record<string, unknown>;
    expect(Object.keys(properties).sort()).toEqual(['harness', 'locale', 'notifications', 'office']);
  });
});
