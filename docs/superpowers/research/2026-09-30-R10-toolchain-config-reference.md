# R10 — Toolchain configuration reference for Workbox

Status: config reference, 2026-09-30

Scope: exact file names, option names and minimal snippets for every tool chosen in R7/R9, copied or minimally adapted from official documentation fetched on 2026-09-30 (URL next to each snippet). Versions were read from the npm registry (`/latest`) on the same day. Anything that could not be confirmed is marked **UNVERIFIED** inline and collected in the final list. WebSearch was unavailable in this session (budget exhausted), so every source is a direct fetch of an official page, README, registry document or GitHub issue page.

Version snapshot (npm `latest`, 2026-09-30): pnpm 12.8.1 · turbo 2.11.5 · typescript 7.0.2 · oxlint 1.86.0 · oxlint-tsgolint 7.0.2003 · oxfmt 0.71.0 · eslint 10.11.0 · @eslint/js 10.0.1 · eslint-plugin-boundaries 7.2.0 · eslint-import-resolver-typescript 4.4.5 · typescript-eslint / @typescript-eslint/parser 8.71.0 · knip 6.39.0 · publint 0.3.24 · cspell 10.3.6 · @cspell/dict-cs-cz 3.0.8 · markdownlint-cli2 0.23.3 · @ls-lint/ls-lint 2.3.1 · lefthook 2.1.15 · @commitlint/cli + config-conventional 21.2.3 · bun 1.4.2 · @types/bun 1.4.2 · vite 8.3.1 · @vitejs/plugin-react 6.1.1 · @rolldown/plugin-babel 0.2.4 · babel-plugin-react-compiler 1.0.0 · oxc-transform-react 0.152.0 · @tailwindcss/vite 4.3.3 · vitest / @vitest/browser-playwright 5.0.3 · react / react-dom / @types/react / @types/react-dom 19.3.0 · @inlang/paraglide-js 2.25.4 · @logtape/logtape / file / redaction 2.3.10 · zod 4.6.5 · citty 0.2.2 · open 11.0.4.

---

## 1. pnpm 12.x

**Verified file names:** `pnpm-workspace.yaml` (workspace list, catalogs and *all* non-auth settings), `package.json` (`packageManager`, `devEngines.packageManager`, `engines`). `.npmrc` is only read for auth/registry settings.

> "pnpm gets its configuration from the command line, environment variables, and `pnpm-workspace.yaml`. Only auth and registry settings are read from `.npmrc` files. All other settings are configured in `pnpm-workspace.yaml` or the global `config.yaml`." — https://pnpm.io/settings (2026-09-30)

### 1.1 `pnpm-workspace.yaml` — packages + catalog + supply-chain settings

Assembled from the official per-setting snippets (each cited below):

```yaml
# pnpm-workspace.yaml
packages:
  # all packages in direct subdirs of packages/
  - 'packages/*'
  - 'apps/*'
  # exclude packages that are inside test directories
  - '!**/test/**'

catalog:
  react: ^19.3.0
  react-dom: ^19.3.0

catalogs:
  react17:
    react: ^17.0.2
    react-dom: ^17.0.2

minimumReleaseAge: 1440
minimumReleaseAgeExclude:
  - '@anthropic-ai/claude-agent-sdk'
trustPolicy: no-downgrade
blockExoticSubdeps: true
strictDepBuilds: true
allowBuilds:
  esbuild: true
  core-js: false
```

- `packages` example verbatim: `- 'my-app'`, `- 'packages/*'`, `- 'components/**'`, `- '!**/test/**'` — https://pnpm.io/pnpm-workspace_yaml
- `catalog:` / `catalogs:` and the `"catalog:"` protocol — https://pnpm.io/catalogs :

```yaml
catalog:
  react: ^18.3.1
  redux: ^5.0.1
```

```json
{
  "name": "@example/app",
  "dependencies": {
    "react": "catalog:",
    "redux": "catalog:"
  }
}
```

Named catalogs are referenced as `"catalog:react17"`. Related settings: `catalogMode` (`strict` | `prefer` | `manual`, default `manual`), `catalogPrune` (default `false`).

### 1.2 Supply-chain settings (all live in `pnpm-workspace.yaml`)

Source: https://raw.githubusercontent.com/pnpm/pnpm.io/main/docs/settings/dependency-resolution.md (rendered at https://pnpm.io/settings), 2026-09-30.

| Setting | Added in | Default | Type / values |
|---|---|---|---|
| `minimumReleaseAge` | v10.16.0 | **1440** (since v11), 0 before v11 | number (minutes) |
| `minimumReleaseAgeExclude` | v10.16.0 | undefined | string[] (package names) |
| `trustPolicy` | v10.21.0 | `off` | `no-downgrade` \| `off` |
| `trustPolicyExclude` | v10.22.0 | `[]` | string[] of package selectors, e.g. `'webpack@4.47.0 || 5.102.1'` |
| `trustPolicyIgnoreAfter` | v10.27.0 | undefined | number (minutes) |
| `blockExoticSubdeps` | v10.26.0 | **true** | Boolean |

Verbatim examples:

```yaml
minimumReleaseAge: 1440
minimumReleaseAgeExclude:
- webpack
- react
```

```yaml
trustPolicy: no-downgrade
trustPolicyExclude:
  - 'chokidar@4.0.3'
  - 'webpack@4.47.0 || 5.102.1'
  - '@babel/core@7.28.5'
```

`blockExoticSubdeps`: "When set to `true`, only direct dependencies (those listed in your root `package.json`) may use exotic sources (like git repositories or direct tarball URLs). All transitive dependencies must be resolved from a trusted source, such as the configured registry, local file paths, workspace links, or trusted GitHub repositories (node, bun, deno)."

### 1.3 Build scripts (`allowBuilds` replaces `onlyBuiltDependencies`)

Source: https://raw.githubusercontent.com/pnpm/pnpm.io/main/docs/settings/build.md and https://pnpm.io/cli/approve-builds (2026-09-30).

- `allowBuilds` (added v10.26.0): "A map of package matchers to explicitly allow (`true`) or disallow (`false`) script execution." "Packages not listed in `allowBuilds` are disallowed by default and are treated as unreviewed." It **replaced** `onlyBuiltDependencies`, `onlyBuiltDependenciesFile`, `neverBuiltDependencies`, `ignoredBuiltDependencies` and `ignoreDepScripts` in v11.
- `strictDepBuilds` (v10.3.0, default **true**): install exits non-zero if any dependency has unreviewed build scripts.
- `dangerouslyAllowAllBuilds` (v10.9.0, default **false**): "If set to `true`, all build scripts (e.g. `preinstall`, `install`, `postinstall`) from dependencies will run automatically, without requiring approval."
- `verifyDepsBeforeRun` (default `install`; values `install`, `warn`, `error`, `prompt`, `false`).
- `pnpm approve-builds` (v10.1.0) writes the `allowBuilds` map into `pnpm-workspace.yaml`; since v11.23.0 it also removes the deprecated settings.

```yaml
allowBuilds:
  esbuild: true
  core-js: false
  nx@21.6.4 || 21.6.5: true
  nx@21.6.0: false
```

```yaml
allowBuilds:
  'foo@git+ssh://git@example.com/org/foo.git': true
  'bar@git+https://github.com/org/bar.git#abc123': true
```

Gotcha: lefthook's npm docs still tell pnpm users to edit `onlyBuiltDependencies` (see §9); on pnpm 11+/12 use `allowBuilds: { lefthook: true }` instead.

### 1.4 `packageManager` field, Corepack status, pnpm self-management

- Format (Corepack README, https://github.com/nodejs/corepack#readme): `"packageManager": "pnpm@8.0.0+sha512.abc123..."`; "Permitted values for the package manager are `yarn`, `npm`, and `pnpm`"; the hash is "optional but strongly recommended as a security practice".
- Corepack is "distributed with Node.js from version 14.19.0 up to (but not including) 25.0.0" — i.e. **not shipped with Node 25/26**. The pnpm installation page (https://pnpm.io/installation) no longer documents Corepack at all; it says "pnpm 12 is the current release line" and recommends `npx get-pnpm` or the standalone scripts.
- pnpm honours `packageManager` itself. `managePackageManagerVersions`, `packageManagerStrict`, `packageManagerStrictVersion` were **removed** in v11 and replaced by `pmOnFail` (https://raw.githubusercontent.com/pnpm/pnpm.io/main/docs/settings/cli.md):

| Removed setting | Replace with |
|---|---|
| `managePackageManagerVersions: true` | `pmOnFail: download` (default) |
| `managePackageManagerVersions: false` | `pmOnFail: ignore` |
| `packageManagerStrict: false` | `pmOnFail: warn` |
| `packageManagerStrictVersion: true` | `pmOnFail: error` |
| `COREPACK_ENABLE_STRICT=0` | `pmOnFail: warn` |

`pmOnFail` (v11.0.0, default `download`): "download — download and run the declared pnpm version (this is the default and matches the previous `managePackageManagerVersions: true` behavior)".

- `pnpm self-update` (https://pnpm.io/cli/self-update): inside a project pinned through `packageManager` it "only updates the pinned version in `package.json` to the resolved one. It does not install pnpm globally." pnpm 12 "ships native binaries as `@pnpm/exe.<platform>-<arch>` packages".
- `devEngines.packageManager` (added v11.0.0) accepts version ranges; the resolved version is stored in `pnpm-lock.yaml` — https://pnpm.io/package_json.

```json
{
  "packageManager": "pnpm@12.8.1",
  "engines": { "node": ">=24" }
}
```

(Hash suffix omitted here because it must be computed for the exact tarball; `pnpm self-update` writes the pin for you.)

### 1.5 CI install

`pnpm install --frozen-lockfile` — https://pnpm.io/cli/install: "If `true`, pnpm doesn't generate a lockfile and fails to install if the lockfile is out of sync with the manifest / an update is needed or no lockfile is present." Default: "For CI: **true**, if a lockfile is present" (CI detected via `CI`, `CONTINUOUS_INTEGRATION`, `BUILD_NUMBER`, `RUN_ID`, …). Pass it explicitly anyway.

Registry: pnpm 12.8.1, engines `node >=18`, bins `pn`, `pnx`, `pnpm`, `pnpx` — https://registry.npmjs.org/pnpm/latest.

---

## 2. Turborepo 2.11.5

**Verified file names:** root `turbo.json`; per-package `turbo.json` (with `"extends": ["//"]` and `"tags"`). Docs domain: `turborepo.com` now 301-redirects to **turborepo.dev**; the schema URL is `https://turborepo.dev/schema.json`.

Sources: https://turborepo.dev/docs/reference/configuration, https://turborepo.dev/docs/reference/run, https://turborepo.dev/docs/reference/boundaries, https://turborepo.dev/docs/core-concepts/remote-caching, https://turborepo.dev/docs/guides/ci-vendors/github-actions, https://turborepo.dev/docs/reference/system-environment-variables (all 2026-09-30).

### 2.1 Root `turbo.json`

```jsonc
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "stream",
  "globalEnv": ["CI", "NODE_ENV"],
  "globalPassThroughEnv": ["GITHUB_TOKEN"],
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["$TURBO_DEFAULT$", "!README.md", "$TURBO_ROOT$/tsconfig.base.json"],
      "env": ["NODE_ENV"],
      "passThroughEnv": ["TURBO_TOKEN"]
    },
    "test": { "dependsOn": ["build"], "outputs": ["coverage/**"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true, "interactive": true }
  },
  "boundaries": {
    "tags": {
      "shared": { "dependents": { "allow": ["app", "daemon"] } },
      "app": { "dependencies": { "deny": ["daemon"] } }
    }
  },
  "remoteCache": { "signature": true }
}
```

Field semantics (verbatim where quoted):

- `globalEnv`: "A list of environment variables that you want to impact the hash of all tasks." `globalPassThroughEnv`: "A list of environment variables that you want to make available to tasks." `globalDependencies`: "A list of globs that you want to include in all task hashes."
- `ui`: default `"stream"`; `"tui"` | `"stream"`.
- `dependsOn`: `^build` = the task in the package's dependencies; `build` = same-package task; `web#lint` cross-package.
- `outputs`: "file glob patterns relative to the package's `package.json` to cache". `inputs`: `$TURBO_DEFAULT$` restores default input behaviour, `$TURBO_ROOT$` makes a glob relative to the repo root.
- `cache` default `true`; `persistent` default `false`; `interactive` default `false` (true for persistent); `with`: "A list of tasks that will be ran alongside this task."; `outputLogs`: `full` | `hash-only` | `new-only` | `errors-only` | `none`.
- `env`: variables that impact the hash; `passThroughEnv`: "An allowlist of environment variables that should be made available to this task's runtime". Wildcards `*` and negation `!` supported (`"env": ["DATABASE_URL", "MY_API_*", "!MY_API_SECRET"]`).
- `remoteCache` object keys: `enabled`, `signature`, `preflight`, `timeout`, `apiUrl`, `teamId`. `"signature": true` enables HMAC-SHA256 artifact signing with `TURBO_REMOTE_CACHE_SIGNATURE_KEY`.

Per-package `turbo.json`:

```jsonc
{
  "extends": ["//"],
  "tags": ["internal"],
  "tasks": {
    "build": { "outputs": ["$TURBO_EXTENDS$", ".next/**"] }
  }
}
```

### 2.2 `turbo run --affected`

- "Filter to only packages that are affected by changes on the current branch." When paired with `--filter`, it selects packages matching both. Default comparison is `--filter=...[main...HEAD]`; override with `TURBO_SCM_BASE=development` / `TURBO_SCM_HEAD=your-branch`.
- `futureFlags.affectedUsingTaskInputs` filters at task level using task `inputs` globs.
- Other flags: `--continue[=never|dependencies-successful|always]` (bare `--continue` = `always`), `--dry` / `--dry=json`, `--only`, `--summarize` (JSON in `.turbo/runs`), `--output-logs`, `--env-mode strict|loose` (`strict` is default), `--ui stream|tui`, `--filter tag:<label>`.
- Env: `TURBO_SCM_BASE` / `TURBO_SCM_HEAD` "Base/Head used by `--affected` and `turbo query affected` when calculating what has changed from `base...head`"; `TURBO_REMOTE_CACHE_READ_ONLY` "Prevent writing to the Remote Cache - but still allow reading."; `TURBO_UI`; `TURBO_CACHE`.

### 2.3 Remote cache on GitHub Actions

- Local one-off setup: `turbo login` then `turbo link` (docs show them bare; `npx turbo login` / `npx turbo link` work the same through npx). `turbo login --manual` for self-hosted.
- "Vercel Remote Cache … free to use on all plans, even if you do not host your applications on Vercel".
- Env vars: `TURBO_TOKEN` "The Bearer token for authentication to access Remote Cache."; `TURBO_TEAM` "The account name associated with your repository. When using Vercel Remote Cache, this is your team's slug."; `TURBO_TEAMID` "…this is your team's ID."; `TURBO_API` "Set the base URL for Remote Cache."

Official workflow excerpt (note: the doc's example still pins old action majors — `actions/checkout@v4`, `pnpm/action-setup@v3` with `version: 8`, `actions/setup-node@v4`/Node 20; R7 recommends checkout v7, setup-node v7, pnpm/action-setup v6 — adapt versions, keep the shape):

```yaml
name: CI
on:
  push:
    branches: ["main"]
  pull_request:
    types: [opened, synchronize]
jobs:
  build:
    name: Build and Test
    timeout-minutes: 15
    runs-on: ubuntu-latest
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - uses: pnpm/action-setup@v3
        with:
          version: 8
      - name: Setup Node.js environment
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install
      - name: Build
        run: pnpm build
      - name: Test
        run: pnpm test
```

Gotcha: the doc uses `fetch-depth: 2` for change detection; `--affected` compares `main...HEAD`, so on PR runners you need the base branch available (fetch it or set `TURBO_SCM_BASE`).

### 2.4 `turbo boundaries` (experimental)

- Checks two things: "Importing a file outside of the package's directory" and "Importing a package that is not specified as a dependency in the package's `package.json`".
- Tag rules live under `boundaries.tags` in the root `turbo.json`; packages get tags via their own `turbo.json` `"tags": ["internal"]`. `allow`/`deny` lists accept tag names or package names.

```json
{
  "boundaries": {
    "tags": {
      "tagName": {
        "dependencies": { "allow": ["tag1"], "deny": ["tag2"] },
        "dependents": { "allow": ["tag3"], "deny": ["tag4"] }
      }
    }
  }
}
```

The `@boundaries-ignore` escape-hatch comment was not visible in the fetched page — **UNVERIFIED**. The configuration-reference fetch rendered the example without the `tags` level; the dedicated boundaries reference (above) is the authoritative shape.

---

## 3. TypeScript 7.0.x

**Verified:** npm package `typescript` (latest **7.0.2**, bin **`tsc`** → `bin/tsc`, engines `node >=16.20.0`) — https://registry.npmjs.org/typescript/latest. `@typescript/native-preview` (bin `tsgo`) is frozen at `7.0.0-dev.20260707.2` (dist-tags latest/beta, not deprecated) — https://registry.npmjs.org/@typescript%2Fnative-preview; the staging repo says "For TypeScript 7.0 RC and later versions, the command name transitions to `tsc`" and is archived — https://github.com/microsoft/typescript-go.

Sources: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (2026-07-08), https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ (2026-03-23), https://www.typescriptlang.org/tsconfig/, https://bun.com/docs/typescript.

Install: `npm install -D typescript` (7.0, `tsc`); nightly `typescript@next`; side-by-side TS 6 for tools that still need the JS API: `npm install -D typescript@npm:@typescript/typescript6` → binary **`tsc6`**.

Supported in 7.0: `tsc --build` with project references, incremental compilation, parallel `--checkers` / `--builders`, `--singleThreaded`. Not supported: "TypeScript 7.0 does not yet expose a stable programmatic API" (7.1 "will ship with a new (and different) API"); tools embedding TS (Volar/Vue, MDX, Astro, Svelte, Angular templates) need 6.0.

Removed in 7.0 (hard errors; deprecated in 6.0, silenced there with `"ignoreDeprecations": "6.0"`): `target: es5`, `downlevelIteration`, `moduleResolution: node`/`node10`/`classic`, `module: amd`/`umd`/`systemjs`/`none`, **`baseUrl`**, `esModuleInterop: false`, `allowSyntheticDefaultImports: false`, `alwaysStrict: false`, the `module` keyword for namespaces, `asserts` on imports (use `with`). The 6.0 list additionally deprecates `--outFile` and `no-default-lib` directives.

New defaults (6.0, carried into 7.0):

| Option | Default now |
|---|---|
| `strict` | `true` |
| `module` | `esnext` |
| `target` | `es2025` in 6.0; 7.0 wording: "current stable ECMAScript version immediately preceding `esnext`" |
| `noUncheckedSideEffectImports` | `true` |
| `libReplacement` | `false` |
| `stableTypeOrdering` | `true` (cannot be disabled in 7.0) |
| `rootDir` | `./` (the tsconfig directory) |
| `types` | `[]` — `@types/*` are no longer auto-included |

Migration: "practically any TypeScript code that compiles cleanly with TypeScript 6.0 (with the `stableTypeOrdering` flag on, and without any `ignoreDeprecations` flag set) should compile identically in TypeScript 7.0." Typical adjustments: `"rootDir": "./src"` + `"include": ["./src"]`, and explicit `"types": ["node", "jest"]`.

Option reference (tsconfig index page): `erasableSyntaxOnly` (5.8, default false), `isolatedDeclarations` (5.5, default false), `verbatimModuleSyntax` (default false; the index page fetch reported "Released: 4.7" — **UNVERIFIED**, the option shipped in 5.0), `noUncheckedSideEffectImports` (5.6, default true), `rewriteRelativeImportExtensions` (5.7), `allowImportingTsExtensions` (5.0; default `true` if `rewriteRelativeImportExtensions` is enabled; requires `noEmit`/`emitDeclarationOnly` otherwise), `module` values include `node16`, `node18`, `node20`, `nodenext`, `preserve`; `moduleResolution` values `classic`, `node10`, `node16`, `nodenext`, `bundler` (default `Bundler` if `module` is `Preserve`, `NodeNext` if `module` is `NodeNext`).

Bun daemon `tsconfig.json` (verbatim from https://bun.com/docs/typescript; `"types": ["bun"]` "is required for TypeScript 6.0+"):

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "types": ["bun"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  }
}
```

Install types: `bun add -d @types/bun`. React UI: add `"types": ["vite/client"]` as needed (types are no longer auto-included) and `"jsx": "react-jsx"`.

Type packages (registry, 2026-09-30): `@types/bun` **1.4.2** (depends on `bun-types` 1.4.2, `typeScriptVersion` 5.6); `@types/react` **19.3.0** (dist-tag `ts6.0` → 19.3.0); `@types/react-dom` **19.3.0** (peer `@types/react ^19.3.0`); `react` / `react-dom` 19.3.0 (react-dom peer `react ^19.3.0`).

Gotchas: (1) `baseUrl` is gone — `paths` works without it since 4.1; (2) `types: []` default means Bun/Vite/Node globals vanish until listed; (3) typescript-eslint 8.71.0 declares `typescript >=4.8.4 <6.1.0` — no TS 7 support (see §6); (4) `@typescript/native-preview`/`tsgo` is discontinued — use `tsc` from `typescript@7`.

---

## 4. Oxlint 1.86.0 + oxlint-tsgolint 7.0.2003

**Verified file names:** `.oxlintrc.json`, `.oxlintrc.jsonc`, `oxlint.config.ts`, `oxlint.config.mts` (auto-discovered in cwd; nested configs supported); `oxlint --init` generates `.oxlintrc.json`.

Sources: https://oxc.rs/docs/guide/usage/linter/config.html, https://oxc.rs/docs/guide/usage/linter/plugins.html, https://oxc.rs/docs/guide/usage/linter/cli.html, https://oxc.rs/docs/guide/usage/linter/type-aware.html, https://registry.npmjs.org/oxlint/latest, https://registry.npmjs.org/oxlint-tsgolint/latest.

Official example (verbatim):

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "categories": {
    "correctness": "error",
    "suspicious": "warn",
    "pedantic": "off"
  },
  "plugins": ["unicorn", "typescript", "oxc"],
  "env": {
    "es6": true
  },
  "globals": {
    "MY_GLOBAL": "readonly",
    "Promise": "off"
  },
  "rules": {
    "no-alert": "error",
    "oxc/approx-constant": "warn",
    "no-plusplus": ["error", { "allowForLoopAfterthoughts": true }]
  },
  "overrides": [
    {
      "files": ["**/test/**"],
      "plugins": ["jest"],
      "env": { "jest": true },
      "rules": { "jest/no-disabled-tests": "off" }
    }
  ],
  "settings": {
    "react": {
      "linkComponents": [{ "name": "Link", "linkAttribute": "to" }]
    },
    "jsx-a11y": {
      "components": { "Link": "a", "Button": "button" }
    },
    "next": {
      "rootDir": "apps/dashboard/"
    }
  }
}
```

Other top-level keys: `ignorePatterns` (extra globs to ignore), `extends` (inherit other config files), `options.typeAware` (see below). Categories: `correctness`, `suspicious`, `pedantic`, `perf`, `style`, `restriction`, `nursery`.

Built-in plugins (15) — default **on**: `eslint`, `typescript`, `unicorn`, `oxc`. Default **off**: `react` (bundles eslint-plugin-react + react-hooks + react-refresh), `react-perf`, `nextjs`, `import`, `jsdoc`, `jsx-a11y`, `node`, `promise`, `jest`, `vitest`, `vue`. So `unicorn` **is** on by default and `import` is **not**. Enable in config `"plugins": ["react", "import"]` or CLI `oxlint --react-plugin --import-plugin`; disable defaults with `"plugins": []` or e.g. `--disable-typescript-plugin`. ESLint-compatible JS plugins are supported.

Type-aware linting (requires **TypeScript 7.0+**):

```sh
pnpm add -D oxlint oxlint-tsgolint@latest
oxlint --type-aware --type-check
```

or in the root config `{ "options": { "typeAware": true } }` (CLI flag wins). `--type-check` "report[s] TypeScript errors alongside lint results" and "can replace a separate `tsc --noEmit` step in CI". tsconfig is discovered automatically; `--tsconfig` overrides it (discouraged). Coverage: "59 out of 61 type-aware rules from typescript-eslint"; type-aware rules live under the `typescript/*` namespace. Debug: `OXC_LOG=debug oxlint --type-aware`. `oxlint` lists `oxlint-tsgolint >=7.0.2003` as an optional peer; tsgolint ships per-platform optional deps (`@oxlint-tsgolint/{linux,win32,darwin}-{x64,arm64}`).

CLI flags: `-c, --config <file>`, `--fix`, `--fix-suggestions`, `--fix-dangerously`, `--deny-warnings`, `--max-warnings <n>`, `-D/--deny`, `-A/--allow`, `-W/--warn` (rules or categories), `--format` (checkstyle, json, sarif, github, …), `--quiet`, `--threads`, `--print-config`, `--ignore-path`, `--ignore-pattern`, `--type-aware`, `--type-check`, `--tsconfig`, `--init`, `--<name>-plugin` / `--disable-<name>-plugin`. Engines: node `^20.19.0 || >=22.12.0`.

CI line: `oxlint --type-aware --type-check --deny-warnings`.

---

## 5. Oxfmt 0.71.0

**Verified file names:** `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts`; `$schema: "./node_modules/oxfmt/configuration_schema.json"`; `oxfmt --init` writes `.oxfmtrc.json`.

Sources: https://oxc.rs/docs/guide/usage/formatter.html, https://oxc.rs/docs/guide/usage/formatter/config.html, https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html, https://oxc.rs/docs/guide/usage/formatter/cli.html, https://oxc.rs/docs/guide/usage/formatter/ignore-files.html, https://registry.npmjs.org/oxfmt/latest.

```jsonc
// .oxfmtrc.jsonc
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 100,
  "singleQuote": true,
  "ignorePatterns": ["**/paraglide/**", "**/dist/**"],
  "sortImports": true,
  "sortPackageJson": true
}
```

Options and defaults (config-file reference): `printWidth` 100 (note: **not** Prettier's 80), `tabWidth` 2, `useTabs` false, `semi` true, `singleQuote` false, `jsxSingleQuote` false, `quoteProps` `"as-needed"`, `trailingComma` `"all"`, `bracketSpacing` true, `bracketSameLine` false, `objectWrap` `"preserve"`, `arrowParens` `"always"`, `endOfLine` `"lf"`, `embeddedLanguageFormatting` `"auto"`, `insertFinalNewline` true, `ignorePatterns` `[]`, `overrides` `[]`, `sortImports` disabled, `sortTailwindcss` disabled, `sortPackageJson` **enabled**, `experimentalOperatorPosition` `"end"`, `jsdoc` disabled, `svelte` disabled.

Languages: JavaScript, JSX, TypeScript, TSX, JSON, JSONC, JSON5, YAML, TOML, HTML, Angular, Vue, Svelte, CSS, SCSS, Less, Markdown, MDX, GraphQL, Ember, Handlebars.

CLI: `oxfmt` (formats in place; `--write` is the default), `oxfmt --check`, `--list-different`, `-c/--config <path>`, `--init`, `--migrate=prettier` | `--migrate=biome`, `--lsp`, `--stdin-filepath`, `--disable-nested-config`, `--ignore-path <file>` (repeatable), `--with-node-modules`, `--no-error-on-unmatched-pattern`, `--threads`. Exit code for `--check` failures — **UNVERIFIED** (not documented on the CLI page).

Ignore handling: `.gitignore` files are respected up the tree (global `core.excludesFile` is not); `.prettierignore` / `--ignore-path` apply globally; `ignorePatterns` is scoped to its config file (gitignore syntax, relative to the config); `.git`, `.svn`, `.jj`, `node_modules` and lock files (`package-lock.json`, `pnpm-lock.yaml`) are always ignored.

`.editorconfig`: read for `end_of_line`, `indent_style`, `indent_size`, `max_line_length`, `insert_final_newline`. Prettier: "Oxfmt matches Prettier's JavaScript formatting" (100 % of Prettier's JS/TS conformance tests); migrate `.prettierrc` with `oxfmt --migrate=prettier`. Package scripts from the docs: `"fmt": "oxfmt"`, `"fmt:check": "oxfmt --check"`. Engines node `^20.19.0 || >=22.12.0`.

---

## 6. ESLint 10 flat config + eslint-plugin-boundaries 7.x

**Verified file names:** `eslint.config.js` (also `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`). ESLint 10.11.0 (`"type": "commonjs"`, engines `^20.19.0 || ^22.13.0 || >=24`), `@eslint/js` 10.0.1.

Sources: https://eslint.org/docs/latest/use/configure/configuration-files (v10.11.0), https://www.jsboundaries.dev/docs/quick-start/, /docs/settings/, /docs/policies/, /docs/rules/, /docs/rules/dependencies/, /docs/classification/, /docs/guides/typescript-support/, /docs/next/releases/migration-guides/v6-to-v7/, https://raw.githubusercontent.com/javierbrea/eslint-plugin-boundaries/master/README.md, https://unpkg.com/eslint-plugin-boundaries@7.2.0/dist/Config/Recommended.js, registry pages for eslint-plugin-boundaries, eslint-import-resolver-typescript, typescript-eslint, @typescript-eslint/parser.

Plugin facts: peer `eslint >=6.0.0`, engines `node >=18.18`; bundles `eslint-import-resolver-node` and `eslint-module-utils`; exports `.`, `./config`, `./strict`, `./recommended`. The `recommended` preset enables only `boundaries/dependencies: [2]` and sets `no-ignored-dependencies`, `no-private`, `no-unknown-files`, `no-unknown-dependencies` to `0`.

v7 rule names (from /docs/rules/ and the v6→v7 guide): **`boundaries/dependencies`** (canonical; `boundaries/element-types` is a deprecated alias), `boundaries/no-unknown-files`, `boundaries/no-unknown-dependencies` (formerly `boundaries/no-unknown`), `boundaries/no-ignored-dependencies` (formerly `boundaries/no-ignored`); deprecated: `entry-point` (→ `dependencies` + `fileInternalPath`), `external` (→ `checkAllOrigins: true`), `no-private` (→ `dependency.relationship`). The rule option array is **`policies`** in v7 (v6 called it `rules`); the Options table on /docs/rules/dependencies/ still prints `"rules": <array>` while its own example uses `policies:` — follow the migration guide and the README (`policies`).

Monorepo config (element patterns verbatim from /docs/classification/; rule shape from /docs/quick-start/; resolver from /docs/guides/typescript-support/):

```js
// eslint.config.js (ESM)
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import typescriptParser from "@typescript-eslint/parser";
import boundaries from "eslint-plugin-boundaries";

export default defineConfig([
  globalIgnores(["**/dist/", "**/coverage/", "**/paraglide/"]),
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    plugins: { js, boundaries },
    extends: ["js/recommended"],
    languageOptions: { parser: typescriptParser },
    settings: {
      "boundaries/root-path": import.meta.dirname,
      "boundaries/dependency-nodes": ["import", "export", "require", "dynamic-import"],
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
      "boundaries/elements": [
        { type: "package", pattern: "packages/*/src", capture: ["packageName"] },
        { type: "app", pattern: "apps/*/src", capture: ["appName"] },
      ],
      "boundaries/files": [
        { pattern: "**/*.test.ts", category: "test" },
      ],
    },
    rules: {
      ...boundaries.configs.recommended.rules,
      "boundaries/no-unknown-files": 2,
      "boundaries/no-unknown-dependencies": 2,
      "boundaries/dependencies": [2, {
        default: "disallow",
        policies: [
          { from: { element: { type: "package" } }, allow: { to: { element: { type: "package" } } } },
          { from: { element: { type: "app" } }, allow: { to: { element: { types: ["package", "app"] } } } },
          { disallow: { to: { file: { categories: "test" } } }, message: "Do not import test files from production code" },
        ],
      }],
    },
  },
]);
```

Verbatim building blocks:

- `@eslint/js` usage from the ESLint docs: `plugins: { js }, extends: ["js/recommended"]` (both lines are required).
- `"boundaries/root-path"`: default `process.cwd()`; docs example `resolve(import.meta.dirname)`; env override `ESLINT_PLUGIN_BOUNDARIES_ROOT_PATH=../../project-root`.
- `"boundaries/dependency-nodes"`: default `["import", "export", "require", "dynamic-import"]`; `"boundaries/additional-dependency-nodes"` takes `{ selector, name?, kind }` esquery objects.
- `"import/resolver"` "leverag[es] the same resolver infrastructure used by `eslint-plugin-import`"; TypeScript guide: install `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` (optional) and `eslint-import-resolver-typescript`, then `settings: { "import/resolver": { typescript: { alwaysTryTypes: true } } }`. The resolver "automatically detects custom path mappings defined in your `tsconfig.json`". `eslint-import-resolver-typescript` 4.4.5 peers: `eslint *`, optional `eslint-plugin-import` / `eslint-plugin-import-x`.
- Element descriptor keys: `type`, `pattern`, `capture`, `basePattern`, `baseCapture`; `mode` is deprecated in v7 (use `partialMatch: false` or file descriptors). Policy selectors: `from`/`to` with `element: { type | types | captured }`, `file: { categories }`, `module: { origin, source }`, `dependency: { kind, relationship, specifiers, origin }`; message templates `{{from.element.types}}`, `{{policy.index}}` (was `{{rule.index}}`).

Running without type information: the config above never sets `parserOptions.project`/`projectService`, so no type-aware rules run. Gotcha: `@typescript-eslint/parser` 8.71.0 declares peer `typescript >=4.8.4 <6.1.0` and requires the TypeScript JS API, which `typescript@7` does not expose — install the alias `typescript@npm:@typescript/typescript6` for the ESLint layer (or pin a TS 6.0.x in that workspace), and ignore the peer warning if you keep TS 7 as the main `typescript`.

---

## 7. knip 6, publint 0.3, @arethetypeswrong/cli 0.18

**Verified file names:** `knip.json` (also `knip.jsonc`, `knip.ts`, `knip.config.ts`, or `"knip"` in `package.json`); optional `.attw.json`.

Sources: https://knip.dev/reference/configuration, https://knip.dev/features/monorepos-and-workspaces, https://publint.dev/docs/cli, https://raw.githubusercontent.com/arethetypeswrong/arethetypeswrong.github.io/main/packages/cli/README.md, https://registry.npmjs.org/knip/latest.

knip reads workspaces from (in order) `package.json` `workspaces`, **`pnpm-workspace.yaml` `packages`**, legacy `workspaces.packages`, and the `workspaces` object in its own config. "In a project with workspaces, the `entry` and `project` options at the root level are ignored." Official example:

```json
{
  "workspaces": {
    ".": {
      "entry": "scripts/*.js",
      "project": "scripts/**/*.js"
    },
    "packages/*": {
      "entry": "{index,cli}.ts",
      "project": "**/*.ts"
    },
    "packages/cli": {
      "entry": "bin/cli.js"
    }
  }
}
```

Adapted for Workbox:

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "ignoreDependencies": ["@types/bun"],
  "workspaces": {
    ".": { "entry": ["scripts/*.ts"], "project": ["scripts/**/*.ts"] },
    "packages/*": { "entry": ["src/index.ts"], "project": ["src/**/*.ts"] },
    "apps/web": { "entry": ["src/main.tsx"], "project": ["src/**/*.{ts,tsx}"] },
    "apps/daemon": { "entry": ["src/main.ts", "src/cli.ts"], "project": ["src/**/*.ts"], "ignoreDependencies": ["oxlint-tsgolint"] }
  }
}
```

Per-workspace keys: `entry`, `project`, `ignore`, `ignoreBinaries`, `ignoreDependencies`, `ignoreIssues`, `ignoreMembers`, `ignoreUnresolved`, `includeEntryExports`, plugin overrides (`true`/`false`/`{ config, entry }`). Root-only: `ignoreWorkspaces`, `include`/`exclude`/`rules` (issue types), `paths`, `tags`, `cycles`. CLI: `knip --workspace packages/my-lib`, `knip --workspace '@myorg/*' --workspace '!@myorg/legacy'`. knip 6.39.0 has bins `knip` and `knip-bun`; engines `^20.19.0 || >=22.12.0` (engineStrict).

publint 0.3.24: `publint [path] [options]` (path = directory or tarball; default cwd), `--level suggestion|warning|error` (default `suggestion`), `--pack auto|npm|yarn|pnpm|bun|false` (default `auto`), `--strict`. Invoke via `pnpm dlx publint` or `npx publint`. Exit codes — **UNVERIFIED** (not on the CLI page).

attw: `npx --yes @arethetypeswrong/cli --pack .` (or `npm i -g @arethetypeswrong/cli` then `attw --pack .`). Gotcha: "The `--pack` option does not support package managers other than npm." — in a pnpm repo run `pnpm pack` first and pass the tarball: `attw ./workbox-shared-0.1.0.tgz`. Options: `--format table|table-flipped|ascii|auto|json`, `--profile strict|node16|esm-only`, `--ignore-rules <rule…>` (e.g. `no-resolution`, `untyped-resolution`, `false-cjs`), `--entrypoints`, `--include-entrypoints`, `--exclude-entrypoints`, `--entrypoints-legacy`, `--summary/--no-summary`, `--quiet`, `--config-path` (default `.attw.json`). Version 0.18.5 per R7 (registry not re-fetched today).

---

## 8. cspell 10, markdownlint-cli2 0.23, ls-lint 2.3

**Verified file names:** `cspell.json` (also `.cspell.json`, `cspell.config.{yaml,yml,json,jsonc,js,cjs,mjs,ts,cts,mts,toml}`, `cspell.yaml`, `package.json` `cspell` field); `.markdownlint-cli2.jsonc` (also `.yaml`, `.cjs`, `.mjs`; rule-only files `.markdownlint.{jsonc,json,yaml,yml,cjs,mjs}`); `.ls-lint.yml`.

Sources: https://cspell.org/docs/getting-started, https://cspell.org/docs/Configuration, https://raw.githubusercontent.com/streetsidesoftware/cspell/main/packages/cspell/README.md, https://raw.githubusercontent.com/streetsidesoftware/cspell/main/packages/cspell-types/src/CSpellSettingsDef.ts, https://raw.githubusercontent.com/streetsidesoftware/cspell-dicts/main/dictionaries/cs_CZ/README.md, https://raw.githubusercontent.com/streetsidesoftware/cspell-dicts/main/README.md, https://registry.npmjs.org/@cspell%2Fdict-cs-cz/latest, https://raw.githubusercontent.com/DavidAnson/markdownlint-cli2/main/README.md, https://raw.githubusercontent.com/DavidAnson/markdownlint-cli2/main/test/markdownlint-cli2-jsonc-example/.markdownlint-cli2.jsonc, https://ls-lint.org/2.3/configuration/the-basics.html, https://ls-lint.org/2.3/configuration/the-rules.html.

### 8.1 cspell (10.3.6, requires Node `>=22.18.0`)

Czech dictionary: **`@cspell/dict-cs-cz`** exists (3.0.8, "Czech dictionary for cspell.", dictionary name `cs-cz`, locale `cs`); cspell-dicts table row: `| @cspell/dict-cs-cz | Czech | cs-cz |`. Install `npm install -D @cspell/dict-cs-cz` and import its `cspell-ext.json`. The `language` field accepts several locales: "`en,nl` to enable both English and Dutch" (`LocaleId` doc: "`en,fr` for both English and French").

```json
{
  "$schema": "https://raw.githubusercontent.com/streetsidesoftware/cspell/main/cspell.schema.json",
  "version": "0.2",
  "language": "en,cs",
  "import": ["@cspell/dict-cs-cz/cspell-ext.json"],
  "dictionaryDefinitions": [
    { "name": "project-words", "path": "./project-words.txt", "addWords": true }
  ],
  "dictionaries": ["project-words", "typescript", "softwareTerms"],
  "words": ["workbox", "oxlint", "oxfmt", "lefthook", "paraglide"],
  "flagWords": ["hte"],
  "ignorePaths": ["node_modules", "**/dist/**", "pnpm-lock.yaml", "/project-words.txt", "**/paraglide/**"],
  "useGitignore": true
}
```

(The `$schema`, `dictionaryDefinitions`/`addWords`, `dictionaries` and `ignorePaths` lines are verbatim from the getting-started example; `import`/`language` from the cs_CZ README, which shows `"import": ["@cspell/dict-cs-cz/cspell-ext.json"], "language": "cs"`.) CLI: `cspell "**"`, `cspell lint --no-progress --gitignore --config cspell.json "**"`.

### 8.2 markdownlint-cli2 (0.23.3)

Precedence: `.markdownlint-cli2.jsonc` > `.yaml` > `.cjs` > `.mjs`. CLI: `markdownlint-cli2 "**/*.md" "#node_modules"` (a leading `#` negates a glob; recommended over `!` because of shell parsing), `--fix`, `--config <path>`. Config `globs` "can be used instead of (or in addition to) passing globs on the command-line". Official all-properties example (verbatim, trimmed to the keys we need):

```jsonc
{
  // Disable some built-in rules
  "config": {
    "no-trailing-spaces": false,
    "no-multiple-blanks": false
  },
  // Fix any fixable errors
  "fix": true,
  // Ignore files referenced by .gitignore (only valid at root)
  "gitignore": true,
  // Define glob expressions to use (only valid at root)
  "globs": [
    "!*bout.md"
  ],
  // Define glob expressions to ignore
  "ignores": [
    "ignore*.md"
  ],
  // Disable progress on stdout (only valid at root)
  "noProgress": true,
  // Use a specific formatter (only valid at root)
  "outputFormatters": [
    [ "markdownlint-cli2-formatter-default" ]
  ]
}
```

Other documented keys: `customRules`, `frontMatter`, `markdownItPlugins`, `modulePaths`, `noBanner`, `noInlineConfig`, `overrides` (`filter`, `config`, `combine: "merge"|"replace"`), `showFound`.

### 8.3 ls-lint (2.3.1)

Rules: `lowercase`, `camelcase`, `pascalcase`, `snakecase`, `screamingsnakecase`, `kebabcase`, `regex:<pattern>`, `exists:<n|n-m>`; alternatives with `|`; `.dir` for directories; sub-extensions (`.d.ts`, `.test.ts`) and wildcard `.*`; directory patterns `packages/*/src`, `packages/**/templates`, `{a,b}`; `**` in `ignore`. Official examples:

```yaml
ls:
  .js: kebab-case
  .ts: kebab-case
  .d.ts: kebab-case

ignore:
  - .git
  - node_modules
```

```yaml
ls:
  packages/*/src:
    .js: kebab-case

  packages/**/templates:
    .html: kebab-case

ignore:
  - "**/*.png"
  - bazel-*
```

Adapted for Workbox (kebab-case with exceptions):

```yaml
ls:
  .dir: kebab-case
  .ts: kebab-case
  .tsx: kebab-case | PascalCase
  .test.ts: kebab-case
  .d.ts: kebab-case
  .md: kebab-case | SCREAMING_SNAKE_CASE

ignore:
  - .git
  - node_modules
  - "**/dist"
  - "**/paraglide"
  - "**/.turbo"
```

---

## 9. lefthook 2.x + commitlint 21

**Verified file names:** `lefthook.yml` (also `lefthook.yaml`, `.lefthook.yml`, `.config/lefthook.yml`, TOML/JSON/JSONC variants, and `lefthook-local.yml`); `commitlint.config.ts` (also `.js/.cjs/.mjs/.cts/.mts`, `.commitlintrc*`, `package.json` `commitlint`).

Sources: https://lefthook.dev/configuration/index.html, https://raw.githubusercontent.com/evilmartians/lefthook/master/docs/configuration/{run,glob,jobs,stage_fixed}.md, …/docs/installation/node.md, …/docs/examples/commitlint.md, https://lefthook.dev/examples/commitlint/, https://raw.githubusercontent.com/evilmartians/lefthook/master/README.md, https://registry.npmjs.org/lefthook/latest, https://commitlint.js.org/reference/configuration.html, https://commitlint.js.org/reference/cli.html, https://raw.githubusercontent.com/conventional-changelog/commitlint/master/@commitlint/config-conventional/README.md, registry pages for @commitlint/cli and config-conventional.

### 9.1 `lefthook.yml`

Placeholders (verbatim): `{files}` "custom `files` command result"; `{staged_files}` "staged files which you try to commit"; `{push_files}` "files that are committed but not pushed"; `{all_files}` "all files tracked by git"; `{cmd}`; `{0}` "the single space-joint string of git hook arguments"; `{1}` "the 1-st git hook argument" (for `commit-msg` = the message file); `{lefthook_job_name}`. `glob` "is only used if you use a file template in `run` option"; with a glob but no template, lefthook checks `{staged_files}` (pre-commit) / `{push_files}` (pre-push) and skips when empty; `**` matches one or more directories deep. `stage_fixed: true` (pre-commit only) runs `git add` on the processed files afterwards.

Official commitlint example (verbatim):

```yaml
# Validate commit messages
commit-msg:
  commands:
    "lint commit message":
      run: yarn run commitlint --edit {1}
```

Official `jobs` example (verbatim excerpt):

```yml
pre-commit:
  parallel: true
  jobs:
    - run: yarn lint --fix {staged_files}
      root: frontend/
      stage_fixed: true
```

Workbox `lefthook.yml` assembled from those pieces:

```yaml
# lefthook.yml
min_version: 2.0.0

pre-commit:
  parallel: true
  jobs:
    - name: format
      glob: "*.{js,ts,tsx,json,jsonc,md,yml,yaml,css}"
      run: pnpm exec oxfmt {staged_files}
      stage_fixed: true
    - name: lint
      glob: "*.{js,ts,tsx}"
      run: pnpm exec oxlint --deny-warnings {staged_files}
    - name: spell
      glob: "*.{ts,tsx,md}"
      run: pnpm exec cspell --no-progress {staged_files}

commit-msg:
  commands:
    "lint commit message":
      run: pnpm exec commitlint --edit {1}

pre-push:
  jobs:
    - name: typecheck
      glob: "*.{ts,tsx}"
      run: pnpm turbo run typecheck --affected
    - name: ls-lint
      run: pnpm exec ls-lint
```

Install: `pnpm add -D lefthook`; the package's `postinstall` (`node postinstall.js`) installs hooks; run `lefthook install` manually after cloning or when hooks are missing (it "Creates an empty `lefthook.yml` if a configuration file does not exist" and "Installs configured hooks to Git hooks"); `lefthook run pre-commit` runs a hook by hand. pnpm gotcha (verbatim from the node install page): "make sure to update pnpm-workspace.yaml's onlyBuiltDependencies with lefthook and add lefthook to pnpm.onlyBuiltDependencies in your root package.json, otherwise the postinstall script of the lefthook package won't be executed and hooks won't be installed." — on pnpm 12 that means `allowBuilds: { lefthook: true }` (§1.3). A `"prepare": "lefthook install"` script is common but is **not** stated in the fetched docs — UNVERIFIED as a documented recommendation (it is safe: `lefthook install` is idempotent). lefthook 2.1.15 ships per-platform optional deps (linux/darwin/windows/freebsd/openbsd × x64/arm64).

### 9.2 commitlint (21.2.3; `@commitlint/cli` and `@commitlint/config-conventional` are ESM, Node `>=22.12.0`)

TypeScript ESM config (verbatim from the configuration reference):

```typescript
import type { UserConfig } from "@commitlint/types";
import { RuleConfigSeverity } from "@commitlint/types";

const Configuration: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [RuleConfigSeverity.Error, "always", ["foo"]],
  },
};

export default Configuration;
```

Config keys: `extends`, `rules` (`[level, applicable, value]` tuples), `parserPreset`, `formatter`, `ignores`, `defaultIgnores`, `helpUrl`, `prompt`. `config-conventional` rules: `type-enum` error — `build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test`; `type-case` lower-case; `type-empty`; `subject-case` never sentence-case/start-case/pascal-case/upper-case; `subject-empty`; `subject-full-stop` never `.`; `header-max-length` 100; `body-leading-blank` (warning); `body-max-line-length` 100; `footer-leading-blank` (warning); `footer-max-line-length` 100. (`scope-case` and `header-trim` were not listed in the fetched README — UNVERIFIED.)

CLI: `--edit`/`-e` "read last commit message from the specified file or fallbacks to ./.git/COMMIT_EDITMSG"; `--from`/`-f`, `--to`/`-t` (commit range, "applies if edit=false"); `--last`; `--verbose`/`-V` "enable verbose output for reports without problems"; `--strict`/`-s` "result code 2 for warnings, 3 for errors"; `--config`/`-g` (result code 9 if missing); `--print-config`. Examples: `npx commitlint --from HEAD~1 --to HEAD --verbose`; CI: `commitlint --from <base-sha> --to <head-sha> --verbose`.

---

## 10. Bun 1.4.x

Sources: https://bun.com/docs/bundler/executables, https://bun.com/docs/cli/test, https://bun.com/docs/test/coverage, https://bun.com/docs/runtime/bunfig, https://bun.com/docs/api/spawn, https://bun.com/docs/install/isolated, https://bun.com/docs/runtime/modules, https://bun.com/docs/runtime/nodejs-apis, https://bun.com/docs/installation, https://bun.com/blog/bun-v1.4, https://raw.githubusercontent.com/oven-sh/setup-bun/main/action.yml, https://registry.npmjs.org/bun/latest (1.4.2), GitHub issue searches listed in the UNVERIFIED section.

### 10.1 `bun build --compile`

Basic: `bun build ./cli.ts --compile --outfile mycli`. Supported `--target` values (verbatim table):

| --target | OS | Arch | Libc |
|---|---|---|---|
| `bun-linux-x64` | Linux | x64 | glibc |
| `bun-linux-arm64` | Linux | arm64 | glibc |
| `bun-linux-x64-musl` | Linux | x64 | musl |
| `bun-linux-arm64-musl` | Linux | arm64 | musl |
| `bun-windows-x64` | Windows | x64 | — |
| `bun-windows-arm64` | Windows | arm64 | — |
| `bun-darwin-x64` | macOS | x64 | — |
| `bun-darwin-arm64` | macOS | arm64 | — |

"The segments of the `--target` value can appear in any order, as long as they're delimited by `-`." Gotcha: "The `-baseline` and `-modern` target suffixes are still accepted for backward compatibility and resolve to the same binary." — there is no separate baseline (non-AVX2) build to ship any more; `bun-linux-x64-baseline` / `bun-windows-x64-baseline` are aliases of the x64 targets.

Flags: `--minify` ("reduces the size of the transpiled output code"); `--sourcemap` ("embeds a sourcemap compressed with zstd, so that errors & stacktraces point to their original locations"); `--bytecode` ("supports both `cjs` and `esm` formats when used with `--compile`"; moves parsing to build time); `--define KEY=VALUE`; `--asset <path>` (file or directory); Windows metadata `--windows-icon=path/to/icon.ico`, `--windows-hide-console`, `--windows-title`, `--windows-publisher`, `--windows-version`, `--windows-description`, `--windows-copyright` — gotcha: "platform-specific options require Windows APIs and cannot be used during cross-compilation" (set them only when building on Windows); `--compile-exec-argv="…"` (exposed via `process.execArgv`); `--compile-autoload-tsconfig` / `--no-compile-autoload-dotenv` (`.env` and `bunfig.toml` load by default, `tsconfig.json`/`package.json` do not).

```bash
bun build --compile --define BUILD_VERSION='"1.2.3"' src/cli.ts --outfile mycli
bun build --compile ./index.ts --asset ./public --outfile myapp
bun build ./src/main.ts --compile --minify --sourcemap --bytecode \
  --define WORKBOX_VERSION='"0.1.0"' --asset ./public \
  --target bun-linux-x64-musl --outfile dist/workbox-linux-x64-musl
```

Reading embedded assets at runtime (verbatim):

```javascript
import fs from "node:fs";
import path from "node:path";

const publicDir = path.join(import.meta.dir, "public");
for (const entry of fs.readdirSync(publicDir, { withFileTypes: true })) {
  console.log(entry.name);
}
```

`Bun.file(path.join(import.meta.dir, "public/index.html"))` reads a file; `Bun.embeddedFiles` lists all embedded `Blob`s; `import icon from "./icon.png" with { type: "file" }` returns a `/$bunfs/…` path (1.4 makes the `/$bunfs/` tree browsable with `existsSync`/`statSync`/`readdirSync`). JS API equivalent: `Bun.build({ entrypoints: ["./index.ts"], compile: { outfile: "./myapp", assets: ["./public"] } })`.

### 10.2 `bun test` and `bunfig.toml`

Discovery: `*.test.{js,jsx,ts,tsx,mjs,cjs,mts,cts}`, `*_test.*`, `*.spec.*`, `*_spec.*`. Flags: `--coverage`, `--coverage-reporter text|lcov`, `--coverage-dir` (default `coverage`), `--timeout` (default 5000), `--bail [n]`, `--rerun-each`, `--retry`, `--concurrent`, `--max-concurrency`, `--randomize`, `--seed`, `--todo`, `-t/--test-name-pattern`, `--reporter junit|dots`, `--reporter-outfile`, `--update-snapshots`/`-u`, `--watch`, `--parallel[=N]`, `--isolate`, `--shard=M/N`, `--timings`, `--changed`, `--preload`. A `--coverage-threshold` CLI flag is **not** documented — thresholds are set in `bunfig.toml` only.

```toml
# bunfig.toml
[test]
root = "."
preload = ["./test/setup.ts"]
coverage = true
coverageThreshold = { lines = 0.8, functions = 0.8 }
coverageReporter = ["text", "lcov"]
coverageDir = "coverage"
coverageSkipTestFiles = true
coveragePathIgnorePatterns = ["**/*.test.ts", "**/paraglide/**"]

[install]
linker = "isolated"
```

(`coverageThreshold = 0.9` scalar form also allowed; unmet thresholds make `bun test` exit non-zero. Other `[test]` keys: `smol`, `randomize`, `seed`, `timeout`, `retry`, `coverageIgnoreSourcemaps`. `[install] frozenLockfile`, `[run] bun/shell/silent` exist.)

### 10.3 Version pinning (`.bun-version`)

- `oven-sh/setup-bun@v2` input `bun-version-file`: "The version of Bun to install from file. (e.g. "package.json", ".bun-version", ".tool-versions")"; `bun-version` accepts `latest`, `canary`, `1.0.0`, `1.0.x`, a sha; outputs `bun-version`, `bun-revision`, `bun-path`, `bun-download-url`, `cache-hit`.

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version-file: .bun-version
```

- Whether the `bun` binary itself reads `.bun-version` (auto-switching) is **UNVERIFIED**: neither the installation page, the bunfig reference nor the 1.4 blog mentions it; issue #25581 "Bun version manager" (closed 2025-12-18) refers to `.bun-version` only as a CI convention. Pin via `bun upgrade` / `curl -fsSL https://bun.com/install | bash -s "bun-v1.4.2"`.

### 10.4 Bun on a pnpm-created `node_modules`

**UNVERIFIED** (no explicit doc statement). Supporting evidence only: Bun's own isolated linker builds the same kind of layout ("Top-level `node_modules` contains symlinks pointing to the central store", described as "Strict dependency isolation similar to pnpm's approach"), Bun implements the Node.js resolution algorithm (scans up for `node_modules`, honours `exports` conditions `bun`, `node-addons`, `node`, `require`, `import`, `default`), and a GitHub issue-title search for `pnpm symlink` returned no results. Related closed issue: #32351 "bun test: ESM `export *` re-exports unresolved on Linux but not macOS" (drizzle-orm; closed "not planned" 2026-06-15). Plan: run `bun test` in the daemon package after `pnpm install` in CI on Linux and macOS and treat a failure as a blocker for §1 `nodeLinker` choices.

### 10.5 `Bun.spawn`

```javascript
const proc = Bun.spawn(["bun", "--version"]);
console.log(await proc.exited); // 0
const text = await proc.stdout.text();
// or: const text = await new Response(proc.stdout).text();
```

`stdout` defaults to `"pipe"` (a `ReadableStream`); options `cwd`, `env`, `stdin`, `stdout`/`stderr` (`"pipe" | "inherit" | "ignore" | Bun.file()`), `onExit`, `signal`, `timeout`, `killSignal`, `maxBuffer` (spawnSync); properties `pid`, `exited`, `exitCode`, `killed`, `kill()`. Sync: `const result = Bun.spawnSync(["echo", "hello"]); result.stdout.toString()`.

Node compat notes (https://bun.com/docs/runtime/nodejs-apis): `node:tty` "Fully implemented" ("constructing them on a non-TTY fd returns a stream with isTTY set to false instead of throwing"), `node:child_process` partial, `node:util` "Fully implemented".

---

## 11. Vite 8.3 + React 19.3 (+ React Compiler, Tailwind 4.3, Vitest 5)

**Verified file names:** `vite.config.ts`, `vitest.config.ts`, `src/index.css`.

Sources: https://raw.githubusercontent.com/vitejs/vite-plugin-react/main/packages/plugin-react/README.md, https://react.dev/learn/react-compiler/installation, https://tailwindcss.com/docs/installation/using-vite, https://vitest.dev/guide/browser/, https://vitest.dev/config/browser/playwright, https://vitest.dev/config/browser/headless, https://vitest.dev/config/browser/instances, https://vitest.dev/guide/projects, https://vite.dev/guide/cli, registry pages for vite, @vitejs/plugin-react, @rolldown/plugin-babel, babel-plugin-react-compiler, oxc-transform-react, @tailwindcss/vite, vitest, @vitest/browser-playwright, @vitest/browser.

Versions/peers: vite 8.3.1 (engines `^20.19.0 || >=22.12.0`); `@vitejs/plugin-react` 6.1.1 (ESM; peer `vite ^8.0.0`; optional peers `oxc-transform-react ^0.145.0`, `@rolldown/plugin-babel ^0.1.7 || ^0.2.0`, `babel-plugin-react-compiler ^1.0.0`); `@rolldown/plugin-babel` 0.2.4 (peers `@babel/core ^7.29.0 || ^8.0.0-rc.1`, node `>=22.12.0 || ^24.0.0`); `babel-plugin-react-compiler` 1.0.0; `oxc-transform-react` 0.152.0; `@tailwindcss/vite` 4.3.3 (peer `vite ^5.2.0 || ^6 || ^7 || ^8`); vitest 5.0.3 (engines `^22.12.0 || ^24.0.0 || >=26.0.0`, peer `vite ^6.4.0 || ^7.0.0 || ^8.0.0`); `@vitest/browser-playwright` 5.0.3 (peer `vitest 5.0.3`, `playwright *` required; depends on `@vitest/browser` 5.0.3 internally).

### 11.1 `vite.config.ts` with React Compiler and Tailwind

Two officially documented ways to enable React Compiler 1.0 with plugin-react 6:

(a) Rust port (experimental, "Native React Compiler support is experimental"): `npm install -D oxc-transform-react` then

```js
export default defineConfig({
  plugins: [react({ compiler: true })],
})
```

(`compiler` also accepts React Compiler options; `logDiagnostics: true` logs recoverable diagnostics.)

(b) Babel (stable path; verbatim from react.dev "For Vite 6.0.0 or later with `@vitejs/plugin-react`"):

```js
// vite.config.js
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()]
    }),
  ],
});
```

`reactCompilerPreset` accepts `{ compilationMode, target }`; requires `@rolldown/plugin-babel`, `babel-plugin-react-compiler` and `@babel/core` (all peer deps). The older `react({ babel: { plugins: ['babel-plugin-react-compiler'] } })` form is documented by react.dev only "for older versions of `@vitejs/plugin-react`" — the `babel` option is not in the 6.1.1 README option list (`include`, `exclude`, `jsxImportSource`, `jsxRuntime`, `reactRefreshHost`, `compiler`). Install: `pnpm install -D babel-plugin-react-compiler@latest`. React Compiler "is designed to work best with React 19".

Tailwind (verbatim): `npm install tailwindcss @tailwindcss/vite`; `import tailwindcss from '@tailwindcss/vite'` → `plugins: [tailwindcss()]`; CSS: `@import "tailwindcss";`.

Combined:

```ts
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    paraglideVitePlugin({ project: './project.inlang', outdir: './src/paraglide' }),
  ],
  build: { outDir: 'dist' },
});
```

CLI: `vite build --outDir <dir>` ("Output directory (default: `dist`)"), `--base`, `--mode`, `--sourcemap [output]`, `--minify [minifier]` (default `"oxc"`), `--emptyOutDir`, `--config`, `-l/--logLevel`; `vite preview --port --host --strictPort`.

### 11.2 Vitest 5 browser mode + projects

Install: `npm install -D vitest @vitest/browser-playwright` (+ `playwright`), or scaffold with `npx vitest init browser`. Provider packages: `@vitest/browser-playwright` ("recommended for CI/local testing with parallel support"), `@vitest/browser-webdriverio`, `@vitest/browser-preview`. Do **not** add `@vitest/browser` yourself (it is a dependency of the provider package).

```typescript
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      enabled: true,
      instances: [{ browser: 'chromium' }],
    },
  }
})
```

`browser.headless`: type boolean, default **`process.env.CI`** ("If you are running Vitest in CI, it will be enabled by default."), CLI `--browser.headless`; `browser.instances` default `[]`, each needs `browser` (`chromium` | `firefox` | `webkit` for Playwright) and may override `headless`, `locators`, `viewport`, `testerHtmlPath`, `screenshotDirectory`, `screenshotFailures`, `provider`; "Every browser config inherits options from the root config". `playwright({ launchOptions, contextOptions, connectOptions, actionTimeout })`. Run: `npx vitest --browser=chromium`, `--project <name>`.

Projects (workspace files were replaced: "The `workspace` is deprecated since 3.2 and replaced with the `projects` configuration"):

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'threads',
    projects: [
      {
        test: {
          name: 'unit',
          include: ['**/*.unit.test.ts'],
        },
      },
      {
        extends: false,
        test: {
          name: 'integration',
          include: ['**/*.integration.test.ts'],
        },
      },
    ],
  },
})
```

`vitest --project unit`, `vitest --project e2e --project unit`, negation `--project '!e2e'`.

---

## 12. Paraglide JS 2.25.4

**Verified file names:** `project.inlang/settings.json`, `messages/{locale}.json` (path set by `plugin.inlang.messageFormat.pathPattern`), optional `project.inlang/paraglide.config.js`; compiled output `src/paraglide/messages.js` and `src/paraglide/runtime.js`.

Sources: https://paraglidejs.com/vite, https://paraglidejs.com/basics, https://paraglidejs.com/variants, https://paraglidejs.com/strategy, https://paraglidejs.com/compiler-options, https://paraglidejs.com/compiling-messages, https://inlang.com/m/reootnfj/plugin-inlang-messageFormat, https://inlang.com/docs/settings, https://registry.npmjs.org/@inlang%2Fparaglide-js/latest (2.25.4, ESM, bin `paraglide-js`, exports `.` and `./urlpattern-polyfill`). Note: `inlang.com/m/gerre34r/library-inlang-paraglideJs/*` now 301-redirects to `paraglidejs.com/*`.

Init: `npx @inlang/paraglide-js@latest init`.

`project.inlang/settings.json` — `$schema`, `baseLocale`, `locales`, `modules` from the inlang settings reference; message-format block verbatim from the plugin page:

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "en",
  "locales": ["en", "cs"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{locale}.json"
  }
}
```

(`baseLocale` "Required. The base locale of your project."; `locales` "Required. All locales available in your project, including the base locale."; `modules` "URIs to plugin modules"; legacy `sourceLanguageTag`/`languageTags`/`{languageTag}` are deprecated. Lint-rule module URLs were not shown on any fetched page — UNVERIFIED; the message-format plugin alone is sufficient for `init`.)

`messages/en.json` — plain message, variable, plural (verbatim):

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "hello_world": "Hello World!",
  "greeting": "Good morning {name}!",
  "some_happy_cat": [{
    "declarations": ["input count", "local countPlural = count: plural"],
    "selectors": ["countPlural"],
    "match": {
      "countPlural=one": "There is one cat.",
      "countPlural=other": "There are many cats."
    }
  }]
}
```

Escape literal braces as `\\{variable\\}`. Prefer flat keys (`calm_green_otter`); nested keys are reachable as `m["user.profile.title"]()`.

Vite plugin (verbatim):

```typescript
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
  plugins: [
    paraglideVitePlugin({ project: "./project.inlang" }),
  ],
});
```

with `project.inlang/paraglide.config.js` → `export default { outdir: "./src/paraglide", emitTsDeclarations: true };` — or pass `outdir` (and `strategy`) directly: `paraglideVitePlugin({ project: "./project.inlang", outdir: "./src/paraglide", strategy: ["localStorage", "baseLocale"] })` (`project` and `outdir` are the two required compiler options). CLI alternative: `npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide`; also `paraglideWebpackPlugin`, `paraglideRollupPlugin`, and programmatic `compile()`.

Usage (verbatim):

```javascript
import { m } from "./paraglide/messages.js";
import { getLocale, setLocale } from "./paraglide/runtime.js";

m.greeting({ name: "World" }); // "Hello World!"
getLocale(); // "en"
setLocale("de"); // switches to German
```

`m.greeting({ name: "Samuel" }, { locale: "de" })` overrides the locale per call; `m.some_happy_cat({ count })` for the plural.

Strategy: values `"cookie"`, `"baseLocale"`, `"globalVariable"`, `"preferredLanguage"`, `"localStorage"`, `"url"`, `"custom-*"`; default `["cookie", "globalVariable", "baseLocale"]`; "Strategies are evaluated in order" and "the first strategy that successfully returns a locale will be used". Related options: `cookieName` `"PARAGLIDE_LOCALE"`, `cookieMaxAge` `60 * 60 * 24 * 400`, `cookieDomain` `""`, `localStorageKey` `"PARAGLIDE_LOCALE"`, `urlPatterns`, `outputStructure` `"message-modules"` | `"locale-modules"`, `emitPrettierIgnore` true, `emitGitIgnore` true, `emitTsDeclarations` false (needs TS ≥ 5.6), `includeEslintDisableComment` true, `cleanOutdir` true, `isServer` `"typeof window === 'undefined'"`, `disableAsyncLocalStorage` false, `experimentalMiddlewareLocaleSplitting` false. Custom strategies: `defineCustomClientStrategy("custom-name", { getLocale, setLocale })` / `defineCustomServerStrategy("custom-name", { getLocale: (request) => … })`. For the URL-less SPA use `strategy: ["localStorage", "preferredLanguage", "baseLocale"]`.

---

## 13. LogTape 2.3.10

Sources: https://logtape.org/manual/config, https://logtape.org/manual/sinks, https://logtape.org/manual/formatters, https://logtape.org/manual/redaction, https://jsr.io/@logtape/file/doc/~/getRotatingFileSink, https://jsr.io/@logtape/file/doc/~/RotatingFileSinkOptions, https://jsr.io/@logtape/file/doc/~/FileSinkOptions, https://jsr.io/@logtape/logtape/doc/~/getJsonLinesFormatter, https://jsr.io/@logtape/logtape/doc/~/JsonLinesFormatterOptions, registry pages (`@logtape/logtape`, `@logtape/file`, `@logtape/redaction` all 2.3.10, ESM, zero deps; file/redaction peer `@logtape/logtape ^2.3.10`).

Minimal config (docs example, category adapted):

```typescript
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getRotatingFileSink } from "@logtape/file";
import { jsonLinesFormatter } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(),
    file: getRotatingFileSink("workbox.log", { maxSize: 1024 * 1024, maxFiles: 5, formatter: jsonLinesFormatter }),
  },
  loggers: [
    { category: ["workbox"], lowestLevel: "info", sinks: ["console", "file"] },
    { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
  ],
});

const logger = getLogger(["workbox", "cli"]);
logger.info("started {version}", { version: "0.1.0" });
```

Facts: levels `'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal'`; child loggers inherit parent sinks unless `parentSinks: "override"`; meta logger category `["logtape", "meta"]`; `configureSync()` for environments without top-level await (no async-disposal sinks); re-run `configure({ reset: true, … })` or call `reset()`. `getRotatingFileSink(path: string, options?: RotatingFileSinkOptions): Sink & Disposable` (`Sink & AsyncDisposable` when `nonBlocking: true`); options `maxSize` (default 1 MiB), `maxFiles` (default 5), plus `FileSinkOptions` (`bufferSize`, `flushInterval`, `nonBlocking`, `formatter` — `formatter` comes from the stream-sink options; `lazy` is excluded for rotating sinks); rotated files are named `<file>.<n>`. JSON Lines: constant `jsonLinesFormatter` (used in the manual as `getFileSink('app.log', { formatter: jsonLinesFormatter })`) or `getJsonLinesFormatter({ categorySeparator, message: "template" | "rendered", properties: "flatten" | "prepend:<prefix>" | "nest:<key>", lineEnding: "lf" | "crlf" })`; output shape `{"@timestamp":"…","level":"INFO","message":"Hello, world!","logger":"my.logger","properties":{…}}`. Other formatters: `defaultTextFormatter`, `getTextFormatter()`, `ansiColorFormatter`, `getAnsiColorFormatter()`, logfmt (≥ 2.1), `@logtape/pretty`.

Redaction (`npm add @logtape/redaction`), verbatim:

```javascript
import { redactByPattern, EMAIL_ADDRESS_PATTERN, CREDIT_CARD_NUMBER_PATTERN } from "@logtape/redaction";

const formatter = redactByPattern(defaultFormatter, [
  EMAIL_ADDRESS_PATTERN,
  CREDIT_CARD_NUMBER_PATTERN,
]);
```

```javascript
import { redactByField, DEFAULT_REDACT_FIELDS } from "@logtape/redaction";

const sink = redactByField(consoleSink(), {
  fieldPatterns: DEFAULT_REDACT_FIELDS,
  action: () => "[REDACTED]"
});
```

Built-in patterns: `EMAIL_ADDRESS_PATTERN`, `CREDIT_CARD_NUMBER_PATTERN`, `JWT_PATTERN`, `US_SSN_PATTERN`, `KR_RRN_PATTERN`.

---

## 14. Zod 4.6.5

Sources: https://zod.dev/packages/zod, https://zod.dev/basics, https://zod.dev/api, https://zod.dev/json-schema, https://zod.dev/v4/changelog, https://registry.npmjs.org/zod/latest (4.6.5, ESM+CJS, exports `.`, `./v4`, `./v3`, `./mini`, `./v4-mini`, `./v4/core`, `./locales`, `./compile`).

- Import: the docs use `import * as z from "zod";` (the `"."` export *is* Zod 4; `zod/v3` keeps the legacy API, `zod/mini` is the tree-shakable build). `import { z } from "zod"` also works but is not the documented form. TypeScript `strict` mode required.
- `.parse()` returns a typed clone or throws `ZodError`; `.safeParse()` returns `{ success: true; data } | { success: false; error }`; `.validate()` is a boolean type guard ("up to 16x faster"); async variants `.parseAsync()`, `.safeParseAsync()`, `.validateAsync()`.
- Types: `z.infer<typeof Schema>`, `z.input<>`, `z.output<>`.
- Objects: `z.object()` strips unknown keys; `z.strictObject({...})` errors on unknown keys; `z.looseObject({...})` passes them through. `.strict()` / `.passthrough()` "are still available for backwards compatibility, and they will not be removed. They are considered legacy."
- `z.discriminatedUnion("status", [ z.object({ status: z.literal("success"), data: z.string() }), z.object({ status: z.literal("failed"), error: z.string() }) ])`.
- Integers: use `z.int()` (`z.number().int()` no longer accepts unsafe integers).
- JSON Schema (verbatim):

```javascript
import * as z from "zod";

const schema = z.object({
  name: z.string(),
  age: z.number(),
});

z.toJSONSchema(schema)
// => {
//   type: 'object',
//   properties: { name: { type: 'string' }, age: { type: 'number' } },
//   required: [ 'name', 'age' ],
//   additionalProperties: false,
// }
```

Options: `target` `"draft-2020-12"` (default) | `"draft-7"` | `"draft-4"` | `"openapi-3.0"`; `io` `"output"` (default) | `"input"`; `unrepresentable` `"throw"` (default) | `"any"`; `cycles` `"ref"` (default) | `"throw"`; `reused` `"inline"` (default) | `"ref"`; `override` (fn); `uri` (fn); `metadata` (registry). `.meta({ id, title, description })`; `z.globalRegistry.add(User, { id: "User" }); z.toJSONSchema(z.globalRegistry)`. `z.fromJSONSchema()` exists (experimental). For the `config.json` `$schema` use `z.toJSONSchema(ConfigSchema, { target: "draft-07", io: "input" })`.

---

## 15. citty 0.2.2

Sources: https://raw.githubusercontent.com/unjs/citty/main/README.md, https://registry.npmjs.org/citty/latest (0.2.2, ESM, zero deps, built on `util.parseArgs`).

```js
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "hello",
    version: "1.0.0",
    description: "My Awesome CLI App",
  },
  args: {
    name: {
      type: "positional",
      description: "Your name",
      required: true,
    },
    friendly: {
      type: "boolean",
      description: "Use friendly greeting",
    },
  },
  run({ args }) {
    console.log(`${args.friendly ? "Hi" : "Greetings"} ${args.name}!`);
  },
});

runMain(main);
```

Sub-commands (verbatim): `subCommands: { sub }` or lazily `subCommands: { sub: () => import("./sub.mjs").then((m) => m.default) }`. Arg types: `positional`, `string`, `boolean` (with `--no-` negation), `enum` (`options: [...]`); a `number` type is **not** listed in the README. Arg fields: `type`, `description`, `required`, `default`, `alias` (not for positional), `valueHint`, `options`, `negativeDescription`. Hooks `setup()` / `cleanup()`. `--help` and `--version` (from `meta.version`) are "handled automatically"; `createMain(cmd)` returns a wrapper that calls `runMain`; `runCommand(cmd, opts)`; `renderUsage` / `showUsage`.

---

## 16. Claude Code CLI (`claude auth …`)

Sources: https://code.claude.com/docs/en/cli-reference, https://code.claude.com/docs/en/authentication, https://code.claude.com/docs/en/setup.md, https://code.claude.com/docs/en/troubleshoot-install.md (2026-09-30).

- `claude auth login` — "Sign in to your Anthropic account. Use `--email` to pre-fill your email address, `--sso` to force SSO authentication, and `--console` to sign in with Anthropic Console for API usage billing instead of a Claude subscription". It prints the OAuth URL and can read the pasted code from stdin (troubleshooting page).
- `claude auth logout` — "Log out from your Anthropic account".
- `claude auth status` — verbatim: "Show authentication status as JSON. Use `--text` for human-readable output. Exits with code 0 if logged in, 1 if not. The JSON includes a `configDirectory` field naming the configuration directory the CLI uses. The field requires Claude Code v2.1.268 or later". The remaining JSON field names (e.g. login method, email, organization) are **UNVERIFIED** — not documented on any fetched page; parse only `configDirectory` and rely on the exit code.
- `claude --version` / `-v` — "Output the version number"; prints e.g. `2.1.211 (Claude Code)` (setup page).
- `claude doctor` — read-only install/settings diagnostics; `claude update`; `claude install [version]`.
- Credentials: macOS Keychain (fallback `~/.claude/.credentials.json` mode 0600), Linux `~/.claude/.credentials.json`, Windows `%USERPROFILE%\.claude\.credentials.json`; `CLAUDE_CONFIG_DIR` relocates them and keys the Keychain entry; precedence: cloud provider → `ANTHROPIC_AUTH_TOKEN` → `ANTHROPIC_API_KEY` → `apiKeyHelper` → `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) → profiles → `/login` OAuth.

Example for the daemon's "is Claude Code logged in?" check: `Bun.spawn(["claude", "auth", "status"])`, then `exitCode === 0` ⇒ logged in; `JSON.parse(await proc.stdout.text()).configDirectory` when present.

---

## 17. `open` 11 and TTY detection

Sources: https://raw.githubusercontent.com/sindresorhus/open/main/readme.md, https://registry.npmjs.org/open/latest (11.0.4, ESM-only, engines `node >=20`), https://nodejs.org/api/tty.html, https://bun.com/docs/runtime/nodejs-apis.

```js
import open from 'open';
await open('https://sindresorhus.com');
```

`open(target, options?)` returns a promise for the spawned `ChildProcess`; options `wait` (false), `background` (macOS), `newInstance` (macOS), `app: { name, arguments }`, `allowNonzeroExitCode`; `openApp(name, options?)`; `apps.chrome|firefox|edge|brave|browser|browserPrivate` (`open(url, { app: { name: apps.browser } })`).

TTY: "The preferred method of determining whether Node.js is being run within a TTY context is to check that the value of the `process.stdout.isTTY` property is `true`"; `tty.isatty(fd)`; `writeStream.columns`/`rows`, `getColorDepth()`. Bun: `node:tty` "Fully implemented" — on a non-TTY fd Bun returns a stream "with isTTY set to false instead of throwing", so `Boolean(process.stdout.isTTY)` is the portable check under both runtimes.

---

## UNVERIFIED

1. Turborepo `@boundaries-ignore` comment syntax (not visible on the boundaries reference page).
2. TypeScript `verbatimModuleSyntax` "Released" version (index page reported 4.7; the option shipped in 5.0).
3. `oxfmt --check` exit code (not on the CLI page).
4. `publint` exit codes.
5. `@arethetypeswrong/cli` version (0.18.5 taken from R7, registry not re-fetched today).
6. `@commitlint/config-conventional` `scope-case` / `header-trim` rules (not in the fetched README).
7. lefthook `"prepare": "lefthook install"` script as an *official* recommendation (docs only mention the package `postinstall`).
8. Whether the `bun` binary itself reads `.bun-version` (only `oven-sh/setup-bun` `bun-version-file` is documented).
9. Bun `bun test` / `bun run` on a pnpm-created symlinked `node_modules` — no explicit doc or issue; indirect evidence only (§10.4).
10. Paraglide/inlang lint-rule module URLs for `settings.json` `modules` (only the message-format plugin URL is documented).
11. `claude auth status` JSON fields other than `configDirectory`.
12. Vitest browser instance keys `name`/`setupFiles`/`provide` (guide summary lists them, the config page fetch did not).
