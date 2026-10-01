import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  configureLogging,
  createRotatingFileSink,
  createStderrSink,
  getLogger,
  resolveLogLevel,
} from '@workbox/observability';
import type { EnvLike, Sink } from '@workbox/observability';

export interface CliLoggingOptions {
  readonly debug: boolean;
  readonly env: EnvLike;
  readonly home: string;
}

/** The rotating debug log, or the reason it could not be opened: an unwritable home must never stop a command. */
async function openDebugFileSink(home: string): Promise<Sink | Error> {
  try {
    const logsDir = join(home, 'logs');
    await mkdir(logsDir, { recursive: true });
    return createRotatingFileSink(join(logsDir, 'workbox.log'));
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/** Stderr always; a rotating JSONL file under WORKBOX_HOME/logs only in debug mode, and never fatally. */
export async function configureCliLogging(options: CliLoggingOptions): Promise<void> {
  const { level } = resolveLogLevel(options.env, options.debug);
  // oxlint-disable-next-line typescript/no-unnecessary-type-conversion -- @types/node types `isTTY` as boolean, but it is undefined when stderr is not a terminal
  const pretty = Boolean(process.stderr.isTTY);
  const sinks: Record<string, Sink> = { stderr: createStderrSink({ pretty }) };
  const fileSink = level === 'debug' ? await openDebugFileSink(options.home) : undefined;
  if (fileSink !== undefined && !(fileSink instanceof Error)) {
    sinks['file'] = fileSink;
  }
  await configureLogging({ level, sinks });
  if (fileSink instanceof Error) {
    getLogger(['cli']).warning('debug log file disabled: {reason}', { reason: fileSink.message });
  }
}
