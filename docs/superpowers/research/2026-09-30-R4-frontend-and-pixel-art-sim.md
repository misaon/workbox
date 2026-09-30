# R4 — Frontend framework + 2D pixel-art simulation engine for Workbox

Status: research draft, 2026-09-30

Verification method: every version/date below was checked online on 2026-09-30 against the GitHub Releases API, npm `dist-tags`, or the project's own blog/docs. Items marked **(secondary)** rest on third-party articles only; **(unverified)** means I could not confirm it and you should not build on it.

## 1) Summary of findings

- **React is the only "hyped" UI stack that is fully stable today.** React 19.3.0 (2026-09-09) moved `<ViewTransition>` and Fragment Refs to stable; `<Activity>` and `useEffectEvent` have been stable since 19.2 (2025-10-01); React Compiler 1.0 has been stable since 2025-10-07. Vue 3.6 (Vapor mode) is **still RC** (rc.10 published 2026-09-30, `latest` = 3.5.43); Solid 2.0 is **RC** (rc.13 on 2026-09-30, `latest` = 1.9.15); there is **no Svelte 6** (Svelte 5.57.1; SvelteKit 3 is in RC).
- **Tooling is bleeding-edge and stable at the same time:** Vite 8.3.1 (Rolldown-based since 8.0 on 2026-03-12), Tailwind 4.3.3, Base UI 1.8.0 (shadcn/ui made Base UI the default in July 2026), Motion 13.4.x with `AnimateView` built on React 19.3's `ViewTransition`, Streamdown 2.7.0 (released today) for streaming Markdown, TanStack Virtual with end-anchored (chat-style) virtualization.
- **PixiJS 8.21.0 is the right renderer**: WebGL by default, WebGPU opt-in via `preference`, experimental Canvas fallback, mature tilemap plugin, React and Vue bridges. Phaser 4.2.1 is stable and impressive (render-node WebGL renderer, `TilemapGPULayer`), but it is a full game framework whose scene/loop model fights a headless simulation; KAPLAY 4000 is alpha; Excalibur is 0.32 (0.33 alpha).
- **WebGPU is not something to depend on in webviews.** Safari/WebKit 26+ enable it by default (so WKWebView on macOS/iOS 26+ has it); Chromium/WebView2 have it on Windows/macOS; Linux is partial in Chromium, Nightly-only in Firefox, and **WebKitGTK 2.50–2.54 release notes never mention WebGPU**. Design for WebGL2 with WebGPU as a progressive enhancement.
- **Sim architecture:** a headless TypeScript package with fixed-timestep ticks, seeded PRNG (`pure-rand`), a small ECS (bitECS 0.4 / koota 0.6 / miniplex 2.0), grid A* with a reservation table, and behaviour trees (mistreevous 4.3.1, MIT) or hand-rolled utility AI. No maintained GOAP or utility-AI TypeScript library was found; existing grid A* libs (`easystarjs` 0.4.4, `pathfinding` 0.4.18) are unmaintained but tiny — copy the algorithm rather than depend on them.
- **Assets are the licensing trap.** LimeZu packs (the look every prior-art project uses) allow commercial use but forbid redistribution; bundling them in an open-source repo is a grey zone that munder-difflin resolved with a separate `LICENSE-ASSETS` file and its reading of the "Complete Version" licence — get LimeZu's written OK or ship art as a user-supplied/paid download. Kenney is CC0. LPC generator output is a licence mix (CC0/CC-BY/CC-BY-SA/GPL/OGA-BY) with exported credits. PixelLab's ToS grants output ownership + commercial use (no training other models); Retro Diffusion's ownership terms could not be fetched (JS-rendered site) **(unverified)**.

## 2) Tables

### UI frameworks, meta-frameworks, styling, chat rendering

| Item | Current (verified 2026-09-30) | Status | Notes |
|---|---|---|---|
| React | 19.3.0 (2026-09-09) | stable | `ViewTransition`, Fragment Refs stable in 19.3; `Activity`, `useEffectEvent` stable since 19.2 |
| React Compiler | babel-plugin-react-compiler `latest` 1.0.0 (1.0 GA 2025-10-07) | stable | React 17+; swc path still experimental per 1.0 post |
| Vue | `latest` 3.5.43 (2026-09-17); 3.6.0-rc.10 (2026-09-30) | 3.6 = RC | RC since 2026-07-18; Vapor "100% opt-in", "feature-complete"; alien-signals reactivity |
| Solid | `latest` 1.9.15; 2.0.0-rc.13 (2026-09-30) | 2.0 = RC | RC announced 2026-08-13; first-class async, `Loading`, `action()` |
| Svelte / SvelteKit | 5.57.1 (2026-09-18) / 3.0.0-next | Svelte stable; Kit 3 RC | No Svelte 6 announced |
| Vite | 8.3.1 (2026-09-24) | stable | Rolldown bundler since 8.0; Node 20.19+/22.12+; 8.1 added experimental bundled dev mode |
| TanStack Router / Start | 1.170.40 / 1.168.59 | Router stable; **Start labelled RC** | React + Solid only |
| Nuxt | 4.5.2 (2026-08-05) | stable | Nuxt 5 "Q4 2026 (estimated)"; `future.compatibilityVersion: 5` |
| Tailwind CSS | 4.3.3 (2026-07-16) | stable | 4.3 added scrollbar, `@container-size`, `zoom-*` utilities |
| Motion (motion.dev) | 13.4.6 npm; 13.4.0 (2026-09-14) | stable, MIT | `AnimateView` on React 19.3 `ViewTransition`; Vue via `motion-v`; vanilla `animate` |
| CSS View Transitions | same-document: Baseline since 2025-10-14 (Firefox 144); cross-document: Chrome 126+, Safari 18.2+, Firefox flag-only | **(secondary)** | Good enough for in-app transitions |
| Scroll-driven animations | Chrome yes; Safari 26.0 yes; Firefox reports conflict | **(secondary, partly unverified)** | Not needed for the office view |
| Base UI | 1.8.0 (2026-09-04); 1.0 on 2025-12-11 | stable | shadcn/ui default since 2026-07; Radix still supported |
| Ark UI / Reka UI | 5.37.2 / 2.10.5 (2026-09-21) | stable | Ark: React/Vue/Solid/Svelte; Reka: Vue |
| Streamdown | 2.7.0 (2026-09-30), Apache-2.0 | stable | React 18/19 only; `remend` 1.4.0 single-pass healing; Mermaid/KaTeX plugins; `streamdown-vue` 1.0.34 is a community port **(quality unverified)** |
| react-markdown / Shiki | 10.1.0 (2025-03-07) / 4.4.3 (2026-08-10) | stable | Fallback if Streamdown's opinions clash |
| TanStack Virtual / Virtua | @tanstack/react-virtual 3.14.13 (2026-09-14) / virtua 0.52.10 | stable | TanStack added end-anchored virtualization for chat streams (2026-05); Virtua: React/Vue/Solid/Svelte, `shift` for prepend |
| Lightbox | yet-another-react-lightbox 3.32.1; react-medium-image-zoom 5.4.8; PhotoSwipe 5.4.4 (~2 yrs old) | stable / stale | YARL has zoom plugin |

### 2D engines

| Engine | Version | Renderer | Fit for Workbox |
|---|---|---|---|
| PixiJS | 8.21.0 (2026-09-17) | WebGL (default), WebGPU (opt-in; docs still say "recommended to use the WebGL renderer for production"), Canvas experimental (8.16+) | **Best**: renderer-only, sprite batching (16 textures/batch), `scaleMode: 'nearest'`, `roundPixels`, `preference` fallback chain; @pixi/tilemap 5.0.2; @pixi/react 8.0.5 (pixi ^8.2.6, React 19); vue3-pixi (v8+) |
| Phaser | 4.2.1 (2026-07-09); 4.0.0 on 2026-04-10 | Rebuilt WebGL render-node renderer; `TilemapGPULayer` ("4096 x 4096 tiles"); Canvas fallback in v4 **(unverified)**; no WebGPU | Strong tilemap/camera/Tiled import out of the box, but owns the loop/scene graph → awkward for headless sim + React UI |
| Excalibur | 0.32.0 (2025-12-23); 0.33 alpha | WebGL, built-in ECS, tilemaps | TypeScript-first; pre-1.0 API churn |
| KAPLAY | 3001.0.19; v4000.0.0-alpha.27.1 (2026-05-12) | WebGL | Alpha; toy-like API |
| Kontra | 10.0.2 (2026-08-25) | Canvas 2D micro-lib | Too small (no batching) for thousands of sprites |
| Custom Canvas 2D | — | Canvas 2D | What pixel-agents (9.5k stars) and agentroom use; fine for ~20 sprites, not for a zoomable multi-floor office |

WebGPU availability (gpuweb wiki, updated 2026-08-13; Apple forum; WebKitGTK release notes): Chromium 113+ Win/macOS/ChromeOS, Linux only Intel Gen12+/NVIDIA-Wayland; Firefox 141+ Win, 145+/147+ macOS, Linux Nightly; Safari/WebKit 26+ all Apple OSes (**WKWebView inherits it on OS 26+**, not before); WebView2 = Chromium; **WebKitGTK 2.54 (2026-09-16): Skia compositor, no WebGPU mention**. Tauri 2 uses WebView2 / WKWebView / webkit2gtk.

### Simulation libraries

| Concern | Candidate | Verified | Verdict |
|---|---|---|---|
| ECS | bitECS 0.4.0 (MPL-2.0, SoA, relations/prefabs/observers) · koota 0.6.6 (ISC, pmndrs, React hooks) · miniplex 2.0.0 (MIT, plain objects) | yes | bitECS for raw speed; koota if you want `useQuery`/`useTrait` in React panels |
| Grid pathfinding | easystarjs 0.4.4 (~2021) · pathfinding 0.4.18 (MIT) · navmesh 2.x (MIT, TS) | yes | All stale; write ~150-line A* (8-dir, weighted, reservation table for multi-agent) |
| Behaviour | mistreevous 4.3.1 (MIT, TS, MDSL/JSON, guards, async actions) · BehaviorTree.js 3.0.0-beta | yes | mistreevous for BTs; utility scoring hand-rolled; **no maintained TS GOAP/utility-AI lib found** |
| Tilemaps | Tiled 1.12.2 (2026-05-27) · LDtk 1.5.3 (2024-01-15, repo active 2026-07) | yes | Tiled JSON is the lingua franca; both Pixi (@pixi/tilemap or custom) and Phaser import it |
| Determinism | fixed-timestep accumulator + interpolation (Gaffer) · pure-rand (MIT, seeded xoroshiro128+) | yes | Sim never reads `Date.now()` or `Math.random()` |

### Asset sources and licences

| Source | Licence | Notes |
|---|---|---|
| LimeZu "Modern Office – Revamped" ($2.50–5) | Commercial OK; **no redistribution**; credit required; **no characters** | 16/32/48 px variants, 300+ sprites |
| LimeZu "Modern Interiors" ($1.50+; $5 bundle) | Same terms | Characters (idle/run/read/…), Character Generator 2.0, updated Sept 2026; munder-difflin bundles it under a separate `LICENSE-ASSETS` |
| Kenney | CC0 | Attribution optional; few office-specific top-down packs |
| Universal LPC Spritesheet Generator | Mixed CC0 / CC-BY / CC-BY-SA 4.0 / OGA-BY / GPL 3 per part | 64×64 frames; exports PNG + `CREDITS.csv`; copyleft parts would bind derived art |
| PixelLab (ToS 2025-11-23) | You own outputs; commercial OK; no training other models; Open RAIL-M | Good for bespoke sprites |
| Retro Diffusion | Credits model, 50 free credits; trained "with their consent" on licensed art; ownership terms **(unverified, site is JS-rendered)** | |
| Community art used by prior art | JIK-A-4 "Metro City" (pixel-agents); SkyOffice 32 px tiles (agentroom) | Check each licence before reuse |

## 3) Prior-art notes

**munder-difflin** (chaitanyagiri, 8.2k stars, v0.5.3, MIT code + `LICENSE-ASSETS`). Stack per `package.json`: Electron 32, electron-vite 2.3, React 18.3, Pixi.js 8.5.1, zustand 4.5, xterm 5.5, node-pty, better-sqlite3, Monaco. `docs/ARCHITECTURE.md` describes "two data planes": a Terminal Plane (PTY I/O) and an Event Plane (agent hooks such as `cth-hook` for Claude Code POST lifecycle payloads → router/"GOD" agent → zustand store → Pixi scene). `src/renderer/src/scene/office/` contains `OfficeFloor.tsx` (85 KB, the whole scene), `Character.ts` (animation states `idle|walk|type|read`, status glyphs `blocked|success|compacting|looping`, dt-based movement at 48 px/s, `sitAtDesk`, `showThought`, `cheer`), `pathfinding.ts` (**plain BFS, 4-directional, no caching**), `SeatPool.ts`, `MessageEnvelope.ts`, `ThoughtBubble.ts`, `ToolBubble.ts`, `Camera.ts`, `TiledMapRenderer.ts`, `cafeteriaLines.ts`, `themeRegistry.ts`, `glRecovery.ts`. Lesson: it works, but rendering, behaviour and state are fused in one Pixi scene file — exactly what Workbox should avoid.

**pixel-agents** (pixel-agents-hq, 9.5k stars, MIT): VS Code extension + `npx` CLI, React 19 + Vite + **Canvas 2D**, Fastify. Two detection paths — Claude hooks (`SessionStart`, `PreToolUse`, `PermissionRequest`, `Stop`) or transcript heuristics — normalised into an `AgentEvent` model driving a state store → animations (type when editing, read when searching, flag when waiting).

**claude-office** (paulrobello, 533 stars, MIT): Next.js + PixiJS + FastAPI + Zustand; boss = main agent, employees = subagents; **one floor per session** with breadcrumb switching; whiteboards, context-window "trashcan".

**the-office** (shahar061, ISC): Electron 41, React 19, PixiJS 8, Zustand 5, Vite 6; roles mapped to rooms (boardroom, conference table, six `pc-*` seats).

**agentroom** (46 stars, MIT): **Tauri v2** + React 18 + Canvas 2D; Rust file-watcher on JSONL transcripts → `AgentStateManager` → Tauri event bus → canvas engine with pathfinding/state machines; per-project offices with persisted layouts.

Common pattern: hook/transcript events → normalised agent state → character state machine. None separates a deterministic sim from rendering, none has a layout editor, and all with a "look" use LimeZu or SkyOffice art.

## 4) Recommendation

**UI:** React 19.3 + React Compiler 1.0 + Vite 8.3 + TanStack Router 1.170 (Start only if SSR is ever needed — it is RC) + Tailwind 4.3 + shadcn/ui on Base UI 1.8 + Motion 13.4 (`AnimateView` for panel/floor transitions) + Streamdown 2.7 for streamed agent Markdown + TanStack Virtual (end-anchored) for transcripts + yet-another-react-lightbox. Rationale: it is the only combination where every hyped piece is *stable today* and the chat-rendering ecosystem (Streamdown, Base UI default, Motion `AnimateView`) is React-first. Vue 3.6 Vapor and Solid 2.0 are both RC on 2026-09-30; revisit if the owner prefers Vue once 3.6 ships (Reka UI 2.10, motion-v, vue3-pixi exist).

**Engine:** PixiJS 8.21 as a *renderer only*: `preference: ['webgl']` initially, flip to `['webgpu','webgl']` behind a setting; `antialias: false`, `roundPixels: true`, texture `scaleMode: 'nearest'`, integer zoom levels; spritesheets via Aseprite/TexturePacker JSON; @pixi/tilemap 5 or a chunked custom tilemap from Tiled JSON; `BitmapText` for labels; culling on; one `Application` per visible floor. Skip @pixi/react on the hot path (per-frame reconciliation); use it or plain React for overlays only.

**Sim:** a headless `@workbox/sim` package (no DOM, tested with Vitest): fixed 20 Hz tick with accumulator, `pure-rand` seeded per floor, bitECS 0.4 (or koota if React hooks are wanted), grid A* with a time-indexed reservation table (prevents two agents in one doorway), mistreevous behaviour trees for routines (work → coffee → toilet → terrace → meeting) with utility scores for needs/habits, and an **event log** (`AgentStarted`, `ToolUse`, `Delegated(from,to)`, `WaitingForHuman`, …) as the only input. Output is an immutable snapshot per tick; the renderer interpolates between the last two snapshots (Gaffer's "final touch"), so the same sim runs on desktop, phone, and in tests by replaying a recorded event log.

```
 agent runtimes (R2/R3)  ──events──▶  @workbox/sim (headless, deterministic)
                                        │ fixed 20 Hz tick, seeded PRNG
                                        │ ECS + A* + behaviour trees
                                        ▼ snapshot(tick N), snapshot(N-1)
   ┌───────────────────────── Web Worker boundary (optional) ─────────────────────────┐
   ▼                                                                                   ▼
 zustand/TanStack store (UI state)                          PixiJS 8 scene (WebGL, WebGPU opt-in)
   │  React 19.3 components                                   │ interpolates N-1→N at 60 fps
   │  Streamdown chat, TanStack Virtual, Base UI, Motion      │ tilemap, sprites, bubbles, camera
   └──── <OfficeCanvas/> React island owns <canvas>, forwards clicks as sim queries ───┘
```

## 5) Open questions for the owner

1. Are you willing to give up Vue for this project, or should we wait for Vue 3.6 stable (currently rc.10) and accept a thinner chat-rendering ecosystem?
2. Desktop shell: Tauri 2 (WebKitGTK on Linux = no WebGPU, weaker GPU compositing) or Electron (Chromium everywhere, bigger binary)? This decides whether WebGPU is ever more than a toggle.
3. Art: buy LimeZu and ask for written permission to bundle in an OSS repo, ship art as a post-install download, or commission/generate a CC0 house style (PixelLab/Retro Diffusion) so the repo is fully redistributable?
4. Sprite standard: LimeZu 16 px (small, cheap) vs 32 px (readable emotions, more work per animation) — the layout editor and floors depend on this.
5. Should the sim run in a Web Worker from day one (adds message-passing complexity, protects 60 fps with many agents) or on the main thread first?
6. How much non-work behaviour (kitchen/toilet/terrace, habits) should be deterministic from the seed vs driven by real agent events?

## 6) Sources (accessed 2026-09-30)

- React 19.3 blog — https://react.dev/blog/2026/09/09/react-19-3 · React 19.2 — https://react.dev/blog/2025/10/01/react-19-2 · React Compiler 1.0 — https://react.dev/blog/2025/10/07/react-compiler-1 · npm dist-tags for react, babel-plugin-react-compiler
- Vue releases API — https://api.github.com/repos/vuejs/core/releases · v3.6.0-rc.1 notes — https://github.com/vuejs/core/releases/tag/v3.6.0-rc.1 · npm dist-tags for vue
- Solid releases API — https://api.github.com/repos/solidjs/solid/releases · RC coverage — https://daily.dev/posts/solid-2-0-hits-release-candidate-with-first-class-async-support-fwnxbelqc · InfoQ beta — https://www.infoq.com/news/2026/05/solidjs-2-async/
- Svelte releases API — https://api.github.com/repos/sveltejs/svelte/releases · https://svelte.dev/blog/whats-new-in-svelte-september-2026
- Vite 8 — https://vite.dev/blog/announcing-vite8 · 8.1 — https://vite.dev/blog/announcing-vite8-1 · releases API — https://api.github.com/repos/vitejs/vite/releases
- TanStack Start — https://tanstack.com/start/latest · npm dist-tags @tanstack/react-router, @tanstack/react-start
- Nuxt releases API — https://api.github.com/repos/nuxt/nuxt/releases · roadmap — https://nuxt.com/docs/4.x/community/roadmap
- Tailwind — https://tailwindcss.com/blog/tailwindcss-v4-3 · releases API — https://api.github.com/repos/tailwindlabs/tailwindcss/releases
- Motion — https://motion.dev/changelog · https://motion.dev/docs/vue · https://github.com/motiondivision/motion · npm dist-tags motion
- Base UI — https://base-ui.com/react/overview/releases · shadcn/ui — https://ui.shadcn.com/docs/changelog · Reka UI releases API — https://api.github.com/repos/unovue/reka-ui/releases
- Streamdown — https://api.github.com/repos/vercel/streamdown/releases · https://vercel.com/changelog/streamdown-2-5 · package.json (Apache-2.0, React peer deps) · react-markdown releases API · Shiki releases API
- TanStack Virtual (search summary, 2026-09) · Virtua — https://github.com/inokawa/virtua · lightbox libs (npm search summaries)
- PixiJS — https://api.github.com/repos/pixijs/pixijs/releases · https://pixijs.com/8.x/guides/components/renderers · https://pixijs.download/release/docs/app.ApplicationOptions.html · https://pixijs.com/8.x/guides/concepts/performance-tips · @pixi/tilemap — https://api.github.com/repos/pixijs-userland/tilemap/releases · @pixi/react — https://api.github.com/repos/pixijs/pixi-react/releases · vue3-pixi — https://github.com/hairyf/vue3-pixi
- Phaser — https://api.github.com/repos/phaserjs/phaser/releases · https://github.com/phaserjs/phaser/releases/tag/v4.0.0 · https://gamefromscratch.com/phaser-4-released/ · https://phaser.io/download/phaser4
- Excalibur — https://api.github.com/repos/excaliburjs/Excalibur/releases · npm dist-tags · KAPLAY npm dist-tags · Kontra (GitHub releases via search)
- WebGPU — https://github.com/gpuweb/gpuweb/wiki/Implementation-Status · https://developer.apple.com/forums/thread/770862 · https://webkitgtk.org/2026/09/16/webkitgtk-2.54-highlights.html · https://webkitgtk.org/2025/11/26/webkitgtk-2.50.html · https://v2.tauri.app/reference/webview-versions/ · WebKit Safari 26.0 features (search summary)
- ECS — https://github.com/NateTheGreatt/bitECS · https://github.com/pmndrs/koota · https://github.com/hmans/miniplex · npm dist-tags
- Pathfinding/behaviour — https://github.com/mikewesthad/navmesh · https://github.com/nikkorn/mistreevous · npm `pathfinding`, `behaviortree`, `easystarjs`
- Tiled — https://www.mapeditor.org/2026/05/27/tiled-1-12-2-released.html · LDtk releases API — https://api.github.com/repos/deepnight/ldtk/releases
- Determinism — https://gafferongames.com/post/fix_your_timestep/ · https://github.com/dubzzz/pure-rand
- Assets — https://limezu.itch.io/modernoffice · https://limezu.itch.io/moderninteriors · https://kenney.nl/support · https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator · https://www.pixellab.ai/termsofservice · https://astropulse.itch.io/retrodiffusionai
- Prior art — https://github.com/chaitanyagiri/munder-difflin (README, package.json, docs/ARCHITECTURE.md, LICENSE-ASSETS, src/renderer/src/scene/office/*) · https://github.com/pixel-agents-hq/pixel-agents · https://github.com/paulrobello/claude-office · https://github.com/shahar061/the-office · https://github.com/liuyixin-louis/agentroom
