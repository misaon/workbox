# 0002. One Bun binary for the CLI, the daemon and the web server

- Status: accepted
- Date: 2026-09-30

## Context

Workbox must run in a browser served locally, as a desktop app and as a headless CLI, from one command, with a binary well under hundreds of megabytes ([R3](../superpowers/research/2026-09-30-R3-runtime-desktop-cli.md)).

## Decision

`apps/cli` is compiled with `bun build --compile --minify --sourcemap` into one executable per target that is at once the CLI, the daemon and the web server (the UI is embedded as assets in plan 2). The desktop app (plan 7 of the product) wraps the same binary as a Tauri sidecar.

There are eight targets, all cross-compiled from one machine: `bun-linux-x64`, `bun-linux-arm64`, `bun-linux-x64-musl`, `bun-linux-arm64-musl`, `bun-darwin-x64`, `bun-darwin-arm64`, `bun-windows-x64` and `bun-windows-arm64`. Each produces `apps/cli/dist/workbox-<os>-<arch>`, with `-musl` appended for the musl builds and `.exe` for Windows. Bun still accepts the `-baseline` and `-modern` target suffixes for backward compatibility, but they resolve to the same binary as the plain x64 targets, so there is no separate non-AVX2 build, and the build script rejects those names instead of producing duplicates.

`pnpm build:binaries` runs `turbo run build:binaries`, which runs `apps/cli/scripts/build-binaries.ts`. The task depends on `^build`, so the generated Paraglide messages of `@workbox/i18n` exist in a fresh clone, and it has `cache: false`, so several hundred megabytes of executables never enter Turborepo's cache. The script compiles the targets one after another, reads the version from the root `package.json` and compiles it in as `WORKBOX_VERSION`. `--sourcemap` embeds the source map in the executable, but Bun also writes a `<outfile>.map` sidecar next to it; the script deletes each sidecar after its compile, so `apps/cli/dist` holds exactly the eight executables that the release job checksums, attests and uploads ([ADR 0011](0011-release-and-dependency-automation.md)).

## Consequences

Each executable is about 63 to 87 MB (about 611 MB for all eight with Bun 1.4.2), most of it the embedded Bun runtime. Bun is pinned to an exact version in `.bun-version` (1.4.2), which CI and the release workflow read and Turborepo hashes into every task, because Bun 1.4 is the first release of the Rust port; `erasableSyntaxOnly` keeps Node type stripping as an escape hatch. CI compiles all eight targets but executes only the Linux x64 one (the gated binary test of [ADR 0007](0007-bun-test-for-runtime-packages-vitest-for-the-web-client.md) and a `--version` and `doctor --json` smoke run).
