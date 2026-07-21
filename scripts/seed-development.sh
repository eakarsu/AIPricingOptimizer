#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${NODE_ENV:-development}" == "production" ]];then echo "The destructive legacy seed is disabled in production." >&2;exit 1;fi
if [[ "${SEED_ACK:-}" != "reset-local-pricing-database" ]];then echo "Legacy seed drops local tables. Set SEED_ACK=reset-local-pricing-database only for a disposable development database." >&2;exit 1;fi
(cd "$PROJECT_DIR/backend" && node seed.js)
