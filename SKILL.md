# connector-rehearsal-skill

Use this skill when an agent has a planned connector action and needs a local dry run, approval packet, risk check, or rollback note before any external write occurs.

## Required Inputs

- A local JSON or simple YAML connector action manifest.
- Optional before/after JSON snapshots for diff review.
- A local output directory for rehearsal artifacts.

## Side-Effect Boundaries

- Read and write local files only.
- Do not call Slack, CRM, GitHub, calendar, project-management, or custom connector APIs.
- Do not store credentials.
- Do not execute the planned connector action.

## Approval Requirements

Human approval is required before any external write. Approval packets should include target, payload preview, risk level, rollback note, evidence, and validation issues.

## Examples

```bash
connector-rehearsal plan fixtures/slack-action.json --out tmp/rehearsal
connector-rehearsal rehearse fixtures/crm-update.yaml --format markdown
connector-rehearsal diff fixtures/before.json fixtures/after.json
```

## Validation Workflow

1. Normalize the manifest with `rehearse` or `plan`.
2. Review warnings and errors.
3. Attach `approval.md` to the human approval request.
4. Use the rollback note and diff before any live connector write.
