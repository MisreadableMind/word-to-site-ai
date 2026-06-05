#!/usr/bin/env bash

set -euo pipefail

# Directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/src/db/migrations"

mkdir -p "$MIGRATIONS_DIR" 2>/dev/null || true

# Accept name as first arg or prompt
NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  read -rp "Migration name (e.g., add_users_table): " NAME
fi

# sanitize name: lowercase, replace spaces with underscores, remove non-alphanum/underscore/dash
SAFE_NAME=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[[:space:]]+/_/g; s/[^a-z0-9_-]+//g')
if [[ -z "$SAFE_NAME" ]]; then
  echo "Error: migration name cannot be empty after sanitization" >&2
  exit 1
fi

# Timestamp in local time YYYYMMDDHHMMSS — keeps migrations in chronological order
TS=$(date +%Y%m%d%H%M%S)

FILENAME="${TS}_${SAFE_NAME}.sql"
FILEPATH="$MIGRATIONS_DIR/$FILENAME"

if [[ -e "$FILEPATH" ]]; then
  echo "Error: file already exists: $FILEPATH" >&2
  exit 1
fi

cat > "$FILEPATH" <<'SQL'
-- Write your SQL migration here. Keep statements idempotent
-- (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
-- Up migration:

-- Down migration (optional, for manual rollback):
SQL

echo "Created migration: $FILEPATH"
echo "Apply it manually:  psql \"\$DATABASE_URL\" -f $FILEPATH"
