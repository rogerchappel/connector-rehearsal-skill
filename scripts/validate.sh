#!/usr/bin/env bash
set -euo pipefail

npm run check
npm test
npm run smoke
node dist/src/cli.js plan fixtures/slack-action.json --out tmp/rehearsal
node dist/src/cli.js rehearse fixtures/github-action.json --format json
