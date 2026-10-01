import { configure, getLogger as getLogTapeLogger, reset } from '@logtape/logtape';
import type { Logger, Sink } from '@logtape/logtape';
import { DEFAULT_REDACT_FIELDS, redactByField } from '@logtape/redaction';

import type { LogLevel } from './log-level.ts';

const ROOT_CATEGORY = 'workbox';
const REDACTED = '[REDACTED]';
const EXTRA_REDACT_FIELDS: readonly RegExp[] = [
  /authorization/iu,
  /api[-_]?key/iu,
  /secret/iu,
  /password/iu,
  /token/iu,
];

export interface LoggingOptions {
  readonly level: LogLevel;
  readonly sinks: Readonly<Record<string, Sink>>;
}

export async function configureLogging(options: LoggingOptions): Promise<void> {
  const redactedSinks = Object.fromEntries(
    Object.entries(options.sinks).map(([name, sink]: readonly [string, Sink]) => [
      name,
      redactByField(sink, {
        fieldPatterns: [...DEFAULT_REDACT_FIELDS, ...EXTRA_REDACT_FIELDS],
        action: () => REDACTED,
      }),
    ]),
  );
  const sinkNames = Object.keys(redactedSinks);
  await configure({
    reset: true,
    sinks: redactedSinks,
    loggers: [
      { category: [ROOT_CATEGORY], lowestLevel: options.level, sinks: sinkNames },
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: sinkNames },
    ],
  });
}

export async function resetLogging(): Promise<void> {
  await reset();
}

export function getLogger(category: readonly string[]): Logger {
  return getLogTapeLogger([ROOT_CATEGORY, ...category]);
}

export type { Logger, LogRecord, Sink } from '@logtape/logtape';
