export type LogLevel = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export type EnvLike = Readonly<Record<string, string | undefined>>;

export interface ResolvedLogLevel {
  readonly level: LogLevel;
  readonly contentLogging: boolean;
}

/** `--debug` or `WORKBOX_DEBUG=1` enable debug logs; `WORKBOX_DEBUG=full` additionally allows prompt and tool content. */
export function resolveLogLevel(env: EnvLike, debugFlag: boolean): ResolvedLogLevel {
  const raw = env['WORKBOX_DEBUG']?.trim().toLowerCase();
  const contentLogging = raw === 'full';
  const debug = debugFlag || raw === '1' || contentLogging;
  return { level: debug ? 'debug' : 'info', contentLogging };
}
