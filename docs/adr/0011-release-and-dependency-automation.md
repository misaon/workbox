# 0011. Release and dependency automation

- Status: accepted
- Date: 2026-10-01

## Context

A solo-maintained open-source project that ships compiled binaries needs releases that cost no manual steps and that users can verify, and a stream of dependency updates that stays current without trusting every fresh publish. Install-time protections are in [ADR 0004](0004-pnpm-and-turborepo-monorepo-with-source-consumed-packages.md); this record covers what runs on GitHub ([R11](../superpowers/research/2026-09-30-R11-github-automation-reference.md), [spec §11.4 and §11.5](../superpowers/specs/2026-09-30-workbox-foundation-vertical-slice-design.md)).

## Decision

**Commits and versions.** Conventional Commits are enforced by commitlint in the `commit-msg` hook and in CI (every commit of a pull request, in the `static` job), and the `pr-title` workflow validates the pull request title. Pull requests are squash-merged, so the title is the commit that release-please reads. release-please runs in manifest mode with one product version for the whole repository. The manifest starts at `0.0.0` and `initial-version` is `0.1.0`, so the first release is `v0.1.0`; with `bump-minor-pre-major`, `feat` and breaking changes bump the minor version and `fix` bumps the patch version until 1.0.

**Releases.** On every push to `main`, `release.yml` lets release-please open or update the release pull request (version bump and `CHANGELOG.md`). Merging it creates the tag and the GitHub Release, and the `build-binaries` job of the same workflow then builds the eight binaries of [ADR 0002](0002-one-bun-binary-for-cli-daemon-and-web-server.md) on one Linux runner, writes `workbox_<version>_checksums.txt` with `sha256sum`, attests the binaries with `actions/attest` (Sigstore build provenance) and uploads the binaries and the checksum file to the Release. The release build restores no cache of any kind (`no-cache: true` for Bun, no dependency cache), because release artifacts must not be built from a poisonable cache. Nothing is published to npm yet: the package name is an open question (`workbox` is taken, and Google's Workbox owns `workbox-cli` and other `workbox-*` names), and the command stays `workbox`.

**Dependency updates.** Renovate extends `config:best-practices`, groups non-major updates, runs weekly on early Monday mornings (Europe/Prague) and keeps at most ten pull requests open. Two rules merge automatically through GitHub's pull request auto-merge once the checks pass: minor and patch updates of the `dev` catalog (one "dev tooling" group) and digest, minor and patch updates of GitHub Actions once they are seven days old (one "github actions" group with `minimumReleaseAge: "7 days"`). Runtime updates, which come from the default catalog, and all major updates are merged by a human.

**Repository security checks.** Every action is pinned to a full commit SHA with a version comment; Renovate keeps the pins current, except the pinned actionlint installer in `ci.yml`, which is bumped by hand. Workflows default to no or read-only token permissions and grant writes per job. CI lints the workflows with actionlint, and three more workflows run on GitHub: zizmor (pedantic persona) lints them on pushes to `main` and on pull requests and reports through code scanning alerts; OpenSSF Scorecard runs on pushes to `main` and weekly, publishes its result for the README badge and uploads it to code scanning; gitleaks scans for committed secrets on pushes to `main`, on pull requests and daily.

## Consequences

- A release is one merge: merging the release pull request produces the tag, the GitHub Release, the binaries, the checksum file and the attestations. A download can be checked against the checksum file with `sha256sum -c` and against its attestation with `gh attestation verify`; attestations need a public repository. The binaries are not code-signed yet (the README documents removing the macOS quarantine flag), so these two are the integrity evidence until signing arrives.
- The release pull request is opened with the workflow's `GITHUB_TOKEN`, and GitHub does not start other workflows for events caused by that token, so `ci.yml` and `pr-title.yml` do not run on it. If `main` requires those checks, merging it needs a bypass or a token input (a personal access token or GitHub App token) on the release-please action, and the repository must allow GitHub Actions to create pull requests.
- Renovate's automerge works only when the Renovate app is installed, the repository allows auto-merge and `main` requires status checks. Its three-day npm cool-down, part of `config:best-practices`, matches pnpm's `minimumReleaseAge`; GitHub Actions updates wait seven days under their own rule, because no install-time age check like pnpm's applies to them.
- The zizmor action does not fail its own job on findings, so blocking a merge on one needs a code scanning requirement on `main`.
- Users get the binary from GitHub Releases. The npm meta-package with per-platform optional dependencies (spec §11.4) waits for the package name decision.
