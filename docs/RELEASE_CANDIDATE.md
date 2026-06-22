# Release Candidate Notes

## 0.1.0

Initial public build with:

- Local-first TypeScript CLI.
- Connector action manifest rehearsal.
- JSON and simple YAML input support.
- Markdown approval packet rendering.
- Before/after JSON diffing for rollback review.
- Safety checks for approvals, rollback notes, broad targets, evidence, and secret-looking payload keys.
- Fixture-backed tests and smoke commands.

## Verification Checklist

- `npm test`
- `npm run check`
- `npm run build`
- `npm run smoke`
- `bash scripts/validate.sh`
