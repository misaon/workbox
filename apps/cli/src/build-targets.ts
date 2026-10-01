import { posix } from 'node:path';

export const BUILD_TARGETS = [
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-linux-x64-musl',
  'bun-linux-arm64-musl',
  'bun-darwin-x64',
  'bun-darwin-arm64',
  'bun-windows-x64',
  'bun-windows-arm64',
] as const;

export type BuildTarget = (typeof BUILD_TARGETS)[number];

export function isBuildTarget(value: string): value is BuildTarget {
  return (BUILD_TARGETS as readonly string[]).includes(value);
}

export function outfileFor(target: BuildTarget): string {
  const suffix = target.startsWith('bun-windows') ? '.exe' : '';
  // POSIX separators on purpose: `bun build --outfile` accepts them on Windows and the tests assert them.
  return posix.join('dist', `workbox-${target.replace(/^bun-/u, '')}${suffix}`);
}

export function buildCommand(target: BuildTarget, version: string, entry: string): string[] {
  return [
    'bun',
    'build',
    entry,
    '--compile',
    '--minify',
    '--sourcemap',
    `--target=${target}`,
    '--define',
    `WORKBOX_VERSION="${version}"`,
    '--outfile',
    outfileFor(target),
  ];
}

/**
 * The `process.platform` values Bun can compile for, as the `<os>` part of a target name. A Map rather
 * than an object literal, so that an inherited key such as `constructor` cannot pass for a platform.
 */
const TARGET_OS_BY_PLATFORM: ReadonlyMap<string, string> = new Map([
  ['darwin', 'darwin'],
  ['linux', 'linux'],
  ['win32', 'windows'],
]);

/** The `process.arch` values Bun can compile for, as the `<arch>` part of a target name. */
const TARGET_ARCH_BY_ARCH: ReadonlyMap<string, string> = new Map([
  ['arm64', 'arm64'],
  ['x64', 'x64'],
]);

/**
 * The Bun target of the machine that runs the build. The parameters default to the running process and
 * exist so that tests can pass other hosts; any host outside darwin, linux and win32 on arm64 or x64 is
 * rejected instead of being mapped to a target that cannot run there.
 */
export function hostTarget(
  platform: string = process.platform,
  arch: string = process.arch,
): BuildTarget {
  const targetOs = TARGET_OS_BY_PLATFORM.get(platform);
  const targetArch = TARGET_ARCH_BY_ARCH.get(arch);
  if (targetOs !== undefined && targetArch !== undefined) {
    const candidate = `bun-${targetOs}-${targetArch}`;
    if (isBuildTarget(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Unsupported host platform ${platform}/${arch}`);
}
