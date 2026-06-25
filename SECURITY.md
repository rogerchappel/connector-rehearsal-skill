# Security Policy

## Supported Versions

Security fixes are handled on the latest `main` branch and the most recent npm
package version.

## Reporting a Vulnerability

Please report suspected vulnerabilities by opening a private GitHub security
advisory for this repository. Include:

- the affected version or commit
- a minimal connector rehearsal fixture or command that reproduces the issue
- expected and observed behavior
- any known workaround

Do not include credentials, live connector payloads, private customer data, or
production approval details in public issues.

## Scope

This package is a local rehearsal planner. It renders dry-run artifacts and
approval packets from supplied manifests; it should not execute connector
actions, write to external accounts, or contact live services as part of normal
operation.
