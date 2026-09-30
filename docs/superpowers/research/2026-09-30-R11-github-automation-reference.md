# R11 — GitHub automation reference for Workbox (misaon/workbox)

Status: config reference, 2026-09-30

Method: every tag, SHA, input name and snippet below was fetched on 2026-09-30 from the GitHub REST API (`releases/latest`, `git/ref/tags/<tag>`, `git/tags/<sha>` for annotated tags), the action's own README / `action.yml`, or the vendor's official docs. Snippets marked **verbatim** are copied from the cited page (only whitespace normalised). Snippets marked **composed** are assembled by me from verified inputs and the resolved SHAs; they were not run. Anything I could not confirm is marked **UNVERIFIED** and repeated in section 10. Where a doc page still shows an older version tag in its example (e.g. `@v4`), the table in section 1 wins.

Scope assumptions (from R7): public repo owned by the personal account `misaon`, pnpm monorepo, Bun-compiled binaries, one product version, Conventional Commits, release-please, SHA-pinned actions, Renovate.

---

## 1) Pinned actions

All tags are the `releases/latest` tag of the repository on 2026-09-30 (exception: `github/codeql-action`, whose `releases/latest` is `codeql-bundle-v2.27.1`; the action version was taken from the releases list, and `wagoid/commitlint-github-action`, which has no GitHub Releases at all, only tags). "Annotated" means the tag ref pointed at a tag object that was dereferenced to the commit; all other tags were lightweight and pointed straight at the commit.

| Action | Tag (published) | Resolved commit SHA | `uses:` line | Source (API) |
|---|---|---|---|---|
| actions/checkout | v7.0.1 (2026-07-20) | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1` | api.github.com/repos/actions/checkout/releases/latest; …/git/ref/tags/v7.0.1 |
| actions/setup-node | v7.0.0 (2026-07-14) | `820762786026740c76f36085b0efc47a31fe5020` | `uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0` | …/actions/setup-node/… |
| pnpm/action-setup | v6.1.0 (2026-09-05), annotated | `ea17c68df8912ef543352723c149a84f56e3d413` | `uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0` | …/pnpm/action-setup/git/ref/tags/v6.1.0 → git/tags/d9184bf1… |
| pnpm/setup (new, pnpm ≥ 11 only) | v3.0.0 (2026-09-20), annotated | `fbda4c85fc2e1e08721cd8763afea8f48d60f024` | `uses: pnpm/setup@fbda4c85fc2e1e08721cd8763afea8f48d60f024 # v3.0.0` | …/pnpm/setup/git/ref/tags/v3.0.0 → git/tags/e0ed22ae… |
| pnpm/setup (pin used by pnpm.io docs) | v2.0.0, annotated | `c9883cc79df532ad1a7b81bf9ab944ceb090d65c` | `uses: pnpm/setup@c9883cc79df532ad1a7b81bf9ab944ceb090d65c # v2.0.0` | …/pnpm/setup/git/tags/00e6b842… |
| oven-sh/setup-bun | v2.2.0 (2026-03-14) | `0c5077e51419868618aeaa5fe8019c62421857d6` | `uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0` | …/oven-sh/setup-bun/… |
| actions/cache | v6.1.0 (2026-06-26) | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | `uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0` | …/actions/cache/… |
| actions/upload-artifact | v7.0.1 (2026-04-10) | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | `uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1` | …/actions/upload-artifact/… |
| actions/download-artifact | v8.0.1 (2026-03-11) | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` | `uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1` | …/actions/download-artifact/… |
| actions/attest-build-provenance | v4.2.2 (2026-08-06) | `4d101475d8b20a2381f78447822ac1eab6504dd8` | `uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2` | …/actions/attest-build-provenance/… |
| actions/attest (recommended replacement, see §7) | v4.2.2 (2026-08-04) | `1e69f48acb82d1966a394da916b4c1698aa569d6` | `uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2` | …/actions/attest/… |
| googleapis/release-please-action | v5.0.0 (2026-04-22) | `45996ed1f6d02564a971a2fa1b5860e934307cf7` | `uses: googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0` | …/googleapis/release-please-action/… |
| ossf/scorecard-action | v2.4.4 (2026-07-23), annotated | `2d1146689b8cda280b9bc96326124645441f03bc` | `uses: ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc # v2.4.4` | …/ossf/scorecard-action/git/ref/tags/v2.4.4 → git/tags/55891bbd… |
| github/codeql-action (init, analyze, upload-sarif share the SHA) | v4.38.2 (2026-09-24), annotated | `2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2` | `uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2` (same for `/init` and `/analyze`) | …/github/codeql-action/releases?per_page=8; git/ref/tags/v4.38.2 → git/tags/88585263… |
| amannn/action-semantic-pull-request | v6.1.1 (2025-08-22) | `48f256284bd46cdaab1048c3721360e808335d50` | `uses: amannn/action-semantic-pull-request@48f256284bd46cdaab1048c3721360e808335d50 # v6.1.1` | …/amannn/action-semantic-pull-request/… |
| zizmorcore/zizmor-action | v0.6.4 (2026-09-09) | `cc914d7f3750a2d13d75c7f184a1060aa0e9d482` | `uses: zizmorcore/zizmor-action@cc914d7f3750a2d13d75c7f184a1060aa0e9d482 # v0.6.4` | …/zizmorcore/zizmor-action/… |
| gitleaks/gitleaks-action | v3.0.0 (2026-05-30) | `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e` | `uses: gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e # v3.0.0` | …/gitleaks/gitleaks-action/… |
| softprops/action-gh-release | v3.0.3 (2026-08-30), annotated | `efb35369e0ad2afab669f228072c1b0d510eae64` | `uses: softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64 # v3.0.3` | …/softprops/action-gh-release/git/ref/tags/v3.0.3 → git/tags/e598afbe… |
| wagoid/commitlint-github-action | v6.2.1 (date UNVERIFIED — tags only, no Releases), annotated | `b948419dd99f3fd78a6548d48f94e3df7f6bf3ed` | `uses: wagoid/commitlint-github-action@b948419dd99f3fd78a6548d48f94e3df7f6bf3ed # v6.2.1` | …/wagoid/commitlint-github-action/tags; git/ref/tags/v6.2.1 → git/tags/6cf16efd… |

Tools that are not actions (pin by version in the workflow instead):

| Tool | Latest release (published) | Notes |
|---|---|---|
| rhysd/actionlint | v1.7.12 (2026-03-30), commit `914e7df21a07ef503a81201c76d2b11c789d3fca` | No official GitHub Action; run the download script with the version as first argument (§7). |
| zizmorcore/zizmor | v1.30.1 (2026-09-09) | zizmor-action `version` input defaults to `latest`; pin `version: 1.30.1`. |

Cross-checks: the pins for checkout `3d3c42e5…# v7.0.1`, upload-artifact `043fb46d…# v7.0.1`, scorecard-action `2d114668…# v2.4.4` and codeql-action `2892aa5e…# v4.38.2` also appear in ossf/scorecard's own `scorecard-analysis.yml`; checkout `3d3c42e5…` and zizmor-action `cc914d7f…# v0.6.4` also appear in the zizmor integration docs. The zizmor docs additionally pin `astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1` and `github/codeql-action/upload-sarif@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9` (the latter matches the codeql-action tags list I fetched; the setup-uv SHA was **not** independently resolved).

Version/runtime notes from READMEs and release notes:
- actions/checkout v7: migrated to ESM; on `pull_request_target`/`workflow_run` it now refuses to check out fork code unless `allow-unsafe-pr-checkout: true`. v6 moved persisted credentials out of `.git/config` into a file under `$RUNNER_TEMP`. v5 moved to the node24 runtime, minimum runner 2.327.1. Inputs: `persist-credentials` (default `true`), `fetch-depth` (default `1`), `fetch-tags` (default `false`), `ref`.
- actions/setup-node v7: ESM internals; "No changes to action inputs, outputs, or behavior"; dummy `NODE_AUTH_TOKEN` fallback removed. `always-auth` was removed in v6. `runs.using: node24`.
- pnpm/action-setup v6.1.0: `runs.using: node24`; new inputs `cache` (default `'false'`) and `cache_dependency_path` (default `'pnpm-lock.yaml'`); `standalone` "has no effect for v12+".
- pnpm/setup v3.0.0 release notes (breaking): "include runid in cache key, restore freshest lockfile match", "automatically detect Node.js version files"; "`pnpm/setup@v3` installs pnpm v11 and newer only"; "pnpm v11 publishes no binary for Intel macOS; use v12 or newer on Intel macOS runners".
- actions/cache: "actions/cache@v5 runs on the Node.js 24 runtime and requires a minimum Actions Runner version of 2.327.1"; v6 is ESM. "A repository can have up to 10GB of caches"; "Caches that are not accessed within the last week will also be evicted".
- actions/upload-artifact v7.0.1: inputs `name`, `path`, `if-no-files-found` (warn|error|ignore), `retention-days`, `compression-level` (0–9, default 6), `overwrite` (default false), `include-hidden-files` (default false), `archive` (default true); outputs `artifact-id`, `artifact-url`, `artifact-digest`. Artifacts are immutable: "uploading to the same artifact via multiple jobs is not supported" without `overwrite: true`.
- actions/download-artifact v8.0.1: inputs `name`, `artifact-ids`, `path` (default `$GITHUB_WORKSPACE`), `pattern`, `merge-multiple` (default false), `github-token`, `repository`, `run-id`, `skip-decompress` (default false), `digest-mismatch` (`ignore|info|warn|error`, default `error`); output `download-path`.
- googleapis/release-please-action v5.0.0: BREAKING "upgrade to node24"; bundles `"release-please": "^17.6.0"` (exact resolved version inside `dist/` UNVERIFIED; R7 lists release-please 17.11.2 as the library's latest).
- softprops/action-gh-release v3: Node 24; v2.6.2 (Node 20) is deprecated.
- gitleaks/gitleaks-action v3: Node 20 → Node 24.

---

## 2) Runner labels (public repository, 2026-09-30)

Source: GitHub Docs "GitHub-hosted runners" reference + `actions/runner-images` README + GitHub Changelog.

Cost: **verbatim** — "Use of the standard GitHub-hosted runners is free and unlimited on public repositories." (runners reference) and "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners." (billing). "Larger runners are always charged for, even when used by public repositories or when you have quota available from your plan." Larger runners are only "available for organizations and enterprises on GitHub Team and GitHub Enterprise Cloud plans" — irrelevant for a personal repo. Private-repo rates (not applicable here): Linux 2-core $0.006/min, Windows 2-core $0.010/min, macOS 3–4 core $0.062/min; GitHub Free includes 2,000 min/month and 500 MB artifact storage for private repos.

| Label | Maps to / status today | Arch, hardware | Notes |
|---|---|---|---|
| `ubuntu-latest` | Ubuntu **24.04** today. Changelog 2026-09-17: `ubuntu-latest` migrates 24.04 → 26.04 "between October 19 and November 19, 2026"; "may break builds"; pin `ubuntu-24.04` if unprepared. | x64, 4 vCPU / 16 GB / 14 GB SSD | Standard, free on public repos |
| `ubuntu-26.04` | GA. Changelog 2026-09-17: "now out of public preview and fully supported for production workflows on both x64 and arm64" | x64, 4/16/14 | Standard |
| `ubuntu-26.04-arm` | GA (same announcement) | arm64, 4/16/14 | Standard |
| `ubuntu-24.04-arm` | Listed as a standard runner with no preview/beta note | arm64, 4/16/14 | Changelog 2025-01-16: "Linux arm64 hosted runners are available for free in public repositories" (then public preview; "these labels will not work in private repositories"). Docs today carry no such caveat. |
| `ubuntu-22.04`, `ubuntu-22.04-arm` | Current | x64 / arm64, 4/16/14 | |
| `ubuntu-slim` | Current; "execute Actions workflows in Ubuntu Linux, inside a container rather than a full VM instance"; "runs in unprivileged mode"; "available in both public and private repositories" | x64, 1 vCPU / 5 GB / 14 GB | Good for tiny jobs (PR-title lint etc.) |
| `macos-latest` | **macOS 26** (arm64) | arm64 (M1), 3 vCPU / 7 GB / 14 GB | Standard |
| `macos-26` | Current | arm64 (M1) 3/7/14 | Standard; `macos-26-xlarge` is a larger runner (paid) |
| `macos-15` | Current | arm64 (M1) 3/7/14 | |
| `macos-14` | **Deprecated** per runner-images README | arm64 | Do not use |
| `macos-26-intel`, `macos-15-intel` | Current | x64, 4 vCPU / 14 GB / 14 GB | Only Intel macOS options; note pnpm v11 has no Intel-mac binary (pnpm 12 does) |
| `xcode-27` | **Public preview**; changelog 2026-09-10 "Xcode 27 runner image now runs on macOS 27" | arm64 3/7/14 | Not needed |
| `windows-latest` | **Windows Server 2025** | x64, 4/16/14 | Standard |
| `windows-2025`, `windows-2025-vs2026`, `windows-2022` | Current | x64, 4/16/14 | |
| `windows-11-arm` | Current standard runner. Changelog 2026-08-20: default `windows-11-arm` image moves to Visual Studio 2026 between 2026-09-21 and 2026-09-30 ("may break workflows that depend on Visual Studio 2022"); `windows-11-vs2026-arm` GA on "standard and larger GitHub-hosted runners". | arm64, 4/16/14 | Changelog 2025-04-14: "Windows arm64 hosted runners are available for free in public repositories" (preview then; "this label will not work in private repositories"). |
| `windows-11-vs2026-arm` | GA 2026-08-20 | arm64, 4/16/14 | |

arm64 macOS caveats (**verbatim**): "community actions may not be compatible with arm64 and need to be manually installed at runtime"; "Nested-virtualization is not supported due to the limitation of Apple's Virtualization Framework".

Recommended matrix for Workbox: `[ubuntu-26.04, ubuntu-24.04-arm, macos-26, windows-2025, windows-11-arm]` (explicit versions; avoid `-latest` during the Oct–Nov 2026 Ubuntu migration).

---

## 3) Workflow skeleton snippets

### 3a) `permissions` (workflow syntax reference, **verbatim**)

```yaml
permissions:
  actions: read|write|none
  artifact-metadata: read|write|none
  attestations: read|write|none
  checks: read|write|none
  code-quality: read|write|none
  contents: read|write|none
  deployments: read|write|none
  id-token: write|none
  issues: read|write|none
  discussions: read|write|none
  packages: read|write|none
  pages: read|write|none
  pull-requests: read|write|none
  security-events: read|write|none
  statuses: read|write|none
  vulnerability-alerts: read|none
```

Shorthands: `permissions: read-all`, `permissions: write-all`, `permissions: {}`. Job-level form (**verbatim**):

```yaml
jobs:
  my_job:
    permissions:
      contents: read
      pull-requests: write
```

Security guidance (**verbatim**, "Secure use reference"): "Pinning an action to a full-length commit SHA is currently the only way to use an action as an immutable release." and "It's good security practice to set the default permission for the GITHUB_TOKEN to read access only for repository contents." Permissions "can then be increased, as required, for individual jobs within the workflow file". Repository setting: Settings > Actions > General > Workflow permissions — "Read repository contents and packages permissions" (choose this) vs "Read and write permissions", plus the checkbox "Allow GitHub Actions to create and approve pull requests" (needed by release-please with `GITHUB_TOKEN`, §5).

### 3b) `concurrency` (**verbatim**, docs)

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Variants from the same page: `group: ${{ github.head_ref || github.run_id }}`; `cancel-in-progress: ${{ !contains(github.ref, 'release/')}}`. Rules: "Up to 100 jobs or workflow runs can wait in the concurrency group; once the queue is full, any additional runs are canceled." "The combination of `queue: max` and `cancel-in-progress: true` is not allowed and will result in a workflow validation error."

### 3c) Triggers (**verbatim** fragments, events reference)

```yaml
on:
  pull_request:            # default activity types: opened, synchronize, reopened
  merge_group:
    types: [checks_requested]
    branches: [main]
  push:
    branches: ['main']
```

"If your repository uses GitHub Actions to perform required checks on pull requests in your repository, you need to update the workflows to include the `merge_group` event as an additional trigger." (Merge queues themselves need an organisation-owned repo, §8.) Scheduled workflows: "The shortest interval you can run scheduled workflows is once every 5 minutes." and "Scheduled workflows run on the latest commit on the default branch." The docs' schedule example now shows a `timezone` key under the cron entry (`- cron: '30 5 * * 1-5'` / `timezone: "America/New_York"`) — quoted as fetched, not cross-checked elsewhere.

### 3d) Job-level knobs (**verbatim**)

- `jobs.<job_id>.timeout-minutes`: "The maximum number of minutes to let a job run before GitHub automatically cancels it. Default: 360". `steps[*].timeout-minutes`: "Fractional values are not supported. `timeout-minutes` must be a positive integer."
- `jobs.<job_id>.strategy.fail-fast`: "If `jobs.<job_id>.strategy.fail-fast` is set to `true` or its expression evaluates to `true`, GitHub will cancel all in-progress and queued jobs in the matrix if any job in the matrix fails. This property defaults to `true`."
- `jobs.<job_id>.continue-on-error`: "Prevents a workflow run from failing when a job fails. Set to `true` to allow a workflow run to pass when this job fails."
- `defaults.run.shell` values: `bash` (default on Linux/macOS: `bash --noprofile --norc -eo pipefail {0}`), `pwsh`, `python`, `sh`, `cmd`, `powershell`. Workflow-level form:

```yaml
defaults:
  run:
    shell: bash
```

Matrix examples (**verbatim**, "Run job variations"):

```yaml
jobs:
  example_matrix:
    strategy:
      matrix:
        version: [10, 12, 14]
        os: [ubuntu-latest, windows-latest]
```

```yaml
strategy:
  matrix:
    os: [macos-latest, windows-latest]
    version: [12, 14, 16]
    environment: [staging, production]
    exclude:
      - os: macos-latest
        version: 12
        environment: production
      - os: windows-latest
        version: 16
```

### 3e) Permission blocks for release jobs

- Attestations (GitHub Docs "Use artifact attestations", **verbatim**): `permissions: id-token: write / contents: read / attestations: write`. The `actions/attest` README lists `id-token: write`, `attestations: write`, `artifact-metadata: write` (the last one backs `create-storage-record`, default `true`).
- Uploading release assets with `gh release upload` or `softprops/action-gh-release`: `contents: write` (action-gh-release README; add `discussions: write` only with `discussion_category_name`).
- npm trusted publishing: `id-token: write` + `contents: read` (npm docs).
- Scorecard job: `security-events: write` + `id-token: write` (scorecard workflow).

### 3f) Composed CI skeleton for Workbox (**composed**)

```yaml
name: CI

on:
  pull_request:
  merge_group:
    types: [checks_requested]
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

defaults:
  run:
    shell: bash

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-26.04, ubuntu-24.04-arm, macos-26, windows-2025, windows-11-arm]
        node: [24, 26]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 30
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          fetch-depth: 0            # only needed for `turbo run --affected`
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
        # `version` omitted: read from package.json "packageManager"/"devEngines.packageManager"
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build test
```

Notes: `persist-credentials: false` is what both the Scorecard and zizmor reference workflows use; zizmor otherwise flags the default. `merge_group` is harmless on a personal repo and keeps the workflow ready if the repo ever moves to an organisation.

---

## 4) Caching

### 4a) pnpm store via `actions/setup-node` (`docs/advanced-usage.md`, **verbatim**)

```yaml
steps:
- uses: actions/checkout@v7
- uses: pnpm/action-setup@v6
  with:
    version: 10
- uses: actions/setup-node@v7
  with:
    node-version: '24'
    cache: 'pnpm'
- run: pnpm install
- run: pnpm test
```

Facts (setup-node `action.yml` + docs): `cache`: "Used to specify a package manager for caching in the default directory. Supported values: npm, yarn, pnpm." `cache-dependency-path`: "Used to specify the path to a dependency file: package-lock.json, yarn.lock, etc. Supports wildcards or a list of file names for caching multiple dependencies." (docs examples: `'**/package-lock.json'` or a newline list). `package-manager-cache` (default `true`): "By default, caching is enabled when either devEngines.packageManager or the top-level packageManager field in package.json specifies npm as the package manager." — i.e. automatic caching is npm-only; for pnpm you must pass `cache: 'pnpm'` and pnpm must already be on PATH (hence `pnpm/action-setup` first). The action "caches global cache on the machine instead of `node_modules`, so cache can be reused between different Node.js versions", and it saves the cache itself in a post step (`action.yml`: `post: 'dist/cache-save/index.js'`). **Conclusion:** with `cache: pnpm` a separate `actions/cache` step for the pnpm store is unnecessary; keep `actions/cache` only for other directories (Bun global cache, Playwright browsers, local `.turbo` cache if you want it).

Alternative A — `pnpm/action-setup` v6.1.0 can cache the store itself (README example, **verbatim**):

```yaml
      - uses: pnpm/action-setup@v6
        name: Install pnpm
        with:
          version: 10
          cache: true

      - name: Install dependencies
        run: pnpm install
```

(`cache`: "Whether to cache the pnpm store directory", default `'false'`; `cache_dependency_path` default `'pnpm-lock.yaml'`, newline-separated list allowed.) The README adds: "This action does not set up Node.js; use `actions/setup-node` separately, or consider `pnpm/setup` for pnpm v11+."

Alternative B — what pnpm.io/continuous-integration now shows (**verbatim**), the new `pnpm/setup` action that installs pnpm and the runtime in one step and runs `pnpm install` automatically:

```yaml
name: pnpm Example Workflow
on:
  push:

jobs:
  build:
    runs-on: ubuntu-24.04
    strategy:
      matrix:
        node-version: [24]
    steps:
      - uses: actions/checkout@v6
      - name: Install pnpm and Node.js
        uses: pnpm/setup@c9883cc79df532ad1a7b81bf9ab944ceb090d65c # v2.0.0
        with:
          runtime: node@${{ matrix.node-version }}
          cache: true
```

`pnpm/setup` inputs (action.yml, main): `version` (optional when `packageManager`/`devEngines.packageManager` is set; must resolve to pnpm ≥ 11), `runtime` (`node@24`, `bun@latest`, `deno@2`; falls back to `devEngines.runtime`), `node-version-file` (auto-detects `.node-version`, `.nvmrc`, `.tool-versions`), `cache` (default `'false'`), `cache-dependency-path`, `working-directory` (default `'.'`), `install` (default `'true'`; appends `--no-runtime`), `require-lockfile` (default `'false'`; when true fails without a lockfile and installs with `--frozen-lockfile`). Outputs: `dest`, `bin-dest`, `runtime-name`, `runtime-version`, `runtimes`, `cache-hit`. Its own note on lockfiles: "pnpm already refuses to update an *existing* lockfile when it detects CI, and GitHub Actions always sets `CI`". Latest is v3.0.0 (`fbda4c85…`), which changed cache keys and version-file detection versus the v2.0.0 pin shown in the pnpm docs.

### 4b) Turborepo remote cache in CI (turborepo.dev, **verbatim**)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    steps:
      - uses: actions/checkout@v4
```

System env vars (reference page): `TURBO_TOKEN` "The Bearer token for authentication to access Remote Cache."; `TURBO_TEAM` "The account name associated with your repository. When using Vercel Remote Cache, this is your team's slug."; `TURBO_TEAMID`; `TURBO_API`; `TURBO_REMOTE_CACHE_READ_ONLY` "Prevent writing to the Remote Cache - but still allow reading."; `TURBO_REMOTE_CACHE_SIGNATURE_KEY` "Sign artifacts with a secret key" (enable with `remoteCache.signature: true` in `turbo.json`); `TURBO_REMOTE_ONLY` (the `--remote-only` flag is deprecated in favour of `--cache`, default `local:rw,remote:rw`); `TURBO_SCM_BASE` / `TURBO_SCM_HEAD` for `--affected`. "Vercel Remote Cache is free to use on all plans, even if you do not host your applications on Vercel." `--affected` caveat: "The comparison requires everything between base and head to exist in the checkout. If the checkout is too shallow, then all packages will be considered changed." (so use `fetch-depth: 0` or a deep enough `fetch-depth`). The Turborepo GitHub Actions guide still shows `actions/checkout@v4`, `pnpm/action-setup@v3` (`version: 8`) and `actions/setup-node@v4` (`node-version: 20`) — do not copy those versions.

### 4c) Bun

`oven-sh/setup-bun` (action.yml): inputs `bun-version` ("latest", "canary", "1.0.0", "1.0.x", `<sha>`), `bun-version-file` (`package.json`, `.bun-version`, `.tool-versions`), `bun-download-url`, `registries` (new; `registry-url`/`scope` are deprecated), `no-cache` (default `false`: "Disable caching of the downloaded executable."), `token`; outputs `bun-version`, `bun-revision`, `bun-path`, `bun-download-url`, `cache-hit` ("If the Bun executable was read from cache."). Auto-detection order: `package.json` `packageManager` → `engines.bun` → `latest`. **The action caches only the Bun executable, not `~/.bun/install/cache`.** README example (**verbatim**):

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version-file: ".bun-version"
```

Bun docs: "Bun stores every package downloaded from the registry in a global cache at ~/.bun/install/cache" (override via `bunfig.toml` `[install.cache] dir` or `BUN_INSTALL_CACHE_DIR`). Composed dependency-cache step (**composed**):

```yaml
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version-file: .bun-version
      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('**/bun.lock') }}
          restore-keys: bun-${{ runner.os }}-${{ runner.arch }}-
      - run: bun install --frozen-lockfile
```

(`pnpm/setup` can also install Bun: `runtime: bun@latest`.)

---

## 5) release-please (manifest mode, one product version)

### 5a) Action (README + v5.0.0 release notes)

Inputs (defaults): `token` (`secrets.GITHUB_TOKEN`), `release-type`, `path`, `target-branch` (auto), `config-file` (`release-please-config.json`), `manifest-file` (`.release-please-manifest.json`), `repo-url`, `github-api-url`, `github-graphql-url`, `fork` (`false`), `include-component-in-tag`, `proxy-server`, `skip-github-release` (`false`), `skip-github-pull-request` (`false`), `skip-labeling` (`false`), `changelog-host`, `versioning-strategy`, `release-as`. Manifest mode = omit `release-type` (README: "manifest becomes the default unless `release-type` is explicitly set").

Outputs: `releases_created`, `paths_released`, `prs_created`, `pr`, `prs`; for the root component (`path` `.`/unset): `release_created`, `tag_name`, `version`, `major`, `minor`, `patch`, `sha`, `upload_url`, `html_url`, `body`; per-path: `<path>--release_created` etc. (`steps.release.outputs['packages/my-module--release_created']`).

README example with gated upload (**verbatim**; README still shows `@v4` — use the v5 SHA):

```yaml
on:
  push:
    branches:
      - main
name: release-please
jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          release-type: node
      - name: Upload Release Artifact
        if: ${{ steps.release.outputs.release_created }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh release upload ${{ steps.release.outputs.tag_name }} ./artifact/some-build-artifact.zip
```

Required permissions (README, **verbatim**): `permissions: contents: write, issues: write, pull-requests: write`. Repo setting (README, **verbatim**): "You may also need to set 'Allow GitHub Actions to create and approve pull requests' under repository Settings > Actions > General."

Token note (README + GitHub Docs, **verbatim**): "When you use the repository's GITHUB_TOKEN to perform tasks, events triggered by the GITHUB_TOKEN will not create a new workflow run" (exceptions: `workflow_dispatch`, `repository_dispatch`). Consequence: the release PR opened by release-please gets no CI runs, and the tag/release it creates will **not** fire `on: push: tags` / `on: release` workflows. Options: (a) keep build + upload + publish in the same workflow, gated on `release_created` (recommended, no extra secrets); (b) pass a PAT or GitHub App token via `token:` so the release PR gets CI and downstream workflows trigger.

### 5b) Config files

Option names verified against `schemas/config.json` (release-please main): `$schema`, `packages`, `bootstrap-sha`, `last-release-sha`, `plugins`, `signoff`, `group-pull-request-title-pattern`, `release-search-depth`, `commit-search-depth`, `sequential-calls`, `label`, `release-label`; per package: `release-type`, `bump-minor-pre-major` ("Breaking changes only bump semver minor if version < 1.0.0"), `bump-patch-for-minor-pre-major` ("Feature changes only bump semver patch if version < 1.0.0"), `prerelease-type`, `versioning`, `changelog-sections` (items `type`, `section`, `hidden` — "Skip displaying this type of commit. Defaults to `false`."), `skip-github-release`, `skip-changelog`, `draft`, `prerelease`, `draft-pull-request`, `include-component-in-tag` ("When tagging a release, include the component name as part of the tag."), `include-v-in-tag`, `include-v-in-release-name`, `changelog-type`, `changelog-path`, `pull-request-title-pattern`, `pull-request-header`, `pull-request-footer`, `separate-pull-requests`, `always-update`, `tag-separator`, `extra-files`, `exclude-paths`, `version-file`, `initial-version`. Manifest doc: setting `include-component-in-tag: false` "changes tagName to `v<release-version>`"; the manifest can start as `{}`, or "manually add an entry into `.release-please-manifest.json`" for a package never released; `bootstrap-sha` limits how far back commits are parsed; CLI `release-please bootstrap --token=$GITHUB_TOKEN --repo-url=<owner>/<repo> --release-type=<release-type>`.

Default changelog headings (`src/changelog-notes.ts`, **verbatim**): `feat: 'Features'`, `fix: 'Bug Fixes'`, `perf: 'Performance Improvements'`, `deps: 'Dependencies'`, `revert: 'Reverts'`, `docs: 'Documentation'`, `style: 'Styles'`, `chore: 'Miscellaneous Chores'`, `refactor: 'Code Refactoring'`, `test: 'Tests'`, `build: 'Build System'`, `ci: 'Continuous Integration'`. Which of these are hidden by default is **UNVERIFIED** (no constant found in `changelog-notes.ts`, `changelog-notes/default.ts` or `strategies/base.ts`; the hiding comes from the conventional-changelog preset) — so declare the sections explicitly.

Minimal files for Workbox (**composed** from the verified option names; `$schema` points at the file that was fetched):

`release-please-config.json`
```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "bump-minor-pre-major": true,
  "bump-patch-for-minor-pre-major": true,
  "include-component-in-tag": false,
  "include-v-in-tag": true,
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "deps", "section": "Dependencies" },
    { "type": "revert", "section": "Reverts" },
    { "type": "docs", "section": "Documentation", "hidden": true },
    { "type": "style", "section": "Styles", "hidden": true },
    { "type": "chore", "section": "Miscellaneous Chores", "hidden": true },
    { "type": "refactor", "section": "Code Refactoring", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "build", "section": "Build System", "hidden": true },
    { "type": "ci", "section": "Continuous Integration", "hidden": true }
  ],
  "packages": {
    ".": {}
  }
}
```

`.release-please-manifest.json`
```json
{
  ".": "0.1.0"
}
```

Notes: top-level per-package options act as defaults for every entry in `packages` (manifest doc: "release-type … can be overridden per package"). With `"."` as the only package and `include-component-in-tag: false`, tags are `v0.1.0`, `v0.2.0`, …; `bump-minor-pre-major` keeps breaking changes at a minor bump while < 1.0.0. If the root `package.json` is `private`, `release-type: node` still bumps its `version` field; the workspace packages are published separately (§7d). The `node-workspace` plugin exists for per-package versions but is not needed for a single product version.

### 5c) Composed release workflow (**composed**)

```yaml
name: release

on:
  push:
    branches: [main]

permissions: {}

concurrency:
  group: release-${{ github.ref }}

jobs:
  release-please:
    runs-on: ubuntu-26.04
    timeout-minutes: 10
    permissions:
      contents: write
      pull-requests: write
      issues: write
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - uses: googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0
        id: release
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  build-binaries:
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created == 'true' }}
    runs-on: ubuntu-26.04
    timeout-minutes: 30
    permissions:
      contents: write            # gh release upload
      id-token: write            # Sigstore signing
      attestations: write        # store the attestation
      artifact-metadata: write   # actions/attest storage record (create-storage-record: true)
    env:
      TAG: ${{ needs.release-please.outputs.tag_name }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ needs.release-please.outputs.tag_name }}
          persist-credentials: false
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version-file: .bun-version
      - run: bun install --frozen-lockfile
      - run: bun run build:binaries          # emits dist/workbox-<target>[.exe]
      - name: Checksums
        run: cd dist && sha256sum workbox-* > "workbox_${TAG#v}_checksums.txt"
      - uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
        with:
          subject-path: dist/workbox-*
      - name: Upload release assets
        run: gh release upload "$TAG" dist/* --clobber
        env:
          GH_TOKEN: ${{ github.token }}
```

`release_created` is a string output, hence the `== 'true'` comparison at job level. `gh` is preinstalled on GitHub-hosted runners; "For each step that uses GitHub CLI, you must set an environment variable called `GH_TOKEN`". Because the release already exists (created by release-please), use `gh release upload`, not `gh release create`.

---

## 6) Renovate

### 6a) Install and onboarding

- App: https://github.com/apps/renovate, by Mend; "This app is free to install for both public and private repositories." Install → "All repositories" or "Only select repositories" → Renovate opens a "Configure Renovate" onboarding PR proposing `renovate.json`; merging it activates Renovate; closing it without merging makes no changes.
- Config file locations (docs): `renovate.json`, `renovate.json5`, `.github/renovate.json[5]`, `.gitlab/renovate.json[5]`, `.renovaterc`, `.renovaterc.json[5]`, `package.json` `"renovate"` key (deprecated).
- Default onboarding config (docs config-overview): `{ "$schema": "https://docs.renovatebot.com/renovate-schema.json", "extends": ["config:recommended"] }`.

### 6b) Presets (docs, **verbatim** JSON)

`config:best-practices` — "Preset with best practices from the Renovate maintainers. Recommended for advanced users, who want to follow our best practices." extends: `config:recommended`, `docker:pinDigests`, `helpers:pinGitHubActionDigests`, `:configMigration`, `:pinDevDependencies`, `abandonments:recommended`, `security:minimumReleaseAgeNpm`, `:maintainLockFilesWeekly`.

`config:recommended` extends: `:dependencyDashboard`, `:semanticPrefixFixDepsChoreOthers`, `:ignoreModulesAndTests`, `group:monorepos`, `group:recommended`, `mergeConfidence:age-confidence-badges`, `replacements:all`, `workarounds:all`, `helpers:forgejoDigestChangelogs`, `helpers:giteaDigestChangelogs`, `helpers:githubDigestChangelogs`, `helpers:gitlabDigestChangelogs`, `helpers:goXPackagesChangelogLink`, `helpers:goXPackagesNameLink`, `helpers:renovateChangelog`.

```json
// helpers:pinGitHubActionDigests — "Pin `github-action` digests."
{ "packageRules": [ { "matchDepTypes": ["action", "workflow"], "pinDigests": true } ] }

// security:minimumReleaseAgeNpm — "Wait until the npm package is three days old before raising the update."
{ "packageRules": [
  { "internalChecksFilter": "strict", "matchDatasources": ["npm"], "minimumReleaseAge": "3 days" },
  { "description": "Do not require Minimum Release Age for update types that are controlled by the package manager",
    "matchUpdateTypes": ["lockFileMaintenance"], "minimumReleaseAge": null, "matchDatasources": ["npm"] } ] }

// :maintainLockFilesWeekly — "Run lock file maintenance (updates) early Monday mornings."
{ "lockFileMaintenance": { "enabled": true, "extends": ["schedule:weekly"] } }

// :pinDevDependencies
{ "packageRules": [ { "matchDepTypes": ["devDependencies", "dev-dependencies", "dev"], "rangeStrategy": "pin" } ] }

// :preserveSemverRanges — "Preserve (but continue to upgrade) any existing SemVer ranges."
{ "packageRules": [ { "matchPackageNames": ["*"], "rangeStrategy": "replace" } ] }

// group:allNonMajor — "Group all `minor` and `patch` updates together." (does not separate dev/prod deps)
{ "packageRules": [ { "groupName": "all non-major dependencies", "groupSlug": "all-minor-patch",
                      "matchPackageNames": ["*"], "matchUpdateTypes": ["minor", "patch"] } ] }

// group:allDigest
{ "packageRules": [ { "groupName": "all digest updates", "groupSlug": "all-digest",
                      "matchPackageNames": ["*"], "matchUpdateTypes": ["digest"] } ] }

// :automergeMinor / :automergePatch / :automergeDigest / :automergeBranch / :automergePr
{ "lockFileMaintenance": { "automerge": true }, "minor": { "automerge": true }, "patch": { "automerge": true }, "pin": { "automerge": true } }
{ "lockFileMaintenance": { "automerge": true }, "patch": { "automerge": true }, "pin": { "automerge": true }, "separateMinorPatch": true }
{ "digest": { "automerge": true } }
{ "automergeType": "branch" }
{ "automergeType": "pr" }

// :label(<arg0>) / :prConcurrentLimit10 / :timezone(<arg0>) / :semanticCommits / :dependencyDashboard
{ "labels": ["arg0"] }
{ "prConcurrentLimit": 10 }
{ "timezone": "arg0" }
{ "semanticCommits": "enabled" }
{ "dependencyDashboard": true }

// schedule:weekly → schedule:earlyMondays — "Weekly schedule on early Monday mornings (before 4 AM)"
{ "schedule": ["* 0-3 * * 1"] }
// schedule:weekends
{ "schedule": ["* * * * 0,6"] }
```

### 6c) Option names (configuration-options page)

| Option | Type / default | Notes |
|---|---|---|
| `schedule` | array, default `["at any time"]` | Cron-like strings (see `schedule:` presets) or text such as "before 4am on monday", "every weekend" |
| `timezone` | string, default `"UTC"` | IANA name, e.g. `Europe/Prague` |
| `automerge` | boolean, default `false` | Requires passing checks; with `platformAutomerge` on GitHub "You must select at least one status check in the 'Require status checks to pass before merging' section" |
| `automergeType` | `"branch" \| "pr" \| "pr-comment"`, default `"pr"` | `branch` pushes straight to base and only opens a PR when tests fail |
| `automergeStrategy` | `auto\|fast-forward\|merge-commit\|rebase\|rebase-merge\|squash`, default `auto` | |
| `automergeSchedule` | array, default `["at any time"]` | |
| `platformAutomerge` | boolean, default `true` | Needs the repo setting "Allow auto-merge" (Settings > General > Pull Requests) |
| `ignoreTests` | boolean, default `false` | |
| `lockFileMaintenance` | object, default `{ "enabled": false }` | e.g. `{ "enabled": true, "schedule": ["before 3am on monday"] }` |
| `minimumReleaseAge` | string, default `null` | e.g. `"3 days"`; works with `internalChecksFilter` |
| `pinDigests` | boolean (used as `true` in `helpers:pinGitHubActionDigests`) | The options-page summary I got was inconsistent about its type; preset usage is authoritative |
| `prConcurrentLimit` | integer, default `10` | `0` = no limit |
| `prHourlyLimit` | integer, default `0` | |
| `labels` / `addLabels` | array of strings, default `[]` | `labels` replaces, `addLabels` appends |
| `packageRules` | array of objects | matchers: `matchDepTypes` (e.g. `devDependencies`), `matchUpdateTypes`, `matchManagers`, `matchDatasources`, `matchPackageNames`, plus `groupName`, `rangeStrategy` (`auto\|pin\|bump\|replace\|widen\|update-lockfile`) |
| `matchUpdateTypes` values | `major`, `minor`, `patch`, `pin`, `pinDigest`, `digest`, `rollback`, `bump`, `replacement` (docs list); `lockFileMaintenance` also valid (used in `security:minimumReleaseAgeNpm`) | |
| `separateMajorMinor` / `separateMinorPatch` | boolean, defaults `true` / `false` | |
| `dependencyDashboard`, `semanticCommits`, `extends`, `enabledManagers`, `postUpdateOptions`, `vulnerabilityAlerts`, `osvVulnerabilityAlerts` | exist | Defaults reported for `semanticCommits` and `osvVulnerabilityAlerts` were inconsistent between fetches — UNVERIFIED; `:semanticCommits` preset sets `"semanticCommits": "enabled"` |

GitHub Actions manager: matches `.github/workflows/*.ya?ml` and `action.ya?ml`; supports SHA pins with a version comment — example **verbatim** `- uses: actions/checkout@3df4ab11eba7bda6032a0b82a6bb43b11571feac # v4.0.0` — "Renovate will update the commit SHA according to the GitHub tag you specified"; depTypes `action` (`owner/repo@ref`) and `workflow` (reusable workflow `owner/repo/.github/workflows/x.yml@ref`); `# ratchet:` comments are preserved.

Automerge constraints (Renovate "Automerge" key concept, **verbatim**): "By default, Renovate will not automerge until it sees passing status checks / check runs for the branch."; "If you have configured your project to require Pull Requests before merging, it means that branch automerging is not possible."; "Add the `renovate/**` branch to your testing workflow files, or Renovate will not work properly with the `automergeType=branch` setting."; GitHub "Allow auto-merge" must be enabled for platform automerge. **Consequence for Workbox:** if the `main` ruleset requires a PR (recommended, §8), use `automergeType: "pr"` (the default) with `platformAutomerge`, not `automergeType: "branch"` as sketched in R7.

### 6d) Composed `renovate.json` (**composed**)

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:best-practices",
    "group:allNonMajor",
    ":semanticCommits",
    ":label(dependencies)",
    ":timezone(Europe/Prague)",
    "schedule:weekly"
  ],
  "prConcurrentLimit": 10,
  "minimumReleaseAge": "7 days",
  "packageRules": [
    {
      "description": "devDependencies: shorter cool-down, automerge non-major via GitHub auto-merge",
      "matchDepTypes": ["devDependencies"],
      "minimumReleaseAge": "3 days",
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "description": "GitHub Actions: automerge digest/minor/patch bumps of SHA-pinned actions",
      "matchManagers": ["github-actions"],
      "matchUpdateTypes": ["digest", "minor", "patch"],
      "automerge": true,
      "automergeType": "pr"
    }
  ]
}
```

`config:best-practices` already brings `helpers:pinGitHubActionDigests`, `:pinDevDependencies`, `security:minimumReleaseAgeNpm` (3 days for npm) and weekly lock-file maintenance; replace `:pinDevDependencies` with `:preserveSemverRanges` only if pinned devDependencies are unwanted. `minimumReleaseAge` at top level overrides the preset's 3 days for all datasources; the devDependencies rule restores 3 days there.

### 6e) Dependabot coexistence

Dependabot **alerts** are a repository setting, not a file: Settings > "Security and quality" > Advanced Security > Dependabot alerts > **Enable** (docs; "When enabled, GitHub immediately generates the dependency graph and creates alerts for any vulnerable dependencies it identifies"). Dependabot **version updates** are the only part that needs a file: "You enable Dependabot version updates by checking a `dependabot.yml` configuration file into your repository." So: enable alerts (and, optionally, security updates) in settings, do not add `dependabot.yml`, let Renovate do version updates. Whether alerts are on by default for new public repos is UNVERIFIED (the quickstart only says "GitHub Advanced Security features are also enabled for all public repositories on GitHub").

---

## 7) Security automation

### 7a) OpenSSF Scorecard

Reference workflow from ossf/scorecard itself (`.github/workflows/scorecard-analysis.yml`, **verbatim**; the scorecard-action README points to this file as the up-to-date example):

```yaml
name: Scorecard analysis workflow
on:
  push:
    # Only the default branch is supported.
    branches:
    - main
  schedule:
    # Weekly on Saturdays.
    - cron:  '30 1 * * 6'

permissions: read-all

jobs:
  analysis:
    name: Scorecard analysis
    runs-on: ubuntu-latest
    permissions:
      # Needed for Code scanning upload
      security-events: write
      # Needed for GitHub OIDC token if publish_results is true
      id-token: write

    steps:
      - name: "Checkout code"
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: "Run analysis"
        uses: ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc # v2.4.4
        with:
          results_file: results.sarif
          results_format: sarif
          # Scorecard team runs a weekly scan of public GitHub repos,
          # see https://github.com/ossf/scorecard#public-data.
          # Setting `publish_results: true` helps us scale by leveraging your workflow to
          # extract the results instead of relying on our own infrastructure to run scans.
          # And it's free for you!
          publish_results: true

      # Upload the results as artifacts (optional). Commenting out will disable
      # uploads of run results in SARIF format to the repository Actions tab.
      # https://docs.github.com/en/actions/advanced-guides/storing-workflow-data-as-artifacts
      - name: "Upload artifact"
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: SARIF file
          path: results.sarif
          retention-days: 5

      # Upload the results to GitHub's code scanning dashboard (optional).
      # Commenting out will disable upload of results to your repo's Code Scanning dashboard
      - name: "Upload to code-scanning"
        uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
        with:
          sarif_file: results.sarif
```

README rules for `publish_results: true` (needs `id-token: write` for "GitHub's OIDC token which verifies the authenticity of the result when publishing it"): "The workflow can't contain top level env vars or defaults"; "No workflow level write permissions"; "Only the job with `ossf/scorecard-action` can use `id-token: write`"; "No job level env vars or defaults"; "No containers or services"; must run on Ubuntu hosted runners; allowed steps only: `actions/checkout`, `actions/upload-artifact`, `github/codeql-action/upload-sarif`, `ossf/scorecard-action`, `step-security/harden-runner`. Only the default branch is scanned. Inputs: `results_file` (required), `results_format` (`json`|`sarif`, required), `repo_token` (optional PAT), `publish_results`, `file_mode` (`archive` default | `git`). A PAT is only needed to see **classic** branch protection in the Branch-Protection check; "GitHub's new Repository Rules are accessible … with the workflow's default `GITHUB_TOKEN`" — so use rulesets (§8) and no PAT. On push to `main` the job may fail on a personal repo's `branch_protection_rule` trigger? Not applicable: the reference workflow above has no `branch_protection_rule` trigger, only `push` + `schedule`.

### 7b) CodeQL

- **Default setup**: Settings > "Security and quality" > Advanced Security > Code Security > "CodeQL analysis" > **Set up** > **Default**. Prerequisites (**verbatim**): "GitHub Actions is enabled." and "It is publicly visible, or GitHub Code Security is enabled." Default setup analyses "JavaScript/TypeScript, Go, Ruby, Python, and Kotlin code" without configuration and uses build mode `none` for C/C++, C#, Java and Rust. Switching from advanced to default: "default setup will disable the existing workflow file and block any CodeQL analysis API uploads" (whether this also blocks third-party SARIF uploads such as zizmor/Scorecard is UNVERIFIED — the sentence names CodeQL analysis uploads only).
- **Advanced setup** (workflow-configuration-options reference): language identifiers `c-cpp` (aliases `c`, `cpp`), `csharp`, `go`, `java-kotlin` (`java`, `kotlin`), `javascript-typescript` (`javascript`, `typescript`), `python`, `ruby`, `rust`, `swift`, `actions` (GitHub Actions workflows). Query suites `security-extended`, `security-and-quality`. `category` distinguishes multiple analyses (auto-generated as `.github/workflows/codeql-analysis.yml:analyze` / `language:javascript-typescript`). Permissions: `security-events: write` (plus `contents: read`, `actions: read`, `packages: read` for private repos). codeql-action README: "v4 (latest)" and v3 are supported; reference by major tag or (here) SHA. Interpreted languages use `build-mode: none`.

Composed advanced workflow, only if you want the `actions` language or a custom query suite (**composed** from the reference-page fragments):

```yaml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '20 14 * * 1'
permissions: {}
jobs:
  analyze:
    runs-on: ubuntu-26.04
    timeout-minutes: 60
    permissions:
      security-events: write
      contents: read
      actions: read
      packages: read
    strategy:
      fail-fast: false
      matrix:
        include:
          - language: javascript-typescript
            build-mode: none
          - language: actions
            build-mode: none
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: github/codeql-action/init@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
        with:
          languages: ${{ matrix.language }}
          build-mode: ${{ matrix.build-mode }}
          queries: security-extended
      - uses: github/codeql-action/analyze@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
        with:
          category: "/language:${{ matrix.language }}"
```

Recommendation: a Bun + pnpm TypeScript monorepo needs no build step for CodeQL (`build-mode: none`), so **default setup** is sufficient and zero-maintenance; pick advanced setup only for the `actions` language / `security-extended`. Never enable both.

### 7c) Build provenance (SLSA)

- `actions/attest-build-provenance` README: "As of version 4, this is a wrapper for `actions/attest`" and "Existing applications may continue to use the `attest-build-provenance` action, but new implementations should use `actions/attest` instead."
- `actions/attest` inputs: `subject-path` (globs, max 1024 subjects), `subject-digest` (`sha256:hex`) + `subject-name` (required with digest), `subject-checksums` (shasum-format file), `sbom-path`, `predicate-type`, `predicate`, `predicate-path`, `push-to-registry` (false), `create-storage-record` (true), `show-summary` (true), `github-token`; outputs `bundle-path`, `attestation-id`, `attestation-url`, `storage-record-ids`. Default (no predicate) = build provenance. Basic usage (**verbatim**): `- uses: actions/attest@v4` / `with: subject-path: '<PATH TO ARTIFACT>'`. For container images "The value of the `subject-name` parameter should specify the fully-qualified image name … Do not include a tag".
- GitHub Docs (**verbatim**): "Artifact attestations by itself provides SLSA v1.0 Build Level 2."; "Reusable workflows can provide isolation between the build process and the calling workflow, to meet SLSA v1.0 Build Level 3."; public repositories "use the Sigstore Public Good Instance" and "A copy of the generated Sigstore bundle is stored with GitHub and is also written to an immutable transparency log that is publicly readable on the internet."; attestations are available in public repos on all plans (private/internal need GitHub Enterprise Cloud). Verify: `gh attestation verify PATH/TO/YOUR/BUILD/ARTIFACT-BINARY -R ORGANIZATION_NAME/REPOSITORY_NAME`.

### 7d) npm trusted publishing (OIDC) and staged publishing

npm docs ("Trusted publishers"):
- Requirements: "npm CLI version 11.5.1 or later and Node version 22.14.0 or higher"; cloud-hosted runners only ("Self-hosted runners are not currently supported").
- Configure on npmjs.com: package > Settings > "Trusted Publisher" > select "GitHub Actions" > Organization or user (`misaon`), Repository (`workbox`), Workflow filename (e.g. `release.yml`; "All fields are case-sensitive and must be exact"; must include the extension), Environment name (optional). "up to 10 trusted publishers configured at the same time" per package. CLI equivalent: `npm trust github <package> --file release.yml --repository misaon/workbox [--environment <env>] --allow-stage-publish [--allow-publish]` (`--allow-publish` and `--allow-stage-publish` both default to `false`; at least one is required).
- Allowed actions (**verbatim**): "`npm stage publish` is always allowed. Choose whether this trusted publisher can also publish directly with `npm publish`." Defaults timeline (docs): configurations created before 2026-05-20 allow `npm publish` only; between 2026-05-20 and 2026-09-03 an explicit selection was required; **configurations created after 2026-09-03 are automatically set to allow `npm stage publish`, with `npm publish` opt-in.** This confirms R7. Practical consequence: either tick "also allow npm publish" and keep `npm publish` in CI, or run `npm stage publish` in CI and approve on npmjs.com (2FA) — "the act of staging does not prompt for 2FA and can be done with any token type, the act of approving will."
- Staged publishing: requires npm CLI ≥ 11.15.0 and Node ≥ 22.14.0; subcommands `npm stage publish`, `npm stage list`, `npm stage view <stage-id>`, `npm stage download <stage-id>`, `npm stage approve <stage-id>`, `npm stage reject`; a new package gets a public placeholder version `0.0.0-stage`; "Staged Packages" tab on npmjs.com. `npm stage publish` accepts `--tag`, `--access`, `--dry-run`, `--otp`, `--provenance`.
- Provenance: generated automatically for trusted-publishing workflows from public repos with public packages; `--provenance` is not required (`--provenance-file` takes precedence over automatic generation).
- Example workflow (npm docs, **verbatim**; uses `setup-node@v6` — substitute the v7 SHA):

```yaml
permissions:
  id-token: write  # Required for OIDC
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm publish
```

`registry-url` makes setup-node write the project `.npmrc` ("Will set the registry in a project level .npmrc and .yarnrc file, and set up auth to read in from env.NODE_AUTH_TOKEN") — with OIDC no `NODE_AUTH_TOKEN`/`NPM_TOKEN` secret is set. Composed job for the release workflow in §5c (**composed**):

```yaml
  publish-npm:
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created == 'true' }}
    runs-on: ubuntu-26.04
    timeout-minutes: 15
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ needs.release-please.outputs.tag_name }}
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24
          registry-url: 'https://registry.npmjs.org'
          cache: pnpm
      - run: npm install -g npm@latest        # >= 11.5.1 for OIDC, >= 11.15.0 for `npm stage`
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build
      - run: npm stage publish --access public   # or `npm publish` if "also allow npm publish" is ticked
        working-directory: packages/<published-package>
```

(pnpm's own `pnpm publish` is not what the npm OIDC docs describe; publish with the npm CLI from the built package directory. The filename of this workflow must equal the one registered on npmjs.com.)

### 7e) Workflow linting and secrets scanning

zizmor (docs "Integrations", **verbatim**, SHAs identical to §1):

```yaml
name: GitHub Actions Security Analysis with zizmor 🌈

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["**"]

permissions: {}

jobs:
  zizmor:
    name: Run zizmor 🌈
    runs-on: ubuntu-latest
    permissions:
      security-events: write # Required for upload-sarif
      contents: read         # Only needed for private repos
      actions: read          # Only needed for private repos
    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Run zizmor 🌈
        uses: zizmorcore/zizmor-action@cc914d7f3750a2d13d75c7f184a1060aa0e9d482 # v0.6.4
```

zizmor-action inputs: `inputs` (default `.`), `version` (default `latest` — pin `1.30.1`), `persona` (`regular`|`pedantic`|`auditor`, default `regular`), `min-severity`, `online-audits` (default `true`), `advanced-security` (default `true`; set `false` to skip SARIF upload), `annotations` (default `false`; GitHub caps annotations at 10 per run). Docs note: "When using `--format=sarif`, zizmor exits with code 0 regardless of findings" — use a ruleset / code-scanning alerts to block merges, or run a second `zizmor --format=github` step to fail the job. The manual variant uses `uvx "zizmor@${ZIZMOR_VERSION}" --format=sarif . > results.sarif` with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` (remove `env:` for offline audits) and `github/codeql-action/upload-sarif` with `category: zizmor`.

actionlint (docs `usage.md`, **verbatim**):

```yaml
- name: Download actionlint
  id: get_actionlint
  run: bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
  shell: bash
- name: Check workflow files
  run: ${{ steps.get_actionlint.outputs.executable }} -color
  shell: bash
```

`install.md`: "give the version to the 1st command line argument" and "give the directory path to the 2nd command line argument"; the script "downloads `actionlint` (or `actionlint.exe` on Windows) binary to the current working directory". Pinned form (**composed**): `run: bash <(curl -fsSL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) 1.7.12`. Docker alternative (**verbatim**): `docker run --rm -v $(pwd):/repo --workdir /repo rhysd/actionlint:latest -color`. Problem matcher: copy `actionlint-matcher.json` to `.github/` and `echo "::add-matcher::.github/actionlint-matcher.json"` before running. `-shellcheck=` / `-pyflakes=` with an empty string disable those integrations; `-ignore <regex>` filters messages. No official actionlint GitHub Action exists.

gitleaks (README, **verbatim**):

```yaml
name: gitleaks
on:
  pull_request:
  push:
  workflow_dispatch:
  schedule:
    - cron: "0 4 * * *"
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v3
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
```

Licensing: organisation repositories "Require a free license key from gitleaks.io"; **personal accounts: "No license key needed"** — so `misaon/workbox` can omit `GITLEAKS_LICENSE`. Env inputs: `GITLEAKS_CONFIG`, `GITLEAKS_ENABLE_COMMENTS` (true), `GITLEAKS_ENABLE_SUMMARY` (true), `GITLEAKS_ENABLE_UPLOAD_ARTIFACT` (true), `GITLEAKS_NOTIFY_USER_LIST`, `GITLEAKS_VERSION`.

PR title lint (amannn README, **verbatim**):

```yaml
name: 'Lint PR'
on:
  pull_request_target:
    types: [opened, reopened, edited]

jobs:
  main:
    name: Validate PR title
    runs-on: ubuntu-slim
    permissions:
      pull-requests: read
    steps:
      - uses: amannn/action-semantic-pull-request@v6
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Inputs: `types`, `scopes`, `requireScope`, `disallowScopes`, `subjectPattern`, `subjectPatternError`, `ignoreLabels`, `headerPattern`, `headerPatternCorrespondence`, `wip`, `validateSingleCommit`, `validateSingleCommitMatchesPrTitle`. `pull_request_target` is used so the main-branch config applies to fork PRs; the job does not check out code (keep it that way — zizmor flags `pull_request_target` + checkout).

commitlint in CI — commitlint's own guide (**verbatim**):

```yml
name: CI

on: [push, pull_request]

permissions:
  contents: read

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm
      - name: Install commitlint
        run: npm install -D @commitlint/cli @commitlint/config-conventional
      - name: Print versions
        run: |
          git --version
          node --version
          npm --version
          npx commitlint --version

      - name: Validate current commit (last commit) with commitlint
        if: github.event_name == 'push'
        run: npx commitlint --last --verbose

      - name: Validate PR commits with commitlint
        if: github.event_name == 'pull_request'
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
```

For Workbox use the two `run:` lines above after the normal pnpm install (`pnpm exec commitlint …`) instead of the Docker-based `wagoid/commitlint-github-action` (inputs `configFile` default `commitlint.config.mjs` — `.js` unsupported, `failOnWarnings` false, `failOnErrors` true, `helpURL`, `commitDepth`, `token`; extra config deps need `NODE_PATH: ${{ github.workspace }}/node_modules`). With squash-merge-only plus the PR-title check, commit-message linting on PRs is optional.

---

## 8) Community files

| Item | Verified facts | Source |
|---|---|---|
| Code of conduct | "Contributor Covenant 3.0 Code of Conduct" — HTML: https://www.contributor-covenant.org/version/3/0/code_of_conduct/ ; Markdown: https://www.contributor-covenant.org/version/3/0/code_of_conduct/code_of_conduct.md . Licence **CC BY-SA 4.0**. Required attribution paragraph (**verbatim**): "This Code of Conduct is adapted from the Contributor Covenant, version 3.0, permanently available at https://www.contributor-covenant.org/version/3/0/. Contributor Covenant is stewarded by the Organization for Ethical Source and licensed under CC BY-SA 4.0. To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/". Fill in the placeholders found by searching for `[NOTE` (e.g. "[NOTE: describe your means of reporting here.]") and edit "Addressing and Repairing Harm". Sections: Our Pledge, Encouraged Behaviors, Restricted Behaviors, Other Restrictions, Reporting an Issue, Addressing and Repairing Harm, Scope, Attribution. | contributor-covenant.org |
| Licence | Canonical text: https://www.apache.org/licenses/LICENSE-2.0.txt → `LICENSE`. Appendix "How to apply the Apache License to your work": "Include a copy of the Apache License, typically in a file called LICENSE, in your work, and consider also including a NOTICE file that references the License." and attach the boilerplate ("Copyright [yyyy] [name of copyright owner] / Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. …") "replacing the fields enclosed by brackets with your own identifying information" using "the appropriate comment syntax for the file format". Lighter per-file alternative (SPDX): one comment line `// SPDX-License-Identifier: Apache-2.0` ("In each file in your project, just add a single line in the following format, tailored to your license(s) and the comment style for that file's language."). | apache.org, spdx.dev |
| DCO | App: https://github.com/apps/dco (publisher `dcoapp`, Probot). "requires all commit messages to contain the `Signed-off-by` line with an email address that matches the commit author." Trailer format: `Signed-off-by: Random J Developer <random@developer.example.org>`; `git commit -s`. Optional `.github/dco.yml`: `require: members: false` (skip for org members — n/a on a personal repo) and `allowRemediationCommits: individual: true / thirdParty: true`. Enforce by making the `DCO` check required in the ruleset. DCO text: Developer Certificate of Origin 1.1, "Copyright (C) 2004, 2006 The Linux Foundation and its contributors.", https://developercertificate.org/ — quote it in CONTRIBUTING.md. | github.com/dcoapp/app, developercertificate.org |
| Issue forms | Files in `.github/ISSUE_TEMPLATE/*.yml`. Top-level keys: `name` (required, unique), `description` (required), `body` (required), `title`, `labels`, `assignees`, `projects`, `type` (optional). `body` must contain at least one non-`markdown` element. Element schema: `markdown` (`attributes.value`, no `id`, no `validations`); `input` (`attributes.label` required; `description`, `placeholder`, `value`); `textarea` (same + `render` → code block); `dropdown` (`options` required, non-empty, distinct; `multiple`, `default` index); `checkboxes` (`options[].label` required, `options[].required`); `upload` (`validations.accept` list; size limits per type). `id`: "Can only use alpha-numeric characters, `-`, and `_`. Must be unique". `validations.required` (default false) "Prevents form submission until element is completed". Ordering: "templates in `.github/ISSUE_TEMPLATE` are listed alphanumerically and grouped by filetype, with YAML files appearing before Markdown files" — prefix filenames (`1-bug.yml`, `01-…` for 10+). | GitHub Docs |
| `config.yml` | `.github/ISSUE_TEMPLATE/config.yml` (**verbatim** example): `blank_issues_enabled: false` + `contact_links: - name: … url: … about: …`. | GitHub Docs |
| PR template | `pull_request_template.md` in root, `docs/`, or `.github/`; multiple templates in `.github/PULL_REQUEST_TEMPLATE/` selected with `?template=<name>`; only effective once "merged into the repository's default branch". | GitHub Docs |
| SECURITY.md | Community-health file precedence: "The `.github` folder / The root of the repository / The `docs` folder"; "add information about supported versions of your project and how to report a vulnerability". Private vulnerability reporting: Settings > "Security and quality" > Advanced Security > "Private vulnerability reporting" > **Enable** (public repos, "Owners and administrators") → "Report a vulnerability" button on the Security/Advisories page. | GitHub Docs |
| CODEOWNERS | Location: `.github/`, root or `docs/` ("GitHub searches in that order and uses the first one found"); "must be under 3 MB"; gitignore-like patterns but `!` negation, `\#` escaping and `[ ]` ranges "doesn't work"; owners `@username` / `@org/team` / email; "If the code owners are not on the same line, the pattern matches only the last mentioned code owner"; owners "must have write permissions for the repository". Composed file: `* @misaon`. | GitHub Docs |
| Discussions | Settings > General > Features > "Set up discussions" → edit welcome post → "Start discussion". "Repository owners and people with write access can enable GitHub Discussions for a community on their public and private repositories." | GitHub Docs |
| Rulesets / branch protection (personal public repo) | gated-features reusables (**verbatim**): "Rulesets are available in public repositories with free user and free team plans for organizations, and in public and private repositories with pro, team, and GitHub Enterprise Cloud"; "Protected branches are available in public repositories with GitHub Free". Enforcement statuses: Active, Disabled (Evaluate is enterprise-only). Rules available: "Require a pull request before merging" (required approvals, dismiss stale approvals, **allowed merge methods**: "you can require a merge type of merge, squash, or rebase"), "Require status checks to pass" (strict "Require branches to be up to date before merging"), "Require linear history" ("prevents collaborators from pushing merge commits"), "Require signed commits", "Restrict deletions", "Block force pushes", "Require deployments to succeed", bypass list. **Merge queue** (**verbatim**): "Pull request merge queues are available in any public repository owned by an organization, or in private repositories owned by organizations using GitHub Enterprise Cloud" — not available on `misaon/workbox`. | GitHub Docs |
| Repo merge settings | Settings > General > Pull Requests: "Allow squash merging" (keep) with default message format ("Pull request title", "Pull request title and commit details", "Pull request title and description"); untick "Allow merge commits" and "Allow rebase merging" ("If you select more than one merge method, collaborators can choose"; branches requiring linear history "must allow squash merging, rebase merging, or both"). Enable "Allow auto-merge" for Renovate `platformAutomerge`. | GitHub Docs |

Composed ruleset for `main` (settings, not code): target default branch; Restrict deletions; Block force pushes; Require linear history; Require a pull request before merging (0 required approvals for a solo maintainer, allowed merge method: squash); Require status checks to pass (select the CI job names, e.g. `test`, `static`, `Validate PR title`, `DCO`); bypass list: repository admin (so release-please's PRs can still be merged manually if a check is stuck).

---

## 9) Releases upload

`gh release upload` (**verbatim** usage): `gh release upload <tag> <files>... [flags]` — flags `--clobber` ("Delete and re-upload assets with duplicate names"; if the upload fails the originals are lost) and `-R, --repo <[HOST/]OWNER/REPO>`; display labels via `binary.exe#Windows Binary`.

`gh release create` (**verbatim** usage): `gh release create [<tag>] [<filename>... | <pattern>...]` — creates the tag from the default branch if missing (`--target <branch|sha>`); flags `--notes`, `--notes-file` (`-F`, "-" for stdin), `--notes-from-tag`, `--generate-notes`, `--notes-start-tag`, `--draft`, `--prerelease`, `--latest` (`--latest=false`), `--title`, `--verify-tag` ("Fail if git tag doesn't exist remotely"), `--discussion-category`, `--fail-on-no-commits`. Examples: `gh release create v1.2.3 --generate-notes`, `gh release create v1.2.3 -F release-notes.md`, `gh release create v1.2.3 ./dist/*.tgz`.

Auth in workflows: `GH_TOKEN`, `GITHUB_TOKEN` "(in order of precedence): an authentication token"; docs example sets `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`; the job needs `contents: write`. With release-please the release already exists, so the release job only runs `gh release upload "$TAG" dist/* --clobber` (§5c). `softprops/action-gh-release@efb35369…# v3.0.3` is the action alternative (inputs `files` multi-line globs, `tag_name`, `body`/`body_path`, `draft`, `prerelease`, `make_latest`, `generate_release_notes`, `fail_on_unmatched_files`, `overwrite_files`; outputs `url`, `id`, `upload_url`, `assets`) — unnecessary when `gh` is already on the runner.

Checksums convention: publish one `sha256` file next to the binaries. GoReleaser's default (widely copied) is `{{ .ProjectName }}_{{ .Version }}_checksums.txt` with algorithm `sha256`; produce it with `sha256sum workbox-* > workbox_<version>_checksums.txt` and let `actions/attest` cover the binaries (`subject-path: dist/workbox-*`) or the checksum list (`subject-checksums:`). Users verify with `sha256sum -c` (coreutils convention, not from a GitHub doc).

Homebrew tap: deferred (out of scope for the first release; would be a separate `misaon/homebrew-tap` repository updated from the release job).

---

## 10) UNVERIFIED list

1. `wagoid/commitlint-github-action` v6.2.1 release date (repo has tags but no GitHub Releases; `releases/latest` returns 404).
2. The exact release-please library version bundled in release-please-action v5.0.0 `dist/` (package.json says `^17.6.0`).
3. Which conventional-commit types release-please hides by default (no constant found in `src/changelog-notes.ts`, `src/changelog-notes/default.ts`, `src/strategies/base.ts`); the composed config declares them explicitly.
4. Whether enabling CodeQL **default setup** blocks third-party SARIF uploads (zizmor, Scorecard); docs only say it blocks "CodeQL analysis API uploads".
5. Whether Dependabot alerts are enabled by default on newly created public repositories (docs only give the manual enable path).
6. Renovate option defaults for `semanticCommits` and `osvVulnerabilityAlerts`, and the declared type of `pinDigests` on the options page (page summaries contradicted each other; preset JSON usage is verified).
7. `astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1` (quoted from zizmor docs, not resolved via the API).
8. The `timezone` key under `on.schedule[].cron` appeared in the events-reference fetch; not cross-checked in a second source.
9. Maximum value of `steps[*].timeout-minutes` (fetch was ambiguous; only "positive integer, no fractions" is certain).
10. All **composed** YAML/JSON blocks (§3f, §4c, §5b, §5c, §6d, §7b, §7d publish job, actionlint pinned form) were assembled from verified inputs but not executed.

---

## 11) Sources (all fetched 2026-09-30)

GitHub REST API (releases/latest, git/ref/tags, git/tags, tags, releases): https://api.github.com/repos/{actions/checkout, actions/setup-node, pnpm/action-setup, pnpm/setup, oven-sh/setup-bun, actions/cache, actions/upload-artifact, actions/download-artifact, actions/attest-build-provenance, actions/attest, googleapis/release-please-action, ossf/scorecard-action, github/codeql-action, amannn/action-semantic-pull-request, zizmorcore/zizmor-action, zizmorcore/zizmor, gitleaks/gitleaks-action, softprops/action-gh-release, wagoid/commitlint-github-action, rhysd/actionlint}/…

READMEs / action.yml / source:
- https://github.com/actions/checkout ; https://github.com/actions/setup-node ; https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md ; https://raw.githubusercontent.com/actions/setup-node/main/action.yml
- https://github.com/pnpm/action-setup ; https://raw.githubusercontent.com/pnpm/action-setup/master/action.yml ; https://github.com/pnpm/setup ; https://raw.githubusercontent.com/pnpm/setup/main/action.yml ; https://pnpm.io/continuous-integration
- https://github.com/oven-sh/setup-bun ; https://raw.githubusercontent.com/oven-sh/setup-bun/main/action.yml ; https://bun.com/docs/guides/runtime/cicd ; https://bun.com/docs/install/cache
- https://github.com/actions/cache ; https://github.com/actions/upload-artifact ; https://github.com/actions/download-artifact
- https://github.com/actions/attest-build-provenance ; https://github.com/actions/attest
- https://github.com/googleapis/release-please-action ; https://raw.githubusercontent.com/googleapis/release-please-action/main/README.md ; https://raw.githubusercontent.com/googleapis/release-please-action/v5.0.0/package.json ; https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md ; https://github.com/googleapis/release-please/blob/main/docs/customizing.md ; https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json ; https://raw.githubusercontent.com/googleapis/release-please/main/src/changelog-notes.ts ; …/src/changelog-notes/default.ts ; …/src/strategies/base.ts
- https://github.com/ossf/scorecard-action ; https://raw.githubusercontent.com/ossf/scorecard-action/main/README.md ; https://raw.githubusercontent.com/ossf/scorecard/main/.github/workflows/scorecard-analysis.yml
- https://github.com/github/codeql-action
- https://github.com/amannn/action-semantic-pull-request ; https://github.com/zizmorcore/zizmor-action ; https://docs.zizmor.sh/usage/ ; https://docs.zizmor.sh/integrations/ ; https://github.com/gitleaks/gitleaks-action ; https://github.com/softprops/action-gh-release ; https://github.com/wagoid/commitlint-github-action ; https://commitlint.js.org/guides/ci-setup.html
- https://raw.githubusercontent.com/rhysd/actionlint/main/docs/usage.md ; https://raw.githubusercontent.com/rhysd/actionlint/main/docs/install.md
- https://turborepo.dev/docs/guides/ci-vendors/github-actions ; https://turborepo.dev/docs/core-concepts/remote-caching ; https://turborepo.dev/docs/reference/system-environment-variables ; https://turborepo.dev/docs/reference/run

GitHub Docs:
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners ; https://docs.github.com/en/actions/reference/runners/larger-runners ; https://github.com/actions/runner-images ; https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax ; https://raw.githubusercontent.com/github/docs/main/content/actions/reference/workflows-and-actions/workflow-syntax.md ; https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/jobs/section-using-a-build-matrix-for-your-jobs-failfast.md ; https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations ; https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows ; https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency ; https://docs.github.com/en/actions/reference/security/secure-use ; https://docs.github.com/en/actions/concepts/security/github_token ; https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository ; https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-github-cli
- https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations ; https://docs.github.com/en/actions/concepts/security/artifact-attestations
- https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning ; https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/configuring-advanced-setup-for-code-scanning ; https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options
- https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts ; https://docs.github.com/en/code-security/dependabot/dependabot-alerts/configuring-dependabot-alerts ; https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates ; https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository
- https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms ; …/syntax-for-githubs-form-schema ; …/configuring-issue-templates-for-your-repository ; …/creating-a-pull-request-template-for-your-repository ; https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
- https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository ; https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners ; https://docs.github.com/en/discussions/quickstart
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets ; …/managing-rulesets/about-rulesets ; https://raw.githubusercontent.com/github/docs/main/data/reusables/gated-features/repo-rules.md ; …/gated-features/protected-branches.md ; …/gated-features/merge-queue.md ; …/repositories/rulesets-about-enforcement-statuses.md ; https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue ; …/configuring-commit-squashing-for-pull-requests ; …/configuring-commit-merging-for-pull-requests ; https://docs.github.com/en/get-started/learning-about-github/githubs-plans
- GitHub Changelog: https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration ; https://github.blog/changelog/2026-08-20-windows-11-arm64-vs2026-image-generally-available ; https://github.blog/changelog/2025-01-16-linux-arm64-hosted-runners-now-available-for-free-in-public-repositories-public-preview/ ; https://github.blog/changelog/2025-04-14-windows-arm64-hosted-runners-now-available-in-public-preview/ ; https://github.blog/changelog/label/actions/

GitHub CLI: https://cli.github.com/manual/gh_release_upload ; https://cli.github.com/manual/gh_release_create ; https://cli.github.com/manual/gh_help_environment

npm: https://docs.npmjs.com/trusted-publishers ; https://docs.npmjs.com/staged-publishing ; https://docs.npmjs.com/cli/v11/commands/npm-publish ; https://docs.npmjs.com/cli/v11/commands/npm-stage ; https://docs.npmjs.com/cli/v11/commands/npm-trust

Renovate: https://github.com/apps/renovate ; https://docs.renovatebot.com/getting-started/installing-onboarding/ ; https://docs.renovatebot.com/config-overview/ ; https://docs.renovatebot.com/configuration-options/ ; https://docs.renovatebot.com/presets-config/ ; https://docs.renovatebot.com/presets-default/ ; https://docs.renovatebot.com/presets-helpers/ ; https://docs.renovatebot.com/presets-group/ ; https://docs.renovatebot.com/presets-schedule/ ; https://docs.renovatebot.com/presets-security/ ; https://docs.renovatebot.com/key-concepts/automerge/ ; https://docs.renovatebot.com/modules/manager/github-actions/

Community: https://www.contributor-covenant.org/version/3/0/code_of_conduct/ ; https://www.contributor-covenant.org/version/3/0/code_of_conduct/code_of_conduct.md ; https://www.apache.org/licenses/LICENSE-2.0 ; https://www.apache.org/licenses/LICENSE-2.0.txt ; https://spdx.dev/learn/handling-license-info/ ; https://github.com/apps/dco ; https://github.com/dcoapp/app ; https://developercertificate.org/ ; https://goreleaser.com/customization/checksum/
