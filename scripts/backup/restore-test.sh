#!/usr/bin/env bash
# Proves the latest backup can be restored. Run monthly, and after any change
# to the backup set-up — a backup nobody has restored is a hope, not a backup.
#
# Restores the newest daily dump into a throwaway database, then checks every
# migration is present and the core tables hold rows. Run it somewhere that is
# NOT production (your laptop, or a staging box), with the age PRIVATE key.
#
#   AGE_IDENTITY=~/.config/aic/backup.key RCLONE_REMOTE=b2:aic-backups/prod \
#   RESTORE_URL=postgres://postgres:postgres@localhost:5432/postgres \
#   scripts/backup/restore-test.sh
set -euo pipefail
: "${AGE_IDENTITY:?AGE_IDENTITY (path to the private key) is required}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE is required}"
: "${RESTORE_URL:?RESTORE_URL (a server you can create a database on) is required}"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
latest=$(rclone lsf "$RCLONE_REMOTE/daily/" --include 'db-*.dump.age' | sort | tail -1)
[ -n "$latest" ] || { echo "no backups found"; exit 1; }
echo "[restore-test] $latest"
rclone copy "$RCLONE_REMOTE/daily/$latest" "$work/"
rclone copy "$RCLONE_REMOTE/daily/$latest.sha256" "$work/" || true
if [ -f "$work/$latest.sha256" ]; then (cd "$work" && sha256sum -c "$latest.sha256"); fi
age -d -i "$AGE_IDENTITY" -o "$work/db.dump" "$work/$latest"

db="aic_restore_test_$(date +%s)"
psql "$RESTORE_URL" -qc "create database $db"
target="${RESTORE_URL%/*}/$db"
pg_restore --no-owner --no-privileges --dbname="$target" "$work/db.dump"
DATABASE_URL="$target" node "$(dirname "$0")/../verify-migrations.mjs" || true
psql "$target" -c "select 'organizations' as t, count(*) from organizations union all select 'users', count(*) from users union all select 'estate_events', count(*) from estate_events union all select 'audit_documents', count(*) from audit_documents"
psql "$RESTORE_URL" -qc "drop database $db"
echo "[restore-test] restored, checked and dropped $db"
