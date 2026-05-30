#!/usr/bin/env bash
#
# AIC Platform — Database Migration Runner
#
# Usage:
#   ./migrate.sh                  # Apply all pending migrations
#   ./migrate.sh --status         # Show migration status
#   ./migrate.sh --seed           # Run seed data (development only)
#   ./migrate.sh --reset          # Drop all tables and re-apply (DESTRUCTIVE)
#
# Migrations are stored in db/migrations/ as numbered SQL files.
# Each migration is applied once and tracked in the _migrations table.
#
# Requires: psql, .env file in project root (or env vars set directly)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
SEED_FILE="$SCRIPT_DIR/seed.sql"

# Load .env from project root if it exists
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-aic_admin}"
DB_PASS="${POSTGRES_PASSWORD:-aic_password_secure}"
DB_NAME="${POSTGRES_DB:-aic_platform}"

export PGPASSWORD="$DB_PASS"

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1"

echo "=== AIC Database Migrations ==="
echo "Host: $DB_HOST:$DB_PORT  Database: $DB_NAME"
echo ""

# Ensure migrations tracking table exists
$PSQL -q -c "
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);" 2>/dev/null

# --status: show what's applied
if [ "${1:-}" = "--status" ]; then
  echo "Applied migrations:"
  $PSQL -c "SELECT filename, applied_at FROM _migrations ORDER BY filename;"
  echo ""
  echo "Pending migrations:"
  for f in "$MIGRATIONS_DIR"/*.sql; do
    fname="$(basename "$f")"
    applied=$($PSQL -t -c "SELECT COUNT(*) FROM _migrations WHERE filename = '$fname';" | tr -d ' ')
    if [ "$applied" = "0" ]; then
      echo "  - $fname"
    fi
  done
  exit 0
fi

# --seed: run seed data
if [ "${1:-}" = "--seed" ]; then
  if [ ! -f "$SEED_FILE" ]; then
    echo "ERROR: Seed file not found: $SEED_FILE"
    exit 1
  fi
  echo "Applying seed data from $SEED_FILE..."
  $PSQL -f "$SEED_FILE"
  echo "Seed data applied."
  exit 0
fi

# --reset: drop everything (DESTRUCTIVE)
if [ "${1:-}" = "--reset" ]; then
  echo "WARNING: This will DROP ALL TABLES in $DB_NAME."
  read -p "Type 'yes' to confirm: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
  echo "Dropping all tables..."
  $PSQL -c "
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO $DB_USER;
  "
  # Re-create migrations table
  $PSQL -q -c "
  CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );"
  echo "All tables dropped. Re-running migrations..."
fi

# Apply pending migrations in order
applied=0
for f in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  fname="$(basename "$f")"

  # Check if already applied
  count=$($PSQL -t -c "SELECT COUNT(*) FROM _migrations WHERE filename = '$fname';" | tr -d ' ')
  if [ "$count" != "0" ]; then
    continue
  fi

  echo "Applying: $fname"
  $PSQL -f "$f"
  $PSQL -c "INSERT INTO _migrations (filename) VALUES ('$fname');"
  applied=$((applied + 1))
done

if [ "$applied" -eq 0 ]; then
  echo "No pending migrations."
else
  echo ""
  echo "$applied migration(s) applied successfully."
fi
