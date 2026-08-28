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
  Like `plan` and `rehearse`, it exits nonzero when the rehearsal contains an
  error. The packet is still retained for diagnosis, and the CLI reports that
  approval is blocked instead of reporting a successful write.
- `diff <before.json> <after.json>` prints changed fields for rollback review.

Diff paths use dot notation for identifier-like keys and bracketed JSON strings
for keys that contain punctuation. For example, nested `{ "a": { "b": 2 } }`
is reported as `a.b`, while the literal key `{ "a.b": 1 }` is reported as
`["a.b"]`, so additions, removals, and changes cannot collide.
Empty objects are retained as diff values, including at nested paths, so adding
or removing an empty configuration section is reported instead of producing
`No changes.`.

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

This project never calls external services and never stores credentials. It
flags missing rollback notes, broad targets, disabled approval, missing
evidence, and secret-looking payload keys. Payload inspection and preview
redaction recurse through objects and arrays at every depth: secret-like values
are replaced with `[REDACTED]`, while ordinary array values and structure are
preserved. A detected secret-like key blocks approval readiness.

Broad-target inference recognizes `*` and the words `all`, `everyone`,
`workspace`, `org`, and `organization` when they are standalone or delimited by
non-alphanumeric characters (for example, `#all-hands`). Embedded substrings in
identifiers such as `#small-team` or `organizationId` are not treated as broad
targets.

Action-name risk inference matches complete mutation tokens. It recognizes tokens separated by non-alphanumeric delimiters (such as `_`, `-`, `.`, and `/`) or camel-case boundaries, so `delete_contact`, `send-message`, and `bulkInvite` are classified by their mutation verbs. Mutation-looking substrings within a token do not count: read-like names such as `sender_lookup` and `undelete_contact` remain low risk unless another rule applies.

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
npm run build
npm run test:compiled
npm run smoke:compiled
npm run validate:cli
npm run package:smoke
```

The gate builds once, then runs the compiled test and smoke suites. `validate:cli`
exercises plan artifact generation and a JSON rehearsal. `package:smoke` runs
`npm pack --dry-run` against that build so
reviewers can confirm the CLI, fixtures, docs, changelog, README, and license are
included before a release. It also asserts that the security policy ships in
the tarball.
