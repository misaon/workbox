# Implementation plans for sub-project 1

Spec: [2026-09-30-workbox-foundation-vertical-slice-design.md](../specs/2026-09-30-workbox-foundation-vertical-slice-design.md)

The spec covers five subsystems that can be built and verified independently, so it is implemented as a series of plans. Each plan ends with working, tested software and a green CI run. Later plans are written only after the previous one has landed, so they can reference the real code instead of guessing at it.

| # | Plan | Deliverable | Status |
|---|---|---|---|
| 1 | [Repository foundation and CLI skeleton](2026-09-30-plan-1-repository-foundation.md) | Monorepo with the full pedantic toolchain, CI/CD, community files, and a compiled `workbox` binary with `--version` and `doctor` | written, awaiting execution |
| 2 | Daemon core with the fake harness | `protocol` event catalogue, `core` domain and session runtime, `store-sqlite`, `harness-fake`, `sandbox-host`, `server`, daemon and session CLI commands | not written |
| 3 | Web UI | Dashboard, session creation, chat with live transcript, asking dialog, notifications, i18n, Playwright e2e against the fake harness | not written |
| 4 | Claude adapter | `harness-claude` over the Claude Agent SDK, auth status, usage, permissions and questions end to end through the UI | not written |
| 5 | Office simulation and renderer | `sim`, `office-render`, assets, Tiled floor, employee binding, coffee routine | not written |
| 6 | Cross-cutting polish | Telemetry export, debug bundles, README demo, release hardening | not written |
