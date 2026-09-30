# Workbox — Sub-project 1: Foundation and Vertical Slice — Design Spec

- Status: design approved section by section in brainstorming on 2026-09-30; awaiting the owner's review of this written spec before planning.
- Owner: Ondřej Misák (misaon/workbox).
- Language policy: source code, commits and documentation in English; the product UI in Czech and English.
- Research inputs (all facts verified online on 2026-09-30, sources inside each report): [R1 subscriptions and agent auth](../research/2026-09-30-R1-subscriptions-and-agent-auth.md), [R2 agent harness frameworks](../research/2026-09-30-R2-agent-harness-frameworks.md), [R3 runtime, desktop, CLI](../research/2026-09-30-R3-runtime-desktop-cli.md), [R4 frontend and pixel-art sim](../research/2026-09-30-R4-frontend-and-pixel-art-sim.md), [R5 agent sandboxing](../research/2026-09-30-R5-agent-sandboxing.md), [R6 remote control and security](../research/2026-09-30-R6-remote-control-and-security.md), [R7 repo engineering toolchain](../research/2026-09-30-R7-repo-engineering-toolchain.md), [R8 skills, MCP, workflow patterns](../research/2026-09-30-R8-skills-mcp-workflow-patterns.md), [R9 library verification](../research/2026-09-30-R9-library-verification.md).

## 1. Context and intent

Workbox is an open-source, local-first orchestrator for AI coding agents whose unique pillar is a Sims-like pixel-art office: every agent is an employee who walks, sits at a desk while working, hands over envelopes when delegating, visits the kitchen, and raises a hand when it needs a human decision. Each project is a floor of the same building.

The owner's real delivery flow that Workbox will eventually automate end to end: Jira ticket to In Progress, clone the repository on a chosen branch, implement with an agent, open a GitHub PR, ask a colleague on Slack for review, react to review comments, merge, post the PR link and short tester notes to the Jira ticket, move it to Testing. Sometimes there is no ticket, sometimes no review is needed.

Hard constraints from the owner: agents run on the owner's existing Claude and ChatGPT subscriptions with zero paid API usage; TypeScript-first; browser, desktop and CLI from one command; small binary (never hundreds of MB); bleeding-edge but verified technology; pedantic linting and strict CI; smooth animations with no layout jank; Czech and English; telemetry good enough for a later AI-driven prompt and skill improvement loop; agents as autonomous as possible, asking only when necessary and always with a recommended option.

### 1.1 Decomposition

The whole product was decomposed into eight sub-projects, each with its own spec and plan:

1. **Foundation and thin vertical slice** (this spec).
2. Full office simulation: needs, moods, habits, routines, art pipeline, employee customisation, notifications polish.
3. Delivery workflow engine: roles and hand-offs, Jira, GitHub, Slack, approval points with recommended defaults.
4. Second harness and the agnostic layer: Codex app-server adapter, generic ACP adapter, custom agents with model, effort and prompt, usage meters per subscription.
5. Sandbox providers: OS sandbox by default, microVM, OCI, remote.
6. Remote control: end-to-end encrypted relay, phone PWA, Web Push.
7. Desktop shell and releases: Tauri sidecar, signing and notarisation, updater, multi-OS release pipeline.
8. Skills sync, telemetry exporters and the improvement loop, auto-compaction policies.

Sub-project 1 was chosen first because it proves the one architecture everything else depends on (the event log consumed by chat, office and telemetry alike) and retires the largest external risk first (running Claude on the subscription in a compliant way).

### 1.2 Research findings that shaped the design

- Anthropic's help centre states (2026-06-16) that Agent SDK, headless `claude -p` and third-party app usage draw from the subscription's limits, while the legal page forbids third parties from intermediating tokens or offering claude.ai login. The policy changed four times in 2026 and a monthly credit model was paused, not cancelled. The compliant posture is to run the unmodified Claude Code binary through the Agent SDK with the user's own login, never touching tokens, and to ship an API-key fallback with a budget UI from day one (R1, R5).
- OpenAI officially allows open-source apps on ChatGPT Plus/Pro through `codex app-server`; Gemini ended consumer login in June 2026; ACP by Zed offers a generic adapter layer with 50+ agents (R1, R2). These arrive in sub-project 4 but the adapter port is designed for them now.
- No general agent framework runs on a subscription; every coordinator role must run inside the same harnesses in cheap mode (R2).
- A Bun-compiled binary has a floor of roughly 80 MB on disk; Tauri adds 5 to 10 MB. Bun 1.4 was rewritten from Zig to Rust, Bun is owned by Anthropic and Claude Code itself is a Bun binary. TypeScript 7.0 is GA but its programmatic API arrives in 7.1 (R3, R7).
- React 19.3 is the only hyped UI framework that is also stable; Vue 3.6 Vapor and Solid 2.0 are release candidates. PixiJS 8 fits a renderer-only role; WebGPU cannot be required because WebKitGTK lacks it (R4).
- LimeZu art used by all prior art forbids redistribution; Kenney packs are CC0 (R4, R9).
- Prior art (munder-difflin, pixel-agents, agentroom, Paseo, Happy, Vibe Kanban) fuses behaviour with rendering and wraps vendor CLIs with native logins. The open niche is a headless deterministic simulation plus multi-vendor orchestration plus E2EE remote control (R4, R6).
- Vitest does not run on the Bun runtime and `bun:sqlite` cannot load under Node, so daemon packages test with `bun test` and only the browser client uses Vitest (R9).

## 2. Goals, non-goals and success criteria

### 2.1 In scope

- Monorepo with the full pedantic toolchain, CI, Conventional Commits, release automation skeleton and community files.
- The `workbox` daemon: projects, employees, sessions, workspaces, append-only event log in SQLite, projections, typed WebSocket/HTTP protocol, one-time token auth on localhost.
- Claude Code integration through the Claude Agent SDK behind a vendor-neutral `HarnessAdapter` port, plus a scriptable fake adapter.
- Git worktree per session behind a `SandboxProvider` port with a host implementation.
- Web UI: dashboard, session creation with project and branch selection, chat with live transcript, streaming Markdown, tool cards, images with lightbox, attachments, copy buttons, search, asking dialog with a recommended option, usage chip, notifications, Czech and English.
- Office: one floor per project, multiple employees per floor bound to sessions, a small behaviour repertoire including a coffee routine that exercises pathfinding, behaviour trees and needs; headless deterministic simulation in a Web Worker; PixiJS renderer.
- Cross-cutting skeletons: structured logging with a debug flag, telemetry schema and JSONL export, i18n, error taxonomy.
- One-command start: `workbox` starts or attaches to the daemon and opens the browser; `workbox serve` runs headless.

### 2.2 Out of scope, with the seam prepared

Jira, GitHub and Slack integrations (3); Codex and ACP adapters, custom agent editor, per-vendor usage meters (4); sandboxes beyond the host worktree (5); Tauri shell, signing, updater (7); phone access and relay (6); skills sync, OTLP export, compaction policies (8); the full life simulation and the layout editor (2).

### 2.3 Success scenario (acceptance demo)

1. Run one command in a terminal. The daemon starts on a free localhost port, the browser opens, an empty state offers to add a project.
2. Add a project by path. Workbox detects its default branch and shows the floor for it.
3. Create a session: branch preselected to the default, an employee with a name and appearance, an initial prompt, optionally an attached image.
4. The employee enters by the elevator, walks to a free desk, an envelope drops on the desk, the employee types while the transcript streams and tool cards appear.
5. The agent asks for permission to run a command. The asking dialog appears with a recommended option; pressing Enter accepts it; the employee returns to typing.
6. The turn completes. The employee shows a check bubble, a desktop notification and a sound fire, the dashboard shows the session under done.
7. A second project is added; its floor is a second tab; a second session runs in parallel; floor tabs show pending counts; switching floors animates.
8. `workbox stop` then `workbox` again: sessions are listed, transcripts intact, resuming a session continues the same Claude session.
9. The UI switches between Czech and English without reload of state.

### 2.4 Quality bars

| Bar | Target |
|---|---|
| Office idle CPU on an M4 MacBook, one floor visible | under 5 % |
| Simulation tick for three floors with eight employees each | under 1 ms |
| Rendering | 60 fps, interpolation between 20 Hz snapshots, paused when hidden |
| Transcript streaming | no layout shift, virtualised, end-anchored |
| Daemon binary | roughly 80 MB on disk, 25 to 40 MB compressed, per platform |
| PR CI wall time | under 10 minutes with caches warm |
| Coverage | thresholds on core, protocol and sim (numbers decided in the plan, proposal 90 %) |

## 3. Key decisions

| Decision | Choice | Evidence |
|---|---|---|
| Core shape | Append-only event log as the single source of truth; chat, dashboard, office and telemetry are projections | R2, R4, prior-art gap |
| Runtime and packaging | One Bun 1.4.2 compiled binary: CLI, daemon, web server with embedded UI; later a Tauri sidecar | R3 |
| Claude integration | `@anthropic-ai/claude-agent-sdk` 0.3.285 running the bundled unmodified binary with the user's own login; never `--bare`; API-key fallback | R1, R2 |
| UI framework | React 19.3 with React Compiler 1.0, Vite 8.3, Tailwind 4.3, shadcn/ui on Base UI 1.8, Motion 13.4, Streamdown 2.7, TanStack Virtual, TanStack Router 1.170, Zustand 5, TanStack Query 5 | R4, R9 |
| Office | Headless deterministic `sim` package in a Web Worker; PixiJS 8.21 renderer only, WebGL2 baseline, WebGPU behind a setting | R4, R9 |
| Schema | Zod 4.6 for protocol messages, events and config, with JSON Schema export | R9 |
| Storage | `bun:sqlite` in WAL mode through Drizzle ORM 0.45 with versioned migrations | R9 |
| Package management | pnpm 12.8 with catalogs and supply-chain guards; Turborepo 2.11 | R7 |
| Lint and format | Oxlint 1.86 with type-aware rules via tsgolint; Oxfmt 0.71 with Prettier 3.9 fallback; thin ESLint 10 only for boundaries | R7 |
| TypeScript | 7.0.2 (tsgo) for type checking; `erasableSyntaxOnly` keeps Node type stripping as an escape hatch | R3, R7 |
| Tests | `bun test` for daemon and shared packages; Vitest 5 browser mode and Storybook 10 for the client; Playwright 1.63 end to end | R7, R9 |
| Release | commitlint, lefthook, release-please 17.11, GitHub Releases with SLSA provenance, npm trusted publishing | R7 |
| License | Apache-2.0 (patent grant; wraps proprietary CLIs) | R7 |
| Art | Kenney CC0 packs, 16 × 16 px base, integer scaling; Tiled 1.12 maps; Aseprite export with a conversion step | R4, R9 |

## 4. Architecture

### 4.1 System overview

```
 workbox (Bun binary)                                     browser (React 19.3)
┌───────────────────────────────────────────────┐   WS+HTTP  ┌──────────────────────────────┐
│ CLI │ daemon                                  │◄──────────►│ chat, dashboard, dialogs      │
│     │  event log (SQLite, append-only)        │  typed     │ office canvas (PixiJS)        │
│     │  session runtime (one actor per session)│  events    │   ▲ snapshots                 │
│     │    port HarnessAdapter ◄─ harness-claude│            │ sim (Web Worker, headless)    │
│     │    port SandboxProvider ◄─ sandbox-host │            │   ▲ the same events           │
│     │  projections: transcript, dashboard,    │            └──────────────────────────────┘
│     │               usage, search index       │
│     │  embedded static UI, token auth         │
└───────────────────────────────────────────────┘
```

The daemon is the only stateful process. Every UI (browser now, Tauri window and phone later) is a client of the same protocol. The office is not a server projection; each client simulates it from the event stream.

### 4.2 Monorepo layout

```
workbox/
├─ apps/
│  ├─ cli/             # binary entry: commands, composition root, daemon start, browser open
│  └─ web/             # React SPA built with Vite, embedded into the binary
├─ packages/
│  ├─ protocol/        # leaf: Zod schemas for events, commands, frames, config; pure projections; protocol version
│  ├─ core/            # domain: Project, Employee, Session, Workspace; ports HarnessAdapter, SandboxProvider, EventStore; session runtime
│  ├─ harness-claude/  # HarnessAdapter over the Claude Agent SDK
│  ├─ harness-fake/    # scriptable HarnessAdapter for tests, demos and UI development without a subscription
│  ├─ sandbox-host/    # SandboxProvider: host process + git worktree per session
│  ├─ store-sqlite/    # EventStore over bun:sqlite via Drizzle, versioned migrations, FTS index
│  ├─ server/          # Bun.serve: HTTP routes, WebSocket, token exchange, static UI
│  ├─ sim/             # headless deterministic office simulation, no DOM, no Pixi
│  ├─ office-render/   # PixiJS renderer, spritesheets, camera, snapshot interpolation, React island
│  ├─ i18n/            # Paraglide project with cs and en messages
│  └─ observability/   # LogTape setup, debug flag, redaction, telemetry schema, JSONL export
├─ assets/             # CC0 pixel-art sources, Tiled maps, Aseprite files, CREDITS.md
├─ docs/               # superpowers specs and plans, research, ADRs
└─ .github/            # workflows, issue forms, PR template, Renovate config
```

### 4.3 Dependency rules (enforced by lint)

- `protocol`, `i18n` and `observability` depend on no internal package.
- `core` depends only on `protocol`. It uses no Bun API and no DOM so it can be tested anywhere.
- `sim` depends only on `protocol`. Never on `office-render`, React or the DOM.
- `harness-*`, `sandbox-host`, `store-sqlite` and `server` depend on `core` and `protocol`, never on each other.
- `apps/web` depends on `protocol`, `sim`, `office-render` and `i18n`. Never on `core`.
- `apps/cli` may import everything. It is the only composition root.

### 4.4 One-command start and daemon lifecycle

- `workbox` with no arguments reads `~/.workbox/daemon.json`; if a daemon answers on the recorded port with the recorded token, it opens the browser at the existing instance; otherwise it starts the daemon on a free port bound to 127.0.0.1, writes `daemon.json` (port, pid, token hash, protocol version) with owner-only permissions, generates a one-time browser token and opens the browser at `http://127.0.0.1:<port>/?token=<one-time>`. The terminal shows a short summary with the URL.
- `workbox serve` runs headless (no browser), suitable for systemd; it accepts `--port`. `workbox --no-open` starts or attaches to the daemon without opening the browser.
- A lock file under `WORKBOX_HOME` guarantees a single instance per home. `WORKBOX_HOME` defaults to `~/.workbox`.
- On shutdown the daemon stops running harness processes gracefully, marks their sessions `idle` with a resume hint, and removes `daemon.json` and the lock.

## 5. Domain model and event log

### 5.1 Entities

| Entity | Fields (slice 1) |
|---|---|
| Project | id, name, path, defaultBranch, config (parsed `.workbox/config.json` plus local override), createdAt, updatedAt. One floor in the office. |
| Employee | id, projectId, name, appearance (body preset, skin, hair, outfit palette), gender, role (`developer`), harness (`claude`), model, effort, systemPromptAppend, permissionMode, deskId, createdAt, updatedAt. |
| Session | id, projectId, employeeId, title, baseBranch, workspace (path, branch), status, harnessSessionId, lastSeq, createdAt, updatedAt, archivedAt. |
| Workspace | git worktree at `~/.workbox/workspaces/<projectId>/<sessionId>/` on branch `<branchPrefix><slug>`; setup commands from config run after creation. |
| Event | seq (global, monotonic), sessionId (nullable for project-level events), type, v (schema version of the type), payload, ts, source (`harness`, `user`, `system`), sourceId (idempotency key). |

### 5.2 Session state machine

States: `creating`, `idle`, `running`, `waiting_for_permission`, `waiting_for_answer`, `completed`, `failed`, `stopped`. Archiving is a flag set by `session.archived`, not a state.

| From | Trigger | To |
|---|---|---|
| creating | workspace prepared and harness bound | idle |
| creating | preparation error | failed |
| idle, completed, failed, stopped | prompt | running |
| running | permission.requested | waiting_for_permission |
| waiting_for_permission | permission.resolved | running |
| running | question.asked | waiting_for_answer |
| waiting_for_answer | question.answered | running |
| running | turn.completed | completed |
| running | turn.failed | failed |
| running, waiting_* | interrupt | idle |
| any non-terminal | stop | stopped |

A prompt sent while `running` is queued and becomes the next turn. Every transition emits `session.status_changed`. The dashboard groups `waiting_*` as "waiting for me", `running` and `creating` as running, `completed` as done, and `idle`, `failed` and `stopped` as needing attention.

### 5.3 Event catalogue

| Group | Event | Payload summary |
|---|---|---|
| Project and people | project.registered | id, name, path, defaultBranch |
| | project.updated | id, changed fields |
| | project.removed | id |
| | employee.created | employee fields |
| | employee.updated | id, changed fields |
| Session | session.created | id, projectId, employeeId, title, baseBranch |
| | session.status_changed | id, from, to, reason |
| | session.renamed | id, title |
| | session.archived | id |
| | workspace.prepared | sessionId, path, branch, setupCommandResults |
| | workspace.removed | sessionId |
| Conversation | turn.started | sessionId, turnId, prompt text, attachment ids, queuedAt |
| | message.completed | sessionId, turnId, messageId, role, blocks (text, tool_use, tool_result ref, image ref), model |
| | tool.started | sessionId, turnId, toolCallId, name, inputSummary, category (read, edit, run, web, other) |
| | tool.completed | sessionId, turnId, toolCallId, outputSummary, isError, durationMs, attachment ids |
| | turn.completed | sessionId, turnId, stopReason, durationMs |
| | turn.failed | sessionId, turnId, error.type, message |
| Human decisions | permission.requested | sessionId, requestId, toolCallId, name, input, options, recommended, reason |
| | permission.resolved | sessionId, requestId, decision, updatedInput, decidedBy (user, policy, timeout), latencyMs |
| | question.asked | sessionId, requestId, questions with options, recommended |
| | question.answered | sessionId, requestId, answers, decidedBy, latencyMs |
| Harness | harness.bound | sessionId, harness, harnessSessionId, model, tools, skills, version |
| | harness.auth_status | harness, kind (subscription, api_key, none), plan, account label |
| | harness.error | sessionId, error.type, message |
| | context.compacted | sessionId, tokensBefore, tokensAfter, trigger |
| | subagent.started | sessionId, subagentId, name |
| | subagent.stopped | sessionId, subagentId, outcome |
| Usage | usage.reported | sessionId, turnId, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costEstimateUsd, model |
| | rate_limit.reported | harness, window, utilisation, resetsAt (only what the SDK reports) |
| Attachments | attachment.added | id (sha256), sessionId, mime, bytes, origin (user, agent), name |

Transient frames (broadcast, never stored): `message.delta`, `thinking.delta`, `tool.progress`.

### 5.4 Log rules

- Append-only: no update or delete of rows. Archiving is an event; blob garbage collection is a separate maintenance command that only removes blobs no event references.
- Idempotency: adapters set `sourceId` for every event they derive from the harness; the store ignores duplicates, so crash and resume never double-record.
- Versioning: every event type has a schema version; `protocol` exports `PROTOCOL_VERSION` (semver); clients with a different major must reload and are told why.
- A client that subscribes mid-turn receives the persisted log from its cursor plus a `snapshot` of in-flight partial messages held in the session runtime's memory.

### 5.5 Projections and queries

- `projects`, `employees` and `sessions` tables are materialised in the same transaction as the event append; the dashboard reads them directly.
- Transcript per session is folded on demand from events by a pure function in `protocol/projections` (shared with the client); message text is indexed in SQLite FTS5 for search (availability in `bun:sqlite` confirmed in the plan; fallback is a LIKE index).
- Usage aggregates per session, project and day come from `usage.reported`.
- Search returns message ids with highlights; the client scrolls to and highlights matches.

### 5.6 Storage layout and configuration

`~/.workbox/` (override with `WORKBOX_HOME`): `workbox.db` (SQLite WAL), `blobs/<sha256>` with a metadata table for MIME and names, `workspaces/`, `logs/`, `daemon.json`, `config.json`, `telemetry/` exports, `lock`.

User config `~/.workbox/config.json` (Zod-validated, JSON Schema published):

```json
{
  "locale": "cs",
  "notifications": { "desktop": true, "sound": true },
  "office": { "renderer": "webgl" },
  "harness": { "claude": { "pinSystemBinary": false } }
}
```

Project config `.workbox/config.json` (committed) with `.workbox/config.local.json` (gitignored) merged over it:

```json
{
  "$schema": "https://raw.githubusercontent.com/misaon/workbox/main/schemas/workbox.config.schema.json",
  "defaultBranch": "main",
  "workspace": { "branchPrefix": "workbox/", "setupCommands": ["pnpm install --frozen-lockfile"] },
  "employees": [
    { "name": "Alice", "appearance": { "body": "a", "skin": 2, "hair": 4, "outfit": 1 }, "gender": "female" }
  ],
  "harness": {
    "claude": { "model": "", "effort": "medium", "permissionMode": "acceptEdits", "allowedTools": [] }
  },
  "permissions": {
    "bashAllow": ["^git (status|diff|log|add|commit|fetch|pull)\\b", "^(pnpm|npm|bun) (install|test|lint|build|run)\\b"],
    "bashDeny": ["\\brm -rf\\b", "\\bgit push --force\\b", "\\bsudo\\b", "curl .*\\| *sh"],
    "webFetchAllow": ["docs.github.com", "developer.mozilla.org"]
  },
  "env": { "passthrough": ["PATH", "HOME", "LANG", "LC_ALL", "ANTHROPIC_API_KEY"] }
}
```

Unknown keys fail validation with a message pointing at the schema. Missing file means defaults.

## 6. Harness integration

### 6.1 The port

```ts
interface HarnessAdapter {
  readonly id: HarnessId                        // 'claude' | 'fake' now; 'codex' | 'acp' later
  describe(): HarnessInfo                       // version, capabilities: resume, fork, steer, models, efforts
  authStatus(): Promise<AuthStatus>             // { kind: 'subscription' | 'api_key' | 'none', plan?, account? }
  start(spec: HarnessSessionSpec, sink: EventSink): Promise<HarnessSession>
}

interface HarnessSessionSpec {
  sessionId: string
  cwd: string                                   // workspace path
  workspace: Workspace                          // handle for SandboxProvider.spawn
  employee: EmployeeRuntimeConfig               // model, effort, permissionMode, allowedTools, systemPromptAppend
  resumeId?: string
  env: Record<string, string>                   // already filtered by the env allowlist
  spawn: SandboxProvider['spawn']               // the adapter must launch processes through the sandbox seam
}

interface HarnessSession {
  prompt(turn: TurnInput): Promise<void>        // text + attachment ids; queued while running
  resolvePermission(requestId: string, decision: PermissionDecision): void
  answerQuestion(requestId: string, answer: QuestionAnswer): void
  interrupt(): Promise<void>
  stop(): Promise<void>
  contextUsage(): Promise<ContextUsage>
}
```

`EventSink` accepts normalised events and transient frames from section 5. Adapters never touch UI concerns.

### 6.2 Claude adapter

- One Claude Code process per session, started through `query()` with an async-iterable prompt (streaming input) so all turns share one process, context and prompt cache. `includePartialMessages` provides deltas. `resume` with the stored harness session id restores a session after a daemon restart; `forkSession` is exposed by `describe()` for later use.
- `settingSources: ['user', 'project', 'local']` so the repository's CLAUDE.md, skills, hooks and MCP configuration apply exactly as in the terminal. `permissionMode` comes from the employee config (default `acceptEdits`). `model`, `effort`, `maxTurns` and `maxBudgetUsd` come from config. `pathToClaudeCodeExecutable` is set only when `pinSystemBinary` is true. `--bare` is never used because it drops OAuth.
- The process is launched through `spec.spawn` (the SDK's custom spawn hook), so sub-project 5 can wrap it without touching the adapter.
- Login belongs to Anthropic: Workbox never reads, copies or refreshes tokens. `authStatus()` runs `claude auth status` (JSON by default; exact fields confirmed in the plan) and emits `harness.auth_status`. When `ANTHROPIC_API_KEY` is present in the passthrough env the adapter reports `api_key` and the UI enforces the per-session budget cap.
- Mapping from SDK messages to events:

| SDK | Event |
|---|---|
| system init | harness.bound |
| assistant message | message.completed with text, tool_use and image blocks; tool_use also emits tool.started |
| user message with tool_result | tool.completed; image results are stored as blobs and referenced |
| stream_event deltas | message.delta, thinking.delta (transient) |
| result | turn.completed plus usage.reported (tokens incl. cache, cost estimate, duration) |
| rate_limit_event | rate_limit.reported |
| PreCompact / PostCompact hooks | context.compacted |
| SubagentStart / SubagentStop hooks | subagent.started / subagent.stopped |
| process exit or SDK error | turn.failed or harness.error with an error.type |

- Usage and limits shown in the UI derive only from SDK events and `accountInfo()`. The undocumented usage endpoint is never called.

### 6.3 Asking dialog and the recommendation policy

- The SDK's `canUseTool` callback produces `permission.requested` and awaits `permission.resolved`; the agent's multiple-choice question tool produces `question.asked` and awaits `question.answered`. One UI component renders both; the phone will reuse the same protocol later.
- Claude Code's own permission rules (settings `allow`, `ask`, `deny`) stay authoritative through `settingSources`. Workbox decides only what to recommend when Claude Code asks, using this order:
  1. Destructive patterns (`bashDeny`, writes outside the workspace, non-allowlisted network) → recommend deny, never auto-resolve.
  2. `bashAllow` matches, read-only tools, edits inside the workspace, `webFetchAllow` domains → auto-allow by policy with `decidedBy: policy` (the dialog is not shown; the transcript shows a small policy note).
  3. Everything else → show the dialog with allow recommended and the reason.
- Questions carry the agent's own recommended option; if none is marked, the first option is shown as recommended with an explicit "agent gave no preference" note.
- A configurable timeout with automatic selection of the recommended option exists for questions only, is off by default, and never applies to permissions.
- Session guards: `maxTurns` and `maxBudgetUsd` from config; compaction is left to Claude Code's auto-compact and shown in the transcript through `context.compacted`.

### 6.4 Fake adapter

A JSON scenario lists timed steps (`delta`, `message`, `tool`, `permission`, `question`, `usage`, `complete`, `fail`) with delays. It powers `pnpm dev`, Storybook stories, `bun test` integration tests and the Playwright e2e run in CI. Scenarios live in `packages/harness-fake/scenarios/`.

## 7. Daemon, protocol and CLI

### 7.1 HTTP

| Route | Purpose |
|---|---|
| `GET /` and static assets | embedded UI, SPA fallback, cache headers |
| `POST /api/auth/exchange` | one-time token → bearer (stored by the client in browser storage) |
| `POST /api/ws-ticket` | bearer → single-use 30 s ticket for the WebSocket upgrade |
| `GET /api/health` | version, protocol version, uptime |
| `POST /api/blobs` | multipart upload, size limit (default 25 MB), returns sha256 and metadata |
| `GET /api/blobs/:sha256` | content with stored MIME type |
| `GET /api/export/telemetry` | JSONL export used by the CLI |

### 7.2 WebSocket protocol

- Endpoint `/ws?ticket=…`. Frames are JSON validated with Zod schemas from `protocol` on both ends.
- Client commands: `subscribe { sinceSeq, projectIds? }`, `project.register`, `project.branches`, `project.update`, `employee.update`, `session.create`, `session.prompt`, `session.interrupt`, `session.stop`, `session.archive`, `session.search`, `permission.resolve`, `question.answer`.
- Server frames: `event { seq, event }`, `transient { frame }`, `snapshot { sessionId, partial }`, `ack { commandId, result }`, `error { commandId?, code, message }`, `hello { protocolVersion, daemonVersion }`.
- `subscribe` backfills from `sinceSeq` then streams live, so reconnects never create gaps. The client reconnects with exponential backoff and pings to keep the connection alive; `Bun.serve` pub/sub topics per project fan out events.

### 7.3 Localhost security

- Bind to 127.0.0.1 only; any other host requires an explicit flag and is reserved for sub-project 6.
- Token hash in `daemon.json` (0600). The one-time browser token is removed from the URL after exchange. WebSocket upgrades require a ticket. Origin must match the daemon's own origin. Uploads are size-limited and content-addressed.

### 7.4 CLI

| Command | Behaviour |
|---|---|
| `workbox [--no-open]` | start or attach daemon, open browser |
| `workbox serve [--port]` | headless daemon |
| `workbox status` | daemon state, port, session counts |
| `workbox stop` | graceful shutdown |
| `workbox doctor` | checks git, the Claude binary and its login, Bun-compiled binary integrity, WORKBOX_HOME permissions |
| `workbox project add <path>` / `project ls` | register and list projects |
| `workbox session new --project <id> --branch <name> [--employee <id>] "<prompt>"` / `session ls` / `session stop <id>` | manage sessions |
| `workbox auth` | show harness auth status and print the vendor's login command |
| `workbox export telemetry [--since] [--include-content]` / `export session <id>` | exports (section 10) |

Global flags: `--json` for machine output, `--debug` (or `WORKBOX_DEBUG=1`, `WORKBOX_DEBUG=full`). The CLI is built with citty 0.2 and opens the browser with `open` 11.

### 7.5 Sandbox seam

```ts
interface SandboxProvider {
  capabilities(): SandboxCapabilities
  prepare(spec: WorkspaceSpec): Promise<Workspace>          // worktree + setup commands
  spawn(ws: Workspace, spec: SpawnSpec): Promise<SandboxedProcess>
  dispose(ws: Workspace): Promise<void>
}
```

`sandbox-host` spawns plain host processes with the env allowlist and cwd inside the workspace, creates worktrees with `git worktree add` (which auto-tracks remote-only branches), lists local and remote branches, detects the default branch, and prunes worktrees on dispose. Git is driven by spawning `git` through `Bun.spawn`; no git library.

## 8. Web UI

### 8.1 Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ top bar: logo · floors = project tabs with pending counts · auth/usage · locale │
├───────────────┬────────────────────────────────┬───────────────────────┤
│ overview      │ office (PixiJS canvas)         │ chat of active session│
│ Waiting for me│ one floor = active project     │ transcript            │
│ Running       │ click an employee to open      │ asking dialog         │
│ Done          │ their session on the right     │ composer + attachments│
│ + new session │                                │                       │
├───────────────┴────────────────────────────────┴───────────────────────┤
│ status bar: daemon, port, version, protocol, debug                      │
└────────────────────────────────────────────────────────────────────────┘
```

Panels have draggable dividers; the office collapses to a thumbnail; chat can expand to full width. Below a tablet breakpoint the three panels become tabs. Floor switches animate the whole canvas.

### 8.2 Screens and states

- Empty state: add a project by typing a path (the daemon validates it and suggests recent paths).
- New session dialog: project, branch list (local and remote, default preselected), employee (name, appearance, gender), first prompt, attachments.
- Transcript: virtualised, end-anchored list; Markdown streamed through Streamdown with Shiki code blocks; tool calls as collapsible cards (name, input, output, duration, error); images as thumbnails with a zoom-and-pan lightbox; copy button on every message; search box backed by the daemon's FTS with in-list highlighting; compaction markers and a context meter inline.
- Asking dialog: a card anchored above the composer, never a modal; recommended option preselected, labelled and explained; Enter confirms; the same request is visible in the overview and as a floor-tab count.
- Composer: multiline, Cmd+Enter sends, paste or drag-and-drop attachments upload to blobs; while running, a sent message shows as queued; interrupt and stop buttons beside the composer.
- Usage chip: subscription plan and today's tokens, plus rate-limit utilisation when reported.
- Notifications on waiting and completion: Web Notification after a one-time permission requested from a click, a short sound through an AudioContext resumed on first gesture, a `document.title` counter with `setAppBadge` when available. All switchable in settings.

### 8.3 Client architecture

- Connection: partysocket 1.3 with the `sinceSeq` cursor; an event bus on top.
- State: Zustand 5 stores normalised by session id; TanStack Query 5 for HTTP calls; pure projections (transcript, overview) imported from `protocol/projections`, the same code the server uses.
- Simulation: `sim` runs in a Web Worker fed by the same events and posts snapshots; `office-render` is a React island owning the canvas.
- Routing: TanStack Router 1.170 with deep links `/`, `/p/:projectId`, `/s/:sessionId`.
- Build: Vite 8.3 output embedded into the binary via `bun build --compile --asset`; in development Vite proxies `/api` and `/ws` to the daemon.

### 8.4 Visual design, motion, i18n, accessibility

- Tailwind 4.3 design tokens; dark and light themes follow the system; system font stack in the UI, pixel font only inside the office.
- Motion 13.4 for panel transitions, list enter and exit, floor switches; honours `prefers-reduced-motion`; transcript rows reserve height to avoid layout shift.
- Paraglide JS 2.25 with `cs` and `en`, strategy `localStorage → cookie → preferredLanguage → baseLocale`, locale switch without reload via React state; dates and numbers through `Intl`.
- shadcn/ui on Base UI 1.8 for dialogs, menus and focus management; full keyboard operation of the asking dialog.

## 9. Office simulation

### 9.1 Employees and sessions

Every session is bound to one employee. When the project's default employee is busy, Workbox creates another persona (name from a pool, random appearance) that the user can rename and recolour (`employee.updated`). Desks are assigned first-free and persist per employee.

### 9.2 Behaviour repertoire (slice 1)

| Event or state | Behaviour |
|---|---|
| session.created | enters by the elevator, walks to the desk, sits |
| turn.started | an envelope drops on the desk, typing starts |
| running, tool.started | typing; bubble with the tool category (read, edit, run, web) |
| waiting_for_permission, waiting_for_answer | stands, faces the camera, pulsing question bubble; click opens the dialog |
| completed (state) | sits, occasional stretch; caffeine need grows; above a threshold walks to the kitchen, drinks coffee, returns |
| turn.completed | check bubble, then idle |
| turn.failed | exclamation bubble, slumped pose |
| stopped, archived | walks to the elevator and despawns |

The coffee routine is deliberately in scope: it proves pathfinding, behaviour trees and needs, which sub-project 2 extends into the full life simulation.

### 9.3 `sim` package

- Fixed 20 Hz tick with an accumulator; input is the event stream filtered per floor plus wall-clock time; output is an immutable `FloorSnapshot { tick, employees: EmployeeState[], effects: Effect[] }` where `EmployeeState = { id, x, y, facing, anim, bubble?, deskId? }`.
- Seeded PRNG (pure-rand 8.4) per floor; same seed plus same event log gives the same run, enabling replay tests.
- ECS-lite without a library: entity ids, typed component tables, systems as functions (movement, needs, behaviour, effects).
- Grid A* with a time-indexed reservation table so two employees never share a tile or a doorway at the same tick.
- Behaviour trees through mistreevous 4.3 behind a Workbox `Behavior` interface; trees: EnterAndSit, Work, WaitForHuman, Idle, CoffeeBreak, Leave.
- The worker simulates all floors; snapshots are posted only for the visible floor (a full snapshot is sent on floor switch). Main-to-worker messages: `init { floors, seeds }`, `event { floorId, event }`, `setVisible { floorId }`, `pause`, `resume`. Worker-to-main: `snapshot { floorId, snapshot }`, `error`. A thin typed `postMessage` wrapper, no RPC library.

### 9.4 `office-render` package

- PixiJS 8.21 as a renderer only: `preference: ['webgl']` by default, `['webgpu', 'webgl']` behind the setting; `antialias: false`, `roundPixels: true`, `resolution: devicePixelRatio`, `autoDensity: true`, `TextureSource.defaultOptions.scaleMode = 'nearest'`, integer world scale.
- Layers: floor tilemap (`@pixi/tilemap` 5.0), furniture sorted by y, employees as animated sprites, bubbles and name labels as `BitmapText`.
- Camera with eased pan and integer zoom steps and auto-fit; rendering runs on `requestAnimationFrame`, interpolates between the last two snapshots, and pauses when the tab is hidden or the panel collapsed.
- `<OfficeCanvas floorId>` React island creates one `Application` for the active floor, swaps scenes with a transition on floor change, and reports clicks and hovers to React for DOM tooltips and session selection.

### 9.5 Assets and pipeline

- Kenney CC0 packs: `roguelike-indoors` (furniture), `roguelike-characters` (bodies and clothing layers used for appearance customisation), `roguelike-rpg-pack` and `tiny-dungeon` (tiles). 16 × 16 px base with integer scaling; tile sizes of two packs were not listed on their pages and are confirmed when downloaded. `assets/CREDITS.md` lists every source.
- The floor is a Tiled 1.12 JSON map with an object layer naming zones (elevator, desks, kitchen with coffee machine, and already-drawn meeting room, toilet and terrace that slice 1 does not use) and a collision layer for walkability.
- Custom animations are exported from Aseprite; a build script converts `meta.frameTags` into Pixi's top-level `animations`.

### 9.6 Budgets

Tick under 1 ms for three floors of eight employees; idle office under 5 % CPU on an M4; 60 fps rendering; determinism tests replay recorded logs and assert invariants (no shared tiles, every employee reaches a desk, snapshots are reproducible).

## 10. Logging, debug, telemetry, errors, security

### 10.1 Logging and debug

- LogTape 2.3 with categories per package (`workbox.core`, `workbox.harness.claude`, `workbox.server`, …); default level `info`; console sink coloured in a TTY and JSON Lines otherwise.
- `--debug` / `WORKBOX_DEBUG=1`: level `debug`, rotating file sink in `~/.workbox/logs/`, plus per-session `debug.jsonl` with raw SDK messages, received commands and WebSocket frame metadata.
- Redaction always on (`@logtape/redaction` field and pattern rules for tokens, authorization, keys, JWTs). Prompt and tool content are logged only with `WORKBOX_DEBUG=full`.

### 10.2 Telemetry

- The event log is the telemetry substrate. `observability` defines an export view per session, turn, tool and human decision: durations, tokens including cache, cost estimate, model, effort, harness version, outcome, human interventions, decision latency, compaction count, error types. Field names follow OpenTelemetry GenAI conventions where they exist (`gen_ai.*`), otherwise `workbox.*`; the schema is versioned because the conventions are still in development.
- `workbox export telemetry` writes JSON Lines with a manifest (schema version, Workbox version); transcript content only with `--include-content`. `workbox export session <id>` bundles events, transcript and debug log after redaction for bug reports.
- No data leaves the machine, not even anonymous statistics. An OTLP exporter arrives in sub-project 8.

### 10.3 Errors and resilience

- `core` returns typed results; adapters translate SDK and process failures into `turn.failed` or `harness.error` with `error.type` in {auth, rate_limit, network, process_crash, sandbox, unknown} and i18n keys for user-facing text.
- A crashed harness process marks the session `failed` with resume offered; after a daemon crash, sessions found `running` at startup become `idle` with a note; the WAL log survives both.
- Client errors are toasts with "copy details" and a link to the session bundle; protocol commands have error codes; a protocol major mismatch forces a reload with an explanation.

### 10.4 Security

- Workbox stores no vendor credentials; only the env allowlist reaches harness processes; env is never logged.
- Paths for blobs, config and workspaces are validated against traversal; worktrees live only under `WORKBOX_HOME` or a configured directory.
- `daemon.json` is owner-only; foreign web pages cannot connect (origin check plus ticket). The threat model grows with sub-projects 5 and 6.

## 11. Toolchain, CI/CD, testing and repository hygiene

### 11.1 Runtime and language

- Bun 1.4.2 pinned (`.bun-version`); Node 24 LTS only for Vite, Vitest and Storybook; Node 26 joins the matrix after its LTS date.
- TypeScript 7.0.2 (tsgo) for type checking with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, and `isolatedDeclarations` in packages.

### 11.2 Packages and monorepo

- pnpm 12.8: catalogs, `minimumReleaseAge: 4320`, `trustPolicy: no-downgrade`, `blockExoticSubdeps: true`; Turborepo 2.11 with remote cache; `turbo boundaries` (experimental) plus eslint-plugin-boundaries in a thin ESLint 10 config for the dependency rules of section 4.3.

### 11.3 Lint and format

- Oxlint 1.86 with oxlint-tsgolint (type-aware): categories correctness, suspicious, pedantic, perf, restriction at error; plugins react, react-hooks, jsx-a11y, import, promise, unicorn; every disable comment must carry a reason.
- Oxfmt 0.71 (Prettier 3.9 for unsupported file types); knip 6; publint + arethetypeswrong for published packages; cspell 10 with cs and en dictionaries; markdownlint-cli2; ls-lint (kebab-case files); actionlint; zizmor; gitleaks.
- lefthook 2.1: pre-commit format and lint on staged files, commit-msg commitlint 21, pre-push typecheck and affected tests.

### 11.4 Commits, versioning, changelog, releases

- Conventional Commits enforced by commitlint locally and in CI, including PR title validation (squash merges, linear history).
- release-please 17.11 manifest mode: release PR with generated `CHANGELOG.md`; on merge, tag and GitHub Release; one product version.
- Release workflow: `bun build --compile` for all supported targets on one Linux runner, artefacts attached to the Release, SLSA provenance via `actions/attest-build-provenance` v4, npm meta-package with per-platform optional dependencies published through trusted publishing (OIDC). Binaries are unsigned until sub-project 7; the README documents removing macOS quarantine meanwhile.
- npm name: `workbox` is taken by an old placeholder and Google owns `workbox-cli` and `workbox-*`. The command stays `workbox` (bin name); the npm package name is an open question (section 13).

### 11.5 CI on GitHub Actions

- `ci.yml` on `pull_request`, `merge_group` and `push` to `main`; jobs: `static` (all linters, commitlint), `test-daemon` (`bun test` on ubuntu-26.04, macos-26, windows-latest), `test-web` (Vitest browser mode, Storybook tests), `build` (turbo build, binary compilation, publint), `e2e` (Playwright against the compiled binary with the fake harness).
- Actions pinned to SHAs (`actions/checkout` v7, `actions/setup-node` v7, `pnpm/action-setup` v6, `oven-sh/setup-bun` v2, `actions/cache` v6, `actions/upload-artifact` v7); `permissions: contents: read`; concurrency cancellation; pnpm store and Turbo caches; ARM runners where useful.
- No merge queue (personal repository); required checks plus squash merge.
- Renovate with `config:best-practices`: automerge minor and patch dev dependencies after the cooldown, weekly lockfile maintenance, ecosystem grouping, off-hours schedule; Dependabot security alerts only; weekly OpenSSF Scorecard; CodeQL default setup.

### 11.6 Testing strategy

- Daemon and shared packages: `bun test` unit and integration tests (store on a temporary database, session runtime with the fake harness, server with an in-process WebSocket client).
- `sim`: `bun test` replay tests, invariants, golden snapshots, tick-budget test.
- Client: Vitest 5 browser mode over Playwright; Storybook 10 with addon-vitest as the catalogue of UI states (asking dialog, tool cards, empty states).
- End to end: Playwright 1.63 drives the compiled binary with a fake scenario: temporary git repository, project registration, session creation, employee reaches the desk, permission answered, completion with notification.
- Protocol contract tests: a fixture per event type validated by its Zod schema; exported JSON Schema kept as a snapshot.
- Coverage thresholds on core, protocol and sim; Stryker 10 mutation testing weekly on core and sim.
- TDD is the working method during implementation.

### 11.7 Repository and community

- Apache-2.0 license; README with a hero GIF of the office, one-command install, three reasons why, architecture diagram, badges (CI, Scorecard, release, license), roadmap of sub-projects.
- CONTRIBUTING (one-command setup, conventions, tests, ADRs), Contributor Covenant 3.0, SECURITY.md with private vulnerability reporting, issue forms (bug form asks for `workbox export session`), PR template, `good first issue` labels, DCO, Discussions, CODEOWNERS.
- ADRs in `docs/adr/` (MADR) for every decision in section 3, linking the research reports.
- Developer experience: `pnpm dev` runs the daemon in watch mode, Vite with proxy and the fake harness; `pnpm dev:claude` switches to the real adapter; `pnpm check` runs everything CI runs.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Anthropic changes subscription policy for SDK usage again | unmodified binary with the user's login only; API-key fallback and budget UI from day one; `harness.auth_status` surfaces the mode; adapter isolated behind the port |
| Bun 1.4 regressions after the Rust rewrite | pin minor versions; `erasableSyntaxOnly` keeps Node type stripping viable; Node-compat smoke tests on upgrade |
| TypeScript 7.0 lacks a programmatic API | tsgo used only as a type checker; no dependency on the API |
| Oxfmt is beta | Prettier fallback wired from the start |
| Kenney pack tile sizes unconfirmed for two packs | confirm on download before the first sprite is drawn; the sim uses tile units, not pixels |
| mistreevous has had no release for over a year | wrapped behind the `Behavior` interface; trees are small |
| WebGPU absent in WebKitGTK | WebGL2 baseline, WebGPU opt-in |
| FTS5 availability in `bun:sqlite` | verified in the plan; LIKE fallback |
| npm name collision with Google Workbox | scoped or suffixed package name (open question); bin stays `workbox` |
| Unsigned binaries until sub-project 7 | `npx`/`bunx` path plus documented quarantine removal |

## 13. Open questions for the owner

1. npm package name: recommended `workbox-ai` (free today), alternatives `workboxd` or an organisation scope if `@workbox` can be claimed. Note that web search results will collide with Google Workbox regardless.
2. License: Apache-2.0 as approved, or MIT if preferred.
3. `pinSystemBinary` default: recommended `false` (the SDK-bundled binary guarantees version parity with the SDK); `true` shares login state and version with the terminal.
4. Default locale: recommended browser language with `en` fallback.
5. Employee name pool: recommended locale-aware pools (Czech and international names).
6. Coverage thresholds: recommended 90 % on core, protocol and sim.

## 14. Glossary

- Office: the whole visualisation. Floor: one project. Employee: an agent persona bound to sessions. Desk: an employee's persistent seat. Session: a unit of work in one workspace. Turn: one prompt and the agent's response to it. Workspace: the git worktree of a session. Harness: a vendor agent runtime (Claude Code, later Codex, ACP agents). Asking dialog: the UI for permission requests and questions, always with a recommended option.
