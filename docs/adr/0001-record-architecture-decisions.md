# 0001. Record architecture decisions

- Status: accepted
- Date: 2026-09-30

## Context

Workbox makes many bleeding-edge technology choices that were verified online at a point in time. Contributors need to know what was decided, why, and what would change the decision.

## Decision

Every decision that shapes the architecture or the toolchain gets a numbered Markdown file in `docs/adr` with the sections Context, Decision and Consequences. Superseded records stay in place with their status updated. Where the spec and an ADR disagree, the ADR records the as-built decision and wins; the spec is amended afterwards.

## Consequences

Decisions are reviewable in pull requests; the research reports in `docs/superpowers/research` are the evidence base and are linked, not copied.
