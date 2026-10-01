import { describe, expect, test } from 'bun:test';

import { resolveLogLevel } from '../src/index.ts';

describe('resolveLogLevel', () => {
  test('defaults to info without flags', () => {
    expect(resolveLogLevel({}, false)).toEqual({ level: 'info', contentLogging: false });
  });

  test('--debug flag switches to debug', () => {
    expect(resolveLogLevel({}, true)).toEqual({ level: 'debug', contentLogging: false });
  });

  test('WORKBOX_DEBUG=1 switches to debug', () => {
    expect(resolveLogLevel({ WORKBOX_DEBUG: '1' }, false)).toEqual({
      level: 'debug',
      contentLogging: false,
    });
  });

  test('WORKBOX_DEBUG=full also allows content logging', () => {
    expect(resolveLogLevel({ WORKBOX_DEBUG: 'full' }, false)).toEqual({
      level: 'debug',
      contentLogging: true,
    });
  });

  test('other values are ignored', () => {
    expect(resolveLogLevel({ WORKBOX_DEBUG: 'yes' }, false)).toEqual({
      level: 'info',
      contentLogging: false,
    });
    expect(resolveLogLevel({ WORKBOX_DEBUG: '0' }, false)).toEqual({
      level: 'info',
      contentLogging: false,
    });
  });
});
