# PRD: connector-rehearsal-skill

## Problem

Agents often know what connector action they intend to perform before the action is approved. Teams need a repeatable local rehearsal step that shows targets, payloads, rollback notes, risk, and evidence without touching live accounts.

## Goals

- Normalize local connector action manifests.
- Produce dry-run JSON artifacts and Markdown approval packets.
- Detect missing approval boundaries, broad targets, missing rollback notes, missing evidence, and secret-looking payload keys.
- Support sample Slack-like, CRM-like, and GitHub-like fixtures.

## Non-Goals

- Performing live connector writes.
- Replacing connector SDKs or policy engines.
- Storing credentials.

## Users

- Agents preparing connector action plans.
- Humans approving external writes.
- Teams adding dry-run evidence to agent workflows.

## MVP

The V1 CLI provides `plan`, `rehearse`, `diff`, and `render-approval`, backed by fixture tests and local smoke commands.
