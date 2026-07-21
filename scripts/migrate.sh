#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${MIGRATION_ACK:-}" != "apply-governed-pricing-001" ]];then echo "Set MIGRATION_ACK=apply-governed-pricing-001 after backup and migration review." >&2;exit 1;fi
if [[ -z "${DATABASE_URL:-}" ]];then echo "DATABASE_URL is required; no database is created by this script." >&2;exit 1;fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$PROJECT_DIR/backend/migrations/001_governed_pricing.sql"
