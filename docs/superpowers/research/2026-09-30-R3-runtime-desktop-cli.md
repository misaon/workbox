# R3 — Runtime, desktop shell and CLI/daemon stack for Workbox

Status: research draft, 2026-09-30. Every version/date below was checked online on 2026-09-30 (primary sources preferred; secondary sources are labelled). Items I could not verify are marked **[unverified]**. Stability labels: **stable**, **beta**, **experimental**.

## 1) Summary of findings

- **Bun is the current hype runtime and the best fit.** Bun 1.4.2 (2026-09-05) is the third release of the Rust-ported Bun (1.4, 2026-08-20; "Rewriting Bun in Rust" post 2026-07-08). Bun joined Anthropic on 2025-12-02 and Claude Code ships as a Bun-compiled binary — the exact use case Workbox needs. State of JS 2025 ranks Bun 3rd runtime (2,321 respondents vs Node 10,062, Deno 1,244).
- **`bun build --compile` cross-compiles from one host to 8 targets** (linux x64/arm64 × glibc/musl, windows x64/arm64, darwin x64/arm64), supports `--bytecode` for ESM, `--asset <dir>` to embed the whole web UI, embedded SQLite, and Windows icon/metadata. Cost: the embedded runtime is **77 MB (Linux x64) / 84.8 MB (Windows x64) / 75.1 MB (Windows arm64)** uncompressed after 1.4's 17 % cut; download zips are **24–38 MB**. macOS uncompressed figure **[unverified]** (2024 hello-world was 57 MB; 1.4 says "about 1 MB larger" than 1.3.14). The "minimal runtime" issue #14546 is still open.
- **Node 26 (Current, LTS in Oct 2026) has stable type stripping**, `node:sqlite` at 1.2 release-candidate, but Single Executable Applications are still **1.1 active development**, cannot safely cross-compile (no code cache/snapshot cross-platform) and Node itself is bigger (24.21.0 downloads: 32–53 MB compressed). Node moves to one major per year starting with 27 (alpha Oct 2026, GA Apr 2027).
- **Deno 2.9.7** has `deno compile --bundle` (experimental) and a new `deno desktop` (experimental) — interesting but both experimental, and Node compat trails Bun for this workload.
- **Tauri 2.12.0 (2026-09-26) is the mature small shell**: Apache-2.0, 111.5k stars, iOS/Android since 2.0 (2024-10-02), first-class sidecars (`externalBin`), signed updater, deb/rpm/AppImage bundlers, tauri-action → GitHub Releases. Hello-world ≈3–5 MB (third-party numbers; Tauri's docs give none). Gotcha: a Bun sidecar under macOS hardened runtime **needs the `com.apple.security.cs.allow-jit` entitlement** or it crashes ("Ran out of executable memory"); Tauri issue #11992 on externalBin notarization is still open.
- **Electrobun 2.0.2 (2026-09-29) is the TypeScript-only alternative**, MIT, 12.9k stars, but its README still says BETA; 2.0 moved the core to Zig and introduced a new JSC runtime "Cottontail" v0.5.0 (~15 MiB) — very bleeding-edge, thin docs.
- **Electron 44.5.1 (2026-09-30)** is what Claude Desktop, Codex desktop, Paseo and (currently) OpenCode desktop use — proven, but 85–150 MB hello-world (third-party) and e.g. Paseo's dmg is 177 MB. Fails the owner's size constraint.
- **Signing**: Apple Developer Program US$99/yr and notarization is mandatory for Developer ID distribution; **Homebrew disables non-Gatekeeper-passing casks in `homebrew/cask` in September 2026** (own tap not mentioned). Windows: **SignPath Foundation is free for OSS**; Azure **Artifact Signing** (renamed from Trusted Signing) admits EU *organizations* but individuals only from US/Canada — a Czech individual is not eligible.
- **Every reference tool splits daemon ↔ UI over localhost HTTP/WS**: Paseo (Node daemon, WS :6767, Electron+Expo+CLI), Vibe Kanban (Rust/axum, `npx` downloads binary, browser UI), Codex desktop (Electron ↔ `codex app-server` child), OpenCode (Bun-compiled CLI with `opencode serve`; desktop Electron). Nobody uses Tauri IPC as the primary channel — the sidecar is always a normal server.
- **TypeScript 7.0 GA 2026-07-08** (native Go `tsc`, 8–12× faster) with **no stable programmatic API until 7.1**; TS 6.0 (2026-03-23) is the mandatory bridge (strict/esnext defaults, `types: []`, node10/baseUrl/outFile deprecations). `erasableSyntaxOnly` (TS 5.8, 2025-02-28) is the flag to stay Node-type-strip compatible.

## 2) Comparison tables

### 2a) JS runtimes

| Runtime | Version / date | Maturity | License | Single binary & size | Fit for Workbox | Risks |
|---|---|---|---|---|---|---|
| **Bun** | 1.4.2, 2026-09-05 (1.4 = first Rust release, 2026-08-20) | stable core; HTTP/2+HTTP/3 experimental; `node:sea`, parts of `inspector`/`worker_threads`/`cluster` partial | MIT (JavaScriptCore LGPL-2, relink obligation) | `bun build --compile`, 8 cross-targets from any host; runtime 77 MB Linux x64 / 84.8 MB Win x64 uncompressed, 24–38 MB zipped; `--bytecode` ESM, `--asset`, sqlite embed | **Best**: `bun:sqlite` (3–6× better-sqlite3), `Bun.serve` WS pub/sub + `unix:` sockets, TS without build step, Anthropic-backed, Claude Code proves the compile path | Rust port was AI-generated (≈64 Claude agents, 4 months, US$165k tokens; 19 semantic regressions found pre-release; 1.4.0→1.4.2 fixed further regressions); Zig→Rust controversy; ~80 MB floor; Anthropic ownership = strategic dependency |
| **Node.js** | 26.10.0 Current (26.0.0 2026-05-05, LTS Oct 2026); 24.21.0 Active LTS; 22.23.3 Maintenance | type stripping **stable** (default; enums/namespaces/param-props error, `--experimental-transform-types` removed in 26); `node:sqlite` **1.2 RC**; SEA **1.1 active development** | MIT | `node --build-sea` since 25.5; no cross-compiled code cache/snapshot; VFS unfinished; 32–53 MB compressed downloads, ≈80–140 MB outputs (secondary) | Safe fallback; largest ecosystem; new 1-major/yr cadence from v27 | SEA not stable, bigger binaries, needs separate bundler + WS lib |
| **Deno** | 2.9.7, 2026-09-16 (2.9: 2026-06-25) | `deno compile` stable; `--bundle`/`--minify` **experimental**; `deno desktop` **experimental** | MIT | 6 targets (Win arm64 since 2.9.3); `denort` zip 27.4 MB (darwin-arm64) / 32.8 MB (linux-x64); total compiled size **[unverified]** | Smaller runtime download than Bun; KV/localStorage persistence in compiled apps | npm compat (target Node 26.3.0) good but behind Bun's test coverage; desktop story brand new |

### 2b) Desktop shells

| Shell | Version / date | Maturity | License | Size numbers | Fit | Risks |
|---|---|---|---|---|---|---|
| **Tauri 2** | 2.12.0, 2026-09-26; MSRV 1.90; Win7 dropped | **stable** (desktop + iOS/Android since 2.0, 2024-10-02) | Apache-2.0 (GitHub) | ≈3–5 MB hello-world, 5–15 MB typical (third-party benchmarks; official docs only list `lto/strip/opt-level=s/removeUnusedCommands`) | Sidecar `externalBin` (target-triple suffix), shell-plugin capabilities, minisign updater via GitHub Releases `latest.json`, deb/rpm/AppImage; Azure Artifact Signing built into bundler | Needs Rust toolchain + per-OS CI runners (Linux cannot cross-compile); WebKitGTK quirks on Linux; Bun sidecar needs JIT entitlement; updater ignores deb/rpm; issue #11992 open |
| **Electrobun** | 2.0.2, 2026-09-29 (2.0 post 2026-08-21) | **beta** (README "BETA_RELEASE"); powers Blackboard's Dash (private beta) | MIT | native main ≈1.28 MiB; Cottontail main ≈15 MiB; Bun main ≈30 MB compressed hello-world (InfoWorld, 2026-03-11); bsdiff updates "as small as 4 KB" | All-TypeScript, Bun/Cottontail main process, system webview or CEF | Young; docs "out of sync" (InfoWorld); Cottontail 0.5.0 is a brand-new runtime; macOS 14+/Win 11+/Ubuntu 24.04+ only |
| **Electron** | 44.5.1, 2026-09-30 (Chromium 152, Node 24.21) | **stable** | MIT | 85–150 MB hello-world (third-party); Paseo 0.10.2 dmg 177 MB / deb 129 MB | Used by Claude Desktop, Codex, Paseo, OpenCode desktop | Violates "not hundreds of MB"; RAM |
| **Wails v3** | v3.0.0-beta.26, 2026-09-25 (beta announced 2026-08-02 **[reported]**) | **beta** | MIT **[unverified]** | small Go binary (no numbers verified) | Go backend, not TS | Not GA; would split codebase into Go |
| **Neutralinojs** | v6.9.0, 2026-07-24 | stable-ish; 8.7k stars | MIT per project **[GitHub shows NOASSERTION]** | lightweight (no numbers verified) | JS-only | Small community; backend is C++ not TS |
| **Dioxus** | 0.7.10, 2026-07-30; 0.8.0-alpha.1 2026-07-31 | 0.7 stable, 0.8 **alpha** | Apache-2.0 (GitHub) | "<5 MB" (third-party) | Pure Rust UI | Not a fit for a TS frontend |
| **`deno desktop`** | Deno 2.9, 2026-06-25 | **experimental** | MIT | n/a | Deno-only | Too new |

### 2c) Signing & distribution

| Channel / requirement | Verified facts (2026-09-30) | Cost | Notes |
|---|---|---|---|
| macOS Developer ID + notarization | Required for Gatekeeper-clean distribution; free Apple account cannot notarize; Tauri supports API-key or Apple-ID auth, ad-hoc `"-"` fallback | US$99/yr (fee waiver only for non-profits/edu/government) | Bun sidecar needs `com.apple.security.cs.allow-jit` in `bundle.macOS.entitlements` |
| Homebrew | 5.0.0 (2025-11-12): casks without codesigning deprecated; **`homebrew/cask` casks failing Gatekeeper disabled September 2026**; `--no-quarantine` deprecated | free | Own tap (`brew tap workbox/tap`) not covered by the policy text, but users still hit Gatekeeper without notarization |
| Windows – SignPath Foundation | Free OSS signing: OSI license, no commercial dual-licensing, verifiable builds from source, publisher shows as "SignPath Foundation", code-signing-policy page required | free | Best free option for Workbox |
| Windows – Azure Artifact Signing (ex-Trusted Signing) | Individuals: US/Canada only; organizations: US, CA, EU, UK, AU, NZ, JP, KR, SG, CH, NO, IL; identity validation 1–20 business days; Basic = 5,000 signatures/month | ≈US$9.99/month Basic **[reported; official page hides price]** | Tauri bundler supports it natively; a Czech *company* qualifies, a Czech individual does not |
| Windows – OV certificate | Individuals eligible; SmartScreen reputation builds over time (EV no longer privileged since 2024) | ≈US$100–400/yr **[unverified]** | |
| winget | PR to `microsoft/winget-pkgs`; automated Defender/AV scan, silent install required, installer URL must be publisher-controlled (GitHub Releases OK) | free | Official doc doesn't mandate signing; community reports unsigned installers get flagged **[secondary]** |
| Scoop | main bucket: non-GUI, ≥500 stars/150 forks; GUI → extras bucket | free | CLI binary fits main bucket later |
| Linux | Tauri bundles deb/rpm/AppImage; Flatpak = manual manifest + Flathub PR; updater only handles AppImage | free | Claude Desktop Linux is beta via apt/.deb |
| npm / `npx` / `bunx` | OpenCode pattern: meta-package `opencode-ai` (7.9 KB) + 12 `optionalDependencies` platform packages built with `Bun.build({compile})` incl. `-baseline`/`-musl` variants + postinstall | free | `npx workbox` / `bunx workbox` becomes a 25–38 MB platform download |
| GitHub Releases | tauri-action matrix: macos (aarch64 + x86_64), ubuntu-22.04 (+ `-arm`), windows-latest; generates `latest.json` | free | Bun binaries can all be cross-compiled on one runner |

## 3) Recommendation

**One Bun-compiled binary (`workbox`) is the product; the desktop app is a thin Tauri 2 shell around it.**

1. **Core = `workbox` binary** built with `bun build --compile --bytecode --minify --asset ./ui-dist` for all 8 targets from one CI job. It is simultaneously: the **CLI** (`workbox agents ls`), the **headless daemon** (`workbox serve --listen unix:/…/workbox.sock --http 127.0.0.1:7777` on a Linux server, systemd), and the **web server** for the pixel-art UI (static assets embedded via `--asset`, `Bun.serve` routes + WebSocket pub/sub for live agent events, `bun:sqlite` in WAL mode for local-first state). Publish it as an npm meta-package with per-platform `optionalDependencies` (OpenCode pattern) so `npx workbox` / `bunx workbox` works, plus Homebrew tap, Scoop (extras), winget, and raw GitHub Releases.
2. **Desktop = Tauri 2.12** with the same binary as `externalBin` sidecar. Rust side only: spawn/supervise sidecar, pick a free port, pass a one-time token, open the webview at `http://127.0.0.1:<port>/?token=…`, tray icon, autostart, updater. UI code is identical to the browser build. Ship `bundle.macOS.entitlements` with `allow-jit` (and test notarization early because of Tauri #11992).
3. **Phone remote** connects to the same WebSocket API (relay/QR pairing as Paseo does) — out of scope here (R-other) but the architecture already supports it.
4. **TypeScript**: TS 6.0 now → TS 7.x for type-checking (`tsc` native); Bun transpiles at runtime/build time so `enum` etc. would work, but enable `erasableSyntaxOnly` + `verbatimModuleSyntax` anyway to keep Node type-stripping as an escape hatch. Do not depend on the TS programmatic API until 7.1.

```
                 ┌──────────────── one binary: workbox (Bun 1.4.x, ~77–85 MB, zip 25–38 MB) ────────────────┐
                 │  CLI cmds │ daemon: agent orchestrator, sandboxes │ Bun.serve HTTP+WS │ bun:sqlite │ embedded UI │
                 └───────────┴───────────────┬───────────────────────┴───────┬───────────┴───────────┴─────▲──────┘
   `workbox serve` on Linux server            │ 127.0.0.1:<port> + unix socket │                           │ --asset ./ui-dist
   (systemd, headless)  ◄─────────────────────┘                               │                           │
                                                                              │ http/ws (+token)          │
        ┌────────────────────────────┐    spawns sidecar     ┌────────────────┴─────────────┐   ┌─────────┴─────────┐
        │ Tauri 2.12 shell (~5–10MB) │ ─────────────────────► │  native webview (WKWebView / │   │ browser tab       │
        │ Rust: supervise, tray,     │                        │  WebView2 / WebKitGTK)       │   │ (any machine)     │
        │ updater, autostart         │                        └──────────────────────────────┘   └───────────────────┘
        └────────────────────────────┘                        ▲ same WS API
                                                              │
                                                  phone (PWA / Expo) via relay + QR pairing
```

**Expected artifact sizes** (uncompressed / download): `workbox` CLI-daemon ≈77–85 MB / 25–38 MB per platform (macOS uncompressed **[unverified]**, likely ≈60 MB); Tauri desktop bundle ≈ sidecar + 5–10 MB shell → ≈85–95 MB installed / ≈35–45 MB installer; Electron equivalent would be ≈180 MB installed (Paseo). A Rust daemon (Vibe Kanban style) would be ≈10–20 MB but abandons "TypeScript-first" — the ~70 MB delta is the price of Bun.

**Why not the alternatives**: Electrobun would remove Rust entirely and is the most hype-aligned, but it is beta with a 0.5.0 runtime and thin docs — keep it as a watched option (its `Bun` main-process mode could even reuse our code). Node SEA is not stable and cannot cross-compile with code cache; Deno has the smallest runtime but two experimental features on the critical path. Electron is disqualified by size.

**Key risks to manage**: pin Bun minor versions and run the Node-compat test suite for our deps on each upgrade (1.4.0→1.4.2 shipped real regressions); watch Bun's minimal-runtime issue for size wins; the JavaScriptCore LGPL relink notice must be included in about/licenses; Tauri Linux (WebKitGTK) rendering must be tested for the pixel-art canvas; Tauri updater cannot update deb/rpm — the sidecar can self-update the CLI channel instead.

## 4) Open questions for the owner

1. **Signing entity**: sign as a Czech company (eligible for Azure Artifact Signing, Apple Developer org) or as an individual (Apple OK, Azure Public Trust *not* eligible → use SignPath Foundation for Windows)?
2. Is **≈80 MB per platform binary / ≈35–45 MB installer** acceptable as "small", or is a Rust/Go daemon (≈10–20 MB) worth giving up TypeScript on the backend?
3. **Tauri (Rust, mature) vs Electrobun (TS-only, beta)** for the desktop shell — do we accept a Rust toolchain in the repo?
4. Notarize from the first release (needed for `homebrew/cask` and clean Gatekeeper) or start with an own tap + ad-hoc signing?
5. Do we need Windows ARM64 and Linux musl/Alpine builds on day one (Bun supports all, but each adds CI test time)?
6. Update strategy: Tauri updater for desktop + self-update for the CLI, or a single "download new binary" path in the daemon?
7. How much do we lean on Anthropic-owned Bun given Workbox orchestrates competing agents (Codex, OpenCode, etc.)?

## 5) Sources (all accessed 2026-09-30)

- Bun 1.4 blog — https://bun.com/blog/bun-v1.4 (2026-08-20); 1.4.1 — https://bun.com/blog/bun-v1.4.1 (2026-09-04); blog index (Anthropic acquisition 2025-12-02, "Rewriting Bun in Rust" 2026-07-08) — https://bun.com/blog
- Bun releases — https://github.com/oven-sh/bun/releases ; asset sizes — https://api.github.com/repos/oven-sh/bun/releases/latest
- Bun docs: executables — https://bun.com/docs/bundler/executables ; HTTP — https://bun.com/docs/api/http ; WebSockets — https://bun.com/docs/api/websockets ; SQLite — https://bun.com/docs/api/sqlite ; Node APIs — https://bun.com/docs/runtime/nodejs-apis ; fullstack — https://bun.com/docs/bundler/fullstack ; LICENSE — https://raw.githubusercontent.com/oven-sh/bun/main/LICENSE.md
- Bun issues: minimal runtime #14546 — https://github.com/oven-sh/bun/issues/14546 ; 1.4 breaking changes #28792 — https://github.com/oven-sh/bun/issues/28792
- InfoQ on the Zig→Rust rewrite (2026-09-20) — https://www.infoq.com/news/2026/09/bun-AI-rewrite-zig-rust-4-months/
- State of JS 2025 runtimes — https://2025.stateofjs.com/en-US/other-tools/
- Node 26.0.0 — https://nodejs.org/en/blog/release/v26.0.0 ; releases table — https://nodejs.org/en/about/previous-releases ; schedule change (2026-03-10) — https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule ; TypeScript — https://nodejs.org/api/typescript.html ; SQLite — https://nodejs.org/api/sqlite.html ; SEA — https://nodejs.org/api/single-executable-applications.html ; Joyee Cheung SEA post (2026-01-26) — https://joyeecheung.github.io/blog/2026/01/26/improving-single-executable-application-building-for-node-js/ ; dist sizes — https://nodejs.org/dist/latest-v24.x/
- Deno 2.9 (2026-06-25) — https://deno.com/blog/v2.9 ; releases — https://github.com/denoland/deno/releases ; asset sizes — https://api.github.com/repos/denoland/deno/releases/latest ; compile docs — https://docs.deno.com/runtime/reference/cli/compile/
- TypeScript 7.0 (2026-07-08) — https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ ; 6.0 (2026-03-23) — https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ ; 6.0 notes — https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html ; 5.8 (2025-02-28) — https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/ ; InfoQ TS7 — https://www.infoq.com/news/2026/08/typescript-7-released/
- Tauri 2.12 (2026-09-26) — https://v2.tauri.app/blog/tauri-2.12/ ; 2.0 (2024-10-02) — https://v2.tauri.app/blog/tauri-20/ ; sidecar — https://v2.tauri.app/develop/sidecar/ ; updater — https://v2.tauri.app/plugin/updater/ ; size — https://v2.tauri.app/concept/size/ ; macOS signing — https://v2.tauri.app/distribute/sign/macos/ ; Windows signing — https://v2.tauri.app/distribute/sign/windows/ ; GitHub pipeline — https://v2.tauri.app/distribute/pipelines/github/ ; Flatpak — https://v2.tauri.app/distribute/flatpak/ ; repo meta — https://api.github.com/repos/tauri-apps/tauri ; externalBin notarization issue #11992 — https://github.com/tauri-apps/tauri/issues/11992 ; JIT-entitlement reports (community) — https://github.com/happier-dev/happier/issues/343 , https://github.com/notefig/notefig/issues/365
- Tauri vs Electron sizes (third-party) — https://www.pkgpulse.com/guides/electron-vs-tauri-2026 , https://www.buildmvpfast.com/blog/tauri-v2-vs-electron-desktop-apps-2026
- Electron releases — https://releases.electronjs.org/
- Electrobun — https://blackboard.sh/electrobun/ ; 2.0 post (2026-08-21) — https://blackboard.sh/blog/electrobun-2-0/ ; repo — https://github.com/blackboardsh/electrobun ; releases — https://api.github.com/repos/blackboardsh/electrobun/releases?per_page=3 ; InfoWorld first look (2026-03-11) — https://www.infoworld.com/article/4137964/first-look-electrobun-for-typescript-powered-desktop-apps.html
- Wails — https://api.github.com/repos/wailsapp/wails/releases?per_page=5 ; Neutralinojs — https://api.github.com/repos/neutralinojs/neutralinojs/releases/latest , https://api.github.com/repos/neutralinojs/neutralinojs ; Dioxus — https://github.com/DioxusLabs/dioxus/releases , https://api.github.com/repos/DioxusLabs/dioxus
- Apple Developer Program — https://developer.apple.com/programs/whats-included/ ; Homebrew 5.0.0 (2025-11-12) — https://brew.sh/2025/11/12/homebrew-5.0.0/ ; Acceptable Casks — https://docs.brew.sh/Acceptable-Casks ; Workbrew summary — https://workbrew.com/blog/homebrew-5-0-0
- Azure Artifact Signing quickstart (eligibility) — https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart ; pricing page — https://azure.microsoft.com/en-us/pricing/details/trusted-signing/ ; SignPath Foundation terms — https://signpath.org/terms.html ; winget submission/validation — https://learn.microsoft.com/en-us/windows/package-manager/package/repository ; Scoop main-bucket criteria — https://github.com/ScoopInstaller/Scoop/wiki/Criteria-for-including-apps-in-the-main-bucket
- Paseo — https://github.com/getpaseo/paseo , releases — https://github.com/getpaseo/paseo/releases ; Vibe Kanban — https://raw.githubusercontent.com/BloopAI/vibe-kanban/main/AGENTS.md ; OpenCode — https://github.com/anomalyco/opencode , desktop README — https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/desktop/README.md , build script — https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/script/build.ts , npm meta-package — https://registry.npmjs.org/opencode-ai/latest , earlier Tauri description (community) — https://forums.basehub.com/anomalyco/opencode/6 ; Codex desktop breakdown — https://www.kitze.io/posts/codex-electron-app-technical-breakdown ; Claude Code desktop docs — https://code.claude.com/docs/en/desktop ; "Why is Claude an Electron app?" (2026-02-21) — https://www.dbreunig.com/2026/02/21/why-is-claude-an-electron-app.html ; Conductor install — https://www.conductor.build/docs/installation
