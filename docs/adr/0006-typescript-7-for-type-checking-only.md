# 0006. TypeScript 7 for type checking only

- Status: accepted
- Date: 2026-09-30

## Context

TypeScript 7.0 (native compiler) is GA since July 2026; its programmatic API arrives in 7.1 ([R3](../superpowers/research/2026-09-30-R3-runtime-desktop-cli.md), [R10 §3](../superpowers/research/2026-09-30-R10-toolchain-config-reference.md)).

## Decision

`typescript@7` (7.0.2) provides the `tsc` binary and no JavaScript API, and it is used to type-check only: each package has a `typecheck` script that runs `tsc --noEmit` with the pedantic flags in `tsconfig.base.json`, and the root `typecheck` adds one more run for the root configuration files. No tool in the repository may depend on the TypeScript JavaScript API. `tsconfig.base.json` sets `types: []`, because TypeScript 6+ no longer auto-includes `@types`; each package opts in to the ambient types it needs (`bun` for runtime packages, `vite/client` for the web client).

## Consequences

Tooling that embeds TypeScript (ESLint typed rules, Vue templates) is out unless it ships its own compiler; `erasableSyntaxOnly` and `verbatimModuleSyntax` keep the code portable to Node's type stripping. A tool that optionally uses the compiler API has to cope with its absence: Paraglide's declaration emit, which is enabled in `packages/i18n`, detects it and runs the `tsc` CLI instead.
