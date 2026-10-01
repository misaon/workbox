# Security policy

## Supported versions

Workbox is pre-1.0. Only the latest release and the `main` branch receive fixes.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting:
<https://github.com/misaon/workbox/security/advisories/new>

You will get an acknowledgement within 7 days and a fix or a mitigation plan within 30 days for confirmed reports.

## Scope

Workbox runs AI coding agents on your machine. Reports about the daemon's localhost authentication, credential handling (Workbox must never read or store vendor credentials), path traversal in the blob store or workspaces, and the compiled binaries are especially welcome.

## Verifying a release

Every release lists the SHA-256 checksum of each binary in `workbox_<version>_checksums.txt` and has a build-provenance attestation for each binary. Releases after v0.1.0 also attest the checksums file and attach the attestation as the Sigstore bundle `workbox_<version>.sigstore.json`, so a download can be checked against the bundle without calling GitHub's attestation API (the Sigstore trust root is still fetched unless you pass `--custom-trusted-root`). In the directory that holds your download, replace `<version>` with the release number without the leading `v` and `<file>` with the asset's name:

```bash
sha256sum --check --ignore-missing workbox_<version>_checksums.txt
gh attestation verify <file> --repo misaon/workbox
gh attestation verify <file> --repo misaon/workbox --bundle workbox_<version>.sigstore.json
```
