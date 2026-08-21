# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately
through GitHub's vulnerability reporting for this repository:

https://github.com/avihut/dumbshow/security/advisories/new

You will get an acknowledgement within a few days. Once a fix is ready it
ships as a normal release and the advisory is published with credit, unless
you ask otherwise.

## Supported versions

dumbshow is pre-1.0. Only the latest release on npm receives fixes.

## What the project does on its side

- Dependabot alerts and security updates are enabled; version updates run
  under a 7-day cooldown (`.github/dependabot.yml`, `pnpm-workspace.yaml`).
- CodeQL default setup scans the repository.
- Every GitHub Action is pinned to a full commit SHA (required by the
  repository's Actions policy).
- Releases are published to npm through trusted publishing (OIDC) with
  provenance attestations — no long-lived registry tokens exist anywhere.
