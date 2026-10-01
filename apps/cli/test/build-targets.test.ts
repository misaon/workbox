import { describe, expect, test } from 'bun:test';

import {
  BUILD_TARGETS,
  buildCommand,
  hostTarget,
  isBuildTarget,
  outfileFor,
} from '../src/build-targets.ts';
import type { BuildTarget } from '../src/build-targets.ts';

/**
 * The release pipeline globs these names, so they are spelled out instead of derived: the two Windows
 * targets get `.exe`, nothing else does.
 */
const EXPECTED_OUTFILES: Readonly<Record<BuildTarget, string>> = {
  'bun-linux-x64': 'dist/workbox-linux-x64',
  'bun-linux-arm64': 'dist/workbox-linux-arm64',
  'bun-linux-x64-musl': 'dist/workbox-linux-x64-musl',
  'bun-linux-arm64-musl': 'dist/workbox-linux-arm64-musl',
  'bun-darwin-x64': 'dist/workbox-darwin-x64',
  'bun-darwin-arm64': 'dist/workbox-darwin-arm64',
  'bun-windows-x64': 'dist/workbox-windows-x64.exe',
  'bun-windows-arm64': 'dist/workbox-windows-arm64.exe',
};

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

  // Bun types `each` for a flat table as a mutable array, so the readonly tuple is copied.
  test.each([...BUILD_TARGETS])('outfileFor(%s) is the exact release file name', (target) => {
    expect(outfileFor(target)).toBe(EXPECTED_OUTFILES[target]);
  });

  test('buildCommand is the complete bun invocation, version define included', () => {
    expect(buildCommand('bun-darwin-arm64', '1.2.3', 'src/main.ts')).toEqual([
      'bun',
      'build',
      'src/main.ts',
      '--compile',
      '--minify',
      '--sourcemap',
      '--target=bun-darwin-arm64',
      '--define',
      'WORKBOX_VERSION="1.2.3"',
      '--outfile',
      'dist/workbox-darwin-arm64',
    ]);
  });
});

describe('hostTarget', () => {
  test.each<[string, string, BuildTarget]>([
    ['darwin', 'arm64', 'bun-darwin-arm64'],
    ['linux', 'x64', 'bun-linux-x64'],
    ['win32', 'arm64', 'bun-windows-arm64'],
  ])('maps %s/%s to %s', (platform, arch, expected) => {
    expect(hostTarget(platform, arch)).toBe(expected);
  });

  test.each<[string, string]>([
    ['freebsd', 'x64'],
    ['linux', 'riscv64'],
    ['linux', 'ia32'],
  ])('rejects %s/%s as an unsupported host', (platform, arch) => {
    expect(() => hostTarget(platform, arch)).toThrow(
      `Unsupported host platform ${platform}/${arch}`,
    );
  });

  test('without arguments it returns a valid target for the running host', () => {
    expect(isBuildTarget(hostTarget())).toBe(true);
  });
});
