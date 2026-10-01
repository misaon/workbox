import { getRotatingFileSink } from '@logtape/file';
import { ansiColorFormatter, jsonLinesFormatter } from '@logtape/logtape';
import type { Sink } from '@logtape/logtape';

/** The active log file rotates before it would grow past 5 MiB (5 * 1024 * 1024 bytes). */
const MAX_LOG_FILE_BYTES = 5_242_880;
/** How many rotated copies are kept next to the active log file. */
const MAX_LOG_FILES = 5;
/**
 * Zero turns LogTape's write buffer off, so every record is written (and synced) as it is logged.
 * LogTape flushes a buffered file sink on dispose, once 8 KiB has accumulated, or on the first
 * record 5 s after the last flush; with the async `configure()` exit hook a short CLI run ends
 * before any of those, so the sink is unbuffered. A buffer would also lose its tail in a crash.
 */
const LOG_BUFFER_BYTES = 0;

export interface StderrSinkOptions {
  readonly pretty: boolean;
}

/** Logs must never touch stdout: product output (including `--json`) lives there. */
export function createStderrSink(options: StderrSinkOptions): Sink {
  const format = options.pretty ? ansiColorFormatter : jsonLinesFormatter;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Sink must accept LogTape's LogRecord (mutable `properties`, TemplateStringsArray) and hand it back to LogTape's formatter
  return (record) => {
    process.stderr.write(format(record));
  };
}

export function createRotatingFileSink(path: string): Sink {
  return getRotatingFileSink(path, {
    maxSize: MAX_LOG_FILE_BYTES,
    maxFiles: MAX_LOG_FILES,
    bufferSize: LOG_BUFFER_BYTES,
    formatter: jsonLinesFormatter,
  });
}
