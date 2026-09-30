# Plan 1: Repository Foundation and CLI Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the empty `misaon/workbox` repository into a pnpm + Turborepo monorepo with the full pedantic toolchain, CI/CD, community files, and a Bun-compiled `workbox` binary whose `--version` and `doctor` commands work on macOS, Linux and Windows.

**Architecture:** Internal packages are consumed as TypeScript source (no build step, `exports` point at `src/index.ts`); the CLI app is compiled with `bun build --compile` for eight targets from one Linux runner. Runtime packages test with `bun test`, the web client tests with Vitest browser mode. Dependency rules between packages are enforced with Turborepo boundaries tags; code quality with Oxlint (type-aware via TypeScript 7) and Oxfmt.

**Tech Stack:** Bun 1.4.2, TypeScript 7.0.2, pnpm 12.8.1, Turborepo 2.11.5, Oxlint 1.86 + oxlint-tsgolint, Oxfmt 0.71, knip 6, cspell 10, markdownlint-cli2 0.23, ls-lint 2.3, lefthook 2.1, commitlint 21, Zod 4.6, LogTape 2.3, Paraglide JS 2.25, citty 0.2, React 19.3 + Vite 8.3 + Tailwind 4.3, Vitest 5 + Playwright, release-please 17, Renovate, GitHub Actions (SHA-pinned).

**Spec:** [docs/superpowers/specs/2026-09-30-workbox-foundation-vertical-slice-design.md](../specs/2026-09-30-workbox-foundation-vertical-slice-design.md) — sections 4, 7.4, 10.1, 11 and 12 are implemented here; the rest belongs to plans 2 to 6 (see [README.md](README.md)).

**Config references (verified online 2026-09-30, copy from them, never from memory):** [R10 toolchain config reference](../research/2026-09-30-R10-toolchain-config-reference.md), [R11 GitHub automation reference](../research/2026-09-30-R11-github-automation-reference.md).

## Global Constraints

- Language: all code, comments, commit messages and documentation in English. UI strings only through `@workbox/i18n` (Czech `cs` and English `en`).
- Runtime pins: Bun `1.4.2` (`.bun-version`), Node `24` (`.node-version`, tooling only), pnpm `12.8.1` (`packageManager`), TypeScript `7.0.2` (type checking only, never its JS API).
- Every workspace package: `"private": true`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, `tsconfig.json` extending `tsconfig.base.json`, `turbo.json` with exactly one boundaries tag.
- Dependency rules from spec §4.3: `protocol`, `i18n`, `observability` are leaves; `core` depends only on `protocol`; adapters never depend on each other; `apps/web` never depends on `core`; `apps/cli` is the only composition root.
- Naming: kebab-case files and directories (`ls-lint`), PascalCase allowed only for `.tsx` component files.
- Commits: Conventional Commits, one commit per task, always `git commit -s` (DCO sign-off). Types allowed: `build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test`.
- Every lint-disable comment carries a reason after a colon, e.g. `// oxlint-disable-next-line no-console: doctor output is the product`.
- No secrets in the repository; `WORKBOX_HOME` defaults to `~/.workbox`; `WORKBOX_DEBUG=1` enables debug logging, `WORKBOX_DEBUG=full` additionally allows logging prompt and tool content (nothing in this plan logs content).
- Supply chain: `minimumReleaseAge: 4320`, `trustPolicy: no-downgrade`, `blockExoticSubdeps: true`, `strictDepBuilds: true`, explicit `allowBuilds`; GitHub Actions pinned to full commit SHAs with a `# vX.Y.Z` comment; `permissions: contents: read` at workflow level.
- Test runners: `bun test` for `packages/*` and `apps/cli`; Vitest 5 browser mode for `apps/web`. Never Vitest under the Bun runtime.
- Logs go to stderr; only product output goes to stdout, so `--json` output is always parseable.

## Deviations from the spec, with the verified reason

1. **No ESLint layer.** Spec §11.2 planned eslint-plugin-boundaries in a thin ESLint 10 config. R10 §3/§6 verified that `typescript@7` ships no JS API and `@typescript-eslint/parser` 8.71 pins `typescript <6.1`, so the ESLint layer would need a second TypeScript installed under the same package name. Dependency rules are enforced with Turborepo boundaries tags (Task 10) plus Oxlint `no-restricted-imports` for runtime purity of leaf packages.
2. **No Prettier fallback.** R10 §5 verified Oxfmt 0.71 formats every file type in this repository (TS, TSX, JSON, JSONC, YAML, TOML, CSS, Markdown).
3. **No `isolatedDeclarations`.** Internal packages are consumed as source with `noEmit`, and that option requires declaration emit.
4. **Bun targets.** R10 §10.1 verified eight real targets and that `-baseline` suffixes are aliases now: `bun-linux-x64`, `bun-linux-arm64`, `bun-linux-x64-musl`, `bun-linux-arm64-musl`, `bun-darwin-x64`, `bun-darwin-arm64`, `bun-windows-x64`, `bun-windows-arm64`.
5. **`actions/attest` instead of `actions/attest-build-provenance`** (the latter is now a wrapper; R11 §7c).
6. **No npm publish job yet.** The npm package name is spec open question 1; binaries are published to GitHub Releases only.
7. **React Compiler through the Babel preset** (`@vitejs/plugin-react` 6 + `@rolldown/plugin-babel`), the stable path in R10 §11.1; the oxc native transform is still experimental.

## Review Focus

Failure modes a person will hit that no spec sentence covers; each has a test in the owning task:

1. `WORKBOX_HOME` points at an unwritable location (a file, or a directory under a missing parent the user cannot create): `workbox doctor` must report the `workbox-home` check as `fail` with the path and the OS error, exit 1, and never throw. Test in Task 7 (`checkWorkboxHome` with a regular file as home).
2. `claude auth status` prints non-JSON text on an older CLI: the login check must use the exit code as the source of truth and tolerate unparseable stdout. Test in Task 7 (`readConfigDirectory('Logged in')` returns null; check still `ok` on exit code 0).
3. `git --version` on Windows prints `git version 2.51.0.windows.1`: the parser must accept suffixes. Test in Task 7 (`parseGitVersion`).
4. `--json` combined with `--debug`: stdout must stay pure JSON while debug lines go to stderr. Test in Task 7 (subprocess test parses stdout).
5. `--debug` with an unwritable `WORKBOX_HOME/logs`: the file sink must be skipped with a warning instead of crashing the command. Test in Task 7 (subprocess test with a file as `WORKBOX_HOME`, `--debug`, expects exit 1 from the failed home check and valid JSON on stdout).

## File Structure

```
workbox/
├─ .bun-version                      # 1.4.2
├─ .node-version                     # 24
├─ .editorconfig
├─ .gitignore
├─ .ls-lint.yml
├─ .markdownlint-cli2.jsonc
├─ .oxfmtrc.jsonc
├─ .oxlintrc.json
├─ .release-please-manifest.json
├─ CHANGELOG.md                      # created by release-please, not by hand
├─ CODE_OF_CONDUCT.md
├─ CONTRIBUTING.md
├─ LICENSE                           # Apache-2.0 text
├─ NOTICE
├─ README.md
├─ SECURITY.md
├─ commitlint.config.ts
├─ cspell.json
├─ project-words.txt                 # cspell project dictionary
├─ knip.json
├─ lefthook.yml
├─ package.json                      # root: scripts, dev tooling, version 0.0.0
├─ pnpm-workspace.yaml               # packages, catalog, supply-chain settings
├─ release-please-config.json
├─ renovate.json
├─ tsconfig.base.json                # shared compiler options
├─ tsconfig.json                     # root-level files (commitlint config)
├─ turbo.json                        # tasks + boundaries tags
├─ .github/
│  ├─ CODEOWNERS
│  ├─ pull_request_template.md
│  ├─ ISSUE_TEMPLATE/{1-bug-report.yml, 2-feature-request.yml, config.yml}
│  └─ workflows/{ci.yml, pr-title.yml, release.yml, scorecard.yml, zizmor.yml, gitleaks.yml}
├─ docs/adr/0001-…0010-*.md          # decision records
├─ packages/
│  ├─ protocol/                      # PROTOCOL_VERSION, user config schema, JSON Schema export
│  │  ├─ package.json, tsconfig.json, turbo.json, .oxlintrc.json
│  │  ├─ src/index.ts, src/version.ts, src/user-config.ts
│  │  └─ test/user-config.test.ts, test/version.test.ts
│  ├─ observability/                 # LogTape logging, debug level resolution, redaction, stderr and file sinks
│  │  ├─ package.json, tsconfig.json, turbo.json
│  │  ├─ src/index.ts, src/log-level.ts, src/logging.ts, src/sinks.ts
│  │  └─ test/log-level.test.ts, test/logging.test.ts
│  └─ i18n/                          # inlang project, messages, compile script, locale resolution
│     ├─ package.json, tsconfig.json, turbo.json
│     ├─ project.inlang/settings.json
│     ├─ messages/en.json, messages/cs.json
│     ├─ scripts/compile.ts
│     ├─ src/index.ts, src/locale.ts, src/paraglide/ (generated, gitignored)
│     └─ test/messages.test.ts, test/locale.test.ts
└─ apps/
   ├─ cli/                           # the workbox binary
   │  ├─ package.json, tsconfig.json, turbo.json
   │  ├─ scripts/build-binaries.ts
   │  ├─ src/build-targets.ts
   │  ├─ src/main.ts, src/version.ts, src/home.ts, src/logging.ts
   │  ├─ src/commands/main.ts, src/commands/doctor.ts
   │  ├─ src/doctor/checks.ts, src/doctor/run-doctor.ts, src/doctor/report.ts
   │  ├─ src/output/stdout.ts
   │  ├─ src/process/command-runner.ts
   │  └─ test/*.test.ts               # binary.test.ts runs only with WORKBOX_BINARY_TEST=1
   └─ web/                           # React skeleton
      ├─ package.json, tsconfig.json, turbo.json, vite.config.ts, vitest.config.ts, index.html
      └─ src/main.tsx, src/app.tsx, src/app.test.tsx, src/test-setup.ts, src/index.css
```

Work on a branch: `git switch -c feat/repository-foundation` from `main` (or the worktree the executing skill creates). Every step's `git commit` uses `-s`.

---

### Task 1: Workspace scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.bun-version`, `.node-version`, `.gitignore`, `.editorconfig`, `tsconfig.base.json`, `tsconfig.json`, `turbo.json`

**Interfaces:**
- Produces: the `catalog:` protocol for every dependency version used by later tasks; `tsconfig.base.json` that every package extends; turbo tasks `build`, `typecheck`, `test`, `dev`.

- [ ] **Step 1: Verify prerequisites on the machine**

Run:
```bash
node --version && bun --version && git --version
```
Expected: `v24.x`, `1.4.2`, any git ≥ 2.40. If Bun is not `1.4.2`, install it: `curl -fsSL https://bun.com/install | bash -s "bun-v1.4.2"`. Install pnpm 12 if missing: `npx get-pnpm@latest` then `pnpm --version` prints `12.x` (the `packageManager` field below makes pnpm download `12.8.1` automatically afterwards, R10 §1.4).

- [ ] **Step 2: Create the root `package.json`**

```json
{
  "name": "workbox-monorepo",
  "version": "0.0.0",
  "private": true,
  "description": "Workbox: an open-source, local-first orchestrator for AI coding agents, visualised as a pixel-art office.",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/misaon/workbox.git"
  },
  "type": "module",
  "packageManager": "pnpm@12.8.1",
  "engines": {
    "node": ">=24",
    "pnpm": ">=12.8.1"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck && tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": {
    "turbo": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml` with the catalog and supply-chain settings**

Every version below was read from the npm registry on 2026-09-30 (R10 header, R7, R9). Caret ranges let pnpm honour `minimumReleaseAge` by picking the newest version that is at least three days old.

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

catalog:
  '@babel/core': ^7.29.0
  '@commitlint/cli': ^21.2.3
  '@commitlint/config-conventional': ^21.2.3
  '@commitlint/types': ^21.2.3
  '@cspell/dict-cs-cz': ^3.0.8
  '@inlang/paraglide-js': ^2.25.4
  '@logtape/file': ^2.3.10
  '@logtape/logtape': ^2.3.10
  '@logtape/redaction': ^2.3.10
  '@ls-lint/ls-lint': ^2.3.1
  '@rolldown/plugin-babel': ^0.2.4
  '@tailwindcss/vite': ^4.3.3
  '@types/bun': ^1.4.2
  '@types/react': ^19.3.0
  '@types/react-dom': ^19.3.0
  '@vitejs/plugin-react': ^6.1.1
  '@vitest/browser-playwright': ^5.0.3
  babel-plugin-react-compiler: ^1.0.0
  citty: ^0.2.2
  cspell: ^10.3.6
  knip: ^6.39.0
  lefthook: ^2.1.15
  markdownlint-cli2: ^0.23.3
  oxfmt: ^0.71.0
  oxlint: ^1.86.0
  oxlint-tsgolint: ^7.0.2003
  playwright: ^1.63.0
  react: ^19.3.0
  react-dom: ^19.3.0
  tailwindcss: ^4.3.3
  turbo: ^2.11.5
  typescript: ^7.0.2
  vite: ^8.3.1
  vitest: ^5.0.3
  zod: ^4.6.5

minimumReleaseAge: 4320
minimumReleaseAgeExclude:
  - '@anthropic-ai/claude-agent-sdk'
trustPolicy: no-downgrade
blockExoticSubdeps: true
strictDepBuilds: true
allowBuilds:
  lefthook: true
  playwright: true
```

- [ ] **Step 4: Create the pins and editor files**

`.bun-version`:
```
1.4.2
```

`.node-version`:
```
24
```

`.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

`.gitignore`:
```gitignore
node_modules/
dist/
coverage/
.turbo/
**/src/paraglide/
*.log
.DS_Store
.idea/
.env
.env.*
!.env.example
test-results/
playwright-report/
```

- [ ] **Step 5: Create `tsconfig.base.json` and the root `tsconfig.json`**

`tsconfig.base.json` (Bun's recommended options from R10 §3 plus the spec's pedantic flags; `types: []` because TypeScript 7 no longer auto-includes `@types`):
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext"],
    "module": "Preserve",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "allowJs": true,
    "noEmit": true,
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": []
  }
}
```

Root `tsconfig.json` (only root-level TypeScript files; packages have their own):
```json
{
  "extends": "./tsconfig.base.json",
  "include": ["commitlint.config.ts"]
}
```

- [ ] **Step 6: Create `turbo.json`**

Tasks only; boundaries tags are added in Task 10 once every package exists (R10 §2.1 shape).
```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "stream",
  "globalDependencies": ["tsconfig.base.json", ".bun-version", "pnpm-workspace.yaml"],
  "globalEnv": ["CI"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "src/paraglide/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build", "^build"],
      "outputs": ["coverage/**"],
      "env": ["WORKBOX_HOME", "WORKBOX_DEBUG", "WORKBOX_LOCALE", "WORKBOX_BINARY_TEST"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 7: Install and verify the empty workspace**

Run:
```bash
pnpm install
```
Expected: creates `pnpm-lock.yaml`, no error. If pnpm stops with "unreviewed build scripts", run `pnpm approve-builds`, approve only packages you recognise from the catalog, and re-run `pnpm install`. If pnpm refuses a version because it is younger than `minimumReleaseAge`, add that package to `minimumReleaseAgeExclude` with a `# remove after <date>` comment and re-run.

Run:
```bash
pnpm turbo run typecheck
```
Expected: turbo reports no packages with a `typecheck` task and exits 0.

Run:
```bash
pnpm exec tsc --version
```
Expected: `Version 7.0.x`.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .bun-version .node-version .gitignore .editorconfig tsconfig.base.json tsconfig.json turbo.json
git commit -s -m "chore: scaffold pnpm workspace with turborepo and typescript 7"
```

---

### Task 2: `@workbox/protocol` with the protocol version and user config schema

**Files:**
- Create: `packages/protocol/package.json`, `packages/protocol/tsconfig.json`, `packages/protocol/turbo.json`, `packages/protocol/src/index.ts`, `packages/protocol/src/version.ts`, `packages/protocol/src/user-config.ts`
- Test: `packages/protocol/test/version.test.ts`, `packages/protocol/test/user-config.test.ts`

**Interfaces:**
- Produces: `PROTOCOL_VERSION: string` (semver), `userConfigSchema` (Zod), `UserConfig` type, `parseUserConfig(input: unknown): ParseResult<UserConfig>`, `userConfigJsonSchema(): Record<string, unknown>`, `DEFAULT_USER_CONFIG`.
- This task also proves that `bun test` works on a pnpm-created `node_modules` (R10 §10.4 marks it unverified).

- [ ] **Step 1: Create the package manifest, tsconfig and turbo tag placeholder**

`packages/protocol/package.json`:
```json
{
  "name": "@workbox/protocol",
  "version": "0.0.0",
  "private": true,
  "description": "Schemas and pure projections shared by the Workbox daemon and its clients.",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/bun": "catalog:",
    "typescript": "catalog:"
  }
}
```

`packages/protocol/tsconfig.json` (`bun` types are needed only for `bun:test`; runtime purity is enforced by Oxlint in Task 3):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun"]
  },
  "include": ["src", "test"]
}
```

`packages/protocol/turbo.json`:
```json
{
  "extends": ["//"],
  "tags": ["leaf"]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/protocol/test/version.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';

import { PROTOCOL_VERSION, protocolMajor } from '../src/index.ts';

describe('PROTOCOL_VERSION', () => {
  test('is a semver string', () => {
    expect(PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('protocolMajor extracts the major number', () => {
    expect(protocolMajor('3.14.1')).toBe(3);
    expect(protocolMajor(PROTOCOL_VERSION)).toBe(Number(PROTOCOL_VERSION.split('.')[0]));
  });
});
```

`packages/protocol/test/user-config.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';

import { DEFAULT_USER_CONFIG, parseUserConfig, userConfigJsonSchema } from '../src/index.ts';

describe('parseUserConfig', () => {
  test('fills defaults for an empty object', () => {
    const result = parseUserConfig({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(DEFAULT_USER_CONFIG);
    }
  });

  test('accepts a full config', () => {
    const result = parseUserConfig({
      locale: 'cs',
      notifications: { desktop: false, sound: true },
      office: { renderer: 'webgpu' },
      harness: { claude: { pinSystemBinary: true } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.locale).toBe('cs');
      expect(result.value.office.renderer).toBe('webgpu');
      expect(result.value.harness.claude.pinSystemBinary).toBe(true);
    }
  });

  test('rejects unknown keys with a path in the message', () => {
    const result = parseUserConfig({ colour: 'blue' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('colour');
    }
  });

  test('rejects an unsupported locale', () => {
    const result = parseUserConfig({ locale: 'de' });
    expect(result.ok).toBe(false);
  });

  test('rejects non-objects', () => {
    expect(parseUserConfig('nope').ok).toBe(false);
    expect(parseUserConfig(null).ok).toBe(false);
  });
});

describe('userConfigJsonSchema', () => {
  test('exports draft-07 JSON Schema with all four top-level properties', () => {
    const schema = userConfigJsonSchema();
    expect(schema['$schema']).toBe('http://json-schema.org/draft-07/schema#');
    const properties = schema['properties'] as Record<string, unknown>;
    expect(Object.keys(properties).sort()).toEqual(['harness', 'locale', 'notifications', 'office']);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
pnpm install && cd packages/protocol && bun test
```
Expected: FAIL, `Cannot find module '../src/index.ts'`.

- [ ] **Step 4: Implement the package**

`packages/protocol/src/version.ts`:
```ts
/** Semantic version of the wire protocol between the daemon and its clients. Bump major on breaking changes. */
export const PROTOCOL_VERSION = '0.1.0';

export function protocolMajor(version: string): number {
  const [major] = version.split('.');
  const parsed = Number(major);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid protocol version "${version}"`);
  }
  return parsed;
}
```

`packages/protocol/src/user-config.ts`:
```ts
import * as z from 'zod';

export const LOCALES = ['en', 'cs'] as const;
export type Locale = (typeof LOCALES)[number];

export const userConfigSchema = z.strictObject({
  locale: z.enum(LOCALES).default('en'),
  notifications: z
    .strictObject({
      desktop: z.boolean().default(true),
      sound: z.boolean().default(true),
    })
    .default({ desktop: true, sound: true }),
  office: z
    .strictObject({
      renderer: z.enum(['webgl', 'webgpu']).default('webgl'),
    })
    .default({ renderer: 'webgl' }),
  harness: z
    .strictObject({
      claude: z
        .strictObject({
          pinSystemBinary: z.boolean().default(false),
        })
        .default({ pinSystemBinary: false }),
    })
    .default({ claude: { pinSystemBinary: false } }),
});

export type UserConfig = z.output<typeof userConfigSchema>;

export const DEFAULT_USER_CONFIG: UserConfig = userConfigSchema.parse({});

export type ParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

export function parseUserConfig(input: unknown): ParseResult<UserConfig> {
  const result = userConfigSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const message = result.error.issues
    .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
  return { ok: false, message };
}

export function userConfigJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(userConfigSchema, { target: 'draft-7', io: 'input' }) as Record<string, unknown>;
}
```

`packages/protocol/src/index.ts`:
```ts
export { PROTOCOL_VERSION, protocolMajor } from './version.ts';
export {
  DEFAULT_USER_CONFIG,
  LOCALES,
  parseUserConfig,
  userConfigJsonSchema,
  userConfigSchema,
} from './user-config.ts';
export type { Locale, ParseResult, UserConfig } from './user-config.ts';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```bash
cd packages/protocol && bun test && pnpm run typecheck
```
Expected: 8 tests pass, `tsc` prints nothing. If `bun test` cannot resolve `zod` through pnpm's symlinked `node_modules`, add `nodeLinker: hoisted` to `pnpm-workspace.yaml`, re-run `pnpm install`, and record the fact in ADR 0004 (Task 15). Z.toJSONSchema with `draft-7` emits `$schema: http://json-schema.org/draft-07/schema#`; if the key differs in the installed Zod, align the assertion with the documented output and keep the `target` option.

- [ ] **Step 6: Commit**

```bash
git add packages/protocol pnpm-lock.yaml
git commit -s -m "feat(protocol): add protocol version and user config schema"
```

---

### Task 3: Formatter and linter (Oxfmt, Oxlint type-aware)

**Files:**
- Create: `.oxfmtrc.jsonc`, `.oxlintrc.json`, `packages/protocol/.oxlintrc.json`
- Modify: `package.json` (scripts, devDependencies)

**Interfaces:**
- Produces: root scripts `format`, `format:check`, `lint`, `lint:fix`; the convention that every disable comment carries a reason.

- [ ] **Step 1: Add the tools**

Run:
```bash
pnpm add -D -w oxfmt oxlint oxlint-tsgolint
```
(`-w` targets the workspace root; versions come from the catalog.) Expected: install succeeds; `pnpm exec oxlint --version` prints `1.86.x`; `pnpm exec oxfmt --version` prints `0.71.x`.

- [ ] **Step 2: Create `.oxfmtrc.jsonc`** (defaults from R10 §5, three overrides)

```jsonc
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 100,
  "singleQuote": true,
  "sortImports": true,
  "sortPackageJson": true,
  "ignorePatterns": [
    "**/dist/**",
    "**/paraglide/**",
    "**/coverage/**",
    "pnpm-lock.yaml",
    "CHANGELOG.md",
    "CODE_OF_CONDUCT.md",
    "docs/superpowers/research/**"
  ]
}
```

- [ ] **Step 3: Create `.oxlintrc.json`** (schema and keys from R10 §4)

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "options": { "typeAware": true },
  "plugins": ["typescript", "unicorn", "oxc", "import", "promise", "node"],
  "categories": {
    "correctness": "error",
    "suspicious": "error",
    "pedantic": "error",
    "perf": "error",
    "style": "error",
    "restriction": "warn"
  },
  "ignorePatterns": ["**/dist/**", "**/paraglide/**", "**/coverage/**"],
  "rules": {
    "no-console": "error",
    "import/no-default-export": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/consistent-type-imports": "error",
    "unicorn/prefer-node-protocol": "error"
  },
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.test.tsx"],
      "plugins": ["jest"],
      "rules": {
        "jest/no-disabled-tests": "error",
        "jest/no-focused-tests": "error"
      }
    },
    {
      "files": ["**/*.config.ts", "**/*.config.js", "**/*.config.mjs"],
      "rules": { "import/no-default-export": "off" }
    },
    {
      "files": ["apps/web/**/*.tsx", "apps/web/**/*.ts"],
      "plugins": ["react", "jsx-a11y", "vitest"]
    },
    {
      "files": ["apps/cli/src/output/**"],
      "rules": { "no-console": "off" }
    }
  ]
}
```

`packages/protocol/.oxlintrc.json` (runtime purity of the leaf package; nested configs are supported):
```json
{
  "$schema": "../../node_modules/oxlint/configuration_schema.json",
  "rules": {
    "no-restricted-globals": ["error", { "name": "Bun", "message": "protocol must stay runtime-neutral" }],
    "no-restricted-imports": [
      "error",
      { "patterns": ["bun:*", "node:*"], "message": "protocol must stay runtime-neutral" }
    ]
  },
  "overrides": [
    {
      "files": ["test/**"],
      "rules": { "no-restricted-imports": "off" }
    }
  ]
}
```

- [ ] **Step 4: Add the scripts**

In root `package.json` `scripts`, add:
```json
"format": "oxfmt",
"format:check": "oxfmt --check",
"lint": "oxlint --type-aware --deny-warnings",
"lint:fix": "oxlint --type-aware --fix"
```

- [ ] **Step 5: Run the formatter and linter**

Run:
```bash
pnpm run format && pnpm run format:check && pnpm run lint
```
Expected: `format` rewrites files (accept the changes), `format:check` exits 0, `lint` exits 0. If the pedantic or style categories flag code from Task 2, fix the code. A rule may be turned off only in `.oxlintrc.json`; JSON has no comments, so every rule turned off there is listed with its reason in ADR 0005 (Task 15), and that list stays short.

- [ ] **Step 6: Negative check for runtime purity**

Append `const home = Bun.env['HOME'];` plus `console.log(home);` to `packages/protocol/src/version.ts`, run `pnpm run lint`. Expected: FAIL with `no-restricted-globals` and `no-console`. Remove the two lines, run `pnpm run lint` again. Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add .oxfmtrc.jsonc .oxlintrc.json packages/protocol/.oxlintrc.json package.json pnpm-lock.yaml
git add -u
git commit -s -m "build: add oxfmt and type-aware oxlint"
```

---

### Task 4: Git hooks and commit message linting (lefthook, commitlint)

**Files:**
- Create: `lefthook.yml`, `commitlint.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the tools**

Run:
```bash
pnpm add -D -w lefthook @commitlint/cli @commitlint/config-conventional @commitlint/types
```
Expected: install succeeds and prints that lefthook installed hooks (its postinstall is allowed by `allowBuilds`). If the postinstall was skipped, run `pnpm exec lefthook install`.

- [ ] **Step 2: Create `commitlint.config.ts`** (shape from R10 §9.2)

```ts
import type { UserConfig } from '@commitlint/types';

const configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
};

export default configuration;
```

- [ ] **Step 3: Create `lefthook.yml`** (placeholders and structure from R10 §9.1; the pre-push runs only affected packages)

```yaml
min_version: 2.0.0

pre-commit:
  parallel: true
  jobs:
    - name: format
      glob: "*.{js,mjs,ts,tsx,json,jsonc,md,yml,yaml,css,toml}"
      run: pnpm exec oxfmt {staged_files}
      stage_fixed: true
    - name: lint
      glob: "*.{js,mjs,ts,tsx}"
      run: pnpm exec oxlint --type-aware --deny-warnings {staged_files}

commit-msg:
  commands:
    "lint commit message":
      run: pnpm exec commitlint --edit {1}

pre-push:
  jobs:
    - name: typecheck-and-test
      run: pnpm turbo run typecheck test --affected
```

- [ ] **Step 4: Add the `prepare` script**

In root `package.json` `scripts`, add:
```json
"prepare": "lefthook install"
```

- [ ] **Step 5: Verify the hooks**

Run:
```bash
pnpm exec lefthook install && pnpm exec lefthook run pre-commit
```
Expected: exits 0 ("no staged files" is acceptable).

Run:
```bash
echo "bad message" > /tmp/workbox-commit-msg.txt && pnpm exec commitlint --edit /tmp/workbox-commit-msg.txt; echo "exit=$?"
```
Expected: errors `subject may not be empty` and `type may not be empty`, `exit=1`.

Run:
```bash
echo "feat(cli): add doctor" > /tmp/workbox-commit-msg.txt && pnpm exec commitlint --edit /tmp/workbox-commit-msg.txt; echo "exit=$?"
```
Expected: `exit=0`.

- [ ] **Step 6: Commit (this commit is itself validated by the new hook)**

```bash
git add lefthook.yml commitlint.config.ts package.json pnpm-lock.yaml
git commit -s -m "build: add lefthook hooks and commitlint"
```

---

### Task 5: `@workbox/observability` logging

**Files:**
- Create: `packages/observability/package.json`, `tsconfig.json`, `turbo.json`, `src/index.ts`, `src/log-level.ts`, `src/logging.ts`, `src/sinks.ts`
- Test: `packages/observability/test/log-level.test.ts`, `packages/observability/test/logging.test.ts`

**Interfaces:**
- Produces:
  - `type LogLevel = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal'`
  - `resolveLogLevel(env: EnvLike, debugFlag: boolean): { level: LogLevel; contentLogging: boolean }`
  - `configureLogging(options: { level: LogLevel; sinks: Record<string, Sink> }): Promise<void>`
  - `getLogger(category: readonly string[]): Logger` (always under the `workbox` root category)
  - `createStderrSink(options: { pretty: boolean }): Sink`, `createRotatingFileSink(path: string): Sink`
  - `type EnvLike = Readonly<Record<string, string | undefined>>`

- [ ] **Step 1: Create the manifest, tsconfig and turbo tag**

`packages/observability/package.json`:
```json
{
  "name": "@workbox/observability",
  "version": "0.0.0",
  "private": true,
  "description": "Structured logging, debug levels and secret redaction for Workbox.",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@logtape/file": "catalog:",
    "@logtape/logtape": "catalog:",
    "@logtape/redaction": "catalog:"
  },
  "devDependencies": {
    "@types/bun": "catalog:",
    "typescript": "catalog:"
  }
}
```

`packages/observability/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun"]
  },
  "include": ["src", "test"]
}
```

`packages/observability/turbo.json`:
```json
{
  "extends": ["//"],
  "tags": ["leaf"]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/observability/test/log-level.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';

import { resolveLogLevel } from '../src/index.ts';

describe('resolveLogLevel', () => {
  test('defaults to info without flags', () => {
    expect(resolveLogLevel({}, false)).toEqual({ level: 'info', contentLogging: false });
  });

  test('--debug flag switches to debug', () => {
    expect(resolveLogLevel({}, true)).toEqual({ level: 'debug', contentLogging: false });
  });

  test('WORKBOX_DEBUG=1 switches to debug', () => {
    expect(resolveLogLevel({ WORKBOX_DEBUG: '1' }, false)).toEqual({ level: 'debug', contentLogging: false });
  });

  test('WORKBOX_DEBUG=full also allows content logging', () => {
    expect(resolveLogLevel({ WORKBOX_DEBUG: 'full' }, false)).toEqual({ level: 'debug', contentLogging: true });
  });

  test('other values are ignored', () => {
    expect(resolveLogLevel({ WORKBOX_DEBUG: 'yes' }, false)).toEqual({ level: 'info', contentLogging: false });
    expect(resolveLogLevel({ WORKBOX_DEBUG: '0' }, false)).toEqual({ level: 'info', contentLogging: false });
  });
});
```

`packages/observability/test/logging.test.ts`:
```ts
import { afterEach, describe, expect, test } from 'bun:test';
import type { LogRecord } from '@logtape/logtape';

import { configureLogging, getLogger, resetLogging } from '../src/index.ts';

const records: LogRecord[] = [];

afterEach(async () => {
  records.length = 0;
  await resetLogging();
});

describe('configureLogging', () => {
  test('routes workbox logs to the given sink at or above the level', async () => {
    await configureLogging({ level: 'info', sinks: { memory: (record) => records.push(record) } });
    const logger = getLogger(['test']);
    logger.debug('hidden');
    logger.info('shown {answer}', { answer: 42 });
    expect(records).toHaveLength(1);
    expect(records[0]?.category).toEqual(['workbox', 'test']);
    expect(records[0]?.properties['answer']).toBe(42);
  });

  test('redacts secret-looking properties', async () => {
    await configureLogging({ level: 'debug', sinks: { memory: (record) => records.push(record) } });
    getLogger(['test']).info('auth', {
      authorization: 'Bearer abc',
      apiKey: 'sk-123',
      password: 'hunter2',
      token: 't',
      safe: 'visible',
    });
    const properties = records[0]?.properties ?? {};
    expect(properties['authorization']).toBe('[REDACTED]');
    expect(properties['apiKey']).toBe('[REDACTED]');
    expect(properties['password']).toBe('[REDACTED]');
    expect(properties['token']).toBe('[REDACTED]');
    expect(properties['safe']).toBe('visible');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
pnpm install && cd packages/observability && bun test
```
Expected: FAIL, `Cannot find module '../src/index.ts'`.

- [ ] **Step 4: Implement**

`packages/observability/src/log-level.ts`:
```ts
export type LogLevel = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export type EnvLike = Readonly<Record<string, string | undefined>>;

export interface ResolvedLogLevel {
  readonly level: LogLevel;
  readonly contentLogging: boolean;
}

/** `--debug` or `WORKBOX_DEBUG=1` enable debug logs; `WORKBOX_DEBUG=full` additionally allows prompt and tool content. */
export function resolveLogLevel(env: EnvLike, debugFlag: boolean): ResolvedLogLevel {
  const raw = env['WORKBOX_DEBUG']?.trim().toLowerCase();
  const contentLogging = raw === 'full';
  const debug = debugFlag || raw === '1' || contentLogging;
  return { level: debug ? 'debug' : 'info', contentLogging };
}
```

`packages/observability/src/sinks.ts`:
```ts
import { getRotatingFileSink } from '@logtape/file';
import { ansiColorFormatter, jsonLinesFormatter, type Sink } from '@logtape/logtape';

export interface StderrSinkOptions {
  readonly pretty: boolean;
}

/** Logs must never touch stdout: product output (including `--json`) lives there. */
export function createStderrSink(options: StderrSinkOptions): Sink {
  const format = options.pretty ? ansiColorFormatter : jsonLinesFormatter;
  return (record) => {
    process.stderr.write(format(record));
  };
}

export function createRotatingFileSink(path: string): Sink {
  return getRotatingFileSink(path, {
    maxSize: 5 * 1024 * 1024,
    maxFiles: 5,
    formatter: jsonLinesFormatter,
  });
}
```

`packages/observability/src/logging.ts`:
```ts
import {
  configure,
  getLogger as getLogTapeLogger,
  reset,
  type Logger,
  type LogRecord,
  type Sink,
} from '@logtape/logtape';
import { DEFAULT_REDACT_FIELDS, redactByField } from '@logtape/redaction';

import type { LogLevel } from './log-level.ts';

const ROOT_CATEGORY = 'workbox';
const REDACTED = '[REDACTED]';
const EXTRA_REDACT_FIELDS: readonly RegExp[] = [/authorization/i, /api[-_]?key/i, /secret/i, /password/i, /token/i];

export interface LoggingOptions {
  readonly level: LogLevel;
  readonly sinks: Readonly<Record<string, Sink>>;
}

export async function configureLogging(options: LoggingOptions): Promise<void> {
  const redactedSinks = Object.fromEntries(
    Object.entries(options.sinks).map(([name, sink]) => [
      name,
      redactByField(sink, {
        fieldPatterns: [...DEFAULT_REDACT_FIELDS, ...EXTRA_REDACT_FIELDS],
        action: () => REDACTED,
      }),
    ]),
  );
  const sinkNames = Object.keys(redactedSinks);
  await configure({
    reset: true,
    sinks: redactedSinks,
    loggers: [
      { category: [ROOT_CATEGORY], lowestLevel: options.level, sinks: sinkNames },
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: sinkNames },
    ],
  });
}

export async function resetLogging(): Promise<void> {
  await reset();
}

export function getLogger(category: readonly string[]): Logger {
  return getLogTapeLogger([ROOT_CATEGORY, ...category]);
}

export type { Logger, LogRecord, Sink };
```

`packages/observability/src/index.ts`:
```ts
export { resolveLogLevel } from './log-level.ts';
export type { EnvLike, LogLevel, ResolvedLogLevel } from './log-level.ts';
export { configureLogging, getLogger, resetLogging } from './logging.ts';
export type { Logger, LoggingOptions, LogRecord, Sink } from './logging.ts';
export { createRotatingFileSink, createStderrSink } from './sinks.ts';
export type { StderrSinkOptions } from './sinks.ts';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```bash
cd packages/observability && bun test && pnpm run typecheck && cd ../.. && pnpm run lint
```
Expected: 7 tests pass, no type errors, lint clean. If `redactByField` does not accept RegExp entries in `fieldPatterns` in the installed version, replace `EXTRA_REDACT_FIELDS` with the string forms `['authorization', 'apikey', 'api_key', 'secret', 'password', 'token']` and keep the test.

- [ ] **Step 6: Commit**

```bash
git add packages/observability pnpm-lock.yaml
git commit -s -m "feat(observability): add logtape logging with redaction and debug levels"
```

---

### Task 6: `@workbox/i18n` messages in English and Czech

**Files:**
- Create: `packages/i18n/package.json`, `tsconfig.json`, `turbo.json`, `project.inlang/settings.json`, `messages/en.json`, `messages/cs.json`, `scripts/compile.ts`, `src/index.ts`, `src/locale.ts`
- Test: `packages/i18n/test/locale.test.ts`, `packages/i18n/test/messages.test.ts`

**Interfaces:**
- Consumes: `LOCALES`, `Locale` from `@workbox/protocol`.
- Produces: `m` (compiled messages; every key below), `getLocale()`, `setLocale(locale)`, `resolveLocale(env: EnvLike): Locale`, `isLocale(value: unknown): value is Locale`.
- Message keys: `app_title`, `cli_doctor_title`, `cli_doctor_check_git`, `cli_doctor_check_claude_binary`, `cli_doctor_check_claude_login`, `cli_doctor_check_workbox_home`, `cli_doctor_summary` (inputs `passed`, `total`), `cli_doctor_hint_install_claude`, `cli_doctor_hint_login`.

- [ ] **Step 1: Create the manifest, tsconfig, turbo tag and inlang project**

`packages/i18n/package.json`:
```json
{
  "name": "@workbox/i18n",
  "version": "0.0.0",
  "private": true,
  "description": "Czech and English messages for Workbox, compiled with Paraglide JS.",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "bun run scripts/compile.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@workbox/protocol": "workspace:*"
  },
  "devDependencies": {
    "@inlang/paraglide-js": "catalog:",
    "@types/bun": "catalog:",
    "typescript": "catalog:"
  }
}
```

`packages/i18n/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun"]
  },
  "include": ["src", "test", "scripts"]
}
```

`packages/i18n/turbo.json`:
```json
{
  "extends": ["//"],
  "tags": ["leaf"]
}
```

`packages/i18n/project.inlang/settings.json` (R10 §12):
```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "en",
  "locales": ["en", "cs"],
  "modules": ["https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{locale}.json"
  }
}
```

- [ ] **Step 2: Write the messages**

`packages/i18n/messages/en.json`:
```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "app_title": "Workbox",
  "cli_doctor_title": "Workbox doctor",
  "cli_doctor_check_git": "git",
  "cli_doctor_check_claude_binary": "Claude Code binary",
  "cli_doctor_check_claude_login": "Claude Code login",
  "cli_doctor_check_workbox_home": "Workbox home directory",
  "cli_doctor_summary": "{passed} of {total} checks passed",
  "cli_doctor_hint_install_claude": "Install Claude Code: https://code.claude.com/docs/en/setup",
  "cli_doctor_hint_login": "Run `claude auth login` in a terminal, Workbox never handles your credentials."
}
```

`packages/i18n/messages/cs.json`:
```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "app_title": "Workbox",
  "cli_doctor_title": "Workbox doktor",
  "cli_doctor_check_git": "git",
  "cli_doctor_check_claude_binary": "binárka Claude Code",
  "cli_doctor_check_claude_login": "přihlášení Claude Code",
  "cli_doctor_check_workbox_home": "domovský adresář Workboxu",
  "cli_doctor_summary": "Prošlo {passed} z {total} kontrol",
  "cli_doctor_hint_install_claude": "Nainstalujte Claude Code: https://code.claude.com/docs/en/setup",
  "cli_doctor_hint_login": "Spusťte v terminálu `claude auth login`, Workbox s vašimi přihlašovacími údaji nikdy nepracuje."
}
```

- [ ] **Step 3: Write the compile script**

`packages/i18n/scripts/compile.ts` (programmatic API from R10 §12; `globalVariable` first so `setLocale` works in the CLI, which has no cookies):
```ts
import { compile } from '@inlang/paraglide-js';

await compile({
  project: './project.inlang',
  outdir: './src/paraglide',
  strategy: ['globalVariable', 'baseLocale'],
  emitTsDeclarations: true,
});
```

- [ ] **Step 4: Write the failing tests**

`packages/i18n/test/locale.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';

import { isLocale, resolveLocale } from '../src/index.ts';

describe('resolveLocale', () => {
  test('uses WORKBOX_LOCALE when supported', () => {
    expect(resolveLocale({ WORKBOX_LOCALE: 'cs' })).toBe('cs');
    expect(resolveLocale({ WORKBOX_LOCALE: 'EN' })).toBe('en');
  });

  test('falls back to English for missing or unsupported values', () => {
    expect(resolveLocale({})).toBe('en');
    expect(resolveLocale({ WORKBOX_LOCALE: 'de' })).toBe('en');
    expect(resolveLocale({ WORKBOX_LOCALE: '' })).toBe('en');
  });
});

describe('isLocale', () => {
  test('accepts only the supported locales', () => {
    expect(isLocale('cs')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(1)).toBe(false);
  });
});
```

`packages/i18n/test/messages.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';

import { getLocale, m, setLocale } from '../src/index.ts';

describe('messages', () => {
  test('English is the base locale', () => {
    expect(getLocale()).toBe('en');
    expect(m.cli_doctor_title()).toBe('Workbox doctor');
  });

  test('a locale can be requested per call', () => {
    expect(m.cli_doctor_title({}, { locale: 'cs' })).toBe('Workbox doktor');
  });

  test('inputs are interpolated', () => {
    expect(m.cli_doctor_summary({ passed: '3', total: '4' })).toBe('3 of 4 checks passed');
    expect(m.cli_doctor_summary({ passed: '3', total: '4' }, { locale: 'cs' })).toBe('Prošlo 3 z 4 kontrol');
  });

  test('setLocale switches the global locale', () => {
    setLocale('cs', { reload: false });
    expect(m.app_title()).toBe('Workbox');
    expect(m.cli_doctor_check_git({}, { locale: getLocale() })).toBe('git');
    setLocale('en', { reload: false });
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run:
```bash
pnpm install && cd packages/i18n && bun test
```
Expected: FAIL, `Cannot find module '../src/index.ts'`.

- [ ] **Step 6: Implement**

`packages/i18n/src/locale.ts`:
```ts
import { LOCALES, type Locale } from '@workbox/protocol';

export type EnvLike = Readonly<Record<string, string | undefined>>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** `WORKBOX_LOCALE` wins; anything unsupported falls back to English. */
export function resolveLocale(env: EnvLike): Locale {
  const candidate = env['WORKBOX_LOCALE']?.trim().toLowerCase();
  return isLocale(candidate) ? candidate : 'en';
}
```

`packages/i18n/src/index.ts`:
```ts
export { m } from './paraglide/messages.js';
export { baseLocale, getLocale, locales, setLocale } from './paraglide/runtime.js';
export { isLocale, resolveLocale } from './locale.ts';
export type { EnvLike } from './locale.ts';
export type { Locale } from '@workbox/protocol';
```

- [ ] **Step 7: Compile and run the tests**

Run:
```bash
cd packages/i18n && pnpm run build && ls src/paraglide && bun test && pnpm run typecheck
```
Expected: `src/paraglide/` contains `messages.js`, `runtime.js`, `.gitignore` and `.d.ts` files; 7 tests pass; typecheck clean. If `setLocale` does not accept a second argument in the installed runtime, call `setLocale('cs')` (there is no document to reload outside the browser) and keep the assertion. If `compile()` rejects `emitTsDeclarations`, remove the option; `allowJs` in the base tsconfig types the JSDoc-annotated output.

- [ ] **Step 8: Verify the turbo graph builds i18n before dependants**

Run from the repository root:
```bash
rm -rf packages/i18n/src/paraglide && pnpm turbo run test
```
Expected: turbo runs `@workbox/i18n#build` before `@workbox/i18n#test`; all three packages' tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/i18n pnpm-lock.yaml
git commit -s -m "feat(i18n): add czech and english messages compiled with paraglide"
```

---

### Task 7: `@workbox/cli` with `--version` and `doctor`

**Files:**
- Create: `apps/cli/package.json`, `tsconfig.json`, `turbo.json`, `src/main.ts`, `src/version.ts`, `src/home.ts`, `src/logging.ts`, `src/commands/main.ts`, `src/commands/doctor.ts`, `src/doctor/checks.ts`, `src/doctor/run-doctor.ts`, `src/doctor/report.ts`, `src/output/stdout.ts`, `src/process/command-runner.ts`
- Test: `apps/cli/test/version.test.ts`, `test/home.test.ts`, `test/checks.test.ts`, `test/run-doctor.test.ts`, `test/report.test.ts`, `test/cli.test.ts`

**Interfaces:**
- Consumes: `@workbox/observability` (`configureLogging`, `createStderrSink`, `createRotatingFileSink`, `resolveLogLevel`, `getLogger`), `@workbox/i18n` (`m`, `resolveLocale`, `Locale`).
- Produces: `CommandRunner` interface `{ run(command: readonly string[]): Promise<CommandResult> }`, `CommandResult { exitCode: number; stdout: string; stderr: string }`, `runDoctor(deps: DoctorDependencies): Promise<DoctorReport>`, `DoctorReport { version: string; checks: CheckResult[]; ok: boolean }`, `CheckResult { id: CheckId; status: 'ok' | 'warn' | 'fail'; detail: string }`, `CheckId = 'git' | 'claude-binary' | 'claude-login' | 'workbox-home'`, `resolveWorkboxHome(env)`, `resolveVersion()`.

- [ ] **Step 1: Create the manifest, tsconfig and turbo tag**

`apps/cli/package.json`:
```json
{
  "name": "@workbox/cli",
  "version": "0.0.0",
  "private": true,
  "description": "The workbox command: CLI, daemon and web server in one Bun binary.",
  "type": "module",
  "exports": {
    ".": "./src/main.ts"
  },
  "scripts": {
    "build:binaries": "bun run scripts/build-binaries.ts",
    "dev": "bun run --watch src/main.ts",
    "test": "bun test",
    "test:binary": "bun test binary",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@workbox/i18n": "workspace:*",
    "@workbox/observability": "workspace:*",
    "citty": "catalog:"
  },
  "devDependencies": {
    "@types/bun": "catalog:",
    "typescript": "catalog:"
  }
}
```

`apps/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun"]
  },
  "include": ["src", "test", "scripts"]
}
```

`apps/cli/turbo.json`:
```json
{
  "extends": ["//"],
  "tags": ["app-cli"],
  "tasks": {
    "build:binaries": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

- [ ] **Step 2: Write the failing unit tests**

`apps/cli/test/version.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';

import { DEV_VERSION, resolveVersion } from '../src/version.ts';

describe('resolveVersion', () => {
  test('falls back to the development version when no build-time define exists', () => {
    expect(resolveVersion()).toBe(DEV_VERSION);
    expect(DEV_VERSION).toBe('0.0.0-dev');
  });
});
```

`apps/cli/test/home.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { resolveWorkboxHome } from '../src/home.ts';

describe('resolveWorkboxHome', () => {
  test('defaults to ~/.workbox', () => {
    expect(resolveWorkboxHome({})).toBe(join(homedir(), '.workbox'));
  });

  test('honours WORKBOX_HOME', () => {
    expect(resolveWorkboxHome({ WORKBOX_HOME: '/tmp/wb' })).toBe('/tmp/wb');
  });

  test('ignores an empty WORKBOX_HOME', () => {
    expect(resolveWorkboxHome({ WORKBOX_HOME: '   ' })).toBe(join(homedir(), '.workbox'));
  });
});
```

`apps/cli/test/checks.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  checkClaudeBinary,
  checkClaudeLogin,
  checkGit,
  checkWorkboxHome,
  parseClaudeVersion,
  parseGitVersion,
  readConfigDirectory,
} from '../src/doctor/checks.ts';
import type { CommandResult, CommandRunner } from '../src/process/command-runner.ts';

function runnerReturning(results: Record<string, CommandResult>): CommandRunner {
  return {
    run: (command) => {
      const key = command.join(' ');
      const result = results[key];
      return Promise.resolve(result ?? { exitCode: 127, stdout: '', stderr: `not found: ${key}` });
    },
  };
}

describe('parsers', () => {
  test('parseGitVersion accepts plain and suffixed output', () => {
    expect(parseGitVersion('git version 2.51.0\n')).toBe('2.51.0');
    expect(parseGitVersion('git version 2.51.0.windows.1')).toBe('2.51.0');
    expect(parseGitVersion('zsh: command not found: git')).toBeNull();
  });

  test('parseClaudeVersion reads the leading semver', () => {
    expect(parseClaudeVersion('2.1.285 (Claude Code)\n')).toBe('2.1.285');
    expect(parseClaudeVersion('')).toBeNull();
  });

  test('readConfigDirectory tolerates non-JSON output', () => {
    expect(readConfigDirectory('{"configDirectory":"/Users/x/.claude"}')).toBe('/Users/x/.claude');
    expect(readConfigDirectory('Logged in')).toBeNull();
    expect(readConfigDirectory('{"other":1}')).toBeNull();
  });
});

describe('checks', () => {
  test('git ok', async () => {
    const runner = runnerReturning({ 'git --version': { exitCode: 0, stdout: 'git version 2.51.0', stderr: '' } });
    expect(await checkGit(runner)).toEqual({ id: 'git', status: 'ok', detail: '2.51.0' });
  });

  test('git missing is a failure', async () => {
    const result = await checkGit(runnerReturning({}));
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('git');
  });

  test('claude binary missing is a warning', async () => {
    const result = await checkClaudeBinary(runnerReturning({}));
    expect(result).toMatchObject({ id: 'claude-binary', status: 'warn' });
  });

  test('claude login uses the exit code as the source of truth', async () => {
    const loggedIn = runnerReturning({ 'claude auth status': { exitCode: 0, stdout: 'Logged in', stderr: '' } });
    expect(await checkClaudeLogin(loggedIn)).toEqual({ id: 'claude-login', status: 'ok', detail: 'logged in' });
    const loggedOut = runnerReturning({ 'claude auth status': { exitCode: 1, stdout: '', stderr: '' } });
    expect((await checkClaudeLogin(loggedOut)).status).toBe('warn');
  });

  test('workbox home is created when missing', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-home-'));
    const home = join(base, 'nested', '.workbox');
    expect(await checkWorkboxHome(home)).toEqual({ id: 'workbox-home', status: 'ok', detail: home });
  });

  test('workbox home that is a file fails with the path and the OS error', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-home-'));
    const file = join(base, 'not-a-directory');
    await writeFile(file, 'x');
    const result = await checkWorkboxHome(file);
    expect(result.status).toBe('fail');
    expect(result.detail).toContain(file);
  });
});
```

`apps/cli/test/run-doctor.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDoctor } from '../src/doctor/run-doctor.ts';
import type { CommandResult, CommandRunner } from '../src/process/command-runner.ts';

function runnerReturning(results: Record<string, CommandResult>): CommandRunner {
  return {
    run: (command) =>
      Promise.resolve(results[command.join(' ')] ?? { exitCode: 127, stdout: '', stderr: 'not found' }),
  };
}

describe('runDoctor', () => {
  test('all green', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-doctor-'));
    const report = await runDoctor({
      runner: runnerReturning({
        'git --version': { exitCode: 0, stdout: 'git version 2.51.0', stderr: '' },
        'claude --version': { exitCode: 0, stdout: '2.1.285 (Claude Code)', stderr: '' },
        'claude auth status': { exitCode: 0, stdout: '{"configDirectory":"/home/u/.claude"}', stderr: '' },
      }),
      env: { WORKBOX_HOME: home },
      version: '1.2.3',
    });
    expect(report.version).toBe('1.2.3');
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.status)).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  test('missing claude skips the login check but does not fail the report', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-doctor-'));
    const report = await runDoctor({
      runner: runnerReturning({ 'git --version': { exitCode: 0, stdout: 'git version 2.51.0', stderr: '' } }),
      env: { WORKBOX_HOME: home },
      version: '1.2.3',
    });
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => `${check.id}:${check.status}`)).toEqual([
      'git:ok',
      'claude-binary:warn',
      'claude-login:warn',
      'workbox-home:ok',
    ]);
  });

  test('missing git fails the report', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-doctor-'));
    const report = await runDoctor({ runner: runnerReturning({}), env: { WORKBOX_HOME: home }, version: '1.2.3' });
    expect(report.ok).toBe(false);
  });
});
```

`apps/cli/test/report.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';

import { formatDoctorReport } from '../src/doctor/report.ts';
import type { DoctorReport } from '../src/doctor/run-doctor.ts';

const report: DoctorReport = {
  version: '1.2.3',
  ok: false,
  checks: [
    { id: 'git', status: 'ok', detail: '2.51.0' },
    { id: 'claude-binary', status: 'warn', detail: 'not found' },
    { id: 'claude-login', status: 'warn', detail: 'skipped' },
    { id: 'workbox-home', status: 'fail', detail: '/x: EACCES' },
  ],
};

describe('formatDoctorReport', () => {
  test('English', () => {
    const text = formatDoctorReport(report, 'en');
    expect(text).toContain('Workbox doctor 1.2.3');
    expect(text).toContain('✓ git: 2.51.0');
    expect(text).toContain('! Claude Code binary: not found');
    expect(text).toContain('✗ Workbox home directory: /x: EACCES');
    expect(text).toContain('1 of 4 checks passed');
    expect(text).toContain('Install Claude Code');
  });

  test('Czech', () => {
    const text = formatDoctorReport(report, 'cs');
    expect(text).toContain('Workbox doktor 1.2.3');
    expect(text).toContain('Prošlo 1 z 4 kontrol');
  });
});
```

`apps/cli/test/cli.test.ts` (subprocess tests; Review Focus items 4 and 5):
```ts
import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cliRoot = join(import.meta.dir, '..');

async function runCli(args: string[], env: Record<string, string>) {
  const proc = Bun.spawn(['bun', 'run', 'src/main.ts', ...args], {
    cwd: cliRoot,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  return { stdout, stderr, exitCode };
}

describe('workbox', () => {
  test('--version prints the development version', async () => {
    const result = await runCli(['--version'], {});
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('0.0.0-dev');
  });

  test('doctor --json --debug keeps stdout pure JSON and logs to stderr', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-cli-'));
    const result = await runCli(['doctor', '--json', '--debug'], { WORKBOX_HOME: home });
    const parsed = JSON.parse(result.stdout) as { version: string; ok: boolean; checks: unknown[] };
    expect(parsed.version).toBe('0.0.0-dev');
    expect(parsed.checks).toHaveLength(4);
    expect(result.stderr).toContain('doctor');
  });

  test('doctor with an unwritable home exits 1 and still prints JSON', async () => {
    const base = await mkdtemp(join(tmpdir(), 'workbox-cli-'));
    const file = join(base, 'file-as-home');
    await writeFile(file, 'x');
    const result = await runCli(['doctor', '--json', '--debug'], { WORKBOX_HOME: file });
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as { ok: boolean };
    expect(parsed.ok).toBe(false);
  });

  test('doctor honours WORKBOX_LOCALE', async () => {
    const home = await mkdtemp(join(tmpdir(), 'workbox-cli-'));
    const result = await runCli(['doctor'], { WORKBOX_HOME: home, WORKBOX_LOCALE: 'cs' });
    expect(result.stdout).toContain('Workbox doktor');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
pnpm install && cd apps/cli && bun test
```
Expected: FAIL on missing modules.

- [ ] **Step 4: Implement the leaf modules**

`apps/cli/src/version.ts`:
```ts
declare const WORKBOX_VERSION: string | undefined;

export const DEV_VERSION = '0.0.0-dev';

/** `bun build --define WORKBOX_VERSION='"x.y.z"'` injects the release version; `bun run` has no define. */
export function resolveVersion(): string {
  return typeof WORKBOX_VERSION === 'string' && WORKBOX_VERSION.length > 0 ? WORKBOX_VERSION : DEV_VERSION;
}
```

`apps/cli/src/home.ts`:
```ts
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { EnvLike } from '@workbox/observability';

export function resolveWorkboxHome(env: EnvLike): string {
  const configured = env['WORKBOX_HOME']?.trim();
  return configured !== undefined && configured !== '' ? configured : join(homedir(), '.workbox');
}
```

`apps/cli/src/output/stdout.ts` (the only module allowed to use `console`):
```ts
export function writeLine(text: string): void {
  console.log(text);
}
```

`apps/cli/src/process/command-runner.ts`:
```ts
export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CommandRunner {
  run(command: readonly string[]): Promise<CommandResult>;
}

export const bunCommandRunner: CommandRunner = {
  async run(command) {
    try {
      const proc = Bun.spawn([...command], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
      return { exitCode, stdout, stderr };
    } catch (error) {
      return { exitCode: 127, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
    }
  },
};
```

- [ ] **Step 5: Implement the doctor**

`apps/cli/src/doctor/checks.ts`:
```ts
import { access, constants, mkdir } from 'node:fs/promises';

import type { CommandRunner } from '../process/command-runner.ts';

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type CheckId = 'git' | 'claude-binary' | 'claude-login' | 'workbox-home';

export interface CheckResult {
  readonly id: CheckId;
  readonly status: CheckStatus;
  readonly detail: string;
}

export function parseGitVersion(output: string): string | null {
  return /git version (\d+\.\d+\.\d+)/.exec(output)?.[1] ?? null;
}

export function parseClaudeVersion(output: string): string | null {
  return /(\d+\.\d+\.\d+)/.exec(output)?.[1] ?? null;
}

/** `claude auth status` prints JSON with `configDirectory` on v2.1.268+; older CLIs print text. The exit code decides. */
export function readConfigDirectory(stdout: string): string | null {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (typeof parsed === 'object' && parsed !== null && 'configDirectory' in parsed) {
      const value = parsed.configDirectory;
      return typeof value === 'string' ? value : null;
    }
  } catch {
    // Non-JSON output from an older CLI: nothing to read.
  }
  return null;
}

export async function checkGit(runner: CommandRunner): Promise<CheckResult> {
  const result = await runner.run(['git', '--version']);
  const version = result.exitCode === 0 ? parseGitVersion(result.stdout) : null;
  if (version === null) {
    return { id: 'git', status: 'fail', detail: result.stderr.trim() || 'git not found' };
  }
  return { id: 'git', status: 'ok', detail: version };
}

export async function checkClaudeBinary(runner: CommandRunner): Promise<CheckResult> {
  const result = await runner.run(['claude', '--version']);
  const version = result.exitCode === 0 ? parseClaudeVersion(result.stdout) : null;
  if (version === null) {
    return { id: 'claude-binary', status: 'warn', detail: result.stderr.trim() || 'not found' };
  }
  return { id: 'claude-binary', status: 'ok', detail: version };
}

export async function checkClaudeLogin(runner: CommandRunner): Promise<CheckResult> {
  const result = await runner.run(['claude', 'auth', 'status']);
  if (result.exitCode === 0) {
    return { id: 'claude-login', status: 'ok', detail: readConfigDirectory(result.stdout) ?? 'logged in' };
  }
  return { id: 'claude-login', status: 'warn', detail: 'not logged in' };
}

export async function checkWorkboxHome(home: string): Promise<CheckResult> {
  try {
    await mkdir(home, { recursive: true });
    await access(home, constants.W_OK);
    return { id: 'workbox-home', status: 'ok', detail: home };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { id: 'workbox-home', status: 'fail', detail: `${home}: ${reason}` };
  }
}
```

`apps/cli/src/doctor/run-doctor.ts`:
```ts
import type { EnvLike } from '@workbox/observability';

import { resolveWorkboxHome } from '../home.ts';
import type { CommandRunner } from '../process/command-runner.ts';
import { checkClaudeBinary, checkClaudeLogin, checkGit, checkWorkboxHome, type CheckResult } from './checks.ts';

export interface DoctorReport {
  readonly version: string;
  readonly checks: readonly CheckResult[];
  readonly ok: boolean;
}

export interface DoctorDependencies {
  readonly runner: CommandRunner;
  readonly env: EnvLike;
  readonly version: string;
}

export async function runDoctor(deps: DoctorDependencies): Promise<DoctorReport> {
  const git = await checkGit(deps.runner);
  const claudeBinary = await checkClaudeBinary(deps.runner);
  const claudeLogin: CheckResult =
    claudeBinary.status === 'ok'
      ? await checkClaudeLogin(deps.runner)
      : { id: 'claude-login', status: 'warn', detail: 'skipped: Claude Code binary not found' };
  const home = await checkWorkboxHome(resolveWorkboxHome(deps.env));
  const checks = [git, claudeBinary, claudeLogin, home];
  return { version: deps.version, checks, ok: checks.every((check) => check.status !== 'fail') };
}
```

`apps/cli/src/doctor/report.ts`:
```ts
import { m, type Locale } from '@workbox/i18n';

import type { CheckId, CheckResult, CheckStatus } from './checks.ts';
import type { DoctorReport } from './run-doctor.ts';

const SYMBOLS: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✗' };

function label(id: CheckId, locale: Locale): string {
  switch (id) {
    case 'git':
      return m.cli_doctor_check_git({}, { locale });
    case 'claude-binary':
      return m.cli_doctor_check_claude_binary({}, { locale });
    case 'claude-login':
      return m.cli_doctor_check_claude_login({}, { locale });
    case 'workbox-home':
      return m.cli_doctor_check_workbox_home({}, { locale });
  }
}

function hints(checks: readonly CheckResult[], locale: Locale): string[] {
  const out: string[] = [];
  if (checks.some((check) => check.id === 'claude-binary' && check.status !== 'ok')) {
    out.push(m.cli_doctor_hint_install_claude({}, { locale }));
  } else if (checks.some((check) => check.id === 'claude-login' && check.status !== 'ok')) {
    out.push(m.cli_doctor_hint_login({}, { locale }));
  }
  return out;
}

export function formatDoctorReport(report: DoctorReport, locale: Locale): string {
  const passed = report.checks.filter((check) => check.status === 'ok').length;
  const lines = [
    `${m.cli_doctor_title({}, { locale })} ${report.version}`,
    ...report.checks.map((check) => `${SYMBOLS[check.status]} ${label(check.id, locale)}: ${check.detail}`),
    m.cli_doctor_summary({ passed: String(passed), total: String(report.checks.length) }, { locale }),
    ...hints(report.checks, locale),
  ];
  return lines.join('\n');
}
```

- [ ] **Step 6: Implement logging setup and the commands**

`apps/cli/src/logging.ts`:
```ts
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  configureLogging,
  createRotatingFileSink,
  createStderrSink,
  getLogger,
  resolveLogLevel,
  type EnvLike,
  type Sink,
} from '@workbox/observability';

export interface CliLoggingOptions {
  readonly debug: boolean;
  readonly env: EnvLike;
  readonly home: string;
}

/** Stderr always; a rotating JSONL file under WORKBOX_HOME/logs only in debug mode, and never fatally. */
export async function configureCliLogging(options: CliLoggingOptions): Promise<void> {
  const { level } = resolveLogLevel(options.env, options.debug);
  const sinks: Record<string, Sink> = { stderr: createStderrSink({ pretty: Boolean(process.stderr.isTTY) }) };
  let fileSinkError: string | null = null;
  if (level === 'debug') {
    try {
      const logsDir = join(options.home, 'logs');
      await mkdir(logsDir, { recursive: true });
      sinks['file'] = createRotatingFileSink(join(logsDir, 'workbox.log'));
    } catch (error) {
      fileSinkError = error instanceof Error ? error.message : String(error);
    }
  }
  await configureLogging({ level, sinks });
  if (fileSinkError !== null) {
    getLogger(['cli']).warning('debug log file disabled: {reason}', { reason: fileSinkError });
  }
}
```

`apps/cli/src/commands/doctor.ts`:
```ts
import { defineCommand } from 'citty';
import { resolveLocale } from '@workbox/i18n';
import { getLogger } from '@workbox/observability';

import { formatDoctorReport } from '../doctor/report.ts';
import { runDoctor } from '../doctor/run-doctor.ts';
import { resolveWorkboxHome } from '../home.ts';
import { configureCliLogging } from '../logging.ts';
import { writeLine } from '../output/stdout.ts';
import { bunCommandRunner } from '../process/command-runner.ts';
import { resolveVersion } from '../version.ts';

export const doctorCommand = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Check that git, Claude Code and the Workbox home directory are ready',
  },
  args: {
    json: { type: 'boolean', description: 'Print the report as JSON', default: false },
    debug: { type: 'boolean', description: 'Verbose logging on stderr (same as WORKBOX_DEBUG=1)', default: false },
  },
  async run({ args }) {
    const env = process.env;
    await configureCliLogging({ debug: args.debug, env, home: resolveWorkboxHome(env) });
    const logger = getLogger(['cli', 'doctor']);
    logger.debug('running doctor checks');
    const report = await runDoctor({ runner: bunCommandRunner, env, version: resolveVersion() });
    writeLine(args.json ? JSON.stringify(report) : formatDoctorReport(report, resolveLocale(env)));
    logger.debug('doctor finished {ok}', { ok: report.ok });
    process.exitCode = report.ok ? 0 : 1;
  },
});
```

`apps/cli/src/commands/main.ts`:
```ts
import { defineCommand } from 'citty';

import { resolveVersion } from '../version.ts';
import { doctorCommand } from './doctor.ts';

export const mainCommand = defineCommand({
  meta: {
    name: 'workbox',
    version: resolveVersion(),
    description: 'Workbox: AI coding agents as a pixel-art office',
  },
  subCommands: {
    doctor: doctorCommand,
  },
});
```

`apps/cli/src/main.ts`:
```ts
import { runMain } from 'citty';

import { mainCommand } from './commands/main.ts';

await runMain(mainCommand);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run:
```bash
cd apps/cli && bun test && pnpm run typecheck && cd ../.. && pnpm run lint && pnpm run format:check
```
Expected: all tests pass (git is installed on the machine; the Claude checks may be `warn`); type check and lint clean. If citty does not print `meta.version` for `--version`, add `version: { type: 'boolean' }` handling in `mainCommand.run` that calls `writeLine(resolveVersion())`.

- [ ] **Step 8: Try the command by hand**

Run:
```bash
cd apps/cli && bun run src/main.ts doctor && WORKBOX_LOCALE=cs bun run src/main.ts doctor
```
Expected: a report in English, then in Czech, with `✓`, `!`, `✗` symbols and the summary line.

- [ ] **Step 9: Commit**

```bash
git add apps/cli pnpm-lock.yaml
git commit -s -m "feat(cli): add workbox doctor and version commands"
```

---

### Task 8: Compiled binaries for eight targets

**Files:**
- Create: `apps/cli/scripts/build-binaries.ts`, `apps/cli/src/build-targets.ts`, `apps/cli/test/build-targets.test.ts`, `apps/cli/test/binary.test.ts`
- Modify: root `package.json` (script `build:binaries`)

**Interfaces:**
- Produces: `BUILD_TARGETS`, `isBuildTarget(value): value is BuildTarget`, `outfileFor(target): string`, `buildCommand(target, version, entry): string[]`, `hostTarget(): BuildTarget`; binaries in `apps/cli/dist/workbox-<os>-<arch>[-musl][.exe]`.

- [ ] **Step 1: Write the failing tests**

`apps/cli/test/build-targets.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';

import { BUILD_TARGETS, buildCommand, hostTarget, isBuildTarget, outfileFor } from '../src/build-targets.ts';

describe('build targets', () => {
  test('lists the eight verified Bun targets', () => {
    expect([...BUILD_TARGETS].sort()).toEqual([
      'bun-darwin-arm64',
      'bun-darwin-x64',
      'bun-linux-arm64',
      'bun-linux-arm64-musl',
      'bun-linux-x64',
      'bun-linux-x64-musl',
      'bun-windows-arm64',
      'bun-windows-x64',
    ]);
  });

  test('isBuildTarget rejects unknown and baseline aliases', () => {
    expect(isBuildTarget('bun-linux-x64')).toBe(true);
    expect(isBuildTarget('bun-linux-x64-baseline')).toBe(false);
    expect(isBuildTarget('linux')).toBe(false);
  });

  test('outfileFor strips the bun prefix and adds .exe on Windows', () => {
    expect(outfileFor('bun-linux-x64-musl')).toBe('dist/workbox-linux-x64-musl');
    expect(outfileFor('bun-windows-arm64')).toBe('dist/workbox-windows-arm64.exe');
  });

  test('buildCommand injects the version define', () => {
    const command = buildCommand('bun-darwin-arm64', '1.2.3', 'src/main.ts');
    expect(command.slice(0, 3)).toEqual(['bun', 'build', 'src/main.ts']);
    expect(command).toContain('--compile');
    expect(command).toContain('--target=bun-darwin-arm64');
    expect(command).toContain('WORKBOX_VERSION="1.2.3"');
    expect(command.at(-1)).toBe('dist/workbox-darwin-arm64');
  });

  test('hostTarget matches the running platform', () => {
    expect(isBuildTarget(hostTarget())).toBe(true);
    expect(hostTarget()).toContain(process.arch === 'arm64' ? 'arm64' : 'x64');
  });
});
```

`apps/cli/test/binary.test.ts` (slow: compiles the host target, so it is skipped unless `WORKBOX_BINARY_TEST=1`; `pnpm run test:binary` narrows `bun test` to this file):
```ts
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { buildCommand, hostTarget, outfileFor } from '../src/build-targets.ts';

const cliRoot = join(import.meta.dir, '..');

describe.skipIf(process.env['WORKBOX_BINARY_TEST'] !== '1')('compiled binary', () => {
  test('--version prints the injected version', async () => {
    const target = hostTarget();
    const build = Bun.spawn(buildCommand(target, '9.9.9-test', 'src/main.ts'), { cwd: cliRoot, stdout: 'inherit', stderr: 'inherit' });
    expect(await build.exited).toBe(0);
    const run = Bun.spawn([join(cliRoot, outfileFor(target)), '--version'], { cwd: cliRoot, stdout: 'pipe', stderr: 'pipe' });
    const [stdout, exitCode] = await Promise.all([run.stdout.text(), run.exited]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('9.9.9-test');
  }, 120_000);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd apps/cli && bun test test/build-targets.test.ts
```
Expected: FAIL, `Cannot find module '../src/build-targets.ts'`.

- [ ] **Step 3: Implement**

`apps/cli/src/build-targets.ts` (targets verified in R10 §10.1):
```ts
import { posix } from 'node:path';

export const BUILD_TARGETS = [
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-linux-x64-musl',
  'bun-linux-arm64-musl',
  'bun-darwin-x64',
  'bun-darwin-arm64',
  'bun-windows-x64',
  'bun-windows-arm64',
] as const;

export type BuildTarget = (typeof BUILD_TARGETS)[number];

export function isBuildTarget(value: string): value is BuildTarget {
  return (BUILD_TARGETS as readonly string[]).includes(value);
}

export function outfileFor(target: BuildTarget): string {
  const suffix = target.startsWith('bun-windows') ? '.exe' : '';
  // POSIX separators on purpose: `bun build --outfile` accepts them on Windows and the tests assert them.
  return posix.join('dist', `workbox-${target.replace(/^bun-/, '')}${suffix}`);
}

export function buildCommand(target: BuildTarget, version: string, entry: string): string[] {
  return [
    'bun',
    'build',
    entry,
    '--compile',
    '--minify',
    '--sourcemap',
    `--target=${target}`,
    '--define',
    `WORKBOX_VERSION="${version}"`,
    '--outfile',
    outfileFor(target),
  ];
}

export function hostTarget(): BuildTarget {
  let os = 'linux';
  if (process.platform === 'darwin') {
    os = 'darwin';
  } else if (process.platform === 'win32') {
    os = 'windows';
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const candidate = `bun-${os}-${arch}`;
  if (!isBuildTarget(candidate)) {
    throw new Error(`Unsupported host platform ${process.platform}/${process.arch}`);
  }
  return candidate;
}
```

`apps/cli/scripts/build-binaries.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BUILD_TARGETS, buildCommand, isBuildTarget, type BuildTarget } from '../src/build-targets.ts';

const cliRoot = join(import.meta.dir, '..');
const rootPackageJson = join(cliRoot, '..', '..', 'package.json');

function requestedTargets(argv: readonly string[]): BuildTarget[] {
  if (argv.length === 0) {
    return [...BUILD_TARGETS];
  }
  return argv.map((value) => {
    if (!isBuildTarget(value)) {
      throw new Error(`Unknown target "${value}". Known targets: ${BUILD_TARGETS.join(', ')}`);
    }
    return value;
  });
}

const { version } = JSON.parse(await readFile(rootPackageJson, 'utf8')) as { version: string };
for (const target of requestedTargets(process.argv.slice(2))) {
  const proc = Bun.spawn(buildCommand(target, version, 'src/main.ts'), { cwd: cliRoot, stdout: 'inherit', stderr: 'inherit' });
  if ((await proc.exited) !== 0) {
    throw new Error(`bun build failed for ${target}`);
  }
}
```

Add to root `package.json` `scripts`:
```json
"build:binaries": "pnpm --filter @workbox/cli run build:binaries"
```

- [ ] **Step 4: Run the tests and a real build**

Run:
```bash
cd apps/cli && bun test && WORKBOX_BINARY_TEST=1 pnpm run test:binary && cd ../.. && pnpm run build:binaries && ls -la apps/cli/dist
```
Expected: unit tests pass (the binary test reports as skipped in the first run and passes in the second); `dist/` contains eight files named `workbox-linux-x64`, `workbox-linux-arm64`, `workbox-linux-x64-musl`, `workbox-linux-arm64-musl`, `workbox-darwin-x64`, `workbox-darwin-arm64`, `workbox-windows-x64.exe`, `workbox-windows-arm64.exe`, each roughly 60 to 90 MB.

Run:
```bash
./apps/cli/dist/workbox-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/') doctor
```
Expected: the doctor report from the compiled binary, version `0.0.0`.

- [ ] **Step 5: Commit**

```bash
git add apps/cli package.json
git commit -s -m "build(cli): compile workbox binaries for eight bun targets"
```

---

### Task 9: `@workbox/web` React skeleton with Vitest browser mode

**Files:**
- Create: `apps/web/package.json`, `tsconfig.json`, `turbo.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `src/main.tsx`, `src/app.tsx`, `src/index.css`, `src/test-setup.ts`
- Test: `apps/web/src/app.test.tsx`

**Interfaces:**
- Consumes: `m` from `@workbox/i18n`.
- Produces: `App` component rendering the product title; `vite build` output in `apps/web/dist` (embedded into the binary in plan 2).

- [ ] **Step 1: Create the manifest, tsconfig and turbo tag**

`apps/web/package.json`:
```json
{
  "name": "@workbox/web",
  "version": "0.0.0",
  "private": true,
  "description": "Workbox web client: dashboard, chat and the pixel-art office.",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@workbox/i18n": "workspace:*",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@babel/core": "catalog:",
    "@rolldown/plugin-babel": "catalog:",
    "@tailwindcss/vite": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "@vitest/browser-playwright": "catalog:",
    "babel-plugin-react-compiler": "catalog:",
    "playwright": "catalog:",
    "tailwindcss": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

`apps/web/turbo.json`:
```json
{
  "extends": ["//"],
  "tags": ["app-web"]
}
```

- [ ] **Step 2: Write the failing test**

`apps/web/src/test-setup.ts`:
```ts
declare global {
  // React's act() requires this flag outside of a test renderer.
  // oxlint-disable-next-line no-var: a global augmentation must use var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
```

`apps/web/src/app.test.tsx`:
```tsx
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test } from 'vitest';

import { App } from './app.tsx';

afterEach(() => {
  document.body.innerHTML = '';
});

test('renders the product title', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    createRoot(container).render(<App />);
  });
  expect(container.querySelector('h1')?.textContent).toBe('Workbox');
});
```

`apps/web/vitest.config.ts` (R10 §11.2):
```ts
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

- [ ] **Step 3: Install browsers and run the test to verify it fails**

Run:
```bash
pnpm install && cd apps/web && pnpm exec playwright install chromium && pnpm run test
```
Expected: FAIL, `Failed to resolve import "./app.tsx"`.

- [ ] **Step 4: Implement the skeleton**

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Workbox</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/index.css`:
```css
@import 'tailwindcss';
```

`apps/web/src/app.tsx`:
```tsx
import { m } from '@workbox/i18n';

export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <h1 className="text-4xl font-semibold tracking-tight">{m.app_title()}</h1>
    </main>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import './index.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Missing #root element');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`apps/web/vite.config.ts` (R10 §11.1, stable React Compiler path):
```ts
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  build: { outDir: 'dist' },
});
```

- [ ] **Step 5: Run the test, the type check and the build**

Run:
```bash
cd apps/web && pnpm run test && pnpm run typecheck && pnpm run build && ls dist && cd ../.. && pnpm run lint && pnpm run format:check
```
Expected: 1 test passes in headless Chromium; `dist/index.html` and hashed assets exist; lint and format clean. If `act` warns about the environment flag, confirm `setupFiles` ran (the flag is set before the test module loads).

- [ ] **Step 6: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -s -m "feat(web): add react skeleton with vitest browser mode"
```

---

### Task 10: Dependency boundaries, dead code, spelling, Markdown and file-name checks

**Files:**
- Create: `knip.json`, `cspell.json`, `project-words.txt`, `.markdownlint-cli2.jsonc`, `.ls-lint.yml`
- Modify: `turbo.json` (boundaries tags), root `package.json` (scripts, devDependencies)

- [ ] **Step 1: Add the tools**

Run:
```bash
pnpm add -D -w knip cspell @cspell/dict-cs-cz markdownlint-cli2 @ls-lint/ls-lint
```

- [ ] **Step 2: Add boundaries tags to `turbo.json`** (deny lists encode spec §4.3; R10 §2.4 shape)

Add the `boundaries` key at the top level of `turbo.json`:
```json
"boundaries": {
  "tags": {
    "leaf": { "dependencies": { "deny": ["core", "adapter", "sim", "render", "app-web", "app-cli"] } },
    "core": { "dependencies": { "deny": ["adapter", "sim", "render", "app-web", "app-cli"] } },
    "sim": { "dependencies": { "deny": ["core", "adapter", "render", "app-web", "app-cli"] } },
    "adapter": { "dependencies": { "deny": ["adapter", "sim", "render", "app-web", "app-cli"] } },
    "render": { "dependencies": { "deny": ["core", "adapter", "app-web", "app-cli"] } },
    "app-web": { "dependencies": { "deny": ["core", "adapter", "app-cli"] } },
    "app-cli": {}
  }
}
```

- [ ] **Step 3: Create `knip.json`** (R10 §7)

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "ignoreDependencies": ["oxlint-tsgolint", "@cspell/dict-cs-cz", "@types/bun"],
  "workspaces": {
    ".": { "entry": ["commitlint.config.ts"], "project": ["*.ts"] },
    "packages/protocol": { "entry": ["src/index.ts", "test/**/*.test.ts"], "project": ["src/**/*.ts", "test/**/*.ts"] },
    "packages/observability": { "entry": ["src/index.ts", "test/**/*.test.ts"], "project": ["src/**/*.ts", "test/**/*.ts"] },
    "packages/i18n": {
      "entry": ["src/index.ts", "scripts/compile.ts", "test/**/*.test.ts"],
      "project": ["src/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"],
      "ignore": ["src/paraglide/**"]
    },
    "apps/cli": {
      "entry": ["src/main.ts", "scripts/build-binaries.ts", "test/**/*.test.ts"],
      "project": ["src/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"]
    },
    "apps/web": {
      "entry": ["src/main.tsx", "src/**/*.test.tsx", "src/test-setup.ts"],
      "project": ["src/**/*.{ts,tsx}"]
    }
  }
}
```

- [ ] **Step 4: Create `cspell.json` and `project-words.txt`** (R10 §8.1)

`cspell.json`:
```json
{
  "$schema": "https://raw.githubusercontent.com/streetsidesoftware/cspell/main/cspell.schema.json",
  "version": "0.2",
  "language": "en,cs",
  "import": ["@cspell/dict-cs-cz/cspell-ext.json"],
  "dictionaryDefinitions": [{ "name": "project-words", "path": "./project-words.txt", "addWords": true }],
  "dictionaries": ["project-words", "typescript", "softwareTerms", "node", "npm"],
  "ignorePaths": [
    "node_modules",
    "**/dist/**",
    "**/paraglide/**",
    "**/coverage/**",
    "pnpm-lock.yaml",
    "CHANGELOG.md",
    "CODE_OF_CONDUCT.md",
    "LICENSE",
    "docs/superpowers/research/**",
    "/project-words.txt"
  ],
  "useGitignore": true
}
```

`project-words.txt` (one word per line; extend it whenever cspell reports a legitimate term):
```
workbox
misaon
oxlint
oxfmt
tsgolint
lefthook
commitlint
paraglide
inlang
turborepo
knip
pnpm
bunfig
logtape
citty
zod
tailwindcss
vitest
rolldown
kebabcase
zizmor
gitleaks
codeql
scorecard
sarif
sha256sum
microvm
sandboxing
subagent
subagents
worktree
worktrees
```

- [ ] **Step 5: Create `.markdownlint-cli2.jsonc` and `.ls-lint.yml`** (R10 §8.2, §8.3)

`.markdownlint-cli2.jsonc`:
```jsonc
{
  "config": {
    "default": true,
    "MD013": false,
    "MD033": false,
    "MD041": false
  },
  "gitignore": true,
  "globs": ["**/*.md"],
  "ignores": ["node_modules/**", "docs/superpowers/research/**", "CHANGELOG.md", "CODE_OF_CONDUCT.md"],
  "noProgress": true
}
```

`.ls-lint.yml`:
```yaml
ls:
  .dir: kebab-case | SCREAMING_SNAKE_CASE
  .ts: kebab-case
  .tsx: kebab-case | PascalCase
  .test.ts: kebab-case
  .test.tsx: kebab-case
  .d.ts: kebab-case
  .md: kebab-case | snake_case | SCREAMING_SNAKE_CASE | regex:\d{4}-\d{2}-\d{2}-R\d{1,2}-[a-z0-9-]+

ignore:
  - .git
  - .github
  - .idea
  - .turbo
  - node_modules
  - "**/dist"
  - "**/coverage"
  - "**/paraglide"
  - "**/project.inlang"
```

- [ ] **Step 6: Add the scripts**

In root `package.json` `scripts`, add:
```json
"boundaries": "turbo boundaries",
"knip": "knip",
"spell": "cspell lint --no-progress --gitignore \"**\"",
"markdownlint": "markdownlint-cli2",
"ls-lint": "ls-lint",
"check": "pnpm run format:check && pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run boundaries && pnpm run knip && pnpm run spell && pnpm run markdownlint && pnpm run ls-lint"
```

- [ ] **Step 7: Run every check and fix findings**

Run:
```bash
pnpm run check
```
Expected: every step exits 0. Typical first-run findings and their fixes: unknown words → add to `project-words.txt`; knip "unused export" → remove the export or add it to the entry list if it is public API; markdownlint findings in `docs/superpowers/specs` → fix the Markdown (do not disable rules per file).

- [ ] **Step 8: Negative check for boundaries**

Add `"@workbox/cli": "workspace:*"` to `apps/web/package.json` dependencies, run `pnpm install`, add `import '@workbox/cli';` to `apps/web/src/main.tsx`, run `pnpm run boundaries`. Expected: FAIL naming the `app-web` → `app-cli` tag violation. Revert both edits and `pnpm install`; `pnpm run boundaries` exits 0 again.

- [ ] **Step 9: Commit**

```bash
git add turbo.json knip.json cspell.json project-words.txt .markdownlint-cli2.jsonc .ls-lint.yml package.json pnpm-lock.yaml
git add -u
git commit -s -m "build: enforce boundaries, dead code, spelling, markdown and file-name rules"
```

---

### Task 11: CI workflow and PR title check

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/pr-title.yml`

Every `uses:` line below is copied from R11 §1 (tag → SHA resolved 2026-09-30). Expressions never appear inside `run:`; values go through `env:` so zizmor's template-injection audit stays quiet.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: ci

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

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  static:
    runs-on: ubuntu-26.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          fetch-depth: 0
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .node-version
          cache: pnpm
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version-file: .bun-version
      - run: pnpm install --frozen-lockfile
      - run: pnpm run format:check
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run boundaries
      - run: pnpm run knip
      - run: pnpm run spell
      - run: pnpm run markdownlint
      - run: pnpm run ls-lint
      - name: Validate PR commits with commitlint
        if: github.event_name == 'pull_request'
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: pnpm exec commitlint --from "$BASE_SHA" --to "$HEAD_SHA" --verbose
      - name: Download actionlint
        id: get_actionlint
        run: bash <(curl -fsSL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) 1.7.12
      - name: Check workflow files
        env:
          ACTIONLINT: ${{ steps.get_actionlint.outputs.executable }}
        run: "$ACTIONLINT" -color

  test-daemon:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-26.04, macos-26, windows-2025]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .node-version
          cache: pnpm
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version-file: .bun-version
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run test --filter='./packages/*' --filter='./apps/cli'

  test-web:
    runs-on: ubuntu-26.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .node-version
          cache: pnpm
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version-file: .bun-version
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm exec playwright install --with-deps chromium
        working-directory: apps/web
      - run: pnpm turbo run test --filter='./apps/web'

  build:
    runs-on: ubuntu-26.04
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .node-version
          cache: pnpm
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version-file: .bun-version
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build
      - name: Compile and run the host binary test
        env:
          WORKBOX_BINARY_TEST: '1'
        run: pnpm --filter @workbox/cli run test:binary
      - run: pnpm run build:binaries
      - name: Smoke test the Linux binary
        run: ./apps/cli/dist/workbox-linux-x64 --version && ./apps/cli/dist/workbox-linux-x64 doctor --json
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: workbox-binaries
          path: apps/cli/dist/
          if-no-files-found: error
          retention-days: 7
```

- [ ] **Step 2: Create `.github/workflows/pr-title.yml`** (R11 §7e; `pull_request` instead of `pull_request_target` because the action needs no repository config and zizmor flags the latter as a dangerous trigger)

```yaml
name: pr-title

on:
  pull_request:
    types: [opened, reopened, edited, synchronize]

permissions: {}

jobs:
  validate:
    name: Validate PR title
    runs-on: ubuntu-slim
    timeout-minutes: 5
    permissions:
      pull-requests: read
    steps:
      - uses: amannn/action-semantic-pull-request@48f256284bd46cdaab1048c3721360e808335d50 # v6.1.1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Lint the workflows locally**

Run:
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) 1.7.12 /tmp && /tmp/actionlint -color && pnpm run check
```
Expected: actionlint prints nothing; `pnpm run check` still green (the workflow YAML is formatted by oxfmt and spell-checked; add words such as `actionlint`, `amannn`, `softprops` to `project-words.txt` if reported).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/pr-title.yml project-words.txt
git commit -s -m "ci: add lint, test, build and pr title workflows"
```

---

### Task 12: Releases with release-please, provenance and GitHub Release assets

**Files:**
- Create: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`

- [ ] **Step 1: Create the release-please files** (R11 §5b; the manifest starts at `0.0.0` so the first `feat:` on `main` produces `v0.1.0`)

`release-please-config.json`:
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

`.release-please-manifest.json`:
```json
{
  ".": "0.0.0"
}
```

- [ ] **Step 2: Create `.github/workflows/release.yml`** (R11 §5c and §7c, with pnpm and our build script)

```yaml
name: release

on:
  push:
    branches: [main]

permissions: {}

concurrency:
  group: release-${{ github.ref }}

defaults:
  run:
    shell: bash

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
      contents: write
      id-token: write
      attestations: write
      artifact-metadata: write
    env:
      TAG: ${{ needs.release-please.outputs.tag_name }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ needs.release-please.outputs.tag_name }}
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .node-version
          # no dependency cache here: release artefacts must not be built from a poisonable cache (zizmor cache-poisoning)
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version-file: .bun-version
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build
      - run: pnpm run build:binaries
      - name: Checksums
        run: cd apps/cli/dist && sha256sum workbox-* > "workbox_${TAG#v}_checksums.txt"
      - uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
        with:
          subject-path: apps/cli/dist/workbox-*
      - name: Upload release assets
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release upload "$TAG" apps/cli/dist/* --clobber
```

- [ ] **Step 3: Verify locally**

Run:
```bash
/tmp/actionlint -color && pnpm run check
```
Expected: clean. (The `actions/attest` glob `subject-path` covers the eight binaries; the checksum file is uploaded as a plain asset.)

- [ ] **Step 4: Commit**

```bash
git add release-please-config.json .release-please-manifest.json .github/workflows/release.yml project-words.txt
git commit -s -m "ci: add release-please with provenance and github release assets"
```

---

### Task 13: Security automation and dependency updates

**Files:**
- Create: `.github/workflows/scorecard.yml`, `.github/workflows/zizmor.yml`, `.github/workflows/gitleaks.yml`, `renovate.json`

- [ ] **Step 1: Create `.github/workflows/scorecard.yml`** (R11 §7a verbatim; the Scorecard job is the only one allowed `id-token: write`)

```yaml
name: scorecard

on:
  push:
    branches: [main]
  schedule:
    - cron: '30 1 * * 6'

permissions: read-all

jobs:
  analysis:
    name: Scorecard analysis
    runs-on: ubuntu-26.04
    timeout-minutes: 15
    permissions:
      security-events: write
      id-token: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc # v2.4.4
        with:
          results_file: results.sarif
          results_format: sarif
          publish_results: true
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: SARIF file
          path: results.sarif
          retention-days: 5
      - uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
        with:
          sarif_file: results.sarif
```

- [ ] **Step 2: Create `.github/workflows/zizmor.yml`** (R11 §7e; a second run in `github` format fails the job on findings)

```yaml
name: zizmor

on:
  push:
    branches: [main]
  pull_request:

permissions: {}

jobs:
  zizmor:
    runs-on: ubuntu-26.04
    timeout-minutes: 10
    permissions:
      security-events: write
      contents: read
      actions: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: zizmorcore/zizmor-action@cc914d7f3750a2d13d75c7f184a1060aa0e9d482 # v0.6.4
        with:
          version: 1.30.1
          persona: pedantic
```

- [ ] **Step 3: Create `.github/workflows/gitleaks.yml`** (R11 §7e; personal accounts need no licence key)

```yaml
name: gitleaks

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 4 * * *'

permissions:
  contents: read

jobs:
  scan:
    runs-on: ubuntu-26.04
    timeout-minutes: 10
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e # v3.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 4: Create `renovate.json`** (R11 §6d; PR automerge through GitHub auto-merge because the ruleset requires pull requests)

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
      "matchUpdateTypes": ["minor", "patch"],
      "minimumReleaseAge": "3 days",
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "description": "GitHub Actions: automerge digest, minor and patch bumps of SHA-pinned actions",
      "matchManagers": ["github-actions"],
      "matchUpdateTypes": ["digest", "minor", "patch"],
      "automerge": true,
      "automergeType": "pr"
    }
  ]
}
```

- [ ] **Step 5: Verify and commit**

Run:
```bash
/tmp/actionlint -color && pnpm run check
```
Expected: clean.

```bash
git add .github/workflows/scorecard.yml .github/workflows/zizmor.yml .github/workflows/gitleaks.yml renovate.json project-words.txt
git commit -s -m "ci: add scorecard, zizmor, gitleaks and renovate"
```

---

### Task 14: Community and licence files

**Files:**
- Create: `LICENSE`, `NOTICE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/1-bug-report.yml`, `.github/ISSUE_TEMPLATE/2-feature-request.yml`, `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Download the licence and the code of conduct texts** (canonical sources from R11 §8)

Run:
```bash
curl -fsSL https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE
curl -fsSL https://www.contributor-covenant.org/version/3/0/code_of_conduct/code_of_conduct.md -o CODE_OF_CONDUCT.md
grep -n "NOTE" CODE_OF_CONDUCT.md
```
Expected: `LICENSE` starts with `Apache License / Version 2.0, January 2004`; the grep lists the `[NOTE: …]` placeholders in the code of conduct. Replace each with the project's answer. Reporting channel: the maintainer's contact address. The git history already publishes the commit author address, but confirm with the owner which address to print here (or create a dedicated alias) before committing. Keep the attribution paragraph untouched (CC BY-SA 4.0 requires it).

`NOTICE`:
```
Workbox
Copyright 2026 Ondřej Misák

This product includes software developed as part of the Workbox project
(https://github.com/misaon/workbox), licensed under the Apache License, Version 2.0.
```

- [ ] **Step 2: Write `CONTRIBUTING.md`**

```markdown
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

| Command | What it does |
|---|---|
| `pnpm dev` | daemon in watch mode and the Vite dev server |
| `pnpm test` | all tests (`bun test` for runtime packages, Vitest browser mode for the web client) |
| `pnpm lint` / `pnpm format` | Oxlint (type-aware) and Oxfmt |
| `pnpm build:binaries` | compile the `workbox` binary for every supported target into `apps/cli/dist` |
| `pnpm check` | the full CI suite |

## Conventions

- Conventional Commits (`feat`, `fix`, `docs`, `chore`, …) are enforced by commitlint locally and in CI. Pull requests are squash-merged, so the PR title must also be a valid Conventional Commit.
- Sign every commit off (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).
- Files and directories are kebab-case; React components may be PascalCase `.tsx` files.
- Code, comments, commits and documentation are English. User-facing strings live in `packages/i18n/messages` in English and Czech.
- Every lint-disable comment states its reason. Every architecture decision gets an ADR in `docs/adr`.
- Tests first: write the failing test, make it pass, then refactor.

## Package rules

`protocol`, `i18n` and `observability` are leaves. `core` depends only on `protocol`. Adapters (`harness-*`, `sandbox-*`, `store-*`, `server`) depend on `core` and `protocol` and never on each other. `apps/web` never depends on `core`. `apps/cli` is the only composition root. `pnpm boundaries` enforces this.

## Reporting bugs and proposing features

Use the issue forms. For anything security-related, follow `SECURITY.md` instead of opening a public issue.
```

- [ ] **Step 3: Write `SECURITY.md`**

```markdown
# Security policy

## Supported versions

Workbox is pre-1.0. Only the latest release and the `main` branch receive fixes.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting:
<https://github.com/misaon/workbox/security/advisories/new>

You will get an acknowledgement within 7 days and a fix or a mitigation plan within 30 days for confirmed reports.

## Scope

Workbox runs AI coding agents on your machine. Reports about the daemon's localhost authentication, credential handling (Workbox must never read or store vendor credentials), path traversal in the blob store or workspaces, and the compiled binaries are especially welcome.
```

- [ ] **Step 4: Write the GitHub templates**

`.github/CODEOWNERS`:
```
* @misaon
```

`.github/pull_request_template.md`:
```markdown
## What

<!-- One paragraph: what changes and why. Link the issue or the spec section. -->

## Checklist

- [ ] The PR title is a Conventional Commit (it becomes the squash commit message)
- [ ] Tests cover the change and `pnpm check` is green locally
- [ ] Commits are signed off (`git commit -s`)
- [ ] Docs, i18n messages (en and cs) and ADRs are updated where the change needs it
```

`.github/ISSUE_TEMPLATE/1-bug-report.yml`:
```yaml
name: Bug report
description: Something in Workbox does not behave as documented
title: 'bug: '
labels: [bug, triage]
body:
  - type: markdown
    attributes:
      value: Thanks for the report. Run `workbox doctor --json` and paste the output below.
  - type: input
    id: version
    attributes:
      label: Workbox version
      description: Output of `workbox --version`
      placeholder: 0.1.0
    validations:
      required: true
  - type: dropdown
    id: os
    attributes:
      label: Operating system
      options: [macOS, Linux, Windows]
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      placeholder: '1. Run … 2. Open … 3. See …'
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behaviour
    validations:
      required: true
  - type: textarea
    id: doctor
    attributes:
      label: Output of `workbox doctor --json`
      render: json
  - type: checkboxes
    id: checks
    attributes:
      label: Checks
      options:
        - label: I searched existing issues and discussions
          required: true
```

`.github/ISSUE_TEMPLATE/2-feature-request.yml`:
```yaml
name: Feature request
description: Propose an improvement or a new capability
title: 'feat: '
labels: [enhancement, triage]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What are you trying to do that Workbox makes hard today?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposal
      description: How should it work? Mention which employee, floor or CLI command it touches.
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
```

`.github/ISSUE_TEMPLATE/config.yml`:
```yaml
blank_issues_enabled: false
contact_links:
  - name: Questions and ideas
    url: https://github.com/misaon/workbox/discussions
    about: Ask questions and discuss ideas before opening an issue
```

- [ ] **Step 5: Verify and commit**

Run:
```bash
pnpm run check
```
Expected: clean (`LICENSE` and `CODE_OF_CONDUCT.md` are excluded from spelling, formatting and Markdown lint; `CODEOWNERS` has no extension and is ignored by ls-lint).

```bash
git add LICENSE NOTICE CODE_OF_CONDUCT.md CONTRIBUTING.md SECURITY.md .github/CODEOWNERS .github/pull_request_template.md .github/ISSUE_TEMPLATE project-words.txt
git commit -s -m "docs: add licence, code of conduct, contributing guide and issue templates"
```

---

### Task 15: README and architecture decision records

**Files:**
- Create: `README.md`, `docs/adr/0001-record-architecture-decisions.md` … `docs/adr/0010-claude-through-the-agent-sdk-with-the-users-own-login.md`

- [ ] **Step 1: Write `README.md`**

```markdown
<h1 align="center">Workbox</h1>

<p align="center">
  Your AI coding agents, as employees in a pixel-art office.<br />
  Local-first. Runs on your Claude and ChatGPT subscriptions. Browser, desktop and CLI from one command.
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
- **No new bills.** Workbox drives the unmodified Claude Code and Codex binaries with the logins you already have. It never reads, copies or stores vendor credentials.
- **One binary everywhere.** The same `workbox` command is the CLI, the daemon and the web server. A thin desktop shell and a phone client connect to it.
- **Built to be studied.** Append-only event log as the single source of truth, headless deterministic office simulation, vendor-neutral harness and sandbox ports, pedantic tooling.

## Quick start (today)

Download the binary for your platform from the [latest release](https://github.com/misaon/workbox/releases), make it executable and run:

```bash
./workbox doctor
```

`doctor` checks git, the Claude Code binary and its login, and the Workbox home directory (`~/.workbox`, override with `WORKBOX_HOME`). `WORKBOX_LOCALE=cs` switches the output to Czech.

On macOS the downloaded binary is quarantined until releases are notarised: `xattr -d com.apple.quarantine ./workbox-darwin-arm64`.

## Build from source

```bash
git clone git@github.com:misaon/workbox.git && cd workbox
pnpm install
pnpm build:binaries   # apps/cli/dist/workbox-<os>-<arch>
```

Prerequisites and conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture in one picture

```
 workbox (Bun binary)                                     browser (React 19)
┌───────────────────────────────────────────────┐   WS+HTTP  ┌──────────────────────────────┐
│ CLI │ daemon                                  │◄──────────►│ chat, dashboard, dialogs      │
│     │  event log (SQLite, append-only)        │  typed     │ office canvas (PixiJS)        │
│     │  session runtime                        │  events    │   ▲ snapshots                 │
│     │    port HarnessAdapter ◄─ harness-claude│            │ sim (Web Worker, headless)    │
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
```

- [ ] **Step 2: Write the ADRs** (MADR-style; each file has the same four headings)

`docs/adr/0001-record-architecture-decisions.md`:
```markdown
# 0001. Record architecture decisions

- Status: accepted
- Date: 2026-09-30

## Context

Workbox makes many bleeding-edge technology choices that were verified online at a point in time. Contributors need to know what was decided, why, and what would change the decision.

## Decision

Every decision that shapes the architecture or the toolchain gets a numbered Markdown file in `docs/adr` with the sections Context, Decision and Consequences. Superseded records stay in place with their status updated.

## Consequences

Decisions are reviewable in pull requests; the research reports in `docs/superpowers/research` are the evidence base and are linked, not copied.
```

`docs/adr/0002-one-bun-binary-for-cli-daemon-and-web-server.md`:
```markdown
# 0002. One Bun binary for the CLI, the daemon and the web server

- Status: accepted
- Date: 2026-09-30

## Context

Workbox must run in a browser served locally, as a desktop app and as a headless CLI, from one command, with a binary well under hundreds of megabytes ([R3](../superpowers/research/2026-09-30-R3-runtime-desktop-cli.md)).

## Decision

`apps/cli` is compiled with `bun build --compile` into one executable per target that is at once the CLI, the daemon and the web server (the UI is embedded as assets in plan 2). The desktop app (plan 7 of the product) wraps the same binary as a Tauri sidecar.

## Consequences

Binary size floor is about 80 MB per platform; Bun minor versions are pinned (`.bun-version`) because Bun 1.4 is a fresh Rust rewrite; `erasableSyntaxOnly` keeps Node type stripping as an escape hatch.
```

`docs/adr/0003-append-only-event-log-as-the-source-of-truth.md`:
```markdown
# 0003. Append-only event log as the source of truth

- Status: accepted
- Date: 2026-09-30

## Context

Chat, dashboard, office simulation, telemetry and later the phone client all need the same history of what agents did ([spec §5](../superpowers/specs/2026-09-30-workbox-foundation-vertical-slice-design.md)).

## Decision

The daemon writes semantic events to an append-only SQLite log; everything else is a projection. Streaming deltas are transient and never stored. Implemented from plan 2 on; `packages/protocol` already owns the schemas.

## Consequences

Replay makes the office simulation testable; adding a second harness or a remote client adds no new state model; the log doubles as the telemetry substrate.
```

`docs/adr/0004-pnpm-and-turborepo-monorepo-with-source-consumed-packages.md`:
```markdown
# 0004. pnpm and Turborepo monorepo with source-consumed packages

- Status: accepted
- Date: 2026-09-30

## Context

The repository hosts a daemon, a CLI, a web client and shared packages. Supply-chain safety and contributor familiarity matter ([R7](../superpowers/research/2026-09-30-R7-repo-engineering-toolchain.md), [R10 §1](../superpowers/research/2026-09-30-R10-toolchain-config-reference.md)).

## Decision

pnpm 12 with a single catalog of versions, `minimumReleaseAge: 4320`, `trustPolicy: no-downgrade`, `blockExoticSubdeps` and explicit `allowBuilds`; Turborepo 2.11 for the task graph, caching and package boundaries. Internal packages have no build step: `exports` point at `src/index.ts`, Bun and Vite consume TypeScript directly, `tsc --noEmit` type-checks.

## Consequences

Bun runs on pnpm's symlinked `node_modules` (verified in plan 1, Task 2); a package published to npm later needs its own build step; `isolatedDeclarations` is not applicable.
```

`docs/adr/0005-oxlint-and-oxfmt-with-turborepo-boundaries-instead-of-eslint.md`:
```markdown
# 0005. Oxlint and Oxfmt, Turborepo boundaries instead of ESLint

- Status: accepted
- Date: 2026-09-30

## Context

The owner wants the strictest, fastest linting available. TypeScript 7 exposes no JavaScript API, and `@typescript-eslint/parser` requires one ([R10 §3, §6](../superpowers/research/2026-09-30-R10-toolchain-config-reference.md)).

## Decision

Oxlint 1.86 with type-aware rules through `oxlint-tsgolint` and the categories correctness, suspicious, pedantic, perf and style at error, restriction at warn (`--deny-warnings` in CI); Oxfmt 0.71 as the only formatter. Dependency rules between packages are enforced with Turborepo boundaries tags, and leaf-package runtime purity with `no-restricted-globals` / `no-restricted-imports`. No ESLint, no Prettier.

## Consequences

Rules that are disabled globally are listed here with a reason (none yet). If ESLint-only plugins become necessary, they need a TypeScript 6 alias in a separate workspace.
```

`docs/adr/0006-typescript-7-for-type-checking-only.md`:
```markdown
# 0006. TypeScript 7 for type checking only

- Status: accepted
- Date: 2026-09-30

## Context

TypeScript 7.0 (native compiler) is GA since July 2026; its programmatic API arrives in 7.1 ([R3](../superpowers/research/2026-09-30-R3-runtime-desktop-cli.md), [R10 §3](../superpowers/research/2026-09-30-R10-toolchain-config-reference.md)).

## Decision

`typescript@7` provides `tsc --noEmit` per package with the pedantic flags in `tsconfig.base.json`; no tool in the repository may depend on the TypeScript JavaScript API. `types: []` is explicit in every tsconfig because TypeScript 6+ no longer auto-includes `@types`.

## Consequences

Tooling that embeds TypeScript (ESLint typed rules, Vue templates) is out unless it ships its own compiler; `erasableSyntaxOnly` and `verbatimModuleSyntax` keep the code portable to Node's type stripping.
```

`docs/adr/0007-bun-test-for-runtime-packages-vitest-for-the-web-client.md`:
```markdown
# 0007. bun test for runtime packages, Vitest for the web client

- Status: accepted
- Date: 2026-09-30

## Context

Vitest does not support the Bun runtime, and `bun:sqlite` cannot load under Node ([R9 §4](../superpowers/research/2026-09-30-R9-library-verification.md)).

## Decision

`packages/*` and `apps/cli` test with `bun test`; `apps/web` tests with Vitest 5 in browser mode on Playwright Chromium. Turborepo runs both through the same `test` task.

## Consequences

Two assertion libraries with the same Jest-style API; browser tests need `playwright install chromium`; CI runs the web tests in a separate job with cached browsers.
```

`docs/adr/0008-apache-2-0-license.md`:
```markdown
# 0008. Apache-2.0 license

- Status: accepted
- Date: 2026-09-30

## Context

Workbox wraps proprietary agent binaries and is meant for wide adoption; the owner wanted a permissive licence with a patent grant ([R7](../superpowers/research/2026-09-30-R7-repo-engineering-toolchain.md)).

## Decision

Apache License 2.0 with a `NOTICE` file; contributions are certified with the Developer Certificate of Origin (sign-off), not a CLA.

## Consequences

Third-party assets (pixel art) must be CC0 or explicitly compatible and credited in `assets/CREDITS.md` (plan 5).
```

`docs/adr/0009-react-19-for-the-web-client.md`:
```markdown
# 0009. React 19 for the web client

- Status: accepted
- Date: 2026-09-30

## Context

The owner knows React and Vue. On 2026-09-30 React 19.3 with React Compiler 1.0 is stable, while Vue 3.6 Vapor and Solid 2.0 are release candidates; the chat rendering ecosystem (Streamdown, Base UI, Motion) is React-first ([R4](../superpowers/research/2026-09-30-R4-frontend-and-pixel-art-sim.md)).

## Decision

React 19.3 with the React Compiler enabled through `@vitejs/plugin-react` and `@rolldown/plugin-babel`, Vite 8, Tailwind 4, and Vitest browser mode for component tests.

## Consequences

The office canvas is a React island around PixiJS (plan 5); the phone client (product plan 6) can share components.
```

`docs/adr/0010-claude-through-the-agent-sdk-with-the-users-own-login.md`:
```markdown
# 0010. Claude through the Agent SDK with the user's own login

- Status: accepted
- Date: 2026-09-30

## Context

Anthropic's help centre states that Agent SDK, headless CLI and third-party app usage draw from the subscription, while its legal page forbids third parties from intermediating tokens or offering claude.ai login; the policy changed four times in 2026 ([R1](../superpowers/research/2026-09-30-R1-subscriptions-and-agent-auth.md)).

## Decision

Workbox runs the unmodified Claude Code binary through `@anthropic-ai/claude-agent-sdk` with the login the user performed in Anthropic's own flow (`claude auth login`). Workbox never reads, copies, refreshes or stores tokens; `workbox doctor` and `workbox auth` only report the exit code of `claude auth status`. An API-key mode with a budget cap ships alongside as the compliance fallback.

## Consequences

The Claude adapter (plan 4) is isolated behind the `HarnessAdapter` port so a policy change swaps one package; the sandbox providers (product plan 5) must let the login happen inside the sandbox rather than forwarding credentials.
```

- [ ] **Step 3: Verify and commit**

Run:
```bash
pnpm run check
```
Expected: clean (add words to `project-words.txt` if cspell reports names from the ADRs).

```bash
git add README.md docs/adr project-words.txt
git commit -s -m "docs: add readme and the first ten architecture decision records"
```

---

### Task 16: Push, repository settings and the first green pull request

**Files:** none in the repository; GitHub settings only (R11 §8 for every setting name).

- [ ] **Step 1: Push the branch and open the pull request**

Run:
```bash
git push -u origin feat/repository-foundation
gh pr create --title "feat: repository foundation and workbox doctor" --body "Implements docs/superpowers/plans/2026-09-30-plan-1-repository-foundation.md: monorepo toolchain, CI/CD, community files and the compiled workbox binary with --version and doctor. Signed-off commits, Conventional Commits, SHA-pinned actions."
```
Expected: the PR opens and the `ci`, `pr-title`, `zizmor` and `gitleaks` workflows start.

- [ ] **Step 2: Configure repository settings (once, in the GitHub UI)**

Settings > General > Pull Requests: untick "Allow merge commits" and "Allow rebase merging", keep "Allow squash merging" with default message "Pull request title and description", tick "Allow auto-merge" and "Automatically delete head branches".

Settings > General > Features: enable Discussions.

Settings > Actions > General > Workflow permissions: "Read repository contents and packages permissions"; tick "Allow GitHub Actions to create and approve pull requests" (release-please needs it).

Settings > Security and quality > Advanced Security: enable Dependabot alerts, Private vulnerability reporting, and CodeQL analysis with **Default** setup (JavaScript/TypeScript; no workflow file).

Install the apps: Renovate (https://github.com/apps/renovate, this repository only; merge its onboarding PR after confirming it keeps `renovate.json`) and DCO (https://github.com/apps/dco).

Settings > Rules > Rulesets > New branch ruleset named `main`: target the default branch; enforcement Active; rules: Restrict deletions, Block force pushes, Require linear history, Require a pull request before merging (0 approvals, allowed merge method squash), Require status checks to pass with the checks `static`, `test-daemon (ubuntu-26.04)`, `test-daemon (macos-26)`, `test-daemon (windows-2025)`, `test-web`, `build`, `Validate PR title`, `DCO`; bypass list: Repository admin.

Optional: create a Turborepo remote cache token (`pnpm exec turbo login && pnpm exec turbo link`) and add `TURBO_TOKEN` as a repository secret and `TURBO_TEAM` as a repository variable; without them CI simply uses local caching.

- [ ] **Step 3: Get the pull request green**

Watch the checks: `gh pr checks --watch`. Expected: all jobs pass. Fix any CI-only failure on the branch with a signed-off Conventional Commit and push again. Typical CI-only issues: a Playwright download blocked → the `test-web` cache step; Windows path separators in the doctor tests (`join` from `node:path` handles them); a `pnpm-lock.yaml` drift → run `pnpm install` locally and commit the lockfile.

- [ ] **Step 4: Merge and verify the release pipeline**

Squash-merge the PR with the title unchanged. Expected on `main`: the `release` workflow opens a release PR titled `chore(main): release 0.1.0` with `CHANGELOG.md` listing the `feat` entries. Merge that PR. Expected: tag `v0.1.0`, a GitHub Release with eight binaries, `workbox_0.1.0_checksums.txt`, and an attestation; verify with:
```bash
gh release download v0.1.0 --pattern 'workbox-darwin-arm64' --dir /tmp/wb && gh attestation verify /tmp/wb/workbox-darwin-arm64 -R misaon/workbox && chmod +x /tmp/wb/workbox-darwin-arm64 && /tmp/wb/workbox-darwin-arm64 --version
```
Expected: the attestation verifies and the binary prints `0.1.0`.

---

## Self-review notes

- **Spec coverage for this plan:** §4.2 layout (Tasks 1, 2, 5, 6, 7, 9), §4.3 rules (Task 10), §7.4 `doctor` and global flags (Task 7), §10.1 logging and debug flag (Tasks 5, 7), §11.1 to §11.7 toolchain, CI, releases, hygiene (Tasks 1, 3, 4, 8, 10 to 15). Everything else in the spec is explicitly assigned to plans 2 to 6 in [README.md](README.md).
- **Type consistency:** `CommandRunner`, `CommandResult`, `CheckResult`, `CheckId`, `DoctorReport`, `DoctorDependencies` are defined in Task 7 and used unchanged in its tests; `EnvLike` is exported by `@workbox/observability` and re-declared structurally in `@workbox/i18n` (both `Readonly<Record<string, string | undefined>>`); `BuildTarget` helpers are defined in Task 8 before the binary test uses them.
- **Review Focus:** all five items have tests in Task 7 (`checks.test.ts` items 1 to 3, `cli.test.ts` items 4 and 5).
- **Placeholders:** none; every config block is copied or adapted from R10/R11 with the source section named.
