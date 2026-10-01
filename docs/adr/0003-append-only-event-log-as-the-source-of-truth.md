# 0003. Append-only event log as the source of truth

- Status: accepted
- Date: 2026-09-30

## Context

Chat, dashboard, office simulation, telemetry and later the phone client all need the same history of what agents did ([spec §5](../superpowers/specs/2026-09-30-workbox-foundation-vertical-slice-design.md)).

## Decision

The daemon writes semantic events to an append-only SQLite log; everything else is a projection. Streaming deltas are transient and never stored. Implemented from plan 2 on; `packages/protocol` is the home of the schemas and today holds the protocol version and the user configuration schema.

## Consequences

Replay makes the office simulation testable; adding a second harness or a remote client adds no new state model; the log doubles as the telemetry substrate.
