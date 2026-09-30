/**
 * Fixture for `sinks.test.ts`: logs one record to the real stderr and file sinks and ends. Nothing
 * here calls `resetLogging()`, because the CLI does not either.
 */
import {
  configureLogging,
  createRotatingFileSink,
  createStderrSink,
  getLogger,
} from '../../src/index.ts';

/** `process.argv` starts with the runtime and the script path, so the first script argument is at 2. */
const LOG_FILE_ARGUMENT_INDEX = 2;

const logFile = process.argv[LOG_FILE_ARGUMENT_INDEX];
if (logFile === undefined) {
  throw new Error('Usage: bun run sink-runner.ts <log file>');
}

await configureLogging({
  level: 'debug',
  sinks: {
    stderr: createStderrSink({ pretty: false }),
    file: createRotatingFileSink(logFile),
  },
});

getLogger(['fixture']).info('sink runner finished', { answer: 42 });
