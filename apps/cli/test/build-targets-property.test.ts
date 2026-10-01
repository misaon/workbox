import { describe, expect, test } from 'bun:test';

import { assert, constantFrom, oneof, property, string, stringMatching, tuple } from 'fast-check';

import {
  BUILD_TARGETS,
  buildCommand,
  hostTarget,
  isBuildTarget,
  outfileFor,
} from '../src/build-targets.ts';

const target = constantFrom(...BUILD_TARGETS);
const SUPPORTED_PLATFORMS = ['darwin', 'linux', 'win32'] as const;
const SUPPORTED_ARCHES = ['arm64', 'x64'] as const;

/** The hosts `hostTarget` must map, listed here so the property does not lean on its own tables. */
function isSupportedHost(platform: string, arch: string): boolean {
  return (
    (SUPPORTED_PLATFORMS as readonly string[]).includes(platform) &&
    (SUPPORTED_ARCHES as readonly string[]).includes(arch)
  );
}

describe('build targets (properties)', () => {
  test('isBuildTarget is exactly membership in BUILD_TARGETS', () => {
    const candidate = oneof(string(), target);
    assert(
      property(candidate, (value) => {
        expect(isBuildTarget(value)).toBe((BUILD_TARGETS as readonly string[]).includes(value));
      }),
    );
  });

  test('every outfile lives in dist, carries the target name and ends with .exe only on Windows', () => {
    assert(
      property(target, (value) => {
        const outfile = outfileFor(value);
        expect(outfile.startsWith(`dist/workbox-${value.replace(/^bun-/u, '')}`)).toBe(true);
        expect(outfile.endsWith('.exe')).toBe(value.startsWith('bun-windows'));
      }),
    );
  });

  test('buildCommand always targets the given triple, defines the version verbatim and writes the outfile', () => {
    const version = stringMatching(/^[0-9A-Za-z.+-]{1,40}$/u);
    const entryPoint = constantFrom('src/main.ts', 'src/other.ts');
    assert(
      property(target, version, entryPoint, (value, ver, entry) => {
        const command = buildCommand(value, ver, entry);
        expect(command).toContain(`--target=${value}`);
        expect(command).toContain(`WORKBOX_VERSION="${ver}"`);
        expect(command.slice(-2)).toEqual(['--outfile', outfileFor(value)]);
        expect(command[2]).toBe(entry);
      }),
    );
  });

  test('hostTarget maps every supported platform/arch pair and rejects everything else', () => {
    const supportedPair = tuple(
      constantFrom(...SUPPORTED_PLATFORMS),
      constantFrom(...SUPPORTED_ARCHES),
    );
    const unsupportedPair = tuple(string(), string()).filter(
      ([platform, arch]: readonly [string, string]) => !isSupportedHost(platform, arch),
    );
    assert(
      property(supportedPair, ([platform, arch]: readonly [string, string]) => {
        expect(isBuildTarget(hostTarget(platform, arch))).toBe(true);
      }),
    );
    assert(
      property(unsupportedPair, ([platform, arch]: readonly [string, string]) => {
        expect(() => hostTarget(platform, arch)).toThrow(/Unsupported host platform/u);
      }),
    );
  });
});
