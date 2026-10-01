import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'sink-runner.ts');

/** What the fixture logs, as the JSON Lines formatter renders it. */
const EXPECTED_RECORD = {
  level: 'INFO',
  logger: 'workbox.fixture',
  message: 'sink runner finished',
  properties: { answer: 42 },
};

interface FixtureRun {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs the fixture in its own Bun process, the way the CLI runs: it ends without `resetLogging()`. */
async function runFixture(logFile: string): Promise<FixtureRun> {
  const child = Bun.spawn(['bun', 'run', FIXTURE, logFile], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stdout, stderr };
}

/** Parses JSON Lines text into one value per non-empty line. */
function parseJsonLines(text: string): unknown[] {
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line): unknown => JSON.parse(line));
}

describe('the stderr and file sinks', () => {
  test('keep the record of a process that ends without resetLogging()', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'workbox-sinks-'));
    try {
      const logFile = join(directory, 'workbox.log');
      const { exitCode, stdout, stderr } = await runFixture(logFile);

      expect(exitCode).toBe(0);
      // Product output, including `--json`, lives on stdout, so logging must leave it empty.
      expect(stdout).toBe('');
      const stderrRecords = parseJsonLines(stderr);
      expect(stderrRecords).toHaveLength(1);
      expect(stderrRecords[0]).toMatchObject(EXPECTED_RECORD);

      expect(await Bun.file(logFile).exists()).toBe(true);
      const fileRecords = parseJsonLines(await readFile(logFile, 'utf8'));
      expect(fileRecords).toHaveLength(1);
      expect(fileRecords[0]).toMatchObject(EXPECTED_RECORD);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
