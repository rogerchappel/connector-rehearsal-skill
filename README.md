# connector-rehearsal-skill

`connector-rehearsal-skill` turns planned connector writes into local dry-run artifacts: a normalized rehearsal JSON file, a Markdown approval packet, and a simple before/after diff.

It is built for agents that need to preview side effects before touching Slack, CRMs, GitHub, project managers, calendars, or internal connector gateways.

## Quickstart

```bash
npm install
npm run build
node dist/src/cli.js --help
node dist/src/cli.js rehearse fixtures/slack-action.json --format markdown
node dist/src/cli.js plan fixtures/slack-action.json --out tmp/rehearsal
node dist/src/cli.js diff fixtures/before.json fixtures/after.json
```

## Commands

- `plan <manifest> --out <dir>` writes `rehearsal.json` and `approval.md`.
- `rehearse <manifest> --format json|markdown` prints the dry-run artifact.
- `render-approval <manifest> --out approval.md` writes a human review packet.
- `diff <before.json> <after.json>` prints changed fields for rollback review.

## Manifest Shape

```json
{
  "connector": "slack",
  "action": "post_message",
  "target": "#release-review",
  "payload": {
    "text": "Release candidate is ready for human review."
  },
  "approval_required": true,
  "risk_level": "medium",
  "rollback_note": "Do not post until approved.",
  "evidence": ["docs/RELEASE_CANDIDATE.md"]
}
```

Manifests may be JSON or YAML (`.yaml`/`.yml`). YAML input supports nested
mappings and sequences, quoted scalars, booleans, numbers, and null values.
Malformed YAML and duplicate mapping keys fail with a nonzero CLI exit before
any rehearsal is marked ready.

Before generating an artifact, the CLI validates all runtime input. Connector
and action names must be non-empty strings; targets must be a non-empty string
or string array; payloads must be non-empty objects; and optional approval,
risk, rollback, and evidence fields must match the documented types. Invalid
manifests exit with an actionable `Invalid manifest:` error and do not produce
approval artifacts.

## Safety Notes

This project never calls external services and never stores credentials. It flags missing rollback notes, broad targets, disabled approval, missing evidence, and secret-looking payload keys.

## Limitations

- Risk inference is rule-based and should be reviewed by a human.
- The CLI does not replace connector SDK authorization or policy engines.

## Verification

```bash
npm run release:check
```

The release check runs:

```bash
npm run check
npm run lint
npm test
npm run smoke
npm run package:smoke
```

`package:smoke` builds the TypeScript output and runs `npm pack --dry-run` so
reviewers can confirm the CLI, fixtures, docs, changelog, README, and license are
included before a release. It also asserts that the security policy ships in
the tarball.
