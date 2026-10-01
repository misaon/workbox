# Security policy

## Supported versions

Workbox is pre-1.0. Only the latest release and the `main` branch receive fixes.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting:
<https://github.com/misaon/workbox/security/advisories/new>

You will get an acknowledgement within 7 days and a fix or a mitigation plan within 30 days for confirmed reports.

## Scope

Workbox runs AI coding agents on your machine. Reports about the daemon's localhost authentication, credential handling (Workbox must never read or store vendor credentials), path traversal in the blob store or workspaces, and the compiled binaries are especially welcome.
