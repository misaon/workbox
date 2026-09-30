import { LOCALES } from '@workbox/protocol';
import type { Locale } from '@workbox/protocol';

export type EnvLike = Readonly<Record<string, string | undefined>>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** `WORKBOX_LOCALE` wins; anything unsupported falls back to English. */
export function resolveLocale(env: EnvLike): Locale {
  const candidate = env['WORKBOX_LOCALE']?.trim().toLowerCase();
  return isLocale(candidate) ? candidate : 'en';
}
