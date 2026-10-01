# Contributing to Workbox

Thanks for helping. Workbox is a pnpm + Turborepo monorepo; the daemon runs on Bun, the web client on Vite.

## Prerequisites

- Node.js 24 (tooling only; see `.node-version`)
- pnpm 12 (`npx get-pnpm@latest`; the exact version comes from `packageManager` in `package.json`)
- Bun 1.4.2 (`curl -fsSL https://bun.com/install | bash -s "bun-v1.4.2"`)
- git 2.40 or newer
- For the web client tests: `pnpm exec playwright install chromium` inside `apps/web`

## Set up

```bash
git clone git@github.com:misaon/workbox.git
cd workbox
pnpm install
pnpm check
```

`pnpm check` runs everything CI runs: formatting, type-aware lint, type checks, tests, dependency boundaries, dead-code detection, spelling, Markdown and file-name rules.

## Everyday commands

| Command                     | What it does                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                  | daemon in watch mode and the Vite dev server                                        |
| `pnpm test`                 | all tests (`bun test` for runtime packages, Vitest browser mode for the web client) |
| `pnpm lint` / `pnpm format` | Oxlint (type-aware) and Oxfmt                                                       |
| `pnpm build:binaries`       | compile the `workbox` binary for every supported target into `apps/cli/dist`        |
| `pnpm check`                | the full CI suite                                                                   |

## Conventions

- Conventional Commits (`feat`, `fix`, `docs`, `chore`, …) are enforced by commitlint locally and in CI. Pull requests are squash-merged, so the PR title must also be a valid Conventional Commit.
- Sign every commit off (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).
- Files and directories are kebab-case; React components may be PascalCase `.tsx` files.
- Code, comments, commits and documentation are English. User-facing strings live in `packages/i18n/messages` in English and Czech.
- Every lint-disable comment states its reason. Every architecture decision gets an ADR in `docs/adr`.
- Tests first: write the failing test, make it pass, then refactor.
- Dependency versions live in the pnpm catalog: runtime dependencies use `catalog:`, tooling (devDependencies) uses `catalog:dev`; Renovate automerges non-major updates of the `dev` catalog and of GitHub Actions, runtime updates are merged by a human.

## Package rules

`protocol` depends on no internal package. `i18n` and `observability` may depend only on `protocol`; `observability` is runtime-only (Bun/Node) and never reaches `sim`, `office-render` or `apps/web`. `core` and `sim` depend only on `protocol`. Adapters (`harness-*`, `sandbox-*`, `store-*`, `server`) depend on `core`, `protocol`, `observability` and `i18n`, never on each other. `apps/web` depends on `protocol`, `sim`, `office-render` and `i18n`. `apps/cli` is the only composition root. `pnpm boundaries` enforces this.

## Reporting bugs and proposing features

Use the issue forms. For anything security-related, follow `SECURITY.md` instead of opening a public issue.
