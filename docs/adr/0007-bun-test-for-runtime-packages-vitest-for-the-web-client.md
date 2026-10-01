# 0007. bun test for runtime packages, Vitest for the web client

- Status: accepted
- Date: 2026-09-30

## Context

Vitest does not run on the Bun runtime, and `bun:sqlite` cannot load under Node ([R9 §4](../superpowers/research/2026-09-30-R9-library-verification.md)). Code that runs on Bun has to be tested on Bun, and the web client needs a real browser.

## Decision

`packages/*` and `apps/cli` test with `bun test`; `apps/web` tests with Vitest 5 in browser mode on Playwright Chromium (headless). Turborepo runs both through the same `test` task.

The compiled-binary test (`apps/cli/test/binary.test.ts`) compiles the host target and runs `--version` on the result. It is slow, so it is skipped unless `WORKBOX_BINARY_TEST=1` is set. CI sets it in the `build` job through `pnpm --filter @workbox/cli run test:binary`; locally, run the same command with the variable set.

## Consequences

Two assertion libraries with the same Jest-style API; browser tests need `playwright install chromium`; CI runs the daemon and package tests on Linux, macOS and Windows (`test-daemon`) and the web tests in a separate Linux job with cached browsers (`test-web`). Oxlint's jest rules cannot see `bun:test` suites, so `.only` and `.skip` are banned there with `no-restricted-properties` ([ADR 0005](0005-oxlint-and-oxfmt-with-turborepo-boundaries-instead-of-eslint.md)).
