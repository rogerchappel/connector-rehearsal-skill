# Orchestration

## Agent Flow

1. Write a local connector action manifest from the planned operation.
2. Run `connector-rehearsal rehearse <manifest> --format markdown`.
3. Resolve errors, especially missing rollback notes and secret-like payload keys.
4. Run `connector-rehearsal plan <manifest> --out tmp/rehearsal`.
5. Present `tmp/rehearsal/approval.md` to the human approver.
6. Only after explicit approval, use the relevant connector workflow outside this V1 tool.

## Failure Handling

- Errors block approval readiness.
- Warnings require explicit reviewer acknowledgement.
- Broad targets should be narrowed or escalated.
- Secret-like payload fields must be removed or represented by safe placeholders.

## External Actions

No external writes are allowed in V1. Live connector execution belongs to a separate approved workflow.
