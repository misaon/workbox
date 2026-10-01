/**
 * Reads a command's stdout and stderr to their ends, one reader per pipe, so that the command runner
 * can drain both while the command runs. Reading can be cut short: `cancel` makes each pending read
 * report the end of its stream, so the text is what had arrived by then. The runner relies on that
 * when a grandchild still holds the pipes after the command has ended, and it cancels both readers
 * once a run is over, because a reader still waiting on a pipe would keep the CLI from exiting.
 */

/** A command's two pipes; `Readonly`, so that they can be parameters under the lint rules. */
export interface Pipes {
  readonly stdout: Readonly<ReadableStream<Uint8Array>>;
  readonly stderr: Readonly<ReadableStream<Uint8Array>>;
}

/** Both pipes being read: `text` settles with `[stdout, stderr]`, and `cancel` stops both readers. */
export interface Output {
  readonly text: Readonly<Promise<readonly [string, string]>>;
  readonly cancel: () => void;
}

/** A pipe being read: all the text it delivered, or what had arrived when `cancel` was called. */
interface Collector {
  readonly text: Promise<string>;
  readonly cancel: () => void;
}

/**
 * Reads the stream to its end. `cancel` stops early: the pending read then reports the end of the
 * stream, so `text` is what had arrived by then.
 */
function collect(stream: Readonly<ReadableStream<Uint8Array>>): Collector {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  // One chunk per call, so that no `await` sits in a loop.
  const readRest = async (text: string): Promise<string> => {
    const chunk = await reader.read();
    if (chunk.done) {
      return text + decoder.decode();
    }
    return readRest(text + decoder.decode(chunk.value, { stream: true }));
  };
  const cancelQuietly = async () => {
    try {
      await reader.cancel();
    } catch {
      // A stream that has failed rejects the cancel too; its pending read has rejected `text`.
    }
  };
  return {
    text: readRest(''),
    cancel: () => {
      void cancelQuietly();
    },
  };
}

/**
 * Starts reading both pipes before anything is awaited: a command that fills a pipe nobody reads
 * blocks, so the pipes are drained while it runs.
 */
export function collectOutput(pipes: Pipes): Output {
  const stdout = collect(pipes.stdout);
  const stderr = collect(pipes.stderr);
  return {
    text: Promise.all([stdout.text, stderr.text]),
    cancel: () => {
      stdout.cancel();
      stderr.cancel();
    },
  };
}
