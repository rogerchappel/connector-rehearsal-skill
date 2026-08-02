#!/usr/bin/env bash
set -euo pipefail

npm run check
npm run build
npm run test:compiled
npm run smoke:compiled
npm run validate:cli
npm run package:smoke
