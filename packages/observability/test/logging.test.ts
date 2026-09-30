import { afterEach, describe, expect, test } from 'bun:test';

import type { LogRecord } from '@logtape/logtape';

import { configureLogging, getLogger, resetLogging } from '../src/index.ts';

const records: LogRecord[] = [];

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Sink must accept LogTape's LogRecord (mutable `properties`, TemplateStringsArray)
function remember(record: LogRecord): void {
  records.push(record);
}

afterEach(async () => {
  records.length = 0;
  await resetLogging();
});

describe('configureLogging', () => {
  test('routes workbox logs to the given sink at or above the level', async () => {
    await configureLogging({ level: 'info', sinks: { memory: remember } });
    const logger = getLogger(['test']);
    logger.debug('hidden');
    logger.info('shown {answer}', { answer: 42 });
    expect(records).toHaveLength(1);
    expect(records[0]?.category).toEqual(['workbox', 'test']);
    expect(records[0]?.properties['answer']).toBe(42);
  });

  test('redacts secret-looking properties', async () => {
    await configureLogging({ level: 'debug', sinks: { memory: remember } });
    getLogger(['test']).info('auth', {
      authorization: 'Bearer abc',
      apiKey: 'sk-123',
      password: 'hunter2',
      token: 't',
      safe: 'visible',
    });
    const properties = records[0]?.properties;
    expect(properties?.['authorization']).toBe('[REDACTED]');
    expect(properties?.['apiKey']).toBe('[REDACTED]');
    expect(properties?.['password']).toBe('[REDACTED]');
    expect(properties?.['token']).toBe('[REDACTED]');
    expect(properties?.['safe']).toBe('visible');
  });
});
