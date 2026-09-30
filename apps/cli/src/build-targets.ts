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

export function hostTarget(): BuildTarget {
  let os = 'linux';
  if (process.platform === 'darwin') {
    os = 'darwin';
  } else if (process.platform === 'win32') {
    os = 'windows';
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const candidate = `bun-${os}-${arch}`;
  if (!isBuildTarget(candidate)) {
    throw new Error(`Unsupported host platform ${process.platform}/${process.arch}`);
  }
  return candidate;
}
