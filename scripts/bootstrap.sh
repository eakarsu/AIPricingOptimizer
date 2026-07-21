#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
(cd "$PROJECT_DIR/backend" && npm ci)
(cd "$PROJECT_DIR/frontend" && npm ci)
echo "Lockfile-pinned dependencies installed; review audit output before startup."
