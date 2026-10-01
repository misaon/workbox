<h1 align="center">Workbox</h1>

<p align="center">
  Your AI coding agents, as employees in a pixel-art office.<br />
  Local-first. Will run on your Claude and ChatGPT subscriptions. Browser, desktop and CLI from one command.
</p>

<p align="center">
  <a href="https://github.com/misaon/workbox/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/misaon/workbox/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/misaon/workbox"><img alt="OpenSSF Scorecard" src="https://api.scorecard.dev/projects/github.com/misaon/workbox/badge" /></a>
  <a href="https://github.com/misaon/workbox/releases"><img alt="Release" src="https://img.shields.io/github/v/release/misaon/workbox?include_prereleases" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue" /></a>
</p>

> **Status: pre-alpha.** The repository foundation and the `workbox doctor` command are in place. The daemon, the chat UI and the office arrive in the next milestones (see the roadmap). The demo GIF lands together with the office.

## Why Workbox

- **You see what your agents do.** Every session is an employee on a floor: walking to a desk, typing, raising a hand when it needs you, getting coffee while it waits. One floor per project.
- **No new bills.** Workbox will drive the unmodified Claude Code and Codex binaries with the logins you already have. It never reads, copies or stores vendor credentials.
- **One binary everywhere.** The same `workbox` command is the CLI, the daemon and the web server. A thin desktop shell and a phone client connect to it.
- **Built to be studied.** Append-only event log as the single source of truth, headless deterministic office simulation, vendor-neutral harness and sandbox ports, pedantic tooling.

## Quick start (today)

Download the binary for your platform from the [latest release](https://github.com/misaon/workbox/releases) (for example `workbox-darwin-arm64`, `workbox-linux-x64` or `workbox-windows-x64.exe`), make it executable and run it:

```bash
chmod +x ./workbox-darwin-arm64
./workbox-darwin-arm64 doctor
```

`doctor` checks git, the Claude Code binary and its login, and the Workbox home directory (`~/.workbox`, override with `WORKBOX_HOME`). `WORKBOX_LOCALE=cs` switches the output to Czech.

On macOS the downloaded binary is quarantined until releases are notarised: `xattr -d com.apple.quarantine ./workbox-darwin-arm64`.

## Build from source

```bash
git clone https://github.com/misaon/workbox.git && cd workbox
pnpm install
pnpm check            # the static checks and tests CI runs
pnpm build:binaries   # all eight targets into apps/cli/dist/workbox-<os>-<arch>
```

Prerequisites (Node, pnpm, Bun, and Playwright's Chromium for the web tests) and conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture in one picture

```text
 workbox (Bun binary)                                        browser (React 19)
┌───────────────────────────────────────────────┐   WS+HTTP  ┌──────────────────────────────┐
│ CLI │ daemon                                  │◄──────────►│ chat, dashboard, dialogs     │
│     │  event log (SQLite, append-only)        │  typed     │ office canvas (PixiJS)       │
│     │  session runtime                        │  events    │   ▲ snapshots                │
│     │    port HarnessAdapter ◄─ harness-claude│            │ sim (Web Worker, headless)   │
│     │    port SandboxProvider ◄─ sandbox-host │            └──────────────────────────────┘
│     │  projections, embedded UI, token auth   │
└───────────────────────────────────────────────┘
```

The design spec lives in [docs/superpowers/specs](docs/superpowers/specs), decisions in [docs/adr](docs/adr), and the research behind every technology choice in [docs/superpowers/research](docs/superpowers/research).

## Roadmap

1. Repository foundation and the `workbox` binary ← you are here
2. Daemon core with a scriptable fake harness
3. Web UI: dashboard, chat, asking dialog
4. Claude Code adapter
5. Office simulation and renderer
6. Delivery workflow (Jira, GitHub, Slack), Codex and ACP adapters, sandboxes, phone remote control, desktop shell, skills sync

## Contributing

Issues and pull requests are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md) and the `good first issue` label. Security reports go through [SECURITY.md](SECURITY.md).

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
