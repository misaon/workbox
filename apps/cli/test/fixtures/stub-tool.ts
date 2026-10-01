/**
 * Fixture for `cli.test.ts`: a stand-in for a tool that `workbox doctor` runs, such as `git` or
 * `claude`. `WORKBOX_STUB_SPEC` holds a `StubSpec` (see `../helpers/stub-tools.ts`) as JSON, and
 * the behaviour that it gives this tool for the first argument of the call, or for `'*'`, says
 * what to write on stdout and stderr, verbatim, and the exit code (0 when left out). A call that
 * the spec does not cover says so on stderr and exits 2, so that a wrong test setup shows instead
 * of passing for a missing tool.
 *
 * The stub runs in one of two forms, and in both the arguments of the call start at
 * `process.argv[2]`:
 * - On POSIX, the `#!/bin/sh` wrapper that the helper writes as `<tool>` runs
 *   `<bun> stub-tool.ts <tool> <args…>`, so the tool name comes first.
 * - On Windows, where Bun cannot spawn a script without a shell, the helper compiles this file
 *   with `bun build --compile` and copies it to `<tool>.exe`, so the tool name is the name of the
 *   executable itself.
 */
import { basename } from 'node:path';

/** `process.argv` starts with the runtime and the script, and a compiled stub has both too. */
const FIRST_ARGUMENT_INDEX = 2;
/** The exit code of a behaviour that leaves it out. */
const EXIT_CODE_SUCCESS = 0;
/** The exit code of a call that the spec does not cover: a wrong test setup, not a tool failure. */
const EXIT_CODE_NO_BEHAVIOUR = 2;
/** The key of the behaviour for any first argument that has none of its own. */
const ANY_ARGUMENT = '*';

/** A JSON object, as `JSON.parse` returns it. */
type JsonObject = Readonly<Record<string, unknown>>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The object's own property `key`, never an inherited one such as `constructor`. */
function ownProperty(object: JsonObject, key: string | undefined): unknown {
  return key !== undefined && Object.hasOwn(object, key) ? object[key] : undefined;
}

/** What the spec gives `tool` for `firstArgument`, or for any first argument. */
function findBehaviour(tool: string, firstArgument: string | undefined): JsonObject | undefined {
  const spec: unknown = JSON.parse(process.env['WORKBOX_STUB_SPEC'] ?? '{}');
  const byArgument = isJsonObject(spec) ? ownProperty(spec, tool) : undefined;
  const behaviour = isJsonObject(byArgument)
    ? (ownProperty(byArgument, firstArgument) ?? ownProperty(byArgument, ANY_ARGUMENT))
    : undefined;
  return isJsonObject(behaviour) ? behaviour : undefined;
}

/** What the behaviour writes on `stream`: nothing when it leaves the stream out. */
function outputOf(behaviour: JsonObject, stream: 'stdout' | 'stderr'): string {
  const text = ownProperty(behaviour, stream);
  return typeof text === 'string' ? text : '';
}

function exitCodeOf(behaviour: JsonObject): number {
  const code = ownProperty(behaviour, 'exit');
  return typeof code === 'number' ? code : EXIT_CODE_SUCCESS;
}

const callArguments = process.argv.slice(FIRST_ARGUMENT_INDEX);
const [tool = '', ...args] = Bun.isStandaloneExecutable
  ? [basename(process.execPath, '.exe'), ...callArguments]
  : callArguments;
const [firstArgument] = args;
const behaviour = findBehaviour(tool, firstArgument);
// The exit code is set rather than passed to `process.exit()`, so that both writes reach the pipes.
if (behaviour === undefined) {
  process.stderr.write(`stub: no behaviour for ${[tool, ...args].join(' ')}\n`);
  process.exitCode = EXIT_CODE_NO_BEHAVIOUR;
} else {
  process.stdout.write(outputOf(behaviour, 'stdout'));
  process.stderr.write(outputOf(behaviour, 'stderr'));
  process.exitCode = exitCodeOf(behaviour);
}
