# 0010. Claude through the Agent SDK with the user's own login

- Status: accepted
- Date: 2026-09-30

## Context

Anthropic's help centre states that Agent SDK, headless CLI and third-party app usage draw from the subscription, while its legal page forbids third parties from intermediating tokens or offering claude.ai login; the policy changed four times in 2026 ([R1](../superpowers/research/2026-09-30-R1-subscriptions-and-agent-auth.md)).

## Decision

Workbox runs the unmodified Claude Code binary through `@anthropic-ai/claude-agent-sdk` with the login the user performed in Anthropic's own flow (`claude auth login`). Workbox never reads, copies, refreshes or stores tokens; `workbox doctor` (and the later `workbox auth`) only report the exit code of `claude auth status`, plus the configuration directory it names when it prints one. An API-key mode with a budget cap ships alongside as the compliance fallback.

## Consequences

The Claude adapter (plan 4) is isolated behind the `HarnessAdapter` port so a policy change swaps one package; the sandbox providers (product plan 5) must let the login happen inside the sandbox rather than forwarding credentials.
