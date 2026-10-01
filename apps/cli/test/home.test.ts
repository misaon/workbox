import { describe, expect, test } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { resolveWorkboxHome } from '../src/home.ts';

describe('resolveWorkboxHome', () => {
  test('defaults to ~/.workbox', () => {
    expect(resolveWorkboxHome({})).toBe(join(homedir(), '.workbox'));
  });

  test('honours WORKBOX_HOME', () => {
    expect(resolveWorkboxHome({ WORKBOX_HOME: '/tmp/wb' })).toBe('/tmp/wb');
  });

  test('ignores an empty WORKBOX_HOME', () => {
    expect(resolveWorkboxHome({ WORKBOX_HOME: '   ' })).toBe(join(homedir(), '.workbox'));
  });
});
