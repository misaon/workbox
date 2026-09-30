import { describe, expect, test } from 'bun:test';

import {
  BUILD_TARGETS,
  buildCommand,
  hostTarget,
  isBuildTarget,
  outfileFor,
} from '../src/build-targets.ts';

// Resolved outside the test body: jest/no-conditional-in-test forbids branching inside a test.
const hostArch = process.arch === 'arm64' ? 'arm64' : 'x64';

describe('build targets', () => {
  test('lists the eight verified Bun targets', () => {
    expect(BUILD_TARGETS.toSorted()).toEqual([
      'bun-darwin-arm64',
      'bun-darwin-x64',
      'bun-linux-arm64',
      'bun-linux-arm64-musl',
      'bun-linux-x64',
      'bun-linux-x64-musl',
      'bun-windows-arm64',
      'bun-windows-x64',
    ]);
  });

  test('isBuildTarget rejects unknown and baseline aliases', () => {
    expect(isBuildTarget('bun-linux-x64')).toBe(true);
    expect(isBuildTarget('bun-linux-x64-baseline')).toBe(false);
    expect(isBuildTarget('linux')).toBe(false);
  });

  test('outfileFor strips the bun prefix and adds .exe on Windows', () => {
    expect(outfileFor('bun-linux-x64-musl')).toBe('dist/workbox-linux-x64-musl');
    expect(outfileFor('bun-windows-arm64')).toBe('dist/workbox-windows-arm64.exe');
  });

  test('buildCommand injects the version define', () => {
    const command = buildCommand('bun-darwin-arm64', '1.2.3', 'src/main.ts');
    expect(command.slice(0, 3)).toEqual(['bun', 'build', 'src/main.ts']);
    expect(command).toContain('--compile');
    expect(command).toContain('--target=bun-darwin-arm64');
    expect(command).toContain('WORKBOX_VERSION="1.2.3"');
    expect(command.at(-1)).toBe('dist/workbox-darwin-arm64');
  });

  test('hostTarget matches the running platform', () => {
    expect(isBuildTarget(hostTarget())).toBe(true);
    expect(hostTarget()).toContain(hostArch);
  });
});
