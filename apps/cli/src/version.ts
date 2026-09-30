declare const WORKBOX_VERSION: string | undefined;

export const DEV_VERSION = '0.0.0-dev';

/** `bun build --define WORKBOX_VERSION='"x.y.z"'` injects the release version; `bun run` has no define. */
export function resolveVersion(): string {
  return typeof WORKBOX_VERSION === 'string' && WORKBOX_VERSION !== ''
    ? WORKBOX_VERSION
    : DEV_VERSION;
}
