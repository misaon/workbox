# Scorecard and Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the OpenSSF Scorecard gaps that a single maintainer can close honestly (Fuzzing, Pinned-Dependencies, Signed-Releases) and the two CI guards from issue #9, in one pull request.

**Architecture:** Property-based tests with fast-check join the existing `bun:test` suites of the pure modules (`protocol`, `i18n`, the CLI's build targets). actionlint runs from its official container image pinned by digest instead of a download-then-run script. The release workflow verifies the binary set before signing, attests every asset including the checksums, and attaches the Sigstore bundle to the release so that Scorecard's Signed-Releases probe sees a signature file.

**Tech Stack:** fast-check 4.10.2, `docker://rhysd/actionlint:1.7.12` (digest `sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`), `actions/attest` v4.2.2 (already pinned), Bun 1.4.2.

**Spec:** [2026-09-30-workbox-foundation-vertical-slice-design.md](../specs/2026-09-30-workbox-foundation-vertical-slice-design.md) (toolchain and CI sections) plus GitHub issues misaon/workbox#9 and misaon/workbox#10 and the first Scorecard run (6.8/10 on 2026-10-01).

**Evidence behind the design (verified 2026-10-01):**

- Scorecard's Fuzzing check detects JavaScript/TypeScript property-based testing by the regular expression `from\s+['"](fast-check|@fast-check/(ava|jest|vitest))['"]` in `*.ts` files ([checks/raw/fuzzing.go](https://github.com/ossf/scorecard/blob/main/checks/raw/fuzzing.go)). A plain `import fc from 'fast-check'` in a test file is enough.
- Scorecard's Signed-Releases probe looks at the five most recent releases and treats a release as signed when at least one asset ends with `.asc`, `.minisig`, `.sig`, `.sign`, `.sigstore` or `.sigstore.json` (8/10). GitHub Artifact Attestations alone are not yet recognised (ossf/scorecard#5001 is open). `actions/attest` writes its attestation as a JSON Sigstore bundle at `bundle-path`.
- Scorecard flags `bash <(curl …)` as `downloadThenRun`; a `uses: docker://…@sha256:…` step counts as a pinned dependency. actionlint documents the container usage `uses: docker://rhysd/actionlint:<version>` with `args: -color`; the image ships shellcheck and pyflakes. Renovate's github-actions manager extracts `docker://` references through its docker handling and keeps `image:tag@sha256:…` up to date.
- Bun's test runner defines no `xit`, `xdescribe` or `xtest` globals (`typeof globalThis.xit === 'undefined'` on Bun 1.4.2), so the lint guard asked for in issue #9 is unnecessary: a call to one of them fails the test file with a ReferenceError.

## Global Constraints

- Package manager: pnpm 12 with two catalogs. Runtime dependencies use `catalog:`, tooling and test dependencies use `catalog:dev`. `minimumReleaseAge` is 72 hours: every new version must have been published at least three days before the install, or the install fails. fast-check 4.10.2 was published 2026-09-19 and qualifies; check its transitive dependency `pure-rand` the same way (`pnpm view pure-rand time --json`).
- Lint: `pnpm run lint` runs type-aware Oxlint with `--deny-warnings`; `pnpm run check` chains format, lint, typecheck, tests, boundaries, knip, cspell, markdownlint and ls-lint and must be green before every commit. A suppression is written `// oxlint-disable-next-line <rule> -- <reason>` and listed in the report; never turn a rule off.
- Tests run with `bun test` in `packages/*` and `apps/cli`; files end with `.test.ts`; no `.only` or `.skip` (lint forbids them); test output must be pristine.
- Workflows: every action is pinned to a full commit SHA with a `# vX.Y.Z` comment, top-level `permissions: {}`, job-level permissions with a comment on every non-read permission, a `concurrency` group, no `${{ }}` expression inside a `run:` block (pass values through `env:`). `uvx zizmor==1.30.1 --persona pedantic --offline .github/workflows` and `actionlint -color` must report nothing.
- Commits: Conventional Commits, signed off (`git commit -s`), body lines at most 100 characters (commitlint enforces this), one commit per task.
- Code, comments and docs are English. Decisions that change the toolchain get a dated amendment in the ADR that covers the area (`docs/adr/`), not a new ADR.
- Never edit files outside this task's file list without saying so in the report.

## Review Focus

- A property test must fail when the code under test is mutated. A filter that leaves no inputs, an arbitrary that only produces one shape, or an assertion on the arbitrary instead of the function makes the property vacuous. Each property test in Task 1 pins at least one mutation in its report.
- `uses: docker://rhysd/actionlint:1.7.12@sha256:…` must be accepted by GitHub Actions and still read `.github/actionlint.yaml` (the image runs in the checked-out workspace). The first CI run on the pull request is the proof; the task's local check is zizmor plus actionlint.
- `check-dist` must fail for a missing binary, an empty binary and an unexpected `workbox-*` file, and it must run before the checksums and the bundle are written, which both start with `workbox_` (underscore) on purpose.
- The attest subject globs must cover exactly the eight binaries and the checksums file; the bundle copy must run after `actions/attest` and before the upload; the bundle itself is not a subject.
- The Signed-Releases improvement is visible only after the next release; the pull request description must say so, so nobody expects the score to move at merge time.

---

### Task 1: Property-based tests with fast-check

**Files:**
- Modify: `pnpm-workspace.yaml` (add `fast-check: ^4.10.2` under `catalogs.dev`, keep the list alphabetical)
- Modify: `packages/protocol/package.json`, `packages/i18n/package.json`, `apps/cli/package.json` (add `"fast-check": "catalog:dev"` to `devDependencies`, alphabetical)
- Create: `packages/protocol/test/version-property.test.ts`
- Create: `packages/protocol/test/user-config-property.test.ts`
- Create: `packages/i18n/test/locale-property.test.ts`
- Create: `apps/cli/test/build-targets-property.test.ts`
- Modify (only if cspell complains): `project-words.txt`

**Interfaces:**
- Consumes: `protocolMajor(version: string): number` and `PROTOCOL_VERSION` from `packages/protocol/src/version.ts`; `parseUserConfig(input: unknown): ParseResult<UserConfig>` (`{ ok: true, value } | { ok: false, message }`), `DEFAULT_USER_CONFIG`, `LOCALES` from `packages/protocol/src/user-config.ts`; `isLocale(value: unknown): value is Locale` and `resolveLocale(env: EnvLike): Locale` from `packages/i18n/src/locale.ts`; `BUILD_TARGETS`, `isBuildTarget`, `outfileFor`, `buildCommand`, `hostTarget(platform?, arch?)` from `apps/cli/src/build-targets.ts`.
- Produces: nothing new; the tests are the deliverable.

- [ ] **Step 1: Add the dependency**

In `pnpm-workspace.yaml`, under `catalogs:` → `dev:`, add `fast-check: ^4.10.2`. In the three `package.json` files add `"fast-check": "catalog:dev"` to `devDependencies`. Run `pnpm install` from the repository root; it must succeed without a new `minimumReleaseAgeExclude` entry (if it reports `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, pick the newest version of fast-check that is older than 72 hours instead of adding an exclusion, and say so in the report).

- [ ] **Step 2: Write the version properties (fail first)**

`packages/protocol/test/version-property.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';

import { PROTOCOL_VERSION, protocolMajor } from '../src/version.ts';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

describe('protocolMajor (properties)', () => {
  test('returns the first number of every plain major.minor.patch version', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: Number.MAX_SAFE_INTEGER }),
        fc.nat(),
        fc.nat(),
        (major, minor, patch) => {
          expect(protocolMajor(`${major}.${minor}.${patch}`)).toBe(major);
        },
      ),
    );
  });

  test('rejects every string that is not three dot-separated digit runs', () => {
    const notAVersion = fc.string().filter((value) => !VERSION_PATTERN.test(value));
    fc.assert(
      fc.property(notAVersion, (value) => {
        expect(() => protocolMajor(value)).toThrow(TypeError);
      }),
    );
  });

  test('rejects a major above the safe-integer range even when the pattern matches', () => {
    const hugeMajor = fc
      .bigInt({ min: BigInt(Number.MAX_SAFE_INTEGER) + 1n, max: 10n ** 30n })
      .map((major) => `${major}.0.0`);
    fc.assert(
      fc.property(hugeMajor, (value) => {
        expect(() => protocolMajor(value)).toThrow(TypeError);
      }),
    );
  });

  test('the shipped PROTOCOL_VERSION is itself accepted', () => {
    expect(protocolMajor(PROTOCOL_VERSION)).toBe(Number(PROTOCOL_VERSION.split('.')[0]));
  });
});
```

Run `bun test test/version-property.test.ts` in `packages/protocol` before `pnpm install` has added fast-check and confirm it fails with a module-resolution error; after Step 1 it must pass. Then prove the properties bite: temporarily change `protocolMajor` to return `Number(version.split('.')[1])` and run the file again; the first property must fail with a counterexample. Restore the code. Record both outputs in the report.

- [ ] **Step 3: Write the user-config properties**

`packages/protocol/test/user-config-property.test.ts`. Read `packages/protocol/src/user-config.ts` first for the exact shape of `userConfigSchema` (which top-level sections exist and where the `locale` key lives); adapt the key paths below to it, keeping the four properties.

```ts
import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';

import { DEFAULT_USER_CONFIG, LOCALES, parseUserConfig } from '../src/user-config.ts';

const topLevelKeys = Object.keys(DEFAULT_USER_CONFIG);

describe('parseUserConfig (properties)', () => {
  test('omitting any subset of sections still yields the full defaults', () => {
    fc.assert(
      fc.property(fc.subarray(topLevelKeys), (omitted) => {
        const input: Record<string, unknown> = structuredClone(DEFAULT_USER_CONFIG);
        for (const key of omitted) {
          delete input[key];
        }
        const result = parseUserConfig(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(DEFAULT_USER_CONFIG);
          expect(result.value).not.toBe(DEFAULT_USER_CONFIG);
        }
      }),
    );
  });

  test('every non-object input is rejected with a non-empty message', () => {
    const notAnObject = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.double(),
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined),
      fc.array(fc.anything()),
    );
    fc.assert(
      fc.property(notAnObject, (input) => {
        const result = parseUserConfig(input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.message.length).toBeGreaterThan(0);
        }
      }),
    );
  });

  test('an unknown top-level key is rejected and named in the message', () => {
    const unknownKey = fc
      .stringMatching(/^[a-z][a-zA-Z0-9]{0,15}$/u)
      .filter((key) => !topLevelKeys.includes(key));
    fc.assert(
      fc.property(unknownKey, (key) => {
        const result = parseUserConfig({ ...structuredClone(DEFAULT_USER_CONFIG), [key]: 1 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.message).toContain(key);
        }
      }),
    );
  });

  test('a locale is accepted exactly when it is one of LOCALES', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constantFrom(...LOCALES)), (locale) => {
        const result = parseUserConfig({ locale });
        expect(result.ok).toBe((LOCALES as readonly string[]).includes(locale));
      }),
    );
  });
});
```

If `locale` is nested (for example `ui.locale`), build the input accordingly and keep the assertion. Mutation to record: make `describeIssue` drop the key path (or change `strictObject` to `object`) and show the failing property.

- [ ] **Step 4: Write the locale properties**

`packages/i18n/test/locale-property.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { LOCALES } from '@workbox/protocol';

import { isLocale, resolveLocale } from '../src/locale.ts';

const supported = fc.constantFrom(...LOCALES);
const whitespace = fc.string({ unit: fc.constantFrom(' ', '\t', '\n'), maxLength: 3 });

function withCasing(locale: string, upper: readonly boolean[]): string {
  return [...locale]
    .map((char, index) => (upper[index] === true ? char.toUpperCase() : char.toLowerCase()))
    .join('');
}

describe('resolveLocale (properties)', () => {
  test('always returns a supported locale, whatever WORKBOX_LOCALE holds', () => {
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: undefined }), (value) => {
        expect(isLocale(resolveLocale({ WORKBOX_LOCALE: value }))).toBe(true);
      }),
    );
  });

  test('ignores surrounding whitespace and letter case of a supported locale', () => {
    fc.assert(
      fc.property(
        supported,
        whitespace,
        whitespace,
        fc.array(fc.boolean(), { minLength: 2, maxLength: 2 }),
        (locale, before, after, upper) => {
          const env = { WORKBOX_LOCALE: `${before}${withCasing(locale, upper)}${after}` };
          expect(resolveLocale(env)).toBe(locale);
        },
      ),
    );
  });

  test('falls back to English for every unsupported value', () => {
    const unsupported = fc.string().filter((value) => !isLocale(value.trim().toLowerCase()));
    fc.assert(
      fc.property(unsupported, (value) => {
        expect(resolveLocale({ WORKBOX_LOCALE: value })).toBe('en');
      }),
    );
  });
});

describe('isLocale (properties)', () => {
  test('accepts exactly the strings in LOCALES', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const expected = typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
        expect(isLocale(value)).toBe(expected);
      }),
    );
  });
});
```

Mutation to record: remove `.trim()` from `resolveLocale` and show the whitespace property failing.

- [ ] **Step 5: Write the build-target properties**

`apps/cli/test/build-targets-property.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';

import {
  BUILD_TARGETS,
  buildCommand,
  hostTarget,
  isBuildTarget,
  outfileFor,
} from '../src/build-targets.ts';

const target = fc.constantFrom(...BUILD_TARGETS);
const SUPPORTED_PLATFORMS = ['darwin', 'linux', 'win32'] as const;
const SUPPORTED_ARCHES = ['arm64', 'x64'] as const;

describe('build targets (properties)', () => {
  test('isBuildTarget is exactly membership in BUILD_TARGETS', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), target), (value) => {
        expect(isBuildTarget(value)).toBe((BUILD_TARGETS as readonly string[]).includes(value));
      }),
    );
  });

  test('every outfile lives in dist, carries the target name and ends with .exe only on Windows', () => {
    fc.assert(
      fc.property(target, (value) => {
        const outfile = outfileFor(value);
        expect(outfile.startsWith(`dist/workbox-${value.replace(/^bun-/u, '')}`)).toBe(true);
        expect(outfile.endsWith('.exe')).toBe(value.startsWith('bun-windows'));
      }),
    );
  });

  test('buildCommand always targets the given triple, defines the version verbatim and writes the outfile', () => {
    const version = fc.stringMatching(/^[0-9A-Za-z.+-]{1,40}$/u);
    fc.assert(
      fc.property(target, version, fc.constantFrom('src/main.ts', 'src/other.ts'), (value, ver, entry) => {
        const command = buildCommand(value, ver, entry);
        expect(command).toContain(`--target=${value}`);
        expect(command).toContain(`WORKBOX_VERSION="${ver}"`);
        expect(command.slice(-2)).toEqual(['--outfile', outfileFor(value)]);
        expect(command[2]).toBe(entry);
      }),
    );
  });

  test('hostTarget maps every supported platform/arch pair and rejects everything else', () => {
    const supportedPair = fc.tuple(fc.constantFrom(...SUPPORTED_PLATFORMS), fc.constantFrom(...SUPPORTED_ARCHES));
    const unsupportedPair = fc
      .tuple(fc.string(), fc.string())
      .filter(
        ([platform, arch]) =>
          !(SUPPORTED_PLATFORMS as readonly string[]).includes(platform) ||
          !(SUPPORTED_ARCHES as readonly string[]).includes(arch),
      );
    fc.assert(
      fc.property(supportedPair, ([platform, arch]) => {
        expect(isBuildTarget(hostTarget(platform, arch))).toBe(true);
      }),
    );
    fc.assert(
      fc.property(unsupportedPair, ([platform, arch]) => {
        expect(() => hostTarget(platform, arch)).toThrow(/Unsupported host platform/u);
      }),
    );
  });
});
```

Mutation to record: make `outfileFor` append `.exe` for every target and show the outfile property failing.

- [ ] **Step 6: Lint, typecheck, full check**

Run `pnpm run check` from the repository root. Fix formatting with `pnpm run format` if oxfmt reports differences. If cspell rejects a word that is part of the fast-check vocabulary, add it to `project-words.txt` and list it in the report. If knip reports fast-check as unused in a package, the test file in that package is missing the import; do not add an `ignoreDependencies` entry.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/protocol/package.json packages/i18n/package.json apps/cli/package.json packages/protocol/test/version-property.test.ts packages/protocol/test/user-config-property.test.ts packages/i18n/test/locale-property.test.ts apps/cli/test/build-targets-property.test.ts
git commit -s -m "test: add fast-check property tests for the pure modules"
```

Add `project-words.txt` to the `git add` list only if Step 6 changed it.

---

### Task 2: Run actionlint from its digest-pinned container image (issue #10)

**Files:**
- Modify: `.github/workflows/ci.yml` (the two actionlint steps at the end of the `static` job)
- Modify: `docs/adr/0011-release-and-dependency-automation.md` (dated amendment; it is the ADR that documents actionlint)
- Leave `docs/superpowers/research/**` untouched (research is a historical record). `CONTRIBUTING.md` and `README.md` do not mention the download script (checked 2026-10-01), so they stay as they are.

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the `static` job's workflow check step, which Task 3 does not touch.

- [ ] **Step 1: Replace the download-then-run steps**

In `.github/workflows/ci.yml`, replace

```yaml
      - name: Download actionlint
        id: get_actionlint
        run: bash <(curl -fsSL https://raw.githubusercontent.com/rhysd/actionlint/914e7df21a07ef503a81201c76d2b11c789d3fca/scripts/download-actionlint.bash) 1.7.12
      - name: Check workflow files
        env:
          ACTIONLINT: ${{ steps.get_actionlint.outputs.executable }}
        run: '"$ACTIONLINT" -color'
```

with

```yaml
      - name: Check workflow files
        # The official image bundles actionlint, shellcheck and pyflakes. The digest pins it; Renovate bumps tag and digest together.
        uses: docker://rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
        with:
          args: -color
```

Keep `.github/actionlint.yaml`; the container runs in the checked-out workspace and reads it.

- [ ] **Step 2: Verify locally**

Run from the repository root:

```bash
uvx zizmor==1.30.1 --persona pedantic --offline .github/workflows
```

Expected: `No findings to report.` Then `actionlint -color` (the Homebrew binary) with no output and exit 0. If Docker is available locally, also run `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 -color` and record the result; if Docker is not available, say so in the report (CI is the proof).

- [ ] **Step 3: Record the decision**

Append to `docs/adr/0011-release-and-dependency-automation.md` a paragraph headed `Amendment 2026-10-01` saying that actionlint runs from the official container image pinned by digest because Scorecard's Pinned-Dependencies check treats a download-then-run script as unpinned, that the digest is updated by Renovate's github-actions manager, and that `.github/actionlint.yaml` still configures the runner labels. If the ADR's existing text describes the download step, reword that sentence so the ADR does not contradict itself.

- [ ] **Step 4: Check and commit**

Run `pnpm run check` (markdownlint and cspell cover the docs). Then:

```bash
git add .github/workflows/ci.yml docs/adr
git commit -s -m "ci: run actionlint from its digest-pinned container image"
```

Add `CONTRIBUTING.md` or `README.md` to the `git add` list if Step 3 changed them.

---

### Task 3: Guard the binary set, attest every asset and attach the Sigstore bundle (issue #9, Signed-Releases)

**Files:**
- Create: `apps/cli/scripts/check-dist.ts`
- Create: `apps/cli/test/check-dist.test.ts`
- Modify: `apps/cli/package.json` (add the `check:dist` script)
- Modify: `.github/workflows/release.yml` (`build-binaries` job)
- Modify: `SECURITY.md` (new section `## Verifying a release`; neither it nor `README.md` describes verification today, and `README.md` already carries the Scorecard badge)
- Modify: `docs/adr/0011-release-and-dependency-automation.md` (dated amendment; it documents the release workflow and `actions/attest`)

**Interfaces:**
- Consumes: `BUILD_TARGETS` and `outfileFor` from `apps/cli/src/build-targets.ts`.
- Produces: `pnpm --filter @workbox/cli run check:dist [distDir]`, exit 0 when `distDir` (default `dist`, relative to `apps/cli`) holds exactly the eight expected binaries, each non-empty; exit 1 with one line per problem on stderr otherwise.

- [ ] **Step 1: Write the failing test**

`apps/cli/test/check-dist.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { BUILD_TARGETS, outfileFor } from '../src/build-targets.ts';

const cliRoot = join(import.meta.dir, '..');
const expectedNames = BUILD_TARGETS.map((target) => basename(outfileFor(target)));

async function runCheck(dist: string) {
  const proc = Bun.spawn(['bun', 'run', 'scripts/check-dist.ts', dist], {
    cwd: cliRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout.text(),
    proc.stderr.text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function distWith(names: readonly string[], options: { readonly empty?: string } = {}) {
  const dist = await mkdtemp(join(tmpdir(), 'workbox-dist-'));
  for (const name of names) {
    await writeFile(join(dist, name), name === options.empty ? '' : `binary ${name}`);
  }
  return dist;
}

describe('check-dist', () => {
  test('accepts exactly the eight expected binaries', async () => {
    const result = await runCheck(await distWith(expectedNames));
    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: '' });
    for (const name of expectedNames) {
      expect(result.stdout).toContain(name);
    }
  });

  test('fails when a binary is missing and names it', async () => {
    const [missing, ...rest] = expectedNames;
    const result = await runCheck(await distWith(rest));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`missing: ${missing}`);
  });

  test('fails when a binary is empty', async () => {
    const [empty] = expectedNames;
    const result = await runCheck(await distWith(expectedNames, { empty }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`empty: ${empty}`);
  });

  test('fails when an unexpected workbox- file is present', async () => {
    const result = await runCheck(await distWith([...expectedNames, 'workbox-freebsd-x64']));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('unexpected: workbox-freebsd-x64');
  });

  test('ignores the checksums and bundle files that later steps add', async () => {
    const result = await runCheck(
      await distWith([...expectedNames, 'workbox_0.2.0_checksums.txt', 'workbox_0.2.0.sigstore.json']),
    );
    expect(result.exitCode).toBe(0);
  });

  test('fails when the directory does not exist', async () => {
    const result = await runCheck(join(tmpdir(), 'workbox-dist-does-not-exist'));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not a directory');
  });
});
```

Run `bun test test/check-dist.test.ts` in `apps/cli`; every test must fail because the script does not exist.

- [ ] **Step 2: Write the script**

`apps/cli/scripts/check-dist.ts`:

```ts
import { readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { BUILD_TARGETS, outfileFor } from '../src/build-targets.ts';

const EXIT_FAILURE = 1;

/** Release binaries are `workbox-<os>-<arch>[.exe]`; the checksums and the Sigstore bundle start with `workbox_`. */
const BINARY_PREFIX = 'workbox-';

async function problemsIn(dist: string): Promise<string[]> {
  const info = await stat(dist).catch(() => undefined);
  if (info === undefined || !info.isDirectory()) {
    return [`not a directory: ${dist}`];
  }
  const expected = new Set(BUILD_TARGETS.map((target) => basename(outfileFor(target))));
  const present = new Set(await readdir(dist));
  const problems: string[] = [];
  for (const name of expected) {
    if (!present.has(name)) {
      problems.push(`missing: ${name}`);
    } else if ((await stat(join(dist, name))).size === 0) {
      problems.push(`empty: ${name}`);
    }
  }
  for (const name of present) {
    if (name.startsWith(BINARY_PREFIX) && !expected.has(name)) {
      problems.push(`unexpected: ${name}`);
    }
  }
  return problems;
}

const dist = resolve(process.argv[2] ?? 'dist');
const problems = await problemsIn(dist);
if (problems.length > 0) {
  for (const problem of problems) {
    process.stderr.write(`${problem}\n`);
  }
  process.exitCode = EXIT_FAILURE;
} else {
  for (const target of BUILD_TARGETS) {
    process.stdout.write(`ok: ${basename(outfileFor(target))}\n`);
  }
}
```

Lint may ask for a different shape (for example `no-await-in-loop`); keep the behaviour and the messages, adapt the code, and list any suppression. Add to `apps/cli/package.json` scripts: `"check:dist": "bun run scripts/check-dist.ts"`. Run the test file again: all six tests pass.

- [ ] **Step 3: Wire the release workflow**

In `.github/workflows/release.yml`, `build-binaries` job, replace the steps from `- run: pnpm run build:binaries` to the upload step with:

```yaml
      - run: pnpm run build:binaries
      - name: Verify the binary set
        run: pnpm --filter @workbox/cli run check:dist
      - name: Checksums
        run: cd apps/cli/dist && sha256sum workbox-* > "workbox_${TAG#v}_checksums.txt"
      - uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
        id: attest
        with:
          subject-path: |
            apps/cli/dist/workbox-*
            apps/cli/dist/workbox_*_checksums.txt
      - name: Attach the Sigstore bundle to the release assets
        # Scorecard's Signed-Releases check looks for a *.sigstore.json asset; the bundle also allows offline verification.
        env:
          BUNDLE_PATH: ${{ steps.attest.outputs.bundle-path }}
        run: cp "$BUNDLE_PATH" "apps/cli/dist/workbox_${TAG#v}.sigstore.json"
      - name: Upload release assets
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release upload "$TAG" apps/cli/dist/* --clobber
```

Keep the `permissions` block and its comments unchanged. Verify with `uvx zizmor==1.30.1 --persona pedantic --offline .github/workflows` (nothing) and `actionlint -color` (nothing).

- [ ] **Step 4: Docs**

- Add a section `## Verifying a release` to `SECURITY.md` stating that every release carries `workbox_<version>_checksums.txt` (`sha256sum -c`), a build-provenance attestation for every asset (`gh attestation verify <file> --repo misaon/workbox`) and the Sigstore bundle `workbox_<version>.sigstore.json` for offline verification (`gh attestation verify <file> --repo misaon/workbox --bundle workbox_<version>.sigstore.json`). Keep it to a short paragraph plus the three commands in one fenced block; `markdownlint` and `cspell` run on it.
- Append `Amendment 2026-10-01` to `docs/adr/0011-release-and-dependency-automation.md`: the binary set is verified before signing, the checksums file is attested too, and the Sigstore bundle is attached because Scorecard recognises `.sigstore.json` assets but not attestations fetched through the API (ossf/scorecard#5001 open on 2026-10-01).
- Issue #9 asked for a lint guard against `xdescribe`, `xit` and `xtest`. Bun's test runner does not define them (`bun -e 'console.log(typeof globalThis.xit)'` prints `undefined` on Bun 1.4.2), so a stray call already fails the file with a ReferenceError; no rule is added. Write one sentence about this in the report so the pull request description can close that part of #9 with the evidence.

- [ ] **Step 5: Check and commit**

`pnpm run check` green, then:

```bash
git add apps/cli/scripts/check-dist.ts apps/cli/test/check-dist.test.ts apps/cli/package.json .github/workflows/release.yml SECURITY.md docs/adr/0011-release-and-dependency-automation.md
git commit -s -m "ci: verify, attest and attach signatures for every release asset"
```
