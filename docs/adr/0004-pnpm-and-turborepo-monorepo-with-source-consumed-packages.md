# 0004. pnpm and Turborepo monorepo with source-consumed packages

- Status: accepted
- Date: 2026-09-30

## Context

The repository hosts a daemon, a CLI, a web client and shared packages. Supply-chain safety and contributor familiarity matter ([R7](../superpowers/research/2026-09-30-R7-repo-engineering-toolchain.md), [R10 §1](../superpowers/research/2026-09-30-R10-toolchain-config-reference.md)).

## Decision

pnpm 12 for packages and Turborepo 2.11 for the task graph, caching and package boundaries ([ADR 0005](0005-oxlint-and-oxfmt-with-turborepo-boundaries-instead-of-eslint.md)).

Versions live in two pnpm catalogs in `pnpm-workspace.yaml`. The default catalog, referenced as `catalog:`, holds runtime dependencies (`react`, `react-dom`, `zod`, `citty` and the three LogTape packages). The named catalog `dev`, referenced as `catalog:dev`, holds all tooling: every `devDependencies` entry. The split lets Renovate give tooling its own update policy ([ADR 0011](0011-release-and-dependency-automation.md)).

pnpm's supply-chain settings are on:

- `minimumReleaseAge: 4320`: a version must be at least three days old before it is installed. When a needed release is still younger and has no alternative, its exact `name@version` is added to `minimumReleaseAgeExclude` under a "remove after" date.
- `trustPolicy: no-downgrade`: a version published with weaker trust evidence (provenance, trusted publisher) than earlier releases of the package is refused. It has fired twice. `lefthook@2.1.15` came from a personal npm account without attestation, after 2.1.0 to 2.1.14 came from GitHub Actions with provenance, so the catalog range is `^2.1.14` and pnpm resolves 2.1.14. `semver@6.3.1`, a dependency of every `@babel/core` 7.x release from 7.22.9 on, was published without provenance after `semver@7.5.1` had it, so the `dev` catalog uses `@babel/core` `^8.0.6` ([ADR 0009](0009-react-19-for-the-web-client.md)).
- `blockExoticSubdeps: true`: only direct dependencies may come from git or tarball URLs.
- `strictDepBuilds: true` with an explicit `allowBuilds` list (`lefthook` and `playwright`): an install fails on any dependency build script that nobody has reviewed.

Internal packages have no transpile or bundle step: `exports` point at `src/index.ts`, Bun and Vite consume TypeScript directly, and `tsc --noEmit` type-checks. The one generated input is the Paraglide output of `@workbox/i18n`, produced by the Turborepo `build` task that `typecheck` and `test` depend on. The inlang message-format plugin that this build runs is a `catalog:dev` dependency of `@workbox/i18n`, and `project.inlang/settings.json` loads it from `node_modules` by relative path instead of from a CDN URL, so the build executes only lockfile-pinned code and needs no network.

## Consequences

Bun runs on pnpm's default isolated `node_modules`, where packages reach their dependencies through symlinks into a virtual store. This was verified with Bun 1.4.2 and pnpm 12.8.1: `bun test` and `bun build --compile` both resolve through the symlinks, so `nodeLinker: hoisted` was not needed. A package published to npm later needs its own build step; `isolatedDeclarations` is not applicable. A release-age or trust-policy rejection is a decision point (pick another version or major, or exclude the exact version with an expiry date), not something to switch off globally.
