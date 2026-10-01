# Daemon Core with the Fake Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running `workbox` daemon that registers projects, creates sessions in git worktrees, drives a harness through the `HarnessAdapter` port, records everything in an append-only SQLite event log and serves it over a typed, token-protected HTTP and WebSocket protocol on localhost, exercised end to end with a scriptable fake harness and the CLI, with no web UI yet.

**Architecture:** `protocol` gains the event catalogue, the command and frame schemas, the session state machine and the pure projections that every client shares. `core` holds the domain, the ports (`EventStore`, `HarnessAdapter`, `SandboxProvider`), one `SessionRuntime` actor per session and the `Workbox` application service, with no Bun or DOM API. `store-sqlite` implements `EventStore` over `bun:sqlite` with embedded, versioned SQL migrations, materialised projection tables and an FTS5 index. `harness-fake` replays JSON scenarios through the port. `sandbox-host` prepares git worktrees and spawns host processes with an env allowlist. `server` exposes `Bun.serve` routes, the one-time-token exchange, WebSocket tickets and the frame protocol with per-project pub/sub. `apps/cli` is the only composition root: daemon lifecycle (`workbox`, `serve`, `status`, `stop`), `project` and `session` commands, config loading and recovery after a crash.

**Tech Stack:** Bun 1.4.2 (`bun:sqlite` with SQLite 3.54 and FTS5, `Bun.serve` routes and WebSocket pub/sub, `Bun.spawn`), Zod 4.6, citty 0.2, `open` 11.0.4, LogTape 2.3 via `@workbox/observability`, `bun test`.

**Spec:** [2026-09-30-workbox-foundation-vertical-slice-design.md](../specs/2026-09-30-workbox-foundation-vertical-slice-design.md), sections 4 to 7 and 10. ADRs 0002, 0003 and 0010 bind; this plan amends ADR 0003 (storage access) and adds ADR 0012 (localhost protocol).

**Evidence behind the design (verified 2026-10-01):**

- `bun:sqlite` on this Mac reports SQLite 3.54.0 and creates and queries an `fts5` virtual table; Bun's static SQLite, used on Linux and Windows by default, is compiled with `SQLITE_ENABLE_FTS5`, `SQLITE_ENABLE_JSON1` and `SQLITE_ENABLE_RTREE` (`scripts/build/deps/sqlite.ts` in oven-sh/bun). FTS5 is therefore available on every CI runner; Task 5 asserts it at store start-up instead of carrying the LIKE fallback the spec reserved.
- `bun:sqlite`'s API: `new Database(path, { strict: true, create: true })`, `db.query()` caches prepared statements, `db.transaction(fn)` returns a callable with `.immediate()`, `PRAGMA journal_mode = WAL`, `.get/.all/.run/.iterate`.
- `Bun.serve` supports a `routes` object (static `Response`, per-method handlers, `/:param` segments read from `req.params`, `/prefix/*` wildcards) with `fetch` as the fallback, `port: 0` for a free port, `hostname`, `server.port`, `server.stop(closeActiveConnections)`, and WebSockets through `server.upgrade(req, { data })`, a `websocket` handler object (`open`, `message`, `close`, `drain`), `ws.subscribe/unsubscribe/publish`, `server.publish`, `idleTimeout` (default 120 s for WebSocket, 10 s for HTTP), `maxPayloadLength` (16 MB) and `sendPings`.
- Drizzle ORM: the stable line is 0.45.3 (2026-09-21) while 1.0 is in release candidates; its migrator reads a migrations folder from disk, which a compiled binary does not have. The log has a handful of tables, an FTS5 virtual table and triggers that an ORM does not model, so this plan uses `bun:sqlite` directly with embedded SQL migrations and records the deviation from spec section 3 in an ADR 0003 amendment.
- `open` 11.0.4 was published 2026-09-14 and qualifies for the 72-hour `minimumReleaseAge`. No other runtime dependency is added; Zod 4.6 and citty are already in the catalog.
- The CLI's command runner from plan 1c (`apps/cli/src/process/command-runner.ts`, `pipe-collector.ts`) is Bun-specific and already handles timeouts, SIGKILL escalation and pipe drain; `sandbox-host` needs the same to drive `git`, so Task 6 moves it there and the CLI imports it back (the CLI may import every package, spec section 4.3).

## Global Constraints

- Dependency rules of spec section 4.3, enforced by `turbo boundaries` tags in the root `turbo.json`: `protocol` depends on nothing internal; `core` depends only on `protocol` (tag `core`); `store-sqlite`, `harness-fake`, `sandbox-host` and `server` depend on `core` and `protocol`, never on each other (tag `adapter`); `apps/cli` may import everything (tag `app-cli`). `protocol` and `core` use no Bun API, no `process` global and no DOM; `packages/core/.oxlintrc.json` copies the bans from `packages/protocol/.oxlintrc.json` (`Bun`, `process`, `bun:*`, `node:*` in `src/**`).
- Package manager pnpm 12 with catalogs: runtime dependencies `catalog:` (add `open: ^11.0.4`), tooling `catalog:dev`; `minimumReleaseAge` 72 h; every new package has `package.json` in the shape of `packages/protocol/package.json` (private, `type: module`, `exports` to `./src/index.ts`, scripts `test` and `typecheck`, devDependencies `@types/bun` and `typescript` from `catalog:dev`) and a `turbo.json` with its tag.
- TypeScript: the base config flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedDeclarations`); import types with `import type`; no `any`, no non-null assertions, no `null` literals except through a named constant with a reason (see `NOT_FOUND` in `apps/cli/src/doctor/checks.ts`); optional fields instead of nullable ones in TypeScript shapes (SQLite columns may still be NULL).
- Lint and format: `pnpm run check` green before every commit; type-aware Oxlint `--deny-warnings`; a suppression is `// oxlint-disable-next-line <rule> -- <reason>` and is listed in the task report; never turn a rule off; knip must know every new entry (fixtures spawned as processes go into `knip.jsonc` the way `packages/observability` does).
- Tests: `bun test` in every runtime package, TDD (failing test first, recorded in the report), pristine output, no `.only`/`.skip`, `test.skipIf(condition)` with a comment when a platform cannot run a test; temporary directories from `mkdtemp` and removed in `afterEach`/`afterAll`; no test depends on the host's `git` configuration except through a temporary repository the test creates (`git init` with an explicit `user.name`/`user.email`, default branch set explicitly). CI runs the tests on `ubuntu-26.04`, `macos-26` and `windows-2025`: paths through `node:path`, no shell scripts as fixtures, `process.execPath` to spawn Bun.
- Coverage: `bunfig.toml` in `packages/protocol` and `packages/core` with `[test] coverage = true` and `coverageThreshold = 0.9`; the threshold fails `bun test` when not met.
- Logging: packages log through the `Logger` port of `core` (a four-method interface); only `apps/cli` binds it to LogTape; env values, tokens and prompt content are never logged below `WORKBOX_DEBUG=full`.
- Security of the local protocol (spec section 7.3): bind `127.0.0.1` only; `daemon.json` written with mode `0o600` and holding the bearer token itself (the spec says "token hash"; the CLI is a local client that must authenticate on later invocations, and the owner-only file is the boundary, so the bearer is stored and the deviation is recorded in ADR 0012); the browser never sees the bearer, only a one-time token exchanged once; tickets single-use and valid 30 s; `Origin` must equal the daemon's own origin or be absent (CLI); blob uploads capped at 25 MB and content-addressed.
- Conventional Commits, signed off (`git commit -s`), body lines at most 100 characters, one commit per task; every task ends with `pnpm run check` green.
- Text in code, comments and docs is English; user-facing CLI strings go through `@workbox/i18n` messages in English and Czech (new keys prefixed `cli_`).

## Review Focus

- Idempotency across crash and resume: a `sourceId` seen twice must yield one event, with the second append returning the stored envelope, and a daemon restart must turn `running` sessions into `idle` with a `session.status_changed` whose reason says so (Tasks 4 and 5 pin both).
- Gap-free reconnects: `subscribe { sinceSeq }` must deliver every persisted event after `sinceSeq` in order and then live events with strictly increasing `seq`, even when an event is appended during the backfill (Task 9 pins it with an append racing the backfill).
- Token hygiene: the one-time token works once, the bearer never appears in URLs or logs, a ticket is rejected after use and after 30 s, a wrong `Origin` is refused with 403, and timing-safe comparison is used (Task 8).
- Windows: worktree paths under `WORKBOX_HOME` with backslashes, branch slugs without characters Windows forbids, `git` spawned by name through the env allowlist that keeps `SystemRoot`, and processes ended through the runner's escalation (Task 6).
- The state machine: every (status, trigger) pair in spec section 5.2 is defined, every undefined pair returns a typed error instead of throwing, and `interrupt` from `waiting_*` returns to `idle` (Task 2).

---

### Task 1: Protocol: event catalogue, envelope and contract fixtures

**Files:**
- Create: `packages/protocol/src/ids.ts`, `packages/protocol/src/events.ts`, `packages/protocol/src/transient.ts`
- Create: `packages/protocol/test/events.test.ts`, `packages/protocol/test/fixtures/events/*.json` (one file per event type), `packages/protocol/test/schema-snapshot.test.ts`
- Create: `packages/protocol/scripts/export-schemas.ts`, `schemas/workbox.events.schema.json`, `schemas/workbox.config.schema.json` (repository root `schemas/`)
- Modify: `packages/protocol/src/index.ts`, `packages/protocol/package.json` (script `schemas: bun run scripts/export-schemas.ts`), `packages/protocol/bunfig.toml` (new), `.ls-lint.yml` only if `schemas/` needs a rule (it is kebab-case with dots, covered by `.json` default)

**Interfaces:**
- Produces: `eventSchema` (discriminated union on `type`), `EventType`, `Event`, `EventPayload<T>`, `NewEvent` (`{ type, v, payload, sessionId?, source, sourceId }`), `eventEnvelopeSchema`, `EventEnvelope` (`NewEvent` plus `seq: number`, `ts: string`), `transientFrameSchema` (`message.delta`, `thinking.delta`, `tool.progress`), `EVENT_TYPES` tuple, `idSchema` (`z.uuid()`), `isoTimestampSchema` (`z.iso.datetime()`), `eventsJsonSchema()`.

- [ ] **Step 1: Write the failing contract tests**

`packages/protocol/test/events.test.ts` loads every file under `test/fixtures/events/`, parses it with `eventEnvelopeSchema`, asserts `type` equals the file name without `.json` and that `EVENT_TYPES` has exactly one fixture each (so a new type without a fixture fails). A second test asserts that an envelope with an unknown key, a wrong `v`, a `seq` of `-1` or a non-ISO `ts` is rejected. `schema-snapshot.test.ts` asserts that `eventsJsonSchema()` and `userConfigJsonSchema()` serialised with two-space indentation equal the committed `schemas/*.json` files (the test names the regeneration command in its failure message). Run `bun test` in `packages/protocol`: both files fail (modules missing).

- [ ] **Step 2: Implement the catalogue**

`ids.ts`:

```ts
import { z } from 'zod';

export const idSchema = z.uuid();
export const isoTimestampSchema = z.iso.datetime();
export const sourceIdSchema = z.string().min(1).max(200);
export type Id = z.output<typeof idSchema>;
```

`events.ts` declares one strict payload schema per event of spec section 5.3, with these exact shapes (field names are the contract for every later plan):

```ts
export const EVENT_SOURCES = ['harness', 'user', 'system'] as const;
export const SESSION_STATUSES = [
  'creating', 'idle', 'running', 'waiting_for_permission', 'waiting_for_answer',
  'completed', 'failed', 'stopped',
] as const;
export const TOOL_CATEGORIES = ['read', 'edit', 'run', 'web', 'other'] as const;
export const DECIDED_BY = ['user', 'policy', 'timeout'] as const;
export const ERROR_TYPES = ['auth', 'rate_limit', 'network', 'process_crash', 'sandbox', 'unknown'] as const;

const appearanceSchema = z.strictObject({ body: z.string(), skin: z.int().min(0), hair: z.int().min(0), outfit: z.int().min(0) });
const employeeFieldsSchema = z.strictObject({
  id: idSchema, projectId: idSchema, name: z.string().min(1), appearance: appearanceSchema,
  gender: z.enum(['female', 'male', 'other']), role: z.literal('developer'), harness: z.enum(['claude', 'fake']),
  model: z.string(), effort: z.enum(['low', 'medium', 'high']), systemPromptAppend: z.string(),
  permissionMode: z.enum(['default', 'acceptEdits', 'plan', 'bypassPermissions']), deskId: z.string(),
});
const blockSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('text'), text: z.string() }),
  z.strictObject({ kind: z.literal('tool_use'), toolCallId: z.string(), name: z.string(), inputSummary: z.string() }),
  z.strictObject({ kind: z.literal('tool_result'), toolCallId: z.string(), attachmentId: z.string().optional() }),
  z.strictObject({ kind: z.literal('image'), attachmentId: z.string() }),
]);
const optionSchema = z.strictObject({ id: z.string(), label: z.string(), description: z.string().optional() });

export const eventPayloads = {
  'project.registered': z.strictObject({ id: idSchema, name: z.string().min(1), path: z.string().min(1), defaultBranch: z.string().min(1) }),
  'project.updated': z.strictObject({ id: idSchema, changes: z.strictObject({ name: z.string().min(1).optional(), defaultBranch: z.string().min(1).optional() }) }),
  'project.removed': z.strictObject({ id: idSchema }),
  'employee.created': employeeFieldsSchema,
  'employee.updated': z.strictObject({ id: idSchema, changes: employeeFieldsSchema.omit({ id: true, projectId: true }).partial() }),
  'session.created': z.strictObject({ id: idSchema, projectId: idSchema, employeeId: idSchema, title: z.string(), baseBranch: z.string().min(1) }),
  'session.status_changed': z.strictObject({ id: idSchema, from: z.enum(SESSION_STATUSES), to: z.enum(SESSION_STATUSES), reason: z.string() }),
  'session.renamed': z.strictObject({ id: idSchema, title: z.string() }),
  'session.archived': z.strictObject({ id: idSchema }),
  'workspace.prepared': z.strictObject({ sessionId: idSchema, path: z.string(), branch: z.string(), setupCommandResults: z.array(z.strictObject({ command: z.string(), exitCode: z.int(), durationMs: z.int().min(0) })) }),
  'workspace.removed': z.strictObject({ sessionId: idSchema }),
  'turn.started': z.strictObject({ sessionId: idSchema, turnId: idSchema, prompt: z.string(), attachmentIds: z.array(z.string()), queuedAt: isoTimestampSchema }),
  'message.completed': z.strictObject({ sessionId: idSchema, turnId: idSchema, messageId: z.string(), role: z.enum(['assistant', 'user']), blocks: z.array(blockSchema), model: z.string() }),
  'tool.started': z.strictObject({ sessionId: idSchema, turnId: idSchema, toolCallId: z.string(), name: z.string(), inputSummary: z.string(), category: z.enum(TOOL_CATEGORIES) }),
  'tool.completed': z.strictObject({ sessionId: idSchema, turnId: idSchema, toolCallId: z.string(), outputSummary: z.string(), isError: z.boolean(), durationMs: z.int().min(0), attachmentIds: z.array(z.string()) }),
  'turn.completed': z.strictObject({ sessionId: idSchema, turnId: idSchema, stopReason: z.string(), durationMs: z.int().min(0) }),
  'turn.failed': z.strictObject({ sessionId: idSchema, turnId: idSchema, error: z.strictObject({ type: z.enum(ERROR_TYPES), message: z.string() }) }),
  'permission.requested': z.strictObject({ sessionId: idSchema, requestId: z.string(), toolCallId: z.string(), name: z.string(), input: z.string(), options: z.array(optionSchema).min(1), recommended: z.string(), reason: z.string() }),
  'permission.resolved': z.strictObject({ sessionId: idSchema, requestId: z.string(), decision: z.enum(['allow', 'deny']), updatedInput: z.string().optional(), decidedBy: z.enum(DECIDED_BY), latencyMs: z.int().min(0) }),
  'question.asked': z.strictObject({ sessionId: idSchema, requestId: z.string(), questions: z.array(z.strictObject({ id: z.string(), text: z.string(), options: z.array(optionSchema).min(1), recommended: z.string().optional() })).min(1) }),
  'question.answered': z.strictObject({ sessionId: idSchema, requestId: z.string(), answers: z.array(z.strictObject({ questionId: z.string(), optionId: z.string() })), decidedBy: z.enum(DECIDED_BY), latencyMs: z.int().min(0) }),
  'harness.bound': z.strictObject({ sessionId: idSchema, harness: z.enum(['claude', 'fake']), harnessSessionId: z.string(), model: z.string(), tools: z.array(z.string()), skills: z.array(z.string()), version: z.string() }),
  'harness.auth_status': z.strictObject({ harness: z.enum(['claude', 'fake']), kind: z.enum(['subscription', 'api_key', 'none']), plan: z.string().optional(), account: z.string().optional() }),
  'harness.error': z.strictObject({ sessionId: idSchema, error: z.strictObject({ type: z.enum(ERROR_TYPES), message: z.string() }) }),
  'context.compacted': z.strictObject({ sessionId: idSchema, tokensBefore: z.int().min(0), tokensAfter: z.int().min(0), trigger: z.string() }),
  'subagent.started': z.strictObject({ sessionId: idSchema, subagentId: z.string(), name: z.string() }),
  'subagent.stopped': z.strictObject({ sessionId: idSchema, subagentId: z.string(), outcome: z.string() }),
  'usage.reported': z.strictObject({ sessionId: idSchema, turnId: idSchema, inputTokens: z.int().min(0), outputTokens: z.int().min(0), cacheReadTokens: z.int().min(0), cacheCreationTokens: z.int().min(0), costEstimateUsd: z.number().min(0), model: z.string() }),
  'rate_limit.reported': z.strictObject({ harness: z.enum(['claude', 'fake']), window: z.string(), utilisation: z.number().min(0).max(1), resetsAt: isoTimestampSchema }),
  'attachment.added': z.strictObject({ id: z.string().regex(/^[0-9a-f]{64}$/u), sessionId: idSchema, mime: z.string(), bytes: z.int().min(0), origin: z.enum(['user', 'agent']), name: z.string() }),
} as const;

export const EVENT_TYPES = Object.keys(eventPayloads) as readonly (keyof typeof eventPayloads)[];
```

`eventSchema` is `z.discriminatedUnion('type', [...])` built from `eventPayloads` with members `z.strictObject({ type: z.literal(type), v: z.literal(1), payload })` (write the member list explicitly if TypeScript cannot infer the tuple from a map; the implementer decides and reports). `newEventSchema` extends every member with `sessionId: idSchema.optional()`, `source: z.enum(EVENT_SOURCES)`, `sourceId: sourceIdSchema`; `eventEnvelopeSchema` adds `seq: z.int().min(0)` and `ts: isoTimestampSchema`. `transient.ts` declares `message.delta { sessionId, turnId, messageId, text }`, `thinking.delta { sessionId, turnId, text }`, `tool.progress { sessionId, turnId, toolCallId, text }` as a discriminated union on `type`. Export everything from `index.ts` together with `EVENT_TYPES`, `SESSION_STATUSES`, `ERROR_TYPES` and the derived TypeScript types.

- [ ] **Step 3: Fixtures and schema export**

Write one fixture per event type under `test/fixtures/events/<type>.json` (an envelope with realistic values; UUIDs, ISO timestamps). `scripts/export-schemas.ts` writes `schemas/workbox.events.schema.json` (`z.toJSONSchema(eventEnvelopeSchema, { target: 'draft-7', io: 'input' })`) and `schemas/workbox.config.schema.json` (`userConfigJsonSchema()`), each with two-space indentation and a trailing newline; `package.json` gets `"schemas": "bun run scripts/export-schemas.ts"`. Run it once and commit the output. Add `packages/protocol/bunfig.toml`:

```toml
[test]
coverage = true
coverageThreshold = 0.9
```

- [ ] **Step 4: Check and commit**

`bun test` in `packages/protocol` green with coverage at or above 90 %, `pnpm run check` green (the schemas directory is JSON and formatted by oxfmt; if oxfmt reformats the exported files, make the export script produce the same formatting or run `pnpm run format` after export and make the snapshot test compare after a formatting-neutral `JSON.parse`). Commit:

```bash
git add packages/protocol schemas
git commit -s -m "feat(protocol): add the event catalogue with contract fixtures and JSON Schema export"
```

---

### Task 2: Protocol: commands and frames, session state machine, projections, project config

**Files:**
- Create: `packages/protocol/src/frames.ts`, `packages/protocol/src/session-status.ts`, `packages/protocol/src/projections/transcript.ts`, `packages/protocol/src/projections/dashboard.ts`, `packages/protocol/src/project-config.ts`
- Create: tests `packages/protocol/test/frames.test.ts`, `session-status.test.ts`, `transcript.test.ts`, `dashboard.test.ts`, `project-config.test.ts`, plus `test/fixtures/sessions/happy-path.json` (an ordered list of envelopes for one session: created, status changes, turn.started, message.completed with a tool_use block, tool.started, tool.completed, permission.requested/resolved, turn.completed, usage.reported)
- Modify: `packages/protocol/src/index.ts`, `packages/protocol/scripts/export-schemas.ts` (also export `schemas/workbox.project.schema.json` and `schemas/workbox.frames.schema.json`)

**Interfaces:**
- Produces: `clientCommandSchema` and `serverFrameSchema` (discriminated unions on `type`, exactly the lists in spec section 7.2, every command with `commandId: z.string().min(1)`), `ClientCommand`, `ServerFrame`, `transitionSession(status, trigger): TransitionResult` where `SESSION_TRIGGERS = ['prepared', 'preparation_failed', 'prompt', 'permission.requested', 'permission.resolved', 'question.asked', 'question.answered', 'turn.completed', 'turn.failed', 'interrupt', 'stop']` and `TransitionResult = { ok: true, to } | { ok: false, code: 'invalid_transition' }`, `isTerminal(status)`, `foldTranscript(events): Transcript` with `Transcript = { sessionId, turns: Turn[], messages: Message[], tools: ToolCall[], pending: PendingDecision[] }` (tool calls joined by `toolCallId`, permission and question requests without a resolution listed under `pending`), `summariseDashboard(sessions): DashboardGroups` with groups `waiting`, `running`, `done`, `attention` per spec section 5.2, `projectConfigSchema`, `parseProjectConfig(input)`, `DEFAULT_PROJECT_CONFIG`, `mergeProjectConfig(base, localOverride)`, `projectConfigJsonSchema()`.

- [ ] **Step 1: Failing tests**

`session-status.test.ts` is table-driven over spec section 5.2: every row asserts `transitionSession(from, trigger)` equals `{ ok: true, to }`; a second table asserts the undefined pairs (for example `('completed', 'turn.completed')`, `('stopped', 'prompt')` is defined: stopped → running on prompt, so pick truly undefined ones such as `('creating', 'prompt')` and `('idle', 'permission.resolved')`) return `{ ok: false, code: 'invalid_transition' }`; `isTerminal` is true for `completed`, `failed`, `stopped` only. `transcript.test.ts` folds `fixtures/sessions/happy-path.json` and asserts the turn, message, tool and decision structure, then folds the same list with the `tool.completed` removed and asserts the tool is `pending`, and with the `permission.resolved` removed and asserts a `pending` decision. `dashboard.test.ts` asserts the grouping for one session per status. `frames.test.ts` round-trips one fixture per command and frame and rejects an unknown `type`. `project-config.test.ts` mirrors `user-config.test.ts`: defaults, unknown key named, `$schema` allowed, local override merged over the committed config (arrays replaced, objects merged one level deep), the `bashDeny` regexes compile.

- [ ] **Step 2: Implement**

`frames.ts`: client commands `subscribe { sinceSeq: z.int().min(0), projectIds?: idSchema[] }`, `project.register { path }`, `project.branches { projectId }`, `project.update { projectId, changes }`, `employee.update { employeeId, changes }`, `session.create { projectId, employeeId?, title, baseBranch, prompt, attachmentIds }`, `session.prompt { sessionId, prompt, attachmentIds }`, `session.interrupt { sessionId }`, `session.stop { sessionId }`, `session.archive { sessionId }`, `session.search { query, sessionId? }`, `permission.resolve { sessionId, requestId, decision, updatedInput? }`, `question.answer { sessionId, requestId, answers }`; server frames `hello { protocolVersion, daemonVersion }`, `event { seq, event: eventEnvelopeSchema }`, `transient { frame: transientFrameSchema }`, `snapshot { sessionId, partial: { messageId, text, thinking } }`, `ack { commandId, result: z.unknown() }`, `error { commandId?: string, code: z.enum(ERROR_CODES), message }` with `ERROR_CODES = ['bad_request', 'unauthorized', 'not_found', 'invalid_transition', 'conflict', 'internal']`. `session-status.ts` encodes the table from spec section 5.2 as a `Map<string, SessionStatus>` keyed `${from}:${trigger}` built from a readonly array of rows, so the table is data and the test can iterate it. Projections are pure functions over `readonly EventEnvelope[]` with no sorting assumptions beyond `seq` order (sort defensively by `seq` first). `project-config.ts` follows `user-config.ts`'s `.default(() => schema.parse({}))` pattern with the fields of spec section 5.6 (`defaultBranch`, `workspace.branchPrefix` default `workbox/`, `workspace.setupCommands` default `[]`, `employees` default `[]` with the appearance schema from Task 1, `harness.claude` with `model`, `effort`, `permissionMode`, `allowedTools`, `permissions.bashAllow/bashDeny/webFetchAllow` with the spec's defaults, `env.passthrough` default `['PATH', 'HOME', 'LANG', 'LC_ALL']`; `ANTHROPIC_API_KEY` is not in the default list, the owner adds it per project).

- [ ] **Step 3: Export, check, commit**

Extend the export script and the snapshot test for the two new schema files, regenerate, `pnpm run check`, then:

```bash
git add packages/protocol schemas
git commit -s -m "feat(protocol): add commands, frames, the session state machine, projections and project config"
```

---

### Task 3: Core: domain, ports, in-memory store

**Files:**
- Create: `packages/core/package.json`, `packages/core/turbo.json` (`"tags": ["core"]`), `packages/core/tsconfig.json` (copy `packages/protocol/tsconfig.json`), `packages/core/.oxlintrc.json` (copy of protocol's bans), `packages/core/bunfig.toml` (coverage 0.9)
- Create: `packages/core/src/index.ts`, `src/domain.ts`, `src/ports.ts`, `src/errors.ts`, `src/projection-state.ts`, `src/testing/memory-event-store.ts`, `src/testing/index.ts` (exported as the `./testing` subpath in `package.json` `exports`, so adapter tests can import `@workbox/core/testing`)
- Create: `packages/core/test/memory-event-store.test.ts`
- Modify: `turbo.json` (root) only if the `core` tag's deny list needs `adapter` added (it already lists it per plan 1); `knip.jsonc` (workspace entry for `packages/core` with `src/testing/index.ts` as an extra entry because adapters' tests import it)

**Interfaces:**
- Produces (all in `ports.ts` unless noted):

```ts
export interface Clock { now(): Date }
export interface IdGenerator { next(): Id }
export interface Logger {
  debug(message: string, properties?: Record<string, unknown>): void;
  info(message: string, properties?: Record<string, unknown>): void;
  warning(message: string, properties?: Record<string, unknown>): void;
  error(message: string, properties?: Record<string, unknown>): void;
}
export interface EventFilter { readonly sessionId?: Id; readonly projectIds?: readonly Id[] }
export interface EventStore {
  append(events: readonly NewEvent[]): Promise<readonly EventEnvelope[]>;  // one transaction; duplicates by sourceId return the stored envelope
  readSince(seq: number, filter?: EventFilter): Promise<readonly EventEnvelope[]>;
  readSession(sessionId: Id): Promise<readonly EventEnvelope[]>;
  lastSeq(): Promise<number>;
  projects(): Promise<readonly Project[]>;
  employees(projectId?: Id): Promise<readonly Employee[]>;
  sessions(filter?: { projectId?: Id; includeArchived?: boolean }): Promise<readonly Session[]>;
  session(sessionId: Id): Promise<Session | undefined>;
  search(query: string, sessionId?: Id): Promise<readonly SearchHit[]>;
  close(): Promise<void>;
}
export interface EventSink { event(event: NewEvent): void; transient(frame: TransientFrame): void }  // adapters set source: 'harness' and a stable sourceId
export interface HarnessAdapter { readonly id: 'claude' | 'fake'; describe(): HarnessInfo; authStatus(): Promise<AuthStatus>; start(spec: HarnessSessionSpec, sink: EventSink): Promise<HarnessSession> }
export interface HarnessSession { prompt(turn: TurnInput): Promise<void>; resolvePermission(requestId: string, decision: PermissionDecision): void; answerQuestion(requestId: string, answer: QuestionAnswer): void; interrupt(): Promise<void>; stop(): Promise<void>; contextUsage(): Promise<ContextUsage> }
export interface SandboxProvider { capabilities(): SandboxCapabilities; prepare(spec: WorkspaceSpec): Promise<PreparedWorkspace>; spawn(workspace: Workspace, spec: SpawnSpec): Promise<SandboxedProcess>; dispose(workspace: Workspace): Promise<void>; detectDefaultBranch(path: string): Promise<string>; listBranches(path: string): Promise<readonly string[]> }
```

  `domain.ts` derives `Project`, `Employee`, `Session` (fields of spec section 5.1 including `status`, `harnessSessionId?`, `lastSeq`, `archivedAt?`), `Workspace { path, branch }`, `SearchHit { messageId, sessionId, snippet }`, `HarnessInfo`, `AuthStatus`, `HarnessSessionSpec` (spec section 6.1 with `spawn: SandboxProvider['spawn']`), `TurnInput { turnId, prompt, attachmentIds }`, `PermissionDecision`, `QuestionAnswer`, `ContextUsage { inputTokens, maxTokens }`, `WorkspaceSpec { projectId, sessionId, projectPath, baseBranch, branchPrefix, slug, setupCommands, env }`, `PreparedWorkspace { workspace, setupCommandResults }`, `SpawnSpec { command, cwd?, env }`, `SandboxedProcess { pid, exited: Promise<number>, kill(signal?) }` from the protocol types. `errors.ts` declares `WorkboxError` with `code` from the protocol `ERROR_CODES` and a `details` record.
- `testing/memory-event-store.ts`: `MemoryEventStore` implementing `EventStore` with an array, `sourceId` map, projection maps updated by the shared `applyProjection(state, envelope)` reducer (which lives in `src/projection-state.ts` so `store-sqlite` can reuse the same rules for its tables), and a naive `includes` search.

- [ ] **Step 1: Failing tests**

`memory-event-store.test.ts`: append assigns increasing `seq` starting at 1 and `ts` from the injected clock; appending the same `sourceId` twice returns the first envelope and does not grow the log; `readSince(0)` returns everything, `readSince(n)` strictly after `n`; `readSince` with `projectIds` keeps project-level events of those projects and session events whose session belongs to them; projections: after `project.registered` + `employee.created` + `session.created` + `session.status_changed` the `sessions()` row has the new status and `lastSeq`; `session.archived` sets `archivedAt` and hides the session unless `includeArchived`.

- [ ] **Step 2: Implement, check, commit**

Implement the files; `bun test` with coverage ≥ 90 %; `pnpm run check` (also `pnpm run boundaries` must pass with the `core` tag). Commit:

```bash
git add packages/core knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(core): add the domain, the ports and an in-memory event store"
```

(`pnpm install` adds the workspace package to the lockfile.)

---

### Task 4: Core: session runtime and the Workbox application service

**Files:**
- Create: `packages/core/src/session-runtime.ts`, `packages/core/src/workbox.ts`, `packages/core/src/policy.ts` (recommendation policy of spec section 6.3, slice 1: deny patterns, allow patterns, read-only tools, workspace-local edits, `webFetchAllow`), `packages/core/src/slug.ts`
- Create: `packages/core/test/stubs/scripted-harness.ts` (a test-only `HarnessAdapter` whose session emits a programmed list of sink calls when prompted and resolves permissions/questions on demand), `packages/core/test/stubs/fake-sandbox.ts`
- Create: tests `session-runtime.test.ts`, `workbox.test.ts`, `policy.test.ts`, `slug.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `createSessionRuntime({ session, store, adapter, sandbox, clock, ids, logger, policy })` returning `SessionRuntime { prompt(input), resolvePermission(requestId, decision, decidedBy), answerQuestion(requestId, answers, decidedBy), interrupt(), stop(), snapshot(): PartialSnapshot | undefined, onTransient(listener) }`; `createWorkbox(deps: { store, sandbox, adapters: Record<HarnessId, HarnessAdapter>, clock, ids, logger, home, userConfig })` returning `Workbox { registerProject(path), listBranches(projectId), updateProject, updateEmployee, createSession(input), prompt, interrupt, stop, archive, resolvePermission, answerQuestion, search, recoverAfterRestart(), shutdown(), subscribeTransient(listener) }`; `recommend(input: PolicyInput): Recommendation` where `PolicyInput = { toolName: string, input: string, workspacePath: string, targetPaths: readonly string[], domains: readonly string[], permissions: ProjectConfig['permissions'] }` and `Recommendation = { decision: 'allow' | 'deny', autoResolve: boolean, reason: string }` (tier 1 deny patterns and writes outside the workspace never auto-resolve; tier 2 allow patterns, read-only tools, edits inside the workspace and allow-listed domains auto-allow; everything else recommends allow with a reason and shows the dialog); `slugify(title): string` (lowercase ASCII, `-` separators, max 40 chars, Windows-safe, never empty).

- [ ] **Step 1: Failing tests**

`session-runtime.test.ts` with the scripted adapter and the memory store: a prompt appends `turn.started`, moves the status to `running`, the scripted events (`message.completed`, `tool.started`, `tool.completed`, `turn.completed`, `usage.reported`) are stored with `source: 'harness'` and the adapter's `sourceId`s, the status ends `completed`; a second prompt while running is queued and starts after `turn.completed`; a `permission.requested` moves to `waiting_for_permission`, `resolvePermission` appends `permission.resolved` with `decidedBy` and `latencyMs` from the clock and returns to `running`; a policy auto-allow (`bashAllow` match) resolves without exposing a pending decision and records `decidedBy: 'policy'`; a deny-pattern match never auto-resolves even if `bashAllow` also matches; `interrupt` from `waiting_for_answer` yields `idle`; `turn.failed` yields `failed` and a later prompt works again; transient frames are not stored but reach the listener; `snapshot()` holds the concatenated `message.delta` text of the in-flight message and is cleared on `message.completed`. `workbox.test.ts` with the fake sandbox: `registerProject` detects the default branch and appends `project.registered` plus one `employee.created` per configured employee (or one default employee named from the locale pool when none is configured; slice 1 pool: `['Alice', 'Bob', 'Eva', 'Jan']`); `createSession` appends `session.created`, `session.status_changed` to `creating`, calls `sandbox.prepare` with the slugged branch, appends `workspace.prepared`, starts the adapter, appends `harness.bound` and moves to `idle`, then prompts; a `prepare` rejection yields `failed` with reason; `recoverAfterRestart` turns a `running` session into `idle` with reason `daemon restarted`; `shutdown` stops every runtime and marks running sessions `idle` with reason `daemon stopped`. `policy.test.ts` covers the three tiers with the spec's default patterns. `slug.test.ts` covers Czech diacritics, spaces, emoji and an empty title (`session` fallback).

- [ ] **Step 2: Implement, check, commit**

Implement; the runtime serialises its own work with a promise chain (one actor per session, no shared mutable state across sessions); every status change goes through `transitionSession` and an invalid transition returns a `WorkboxError('invalid_transition')` without changing state. `pnpm run check`, then:

```bash
git add packages/core
git commit -s -m "feat(core): add the session runtime, the recommendation policy and the Workbox service"
```

---

### Task 5: SQLite event store

**Files:**
- Create: `packages/store-sqlite/{package.json,turbo.json,tsconfig.json}` (tag `adapter`), `src/index.ts`, `src/migrations.ts`, `src/sqlite-event-store.ts`, `src/rows.ts`
- Create: tests `test/sqlite-event-store.test.ts`, `test/migrations.test.ts`, `test/fts.test.ts`
- Modify: `knip.jsonc`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `openSqliteEventStore({ path, clock }): SqliteEventStore` (implements `EventStore`; `path` may be `:memory:`), `MIGRATIONS: readonly Migration[]` (`{ version, name, sql }`), `applyMigrations(db)`, `SCHEMA_VERSION`.

- [ ] **Step 1: Failing tests**

`migrations.test.ts`: a new database ends at `SCHEMA_VERSION` with `PRAGMA user_version` equal to it, running again is a no-op, versions are contiguous from 1, and the database is in WAL mode (`PRAGMA journal_mode` returns `wal` for a file database; `memory` for `:memory:`). `sqlite-event-store.test.ts` runs the same behavioural suite as Task 3's memory store (extract the suite into `packages/core/src/testing/event-store-suite.ts` as `describeEventStore(name, factory)` so both stores run it; the memory store test adopts it in this task), plus: two stores on the same file see each other's appends (second connection reads `lastSeq`), a `sourceId` duplicate inside one `append` batch is dropped, and `readSince` with a projectIds filter uses the `sessions` table to resolve session membership. `fts.test.ts`: after `message.completed` events, `search('workbox')` returns hits with `snippet` containing `<mark>workbox</mark>` style highlights (use FTS5 `highlight()` with `<mark>`/`</mark>`), is scoped by `sessionId`, and an FTS5 syntax error in the query yields an empty result instead of throwing (quote the query as a phrase).

- [ ] **Step 2: Implement**

`migrations.ts` embeds SQL strings; version 1:

```sql
CREATE TABLE events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  type TEXT NOT NULL,
  v INTEGER NOT NULL,
  payload TEXT NOT NULL,
  ts TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL UNIQUE
);
CREATE INDEX events_session_seq ON events(session_id, seq);
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, default_branch TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE employees (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE sessions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), employee_id TEXT NOT NULL, title TEXT NOT NULL, base_branch TEXT NOT NULL, workspace_path TEXT, workspace_branch TEXT, status TEXT NOT NULL, harness_session_id TEXT, last_seq INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT);
CREATE INDEX sessions_project ON sessions(project_id, archived_at);
CREATE VIRTUAL TABLE messages_fts USING fts5(message_id UNINDEXED, session_id UNINDEXED, body);
CREATE TABLE blobs (sha256 TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes INTEGER NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
```

`applyMigrations` runs each migration above `PRAGMA user_version` inside `db.transaction(...).immediate()` and sets `user_version` at the end of each; it first asserts FTS5 by running `CREATE VIRTUAL TABLE temp.fts5_probe USING fts5(x)` followed by `DROP TABLE temp.fts5_probe`, and throws a `WorkboxError('internal')` naming the SQLite version (`SELECT sqlite_version()`) if that fails (the plan's evidence says it is present everywhere; the assertion turns a silent regression into a clear failure). `openSqliteEventStore` opens with `{ strict: true, create: true }`, sets `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 5000`, `PRAGMA foreign_keys = ON`, applies migrations, and implements `append` as one immediate transaction: for each event, `INSERT OR IGNORE` by `source_id`, read back the row (existing or new), then apply the projection reducer from `core` (`applyProjection`) to the `projects`/`employees`/`sessions` rows and insert `message.completed` text blocks into `messages_fts`. Rows are validated with Zod (`rows.ts`) when read, so a corrupted payload fails loudly.

- [ ] **Step 3: Check and commit**

`bun test` in `packages/store-sqlite` and `packages/core` green; `pnpm run check`, then:

```bash
git add packages/store-sqlite packages/core knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(store-sqlite): add the SQLite event store with embedded migrations and FTS5 search"
```

---

### Task 6: Host sandbox provider and the shared command runner

**Files:**
- Create: `packages/sandbox-host/{package.json,turbo.json,tsconfig.json}` (tag `adapter`), `src/index.ts`, `src/host-sandbox-provider.ts`, `src/git.ts`, `src/env.ts`
- Move: `apps/cli/src/process/command-runner.ts` → `packages/sandbox-host/src/process/command-runner.ts`, `apps/cli/src/process/pipe-collector.ts` → `packages/sandbox-host/src/process/pipe-collector.ts`, their tests `apps/cli/test/command-runner.test.ts` and `apps/cli/test/pipe-collector.test.ts` → `packages/sandbox-host/test/` (adjust imports; the CLI's `checks.ts` and `commands/doctor.ts` import `CommandRunner`/`bunCommandRunner` from `@workbox/sandbox-host`)
- Create: tests `test/git.test.ts`, `test/host-sandbox-provider.test.ts`, `test/env.test.ts`, helper `test/helpers/temp-repo.ts` (creates a temporary git repository with a configured identity, an initial commit on `main`, a second branch, and optionally a bare "remote" with a remote-only branch)
- Modify: `apps/cli/package.json` (dependency `@workbox/sandbox-host: workspace:*`), `knip.jsonc`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `createHostSandboxProvider({ home, runner, logger, clock }): SandboxProvider`; `git.ts`: `detectDefaultBranch(repoPath)` (`git symbolic-ref --short refs/remotes/origin/HEAD` stripped of `origin/`, falling back to `git rev-parse --abbrev-ref HEAD`), `listBranches(repoPath)` (`git for-each-ref --format=%(refname:short) refs/heads refs/remotes` deduplicated, `origin/HEAD` dropped, remote prefix stripped), `addWorktree(repoPath, worktreePath, branch, baseBranch)` (`git worktree add -b <branch> <path> <base>` when the branch does not exist, `git worktree add <path> <branch>` when it does), `removeWorktree(repoPath, worktreePath)` (`git worktree remove --force` then `git worktree prune`); `env.ts`: `filterEnv(env, allowlist)` keeping exactly the allowlisted names plus `SystemRoot`, `SYSTEMROOT`, `TEMP`, `TMP`, `windir` on Windows and `TMPDIR` on POSIX.

- [ ] **Step 1: Failing tests**

`git.test.ts` against the temp repository: default branch detection with and without a remote, branch listing includes the remote-only branch once, worktree creation on a new branch from `main` and on an existing remote-only branch (auto-tracking), removal prunes the entry (`git worktree list --porcelain` no longer names it). `host-sandbox-provider.test.ts`: `prepare` creates `<home>/workspaces/<projectId>/<sessionId>` as a worktree on `<branchPrefix><slug>`, runs each setup command with cwd inside it and the filtered env, records `{ command, exitCode, durationMs }`, and a failing setup command rejects with a `WorkboxError('sandbox')` whose details carry the results so far; `spawn` runs `process.execPath -e 'console.log(process.env.WORKBOX_TEST ?? "unset")'` and proves a non-allowlisted variable does not reach the child; `dispose` removes the worktree and leaves the project's repository intact. `env.test.ts` pins the allowlist behaviour per platform (both branches testable by passing `platform`).

- [ ] **Step 2: Implement, move the runner, check, commit**

Move the runner files with `git mv`, update imports, keep their tests green in the new home, add the package dependency to the CLI. Setup commands run through the runner with `cwd` (extend `CommandRunner.run` with an options object `{ cwd?, env? }`; the doctor keeps calling it without options). `pnpm run check` (the move must leave the CLI tests green), then:

```bash
git add packages/sandbox-host apps/cli knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(sandbox-host): add git worktree workspaces and move the command runner"
```

---

### Task 7: Fake harness with JSON scenarios

**Files:**
- Create: `packages/harness-fake/{package.json,turbo.json,tsconfig.json}` (tag `adapter`), `src/index.ts`, `src/scenario.ts`, `src/fake-harness-adapter.ts`, `scenarios/happy-path.json`, `scenarios/permission-then-complete.json`, `scenarios/question-then-fail.json`, `scenarios/README.md`
- Create: tests `test/scenario.test.ts`, `test/fake-harness-adapter.test.ts`
- Modify: `knip.jsonc`, `pnpm-lock.yaml`, `cspell.json` only if scenario words need it (prefer plain English in scenarios)

**Interfaces:**
- Produces: `scenarioSchema` (Zod): `{ name, harnessVersion, model, turns: ScenarioTurn[] }` where a turn is a list of steps, each `{ delayMs: int ≥ 0 }` plus one of `delta { text }`, `message { text, toolUse?: { name, inputSummary, category } }`, `tool { toolCallId, outputSummary, isError, durationMs }`, `permission { toolCallId, name, input, options, recommended, reason, onDeny?: 'fail' | 'continue' }`, `question { questions }`, `usage { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costEstimateUsd }`, `complete { stopReason }`, `fail { type, message }`; `loadScenario(json)`, `createFakeHarnessAdapter({ scenario, timers? })` where `timers` defaults to real `setTimeout` and tests inject a manual timer queue; `authStatus()` resolves `{ kind: 'subscription', plan: 'fake', account: 'fake@workbox.local' }`.

- [ ] **Step 1: Failing tests**

`scenario.test.ts` validates the three shipped scenarios and rejects a step with two kinds or a negative delay. `fake-harness-adapter.test.ts` with manual timers: the first prompt replays turn 1 as sink calls with deterministic `sourceId`s (`fake:<sessionId>:<turn>:<step>`), `permission` blocks until `resolvePermission` (deny with `onDeny: 'fail'` emits `turn.failed`), `question` blocks until `answerQuestion`, `interrupt` during a turn emits nothing further and resolves, `stop` after `complete` resolves, a second prompt replays turn 2 and a prompt beyond the last turn replays the last turn again, and `contextUsage()` reports the sum of usage tokens so far.

- [ ] **Step 2: Implement, check, commit**

Scenarios: `happy-path` (delta ×3, message with a `tool_use` of `Read`, tool completed, message, usage, complete), `permission-then-complete` (message, permission for `Bash` with `recommended: 'allow'`, tool, complete), `question-then-fail` (question with two options and a recommendation, message, fail with `type: 'network'`). `pnpm run check`, then:

```bash
git add packages/harness-fake knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(harness-fake): add the scriptable harness adapter with JSON scenarios"
```

---

### Task 8: Server: token authority, HTTP routes, blobs

**Files:**
- Create: `packages/server/{package.json,turbo.json,tsconfig.json}` (tag `adapter`), `src/index.ts`, `src/auth.ts`, `src/routes.ts`, `src/blobs.ts`, `src/server.ts`
- Create: tests `test/auth.test.ts`, `test/routes.test.ts`, `test/blobs.test.ts`
- Modify: `knip.jsonc`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `createTokenAuthority({ clock, random }): TokenAuthority` with `issueOneTimeToken(): string`, `exchange(oneTime): string | undefined` (returns the bearer once; the one-time token is consumed), `bearerHash(): string` (SHA-256 hex of the bearer, for `daemon.json`), `verifyBearer(header): boolean` (timing-safe via `crypto.timingSafeEqual` on hashes), `issueTicket(bearer): string | undefined`, `consumeTicket(ticket): boolean` (single use, 30 s); `createBlobStore({ dir, maxBytes })` with `put(stream | bytes, { mime, name }): Promise<BlobMeta>` (sha256-addressed file under `dir/<sha256>`, size cap enforced while streaming) and `get(sha256)`; `startServer({ workbox, store, auth, blobs, logger, daemonVersion, hostname: '127.0.0.1', port, staticHandler? }): Promise<RunningServer>` with `RunningServer { port, origin, stop(force?) }`. Routes per spec section 7.1: `GET /` (a placeholder HTML page until plan 3 embeds the UI, stating the daemon version), `POST /api/auth/exchange { token }` → `{ bearer }`, `POST /api/ws-ticket` (bearer) → `{ ticket, expiresInSeconds: 30 }`, `GET /api/health` → `{ version, protocolVersion, uptimeSeconds }`, `GET /api/summary` (bearer) → `{ projects: number, sessionsByGroup: { waiting, running, done, attention } }` (the CLI's `status` command), `POST /api/blobs` (bearer, multipart or raw body with `content-type`, 25 MB cap) → `BlobMeta` plus an `attachment.added` event when `sessionId` is given, `GET /api/blobs/:sha256`, `GET /api/export/telemetry` (bearer) → `501` with a JSON body `{ code: 'not_implemented', plannedIn: 'plan 6' }`, `POST /api/command` (bearer) → runs one `ClientCommand` through the same dispatcher Task 9 uses and returns the `ack`/`error` frame body (the CLI's transport), `POST /api/admin/one-time-token` (bearer) → `{ token }`, a fresh one-time browser token (the CLI mints it before opening the browser, on start and on attach), `POST /api/admin/shutdown` (bearer) → `202` and triggers graceful shutdown through a callback. Every `/api/*` route rejects a present `Origin` header that differs from the server's own origin with `403`.

- [ ] **Step 1: Failing tests**

`auth.test.ts`: one-time token exchanges once, second exchange fails, wrong bearer fails, ticket single-use, ticket expired after 31 s via the injected clock, `verifyBearer` rejects a header of a different length without throwing. `routes.test.ts` starts the server on port 0 with the memory store and the fake sandbox from `core/testing` and a scripted `Workbox` stub where needed: health shape, exchange flow, `POST /api/command` with a `project.register` ack and a malformed command `400 bad_request`, unauthorized `401`, foreign `Origin` `403`, shutdown `202` invoking the callback. `blobs.test.ts`: content addressing (same bytes → same sha256), cap exceeded → `413`, unknown hash → `404`, `GET` returns the stored MIME type.

- [ ] **Step 2: Implement, check, commit**

Use `Bun.serve({ hostname, port, routes, fetch, websocket })` with the WebSocket handler added in Task 9 (leave a `fetch` fallback returning `404` JSON now). `pnpm run check`, then:

```bash
git add packages/server knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(server): add the token authority, HTTP routes and the blob store"
```

---

### Task 9: Server: WebSocket protocol with backfill and pub/sub

**Files:**
- Create: `packages/server/src/ws.ts`, `packages/server/src/dispatcher.ts`
- Create: tests `test/ws.test.ts`, `test/dispatcher.test.ts`
- Modify: `packages/server/src/server.ts`, `src/index.ts`

**Interfaces:**
- Produces: `createDispatcher({ workbox, store }): (command: ClientCommand, context) => Promise<ServerFrame>` mapping every client command to a `Workbox` call and an `ack { result }` or `error` frame (shared by HTTP `POST /api/command` and WebSocket); the WebSocket endpoint `GET /ws?ticket=…`: upgrade only with a valid ticket and a matching or absent `Origin`; on open send `hello`; `subscribe` replies with a backfill of `event` frames from `sinceSeq` (filtered by `projectIds` when given), then subscribes the socket to the topics `events:all` or `events:project:<id>`; the server publishes every stored envelope to its topics after the store's `append` resolves and every transient frame to `transient:session:<id>` (subscribers of the session's project receive them); `snapshot` is sent after the backfill for sessions with an in-flight partial; unknown or invalid frames yield `error { code: 'bad_request' }` without closing the socket; `maxPayloadLength` 1 MB; `idleTimeout` 120 with `sendPings`.

- [ ] **Step 1: Failing tests**

`dispatcher.test.ts` covers every command once with a scripted `Workbox`. `ws.test.ts` with Bun's global `WebSocket` against the in-process server: upgrade without a ticket → `401` (HTTP response), with a used ticket → `401`, with a foreign `Origin` → `403`; the first frame after the upgrade is `hello`; after `subscribe { sinceSeq: 0 }` the client receives the persisted events in `seq` order, then live events; an append performed by the test during the backfill (make the store's `readSince` resolve late with an injected delay in a test double, then append) must still arrive once and in order (the server buffers live events for the subscribing socket until the backfill has been sent, then flushes those with `seq` greater than the last backfilled); `session.prompt` through the socket produces an `ack` and the resulting events arrive live; a second client subscribed to a different project does not receive them; a transient frame reaches a subscriber of the session's project.

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add packages/server
git commit -s -m "feat(server): add the WebSocket protocol with gap-free backfill and per-project pub/sub"
```

---

### Task 10: CLI: daemon lifecycle and the composition root

**Files:**
- Create: `apps/cli/src/daemon/compose.ts`, `apps/cli/src/daemon/daemon-file.ts`, `apps/cli/src/daemon/lock.ts`, `apps/cli/src/daemon/client.ts` (HTTP client for `daemon.json`-recorded daemons: health, command, shutdown), `apps/cli/src/commands/serve.ts`, `apps/cli/src/commands/status.ts`, `apps/cli/src/commands/stop.ts`, `apps/cli/src/commands/start.ts` (the default command), `apps/cli/src/config.ts` (loads `WORKBOX_HOME/config.json` through `parseUserConfig`, writes nothing)
- Create: tests `apps/cli/test/daemon-file.test.ts`, `apps/cli/test/lock.test.ts`, `apps/cli/test/serve.test.ts` (spawns `bun run src/main.ts serve --port 0` in a temp home with `WORKBOX_HARNESS=fake`, waits for `daemon.json`, calls health, then `stop`), `apps/cli/test/start.test.ts` (default command attaches to a running daemon without a second instance; `--no-open` skips the browser; the browser opener is injected and recorded)
- Modify: `apps/cli/src/commands/main.ts` (subcommands and the default `run`), `apps/cli/package.json` (dependencies `@workbox/core`, `@workbox/store-sqlite`, `@workbox/harness-fake`, `@workbox/sandbox-host`, `@workbox/server`, `open: catalog:`), `pnpm-workspace.yaml` (catalog `open: ^11.0.4`), `packages/i18n/messages/{en,cs}.json` (keys `cli_start_running_at`, `cli_start_attached`, `cli_status_*`, `cli_stop_*`), `knip.jsonc`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: the CLI-private `daemon.json` schema (`apps/cli/src/daemon/daemon-file.ts`, Zod-validated) `{ version, protocolVersion, pid, port, bearer, startedAt }` written with mode `0o600` to `<home>/daemon.json` by the serve process and removed on shutdown; `acquireLock(home)` creating `<home>/lock` exclusively (`wx`) with the pid, treating a lock whose pid is not alive as stale; `composeDaemon({ home, env, port, harness: 'fake' | 'claude', logger })` building the store at `<home>/workbox.db`, the blob dir `<home>/blobs`, the host sandbox, the adapter registry (plan 2 ships `fake` only; `claude` is a placeholder adapter whose `authStatus` reports `none` and whose `start` rejects with `WorkboxError('internal', 'planned in plan 4')`), the `Workbox`, the server, `recoverAfterRestart()`, and graceful shutdown on `SIGINT`/`SIGTERM` and on the admin endpoint; `workbox serve [--port] [--harness fake|claude]` runs until stopped and prints the port, the bearer never; `workbox status [--json]` reads `daemon.json`, calls `GET /api/health` and `GET /api/summary` (Task 8), and prints daemon state, port, protocol version and session counts by group (or "not running" with exit code 1 when `daemon.json` is missing or stale); `workbox stop` posts `POST /api/admin/shutdown` with the recorded bearer and waits for `daemon.json` to disappear (10 s); `workbox [--no-open]` attaches when `daemon.json` names a live daemon (health answers with the right protocol major) and otherwise spawns `process.execPath run src/main.ts serve --port 0` (or the compiled binary itself when `process.execPath` is the `workbox` binary) detached with stdio ignored, waits up to 10 s for `daemon.json`, then in both cases mints a one-time token through `POST /api/admin/one-time-token` with the recorded bearer and opens `http://127.0.0.1:<port>/?token=<one-time>` through `open` (injected, so tests record the URL instead of opening a browser).

- [ ] **Step 1: Failing tests**

`daemon-file.test.ts`: round trip, `0o600` on POSIX (`test.skipIf(win32)` for the mode assertion), a stale file whose pid is not alive is reported as stale. `lock.test.ts`: second acquisition fails while the first is held, succeeds after release, and a stale lock is replaced. `serve.test.ts` and `start.test.ts` as described (they spawn the CLI through `process.execPath`, set `WORKBOX_HOME` to a `mkdtemp` directory, `WORKBOX_HARNESS=fake`, and always stop the daemon in `afterEach`).

- [ ] **Step 2: Implement, check, commit**

`pnpm run check`, then:

```bash
git add apps/cli packages/i18n pnpm-workspace.yaml knip.jsonc pnpm-lock.yaml
git commit -s -m "feat(cli): start, attach, stop and inspect the daemon"
```

---

### Task 11: CLI: project and session commands, end-to-end run with the fake harness

**Files:**
- Create: `apps/cli/src/commands/project.ts` (`project add <path>`, `project ls`), `apps/cli/src/commands/session.ts` (`session new --project <id> --branch <name> [--employee <id>] "<prompt>"`, `session ls`, `session stop <id>`), `apps/cli/src/output/table.ts` (plain aligned text, `--json` alternative)
- Create: tests `apps/cli/test/project-session.test.ts` (an end-to-end run: temp home, temp git repository from the sandbox-host test helper, `serve` in the background, `project add`, `session new` with the fake scenario `permission-then-complete`, poll `session ls --json` until the session is `waiting_for_permission`, resolve it through `POST /api/command` with `permission.resolve`, poll until `completed`, assert through `session ls --json` that `lastSeq` grew and through `POST /api/command { type: 'session.search', query }` that the scenario's message text is found, then `stop`)
- Modify: `apps/cli/src/commands/main.ts`, `packages/i18n/messages/{en,cs}.json` (table headers and messages), `README.md` (a "Commands" section listing every command of spec section 7.4 that exists now, marking `auth` and `export` as planned)

**Interfaces:**
- Consumes: `POST /api/command` from Task 8 through `apps/cli/src/daemon/client.ts`.
- Produces: the commands above with `--json`; exit code 1 on a daemon error frame with the localised message.

- [ ] **Step 1: Failing tests, Step 2: implement, Step 3: check and commit**

The end-to-end test is the acceptance test of this plan: it must pass on all three CI runners (git is installed on every GitHub runner; the test sets `GIT_CONFIG_GLOBAL` to a temp file so the host's git config is ignored). `pnpm run check`, then:

```bash
git add apps/cli packages/i18n README.md
git commit -s -m "feat(cli): add project and session commands with an end-to-end fake-harness run"
```

---

### Task 12: Decision records, developer experience and the plan index

**Files:**
- Modify: `docs/adr/0003-append-only-event-log-as-the-source-of-truth.md` (amendment: `bun:sqlite` directly with embedded SQL migrations instead of Drizzle, FTS5 asserted at start-up, projections materialised in the append transaction)
- Create: `docs/adr/0012-localhost-protocol-with-token-exchange-and-websocket-tickets.md` (MADR: context, decision covering one-time token → bearer, SHA-256 hash in `daemon.json`, 30 s single-use tickets, origin check, `POST /api/command` as the CLI transport, pub/sub topics, backfill semantics; consequences)
- Modify: `package.json` (root `dev` script runs `turbo run dev` with the CLI's `dev` script set to `bun run --watch src/main.ts serve --port 4820 --harness fake`), `docs/superpowers/plans/README.md` (plan 2 row: in review → merged at PR time), `CONTRIBUTING.md` (how to run the daemon with the fake harness and where scenarios live)

- [ ] **Step 1: Write, check, commit**

`pnpm run check` (markdownlint, cspell on the ADRs), then:

```bash
git add docs/adr package.json docs/superpowers/plans/README.md CONTRIBUTING.md
git commit -s -m "docs: record the storage access and localhost protocol decisions for the daemon core"
```
