# CLI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CLI's command runner robust against tools that ignore SIGTERM, grandchildren that hold the pipes and spawn failures other than a missing executable, make the doctor report readable for multi-line tool output and observable in debug logs, and make the CLI integration tests independent of the host's `git` and `claude` (issues misaon/workbox#8 and misaon/workbox#4).

**Architecture:** `command-runner.ts` keeps its single `run()` entry point and gains three bounded phases: a SIGTERM at the timeout, a SIGKILL after a grace period, and a bounded drain of the pipes after the command has exited. Readers are explicit `ReadableStream` readers so that a drain timeout can cancel them and keep what was read. The doctor command logs one debug record per check. The CLI integration tests put stub `git` and `claude` executables on a scratch `PATH`; one stub script, configured through an environment variable, serves both tools (shell wrappers on POSIX, a compiled executable on Windows, where `.cmd` shims cannot be spawned without a shell).

**Tech Stack:** Bun 1.4.2 (`Bun.spawn`, `ReadableStream` readers, `bun build --compile` for the Windows stub), `bun:test`, LogTape via `@workbox/observability`.

**Spec:** [2026-09-30-workbox-foundation-vertical-slice-design.md](../specs/2026-09-30-workbox-foundation-vertical-slice-design.md) (CLI and doctor sections) plus issues #8 and #4 and the review notes in PR #1.

**Evidence behind the design (verified 2026-10-01):**

- On Bun 1.4.2 a bare name that is not on `PATH` makes `Bun.spawn` throw with `code: 'ENOENT'` and no `syscall`; an absolute path to a missing file or to a script whose interpreter is missing throws `ENOENT` with `syscall: 'posix_spawn'`; a non-executable file by absolute path throws `EACCES`. Bun skips a non-executable match on `PATH` and runs the next one, so `git` and `claude` by bare name reach `EACCES` only through an explicit path.
- Bun on Windows cannot spawn `.cmd`/`.bat` files without a shell (the same CreateProcess limitation Node hardened in CVE-2024-27980), so Windows stubs must be real executables. `bun build --compile` of a small script with the host target takes a few seconds and needs no download.
- The measured behaviour of the current runner (PR #1 review): a child that ignores SIGTERM or a grandchild holding the pipes keeps `run()` waiting about 3 s past a 300 ms timeout.

## Global Constraints

- Package manager pnpm 12 with `catalog:` (runtime) and `catalog:dev` (tooling); `minimumReleaseAge` 72 h. This plan adds no dependency.
- `pnpm run check` must be green before every commit; type-aware Oxlint with `--deny-warnings`; a suppression is `// oxlint-disable-next-line <rule> -- <reason>`, listed in the report; no rule is turned off; `exactOptionalPropertyTypes` is on; `unicorn/no-null` forbids `null` literals (the codebase names them once, see `NOT_FOUND` in `checks.ts`).
- Tests run with `bun test` in `apps/cli`; no `.only`/`.skip` (`test.skipIf(condition)` is allowed and already used); output pristine; test files kebab-case before `.test.ts`; helpers live in `apps/cli/test/helpers/`, fixtures spawned as processes in `apps/cli/test/fixtures/` (knip treats `test/fixtures/*.ts` as entries only if listed; update `knip.jsonc` for `apps/cli` the way `packages/observability` does).
- CI runs the CLI tests on `ubuntu-26.04`, `macos-26` and `windows-2025`. Every test must pass on all three or be gated with `test.skipIf(process.platform === 'win32')` with a comment saying why.
- English text in code and docs; the `CommandResult.stderr` doc comment must stay true after every change.
- Commits: Conventional Commits, signed off, body lines at most 100 characters, one commit per task.

## Review Focus

- A child that ignores SIGTERM must end within `timeoutMs + killGraceMs` plus scheduling slack, on all three platforms (on Windows the first kill already terminates the process).
- A grandchild that inherited the pipes must not keep `run()` waiting past `drainGraceMs` after the child's exit, and what the child printed before exiting must survive the drain cancel.
- A non-ENOENT spawn failure must surface its message; a plain ENOENT must stay an empty stderr so the report says a localised "not found".
- The Windows stub: compile once per test run, copy to `git.exe` and `claude.exe`, and the CLI child must still find `bun` (spawn it by `process.execPath`, never by name) with `PATH` reduced to the stub directory plus `System32`.
- The report's whitespace collapse must apply to the text report only; `--json` keeps the raw value.

---

### Task 1: Command runner: SIGKILL escalation, bounded pipe drain, spawn-error surfacing

**Files:**
- Modify: `apps/cli/src/process/command-runner.ts`
- Modify: `apps/cli/test/command-runner.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createBunCommandRunner(options?: { timeoutMs?: number; killGraceMs?: number; drainGraceMs?: number })` with defaults `15_000`, `2_000`, `1_000`; `CommandResult` unchanged in shape. `bunCommandRunner` keeps the defaults.

- [ ] **Step 1: Write the failing tests**

Add to `apps/cli/test/command-runner.test.ts` (keep every existing test):

```ts
describe('createBunCommandRunner escalation and drain', () => {
  test('a command that ignores SIGTERM is killed after the grace period', async () => {
    const runner = createBunCommandRunner({ timeoutMs: 200, killGraceMs: 300 });
    const started = performance.now();
    const result = await runner.run([
      'bun',
      '-e',
      'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)',
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toBe('timed out after 200 ms');
    expect(performance.now() - started).toBeLessThan(3000);
  });

  test('a grandchild holding the pipes does not keep the result past the drain grace', async () => {
    const runner = createBunCommandRunner({ timeoutMs: 5000, drainGraceMs: 300 });
    const started = performance.now();
    const result = await runner.run([
      'bun',
      '-e',
      'Bun.spawn(["bun", "-e", "await Bun.sleep(4000)"], { stdout: "inherit", stderr: "inherit" }); process.stderr.write("real error"); process.exit(3)',
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBe('real error');
    expect(performance.now() - started).toBeLessThan(2500);
  });

  test.skipIf(process.platform === 'win32')(
    'a file that exists but is not executable surfaces the spawn error',
    async () => {
      // Windows has no execute bit; its spawn errors for a text file differ and are not part of this contract.
      const dir = await mkdtemp(join(tmpdir(), 'workbox-runner-'));
      const file = join(dir, 'not-executable');
      await writeFile(file, 'plain text');
      const result = await bunCommandRunner.run([file]);
      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain('EACCES');
    },
  );

  test('a missing executable still has an empty stderr', async () => {
    const result = await bunCommandRunner.run(['workbox-no-such-binary-xyz']);
    expect(result).toEqual({ exitCode: 127, stdout: '', stderr: '' });
  });
});
```

Also add, to the existing "with a scripted command" fake-based describe, the two gaps noted in the PR #1 review: (a) a fake whose `kill` throws on the catch path (stderr read rejects) still yields `{ exitCode: 127, stdout: '', stderr: '' }` and does not reject; (b) a fake with `exitCode: null` and `signalCode: 'SIGKILL'` already set when the timer fires is not reported as timed out (`stderr` stays what it printed). Extend the fake factory with a `kill` option and with `signalCode`.

Run `bun test test/command-runner.test.ts`; the new tests fail (the first two by time or text, the EACCES one by empty stderr, the fake ones by missing options).

- [ ] **Step 2: Implement**

In `command-runner.ts`:

1. Options and constants:

```ts
const COMMAND_TIMEOUT_MS = 15_000;
/** After SIGTERM, how long a command may take to end before it is killed outright. */
const KILL_GRACE_MS = 2_000;
/** After the command has ended, how long the runner waits for its pipes to close (a grandchild may hold them). */
const DRAIN_GRACE_MS = 1_000;

export interface CommandRunnerOptions {
  readonly timeoutMs?: number;
  readonly killGraceMs?: number;
  readonly drainGraceMs?: number;
}
```

2. Spawn failure: keep returning exit 127; `stderr` is `''` when the error has `code === 'ENOENT'` (missing executable or missing interpreter, both "not found"), otherwise the error's trimmed `message` (for example `EACCES: permission denied, posix_spawn '/path'`). Implement `spawnCommand` to return either the subprocess or `{ failure: string }` so the caller can distinguish; keep the named-constant style the file already uses.

3. Readers: replace `proc.stdout.text()`/`proc.stderr.text()` with a `collect(stream)` helper built on `stream.getReader()` and a `TextDecoder`, returning `{ text: Promise<string>, cancel(): void }`. `cancel()` calls `reader.cancel()`, which makes the pending `read()` resolve with `done: true`, so `text` resolves with what was read so far. Start both collectors right after the spawn, before awaiting anything (the pipes must be drained while the command runs).

4. Timers: `startTimeout` sends `kill()` at `timeoutMs` (unless the command has ended) and schedules `kill('SIGKILL')` `killGraceMs` later if `exitCode` and `signalCode` are still `null`; `cancel()` clears both timers. After `const exitCode = await proc.exited;`, race `Promise.all([stdout.text, stderr.text])` against a `drainGraceMs` timer; when the timer wins, cancel both collectors and await their `text` promises (they resolve with the partial output). Clear the drain timer in `finally`.

5. The catch around the reads keeps its contract (`stopCommand`, exit 127, empty stderr) and `stopCommand` stays guarded.

6. Update the `CommandResult.stderr` doc comment and the top-of-file comments to describe the three phases (timeout, kill grace, drain grace) and the spawn-failure rule.

Lint will object to some shapes (`max-statements`, `no-await-in-loop` in the collector loop, `unicorn/no-null` for `null` checks against Bun's fields); extract small helpers rather than suppress, and list any suppression you could not avoid.

- [ ] **Step 3: Verify timings and run everything**

`bun test test/command-runner.test.ts` three times in a row to catch timing flakiness; then `pnpm run check`. Record the durations of the escalation and drain tests in the report.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/process/command-runner.ts apps/cli/test/command-runner.test.ts
git commit -s -m "fix(cli): escalate to SIGKILL, bound the pipe drain and surface spawn errors"
```

---

### Task 2: Doctor report readability and per-check debug logs

**Files:**
- Modify: `apps/cli/src/doctor/report.ts`
- Modify: `apps/cli/src/commands/doctor.ts`
- Modify: `apps/cli/test/report.test.ts`
- Modify: `apps/cli/test/cli.test.ts` (one assertion in the existing `--debug` test; Task 3 rewrites this file and must keep the assertion)

**Interfaces:**
- Consumes: `CheckResult`, `CheckDetail` from `checks.ts`; the logger from `configureCliLogging`/`getLogger(['cli', 'doctor'])`.
- Produces: text report lines are always single lines; debug records `doctor check {id}: {status} ({code})`.

- [ ] **Step 1: Failing tests**

In `report.test.ts`, under the `detail texts` describe, add a test where a `not-found` detail's value is `'xcode-select: note: No developer tools were found.\nIf developer tools are located at a non-default location on disk, use …'` and assert that the English line is `✗ git: not found: xcode-select: note: No developer tools were found. If developer tools are located at a non-default location on disk, use …` (one line, newline and surrounding spaces collapsed to one space) and the Czech line uses `nenalezeno:` the same way. In `cli.test.ts`'s `doctor --json --debug` test, assert that the log file contains `doctor check git` and `doctor check workbox-home: ok (path)`.

- [ ] **Step 2: Implement**

In `report.ts`, when `not-found` has a value, print `collapseWhitespace(detail.value)` where `collapseWhitespace = (text: string) => text.replaceAll(/\s+/gu, ' ').trim()`; `--json` is untouched because `detailText` is only used for the text report. In `commands/doctor.ts`, after `runDoctor` returns, log one debug record per check: `logger.debug('doctor check {id}: {status} ({code})', { id: check.id, status: check.status, code: check.detail.code, value: check.detail.value })` (`value` may be `undefined`; LogTape drops undefined properties). Keep the existing `running doctor checks` and `doctor finished {ok}` records.

- [ ] **Step 3: Check and commit**

`pnpm run check` green, then:

```bash
git add apps/cli/src/doctor/report.ts apps/cli/src/commands/doctor.ts apps/cli/test/report.test.ts apps/cli/test/cli.test.ts
git commit -s -m "fix(cli): keep doctor lines single-line and log every check at debug level"
```

---

### Task 3: Host-independent CLI integration tests

**Files:**
- Create: `apps/cli/test/fixtures/stub-tool.ts`
- Create: `apps/cli/test/helpers/stub-tools.ts`
- Modify: `apps/cli/test/cli.test.ts`
- Modify: `knip.jsonc` (`apps/cli` workspace: add `"test/fixtures/*.ts"` to `entry`, with the same comment style as `packages/observability`)
- Modify: `.ls-lint.yml` only if the new directories need a rule (they are kebab-case already)

**Interfaces:**
- Consumes: the CLI entry `apps/cli/src/main.ts` run through `process.execPath`.
- Produces: `createStubTools(spec: StubSpec): Promise<StubTools>` where `StubSpec = Readonly<Record<string, Readonly<Record<string, StubBehaviour>>>>` maps a tool name to a map from its first argument (or `'*'`) to `{ exit?: number; stdout?: string; stderr?: string }`; `StubTools = { readonly dir: string; readonly env: Readonly<Record<string, string>>; cleanup(): Promise<void> }` with `env.PATH` set to the stub directory (plus `%SystemRoot%\System32` on Windows) and `env.WORKBOX_STUB_SPEC` set to the JSON spec.

- [ ] **Step 1: The stub**

`apps/cli/test/fixtures/stub-tool.ts`: determines its tool name from `process.argv[2]` when started through the POSIX wrapper (`stub-tool.ts <tool> <args…>`) or from `basename(process.execPath, '.exe')` when it runs as a compiled executable; reads `WORKBOX_STUB_SPEC`; picks `spec[tool][args[0]] ?? spec[tool]['*']`; writes `stdout`/`stderr` verbatim; exits with `exit` (default 0). When the spec has no entry for the tool, writes `stub: no behaviour for <tool> <args>` to stderr and exits 2, so a wrong test setup is visible.

- [ ] **Step 2: The helper**

`apps/cli/test/helpers/stub-tools.ts`: `mkdtemp` a directory; for every tool in the spec, on POSIX write `#!/bin/sh\nexec "<process.execPath>" "<absolute stub-tool.ts>" <tool> "$@"\n` and `chmod 0o755`; on Windows compile the stub once per test process (`Bun.spawn([process.execPath, 'build', '--compile', '--target=<hostTarget()>', '--outfile', '<dir>/stub.exe', '<stub-tool.ts>'])`, memoised in a module-level promise) and copy it to `<tool>.exe`. Build `env` as described in Interfaces. `cleanup()` removes the directory (`rm(dir, { recursive: true, force: true })`).

- [ ] **Step 3: Rewrite `cli.test.ts`**

Keep `--version`, the unwritable-home test and the `--debug` test (with Task 2's assertion), but spawn the CLI through `process.execPath` and pass `env: { ...process.env, ...stub.env, ...overrides }`. Add:

- all-green stubs (`git --version` → `git version 2.50.0`; `claude --version` → `2.1.285 (Claude Code)`; `claude auth status` → `{"loggedIn":true,"configDirectory":"/home/user/.claude"}`): `--json` shows `version` details `2.50.0` and `2.1.285`, `logged-in` with the directory, `ok: true`, exit 0; the Czech text report has the exact lines `✓ git: 2.50.0`, `✓ binárka Claude Code: 2.1.285`, `✓ přihlášení Claude Code: /home/user/.claude` and `Prošlo 4 z 4 kontrol`.
- empty spec (no tools on PATH): exit 1; `git` `fail`/`not-found` without value, `claude-binary` `warn`, `claude-login` `skipped-no-binary`; the English report ends with the install hint.
- broken git (`exit 1`, stderr `xcrun: error: invalid active developer path`): Czech report contains `✗ git: nenalezeno: xcrun: error: invalid active developer path`.
- claude installed but not logged in (`auth status` exit 1): English report shows `not logged in` and the login hint.

Every test creates its stubs in `beforeAll`/`afterAll` or per test and always cleans up.

- [ ] **Step 4: Check and commit**

`bun test` in `apps/cli` (all green, no host tool involved: prove it by running once with `PATH` set to an empty directory for the test process itself), `pnpm run check`, then:

```bash
git add apps/cli/test/fixtures/stub-tool.ts apps/cli/test/helpers/stub-tools.ts apps/cli/test/cli.test.ts knip.jsonc
git commit -s -m "test(cli): run the CLI integration tests against stub git and claude"
```
