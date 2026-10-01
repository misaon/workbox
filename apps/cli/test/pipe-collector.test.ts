import { describe, expect, test } from 'bun:test';

import { collectOutput } from '../src/process/pipe-collector.ts';

/** A pipe that delivers `text` and then stays open, like one that a grandchild still holds. */
function heldPipe(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller: Readonly<ReadableStreamDefaultController<Uint8Array>>) {
      controller.enqueue(new TextEncoder().encode(text));
    },
  });
}

describe('collectOutput', () => {
  test('cancel keeps what both pipes had delivered while they were still open', async () => {
    const output = collectOutput({ stdout: heldPipe('version 1'), stderr: heldPipe('real error') });
    // Both readers take their chunk and wait for more, as they do while a grandchild runs.
    await Bun.sleep(1);
    output.cancel();
    expect(await output.text).toEqual(['version 1', 'real error']);
  });
});
