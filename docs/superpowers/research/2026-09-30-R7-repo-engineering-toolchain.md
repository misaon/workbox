# R7 — Repository Engineering Toolchain for Workbox (September 2026)

Status: research draft, 2026-09-30

Method: every version/date below was checked online on 2026-09-30 against the GitHub Releases API / Atom feeds, the npm registry `dist-tags` endpoint, or official docs. Where a page only showed a relative date, the year is marked *(year inferred)*. Items I could not confirm are marked **UNVERIFIED**. Maturity legend: **S** = stable, **B** = beta, **A** = alpha/experimental.

## 1) Summary

- **TypeScript 7.0.2 (Go-native "tsgo") is GA (2026-07-08) but ships no programmatic API** (planned for 7.1). Consequences: typescript-eslint 8.71 supports only TS `>=4.8.4 <6.1.0`; Vue/Svelte/Astro/MDX template type-checking still needs TS 6 via the alias `typescript@npm:@typescript/typescript6`. Oxlint's type-aware engine (`oxlint-tsgolint` 7.0.2003) *requires* TS 7. Pick the lint stack with this split in mind.
- **Fastest strict stack today:** Oxlint 1.86 (870 rules) + `oxlint-tsgolint` (type-aware, stable since 2026-07-22, 59/61 typescript-eslint typed rules, 12–18x faster) + Oxfmt 0.71 (beta, 100 % Prettier JS/TS conformance). Biome 2.5.14 is the one-binary alternative; ESLint 10.11 + typescript-eslint 8.71 remains the most pedantic reference (`strict-type-checked` + `stylistic-type-checked`), at the cost of TS 6.
- **Supply chain is now default-on:** pnpm 12.8.1 (pnpm 11+ defaults `minimumReleaseAge: 1440` min, `blockExoticSubdeps: true`), Dependabot applies a 3-day cooldown by default, Renovate `config:best-practices` includes `security:minimumReleaseAgeNpm` (3 days) and weekly lockfile maintenance, npm trusted publishing (OIDC, no tokens) auto-generates provenance and since 2026-09-03 defaults new configs to `npm stage publish`.
- **GitHub CI for OSS is generous:** all standard runners, including `ubuntu-24.04-arm`, `windows-11-arm`, `macos-26` (Apple silicon), are free and unlimited on public repos. Merge queue requires the repo to be **organization-owned** (not a personal account).
- **Bun 1.4 (2026-08-20) states "We rewrote Bun from Zig to Rust"**; `bun build --compile` cross-compiles to linux/darwin/windows × x64/arm64 (+musl). Node's SEA is still Stability 1.1. Use Bun for shipped binaries even if pnpm manages the monorepo.
- **OTel GenAI semantic conventions are still "Development"** and moved to a separate repo (2026-06-12); OTel JS core is 2.11.0 but `@opentelemetry/sdk-node` is 0.222.0 (experimental).

## 2) Tables per area

### 2a) Lint / format

| Tool | Version (date) | Maturity | Fit / notes | Risks |
|---|---|---|---|---|
| Oxlint | 1.86.0 (2026-09-28) | S | 870 built-in rules (ESLint core, TS, React, Vitest, Import, Unicorn, jsx-a11y); lints `<script>` of .vue/.svelte/.astro | JS plugins **A** (no type-aware plugin rules, no Vue/Svelte custom parsers) |
| oxlint-tsgolint | 7.0.2003 (stable 2026-07-22) | S | `oxlint --type-aware [--type-check]`; 59/61 typed rules; needs TS 7.0+; monorepo needs built `.d.ts` | High memory on very large repos; no `baseUrl` |
| Oxfmt | 0.71.0 (2026-09-28); beta since 2026-02-24 | B | Prettier-compatible; JS/TS/JSON/YAML/TOML/HTML/Vue/Svelte/CSS/MD; built-in import + Tailwind sorting | Pre-1.0; keep Prettier as fallback |
| Biome | 2.5.14 (2.5 on 2026-06-05) | S (JS/TS/JSON/CSS); A (Vue/Svelte/Astro/HTML) | 500+ rules, GritQL plugins with code fixes, own type inference (no tsc), cross-file rules, `--watch` | Svelte support self-described as weak; typed-rule coverage narrower than tsgolint (exact list UNVERIFIED) |
| ESLint | 10.11.0 (2026-09-18); 10.0 on 2026-02-06 | S | Flat config only; config lookup per linted file (monorepo-friendly); Node `^20.19 \|\| ^22.13 \|\| >=24` | Slowest of the three |
| typescript-eslint | 8.71.0 (2026-09-28) | S | Supports ESLint `^8.57 \|\| ^9 \|\| ^10`; `projectService`; `strict-type-checked` | TS `<6.1.0` only; warns on TS 7 |
| Prettier | 3.9.9 (2026-09-23) | S | No 4.x exists | — |
| knip | 6.39.0 | S | Unused files/exports/deps, monorepo-aware | — |
| publint / @arethetypeswrong/cli | 0.3.24 / 0.18.5 | S | Run on the packed tarball in CI | attw still 0.x |
| dependency-cruiser / eslint-plugin-boundaries / @softarc/sheriff-core | 18.4.0 / 7.2.0 / 0.20.0 | S / S / B | Architecture boundaries; `turbo boundaries` (experimental) as a cheap complement | Sheriff pre-1.0 |
| ls-lint | 2.3.1 (2025-06-04) | S, low activity | File-name conventions | Slow release cadence |
| cspell / markdownlint-cli2 | 10.3.6 / 0.23.3 | S | — | — |
| actionlint / zizmor | 1.7.12 (2026-03-30) / 1.30.1 (2026-09-09) | S | zizmor audits: unpinned-uses, template-injection, dependabot-cooldown, typosquat-uses, self-repository | — |
| gitleaks / secretlint | 8.30.1 (2026-03-21) / 13.0.6 | S | gitleaks in CI + lefthook pre-commit; secretlint if you prefer npm-only | — |

Verdict: Oxlint (+tsgolint) + Oxfmt is the fastest *and* nearly as strict as typescript-eslint `strict-type-checked`; ESLint 10 is kept as a thin layer only for plugins Oxlint lacks (e.g. `eslint-plugin-vue`, `eslint-plugin-boundaries`), run **without** type information so it does not force TS 6.

### 2b) Monorepo / package management / TypeScript

| Tool | Version (date) | Maturity | Fit / notes | Risks |
|---|---|---|---|---|
| pnpm | 12.8.1 (2026-09-28); 11.28.2 still maintained | S | Catalogs (Renovate supports `pnpm.catalog.*`); settings in `pnpm-workspace.yaml`; defaults `minimumReleaseAge: 1440`, `blockExoticSubdeps: true`, `trustPolicy: off` (`no-downgrade` available); store v11 = single SQLite index; Node 22+ | 12.0.0 exact date UNVERIFIED (12.1 post 2026-08-29); two majors in one year |
| Bun | 1.4.2 (2026-09-05); 1.4 on 2026-08-20 | S | Workspaces, catalogs, isolated installs default, `minimumReleaseAge` opt-in (seconds), Security Scanner API, `--compile` cross-targets | Renovate has no `lockFileMaintenance` for `bun.lock` |
| Turborepo | 2.11.5 (2026-09-28) | S | Vercel Remote Cache free on all plans; `boundaries` experimental | — |
| Nx | 23.2.1 (23.2 on 2026-09-02) | S | Nx Cloud Hobby: 50k credits/mo, 5 contributors | Heavier; OSS plan details not on pricing page |
| moon | 2.5.6 (2026-09-28); 2.0 on 2026-02-18 | S | WASM toolchains; remote cache via Bazel-RE-compatible servers or Depot Cache | Smaller ecosystem |
| syncpack | 15.3.3 | S | Optional once catalogs are used | — |
| TypeScript | 7.0.2 (2026-07-08); `next` = 7.1.0-dev | S | `typescript@7` = tsgo; TS 6.0 (2026-03-23) via alias for API consumers | No API in 7.0; removed `baseUrl`, `target es5`, AMD/UMD |
| Node.js | 24 Active LTS; 26 Current (LTS on 2026-10-28) | S | Target Node 24 + 26 in the matrix | `node:sqlite` is Stability 1.2 (RC), not 2 |

### 2c) Commits / versioning / release / provenance

| Tool | Version (date) | Maturity | Fit / notes |
|---|---|---|---|
| commitlint + config-conventional | 21.2.3 | S | `commit-msg` hook + CI job `commitlint --from <base>` |
| lefthook | 2.1.15 (2026-09-29) | S | Go binary, parallel hooks, one YAML; preferred over husky 9.1.7 + lint-staged 17.6.0 |
| release-please | 17.11.2 (2026-08-24) | S | Release PR from Conventional Commits, manifest mode for monorepos, CHANGELOG + GitHub Release |
| changesets | 3.0.3 (2026-09-14) | S | Human intent files; best per-package versioning but duplicates Conventional Commits |
| semantic-release | 25.0.9 (26 beta) | S | Fully automatic, no review step |
| git-cliff / knope | 2.14.2 (2026-09-18) / 0.23.0 (2026-05-24) | S / B | Changelog-only / Rust-centric alternatives |
| softprops/action-gh-release | v3.0.3 (Aug 2026, year inferred; Node 24) | S | Or plain `gh release upload` |
| actions/attest-build-provenance / actions/attest | v4.2.2 (Aug 2026) / v4.2.2 (2026-08-04) | S | SLSA v1.0 Build L2 by default; L3 via reusable workflow; free on public repos (Sigstore public instance); verify with `gh attestation verify` |
| npm trusted publishing | GA 2025-07-31 | S | npm CLI ≥ 11.5.1, Node ≥ 22.14; GitHub-hosted runners only; ≤ 10 publishers/package; provenance automatic; new configs default to `npm stage publish` after 2026-09-03 |
| OpenSSF Scorecard action / Allstar | v2.4.4 (Scorecard 5.5.0, 2026-07-23) / v4.6 (2026-08-31) | S | Allstar is now **self-hosted only** |
| Bun `--compile` vs Node SEA | Bun 1.4 / Node 26 | S / A (1.1) | Bun: 6 cross-targets, `--bytecode`, embedded assets; Node SEA: ESM + VFS supported, cross-platform only with `useCodeCache`/`useSnapshot` off |

### 2d) CI (GitHub Actions)

| Item | Current | Notes |
|---|---|---|
| actions/checkout | v7.0.1 (2026-07-20) | Node 24 runtime line |
| actions/setup-node | v7.0.0 (2026-07-14) | Auto-cache only for npm; use `cache: pnpm` explicitly after pnpm/action-setup |
| pnpm/action-setup | v6.1.0 (2026-09-05) | Adds pnpm 12 support; honors `packageManager`/`devEngines` |
| oven-sh/setup-bun | v2.2.0 (2026-03-14) | Node 24 runtime |
| actions/cache | v6.1.0 (2026-06-26) | v5+ need runner ≥ 2.327.1 |
| actions/upload-artifact | v7.0.1 (2026-04-10) | ESM/Node 24 |
| Runners (public repos, free/unlimited) | `ubuntu-26.04`, `ubuntu-24.04-arm`, `windows-latest`, `windows-11-arm`, `macos-26`/`macos-15` (3-core M1, 7 GB) | Native arm64 on all three OSes |
| Merge queue | GA | Public repos **owned by an organization** or Enterprise Cloud; workflows must add `on: merge_group` |
| Concurrency | `group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true` | `queue: max` cannot combine with cancel-in-progress |
| Pinning | Full-length SHA | GitHub: SHA pin is "currently the only way to use an action as an immutable release"; Renovate `helpers:pinGitHubActionDigests` keeps pins fresh; zizmor enforces. GitHub "immutable releases" feature UNVERIFIED |
| Renovate (Mend app) | Free for public and private repos | `config:best-practices` = recommended + docker/GH-action digest pinning + `:pinDevDependencies` + abandonments + `security:minimumReleaseAgeNpm` (3 d) + `:maintainLockFilesWeekly`; `minimumReleaseAge` default is `null` |
| Dependabot | Default 3-day cooldown (security updates exempt) | Simpler, but no pnpm-catalog awareness or lockfile maintenance |

Recommendation: Renovate. Baseline config: extend `config:best-practices`; `minimumReleaseAge: "7 days"` for prod deps, `"3 days"` for devDependencies; automerge `minor`/`patch` for devDependencies and GitHub Actions digests (`automergeType: "branch"` to skip PR noise); `group:monorepos` already included; `schedule: ["before 6am on monday"]`; `lockFileMaintenance: { enabled: true }`.

### 2e) Testing

| Tool | Version (date) | Maturity | Notes |
|---|---|---|---|
| Vitest | 5.0.3 (2026-09-30); 5.0 on 2026-09-03 | S | Node 22 + Vite 6.4 required; Browser Mode stable (since 4.0); `vi.when()`; mocks cleared by default; unawaited async assertions fail; WebDriverIO provider removed; type testing via `--typecheck` |
| Playwright | 1.63.0 (2026-09-04) | S | Test `lock`s, `locator.visible()`, Chromium 153; **experimental component testing frozen** — use Vitest Browser Mode/Storybook |
| Storybook + addon-vitest | 10.6.1 (2026-09-29); 11.0.0-alpha.1 | S / A | 10.6 supports Vitest 5 browser tests; 11 needs Node 22.12+, Vite 7+, Vitest 4+ |
| testcontainers | 12.2.0 | S | For daemon integration tests |
| @stryker-mutator/core | 10.0.0 | S | Mutation testing on core packages only (cost) |

### 2f) i18n (Czech + English)

| Library | Version | Maturity | Fit |
|---|---|---|---|
| @inlang/paraglide-js | 2.25.4 | S | Compile-time, tree-shakable, fully typed message functions; framework-agnostic (React, Vue, Svelte, vanilla TS → also the CLI/daemon); plurals via `Intl.PluralRules` (Czech few/many/other); ICU/i18next import plugins; MIT |
| @lingui/core | 6.8.0 (Lingui 6) | S | React, Vue, Solid, Astro, Svelte, Node; macro-based extraction |
| i18next | 26.4.2 | S | Runtime, largest ecosystem, heaviest bundle |
| typesafe-i18n | 5.27.1 | maintenance UNVERIFIED | Not recommended over Paraglide |
| MessageFormat 2 | `messageformat` 4.0.0 | S (Unicode/CLDR: "stable part of CLDR") | `Intl.MessageFormat` is TC39 **Stage 1** — do not depend on native support |

Recommendation: Paraglide JS 2.x for web UI, desktop shell and CLI alike (one message catalog per package, compiled functions, no runtime parser).

### 2g) Logging / telemetry plumbing

| Item | Version (date) | Maturity | Notes |
|---|---|---|---|
| OpenTelemetry JS | core 2.11.0 (2026-08-31); `@opentelemetry/api` 1.9.1; `sdk-node` 0.222.0; `semantic-conventions` 1.43.0 | S core / A sdk-node, logs, instrumentations | Tested on Node 22/24/26 |
| GenAI semantic conventions | moved to `open-telemetry/semantic-conventions-genai` (2026-06-12, semconv v1.42.0) | A ("Development") | Emit `gen_ai.*` but version-gate your schema; expect renames |
| OpenLLMetry JS (`@traceloop/node-server-sdk`) | 0.27.0 | B (pre-1.0) | Auto-instruments LLM SDKs; optional |
| Langfuse (self-hosted) | v4.48.0 (2026-09-30) | S | Needs Postgres + ClickHouse + Redis + S3 — heavy for local-first |
| Arize Phoenix | active (2026-09-29) | S | Elastic License 2.0; single Docker image; OTLP/OpenInference ingestion — lighter local option |
| pino | 10.3.1 | S | `redact` (fast-redact, ~2 % overhead, wildcards costlier) |
| LogTape | 2.3.10 | S | Zero-dep, 5.3 kB, Node/Bun/browser, OTel + rotating-file sinks, built-in redaction (field removal, pattern masking, HMAC pseudonymization) |
| Local storage | `node:sqlite` (Stability 1.2 RC, Node 26) / `bun:sqlite` / `@duckdb/node-api` 1.5.6-r.1 | RC / S / S | SQLite for hot event store; DuckDB for analytics and `COPY … TO 'x.parquet' (FORMAT parquet)`; JSONL as the raw append-only export |

Debug-flag pattern: `WORKBOX_LOG_LEVEL` (+ `--log-level`), `DEBUG=workbox:*` namespace compatibility, `--debug` = level `debug` + JSONL trace bundle for bug reports; redact at the sink (LogTape redaction or pino `redact`) with fixed paths (`headers.authorization`, `env.*_KEY`, `*.token`) plus regex masks for known provider key prefixes — never derive redaction paths from input.

## 3) Recommended toolchain (one list)

- Runtime/language: Node 24 LTS + Node 26 (matrix), TypeScript 7.0.2 (`tsgo`), Bun 1.4.2 as the compile target for CLI/daemon binaries; TS 6.0 alias only in packages that need the TS API (Vue templates, ESLint typed rules if ever enabled).
- Package manager/monorepo: pnpm 12.8.1 (catalogs, `minimumReleaseAge: 4320`, `trustPolicy: no-downgrade`, `blockExoticSubdeps: true`), Turborepo 2.11.5 with Vercel Remote Cache (free), `turbo boundaries` (experimental) + eslint-plugin-boundaries 7.2.0.
- Lint/format: Oxlint 1.86.0 + oxlint-tsgolint 7.0.2003 (`--type-aware --type-check`), Oxfmt 0.71.0 (Prettier 3.9.9 as fallback), thin ESLint 10.11.0 layer (no type info) for `eslint-plugin-vue`/boundaries, knip 6.39.0, publint 0.3.24 + attw 0.18.5, cspell 10.3.6, markdownlint-cli2 0.23.3, ls-lint 2.3.1, actionlint 1.7.12, zizmor 1.30.1, gitleaks 8.30.1.
- Commits/release: lefthook 2.1.15, commitlint 21.2.3 (`config-conventional`), release-please 17.11.2 (manifest mode), `gh release upload` or action-gh-release v3, actions/attest-build-provenance v4 (SLSA L3 via reusable workflow), npm trusted publishing (OIDC), Scorecard action v2.4.4.
- CI: checkout v7, setup-node v7, pnpm/action-setup v6, setup-bun v2, cache v6, upload-artifact v7, all SHA-pinned; Renovate (Mend app) with `config:best-practices`; Dependabot alerts only.
- Tests: Vitest 5.0.3 (+ Browser Mode via Playwright 1.63.0), Storybook 10.6.1 + addon-vitest, testcontainers 12.2.0, Stryker 10.0.0 (core packages).
- i18n: Paraglide JS 2.25.4.
- Telemetry/logging: OTel JS 2.11 (`sdk-node` 0.222 experimental), LogTape 2.3.10, `node:sqlite`/`bun:sqlite` + DuckDB Node Neo 1.5.6, JSONL + Parquet exports; Phoenix (ELv2) as optional local trace UI.
- Community: issue forms (YAML, incl. `upload` fields), PR template, CONTRIBUTING, Contributor Covenant 3.0, SECURITY.md + private vulnerability reporting, Discussions, DCO (probot app), all-contributors (maintenance unclear), VHS 0.12.1 demo GIF, Apache-2.0 license.

Sample CI job matrix outline:

```yaml
on: { pull_request: {}, merge_group: {}, push: { branches: [main] } }
permissions: { contents: read }
concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }
jobs:
  static:   # ubuntu-26.04: oxfmt --check, oxlint --type-aware --type-check, eslint (thin), knip, cspell, markdownlint, ls-lint, actionlint, zizmor, gitleaks, commitlint --from origin/main
  test:     # matrix: os [ubuntu-26.04, ubuntu-24.04-arm, macos-26, windows-latest, windows-11-arm] × node [24, 26]; pnpm/action-setup → setup-node cache: pnpm → turbo run build test --affected
  browser:  # ubuntu-26.04: vitest --project browser (Playwright), storybook test
  package:  # pnpm pack → publint + attw; bun build --compile per target (6 targets, cross-compiled on one Linux runner)
  release:  # only on release-please tag: attest-build-provenance (reusable workflow → SLSA L3), gh release upload, npm publish via OIDC (id-token: write)
  scorecard: # weekly schedule
```

## 4) Open questions for the owner

1. Web UI framework: **Vue forces TS 6 for `vue-tsc`**; React can run fully on TS 7. Which one?
2. Is the repo organization-owned? Merge queue and Allstar assume it.
3. Bun as *runtime* for the daemon (single binary, `bun:sqlite`) vs Node 26 (`node:sqlite` RC) — or Bun binaries wrapping Node-compatible code?
4. Release cadence: per-package versions (changesets) or single-train releases driven by Conventional Commits (release-please)? The latter is assumed here.
5. Accept Oxfmt beta as the formatter of record, or Prettier 3.9 until Oxfmt 1.0?
6. Telemetry retention: local SQLite only, or optional Phoenix/Langfuse container?
7. License: Apache-2.0 (explicit patent grant; wrapping proprietary agent CLIs as subprocesses does not create derivative works) vs MIT (simpler) vs AGPL-3.0 (deters embedding by companies). Recommendation: Apache-2.0.

## 5) Sources (all accessed 2026-09-30)

- Biome: https://biomejs.dev/blog/ · https://biomejs.dev/blog/biome-v2-5/ · https://biomejs.dev/blog/roadmap-2026/ · npm `@biomejs/biome` dist-tags
- Oxc: https://oxc.rs/blog/2026-07-22-type-aware-linting-stable · https://oxc.rs/docs/guide/usage/linter/type-aware.html · https://oxc.rs/docs/guide/usage/linter/js-plugins.html · https://oxc.rs/docs/guide/usage/linter.html · https://oxc.rs/docs/guide/usage/formatter.html · https://oxc.rs/blog/2026-02-24-oxfmt-beta · https://github.com/oxc-project/oxc/releases · npm `oxlint`, `oxfmt`, `oxlint-tsgolint`
- ESLint: https://eslint.org/blog/2026/02/eslint-v10.0.0-released/ · GitHub API eslint/eslint latest
- typescript-eslint: https://typescript-eslint.io/users/dependency-versions/ · https://github.com/typescript-eslint/typescript-eslint/releases · https://typescript-eslint.io/blog/
- Prettier: https://github.com/prettier/prettier/releases
- TypeScript: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ · https://devblogs.microsoft.com/typescript/ · npm `typescript`, `@typescript/native-preview`
- pnpm: https://pnpm.io/blog/releases/11.0 · https://pnpm.io/blog/releases/12.0 · https://pnpm.io/blog · https://pnpm.io/settings/dependency-resolution · GitHub API pnpm/pnpm latest · npm `pnpm`
- Bun: https://bun.com/blog · https://bun.com/blog/bun-v1.4 · https://bun.com/blog/bun-v1.3 · https://bun.com/docs/bundler/executables
- Turborepo: GitHub API vercel/turborepo latest · https://turborepo.dev/docs/core-concepts/remote-caching · https://turborepo.dev/docs/reference/boundaries
- Nx: https://nx.dev/changelog · https://nx.dev/pricing · npm `nx`
- moon: https://moonrepo.dev/blog/moon-v2.0 · https://moonrepo.dev/docs/guides/remote-cache · GitHub API moonrepo/moon latest
- Node.js: https://github.com/nodejs/Release · https://nodejs.org/api/sqlite.html · https://nodejs.org/api/single-executable-applications.html
- Release tooling: GitHub API googleapis/release-please, changesets/changesets, orhun/git-cliff, knope-dev/knope, evilmartians/lefthook · npm `semantic-release`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional` · https://github.com/softprops/action-gh-release/releases
- Provenance/publishing: https://docs.github.com/en/actions/concepts/security/artifact-attestations · GitHub API actions/attest latest · https://github.com/actions/attest-build-provenance/releases · https://docs.npmjs.com/trusted-publishers/ · https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/
- Security posture: GitHub API ossf/scorecard-action, ossf/allstar, zizmorcore/zizmor, gitleaks/gitleaks, rhysd/actionlint, loeffel-io/ls-lint · npm `secretlint`, `cspell`, `markdownlint-cli2`, `knip`, `publint`, `@arethetypeswrong/cli`, `dependency-cruiser`, `eslint-plugin-boundaries`, `@softarc/sheriff-core`, `syncpack`
- GitHub Actions: https://github.com/actions/checkout/releases.atom · GitHub API actions/setup-node, actions/upload-artifact, actions/cache, pnpm/action-setup, oven-sh/setup-bun · https://github.com/actions/setup-node · https://docs.github.com/en/actions/reference/runners/github-hosted-runners · https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/ · https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue · https://github.blog/changelog/2023-07-12-pull-request-merge-queue-is-now-generally-available/ · https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs · https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- Dependency bots: https://docs.renovatebot.com/presets-config/ · https://docs.renovatebot.com/configuration-options/ · https://docs.renovatebot.com/modules/manager/npm/ · https://github.com/apps/renovate · https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference
- Testing: GitHub API vitest-dev/vitest latest · https://github.com/vitest-dev/vitest/releases/tag/v5.0.0 · GitHub API microsoft/playwright latest · GitHub API storybookjs/storybook latest · npm `@storybook/addon-vitest`, `testcontainers`, `@stryker-mutator/core` · https://voidzero.dev/posts/announcing-vitest-4
- i18n: https://paraglidejs.com/ · https://inlang.com/blog/inlang-v2-release · https://lingui.dev/ · npm `@inlang/paraglide-js`, `i18next`, `@lingui/core`, `typesafe-i18n`, `messageformat` · https://github.com/unicode-org/message-format-wg · https://github.com/tc39/proposal-intl-messageformat
- Telemetry/logging: GitHub API open-telemetry/opentelemetry-js latest · https://github.com/open-telemetry/opentelemetry-js · https://opentelemetry.io/docs/specs/semconv/gen-ai/ · https://github.com/open-telemetry/semantic-conventions-genai · https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/ (July 2026 status review) · npm `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/semantic-conventions`, `@traceloop/node-server-sdk`, `pino`, `@logtape/logtape`, `@duckdb/node-api` · https://langfuse.com/self-hosting · https://github.com/Arize-ai/phoenix · https://github.com/pinojs/pino/blob/main/docs/redaction.md · https://logtape.org/
- Community: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms · https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository · https://www.contributor-covenant.org/version/3/0/code_of_conduct/ · https://github.com/EthicalSource/contributor_covenant/releases (latest tagged release still 2.1) · https://github.com/apps/dco · https://allcontributors.org/en/ · GitHub API charmbracelet/vhs latest
