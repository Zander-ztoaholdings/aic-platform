#!/usr/bin/env bash
# Nightly encrypted backup of the AIC database and evidence store, sent off
# the VPS. Run from cron on the VPS (or a Coolify scheduled task on a small
# utility container) — see docs/OPERATIONS.md.
#
# What it does:
#   1. pg_dump of the production database (custom format, compressed).
#   2. A copy of the MinIO evidence bucket.
#   3. Encrypts both with age to a public key (the private key is NOT on the
#      VPS, so a compromised server cannot read old backups).
#   4. Uploads to S3-compatible storage (Backblaze B2, Cloudflare R2, AWS S3).
#   5. Keeps 30 daily and 12 monthly copies; deletes older ones.
#
# Needs on the host: pg_dump (16), age, rclone. Environment:
#   DATABASE_URL           owner connection string
#   AGE_RECIPIENT          the backup public key (age1…)
#   RCLONE_REMOTE          configured rclone remote:bucket/path, e.g. b2:aic-backups/prod
#   MINIO_RCLONE_REMOTE    optional rclone remote for the evidence bucket, e.g. minio:aic-evidence
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT is required}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE is required}"

stamp=$(date -u +%Y-%m-%dT%H%MZ)
day=$(date -u +%d)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "[backup] dumping database"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > "$work/db.dump"
pg_restore --list "$work/db.dump" > /dev/null   # a dump that cannot be listed is not a backup
age -r "$AGE_RECIPIENT" -o "$work/db-$stamp.dump.age" "$work/db.dump"
(cd "$work" && sha256sum "db-$stamp.dump.age" > "db-$stamp.dump.age.sha256")

rclone copy "$work/db-$stamp.dump.age" "$RCLONE_REMOTE/daily/"
rclone copy "$work/db-$stamp.dump.age.sha256" "$RCLONE_REMOTE/daily/"
if [ "$day" = "01" ]; then
  rclone copy "$work/db-$stamp.dump.age" "$RCLONE_REMOTE/monthly/"
fi

if [ -n "${MINIO_RCLONE_REMOTE:-}" ]; then
  echo "[backup] syncing evidence files"
  # Evidence is append-only by design, so a sync is a full copy without
  # re-uploading what is already there. Files are encrypted by the remote
  # (configure the rclone remote as a 'crypt' remote).
  rclone sync "$MINIO_RCLONE_REMOTE" "$RCLONE_REMOTE/evidence/" --checksum
fi

echo "[backup] pruning"
rclone delete "$RCLONE_REMOTE/daily/" --min-age 31d 2>/dev/null || true
rclone delete "$RCLONE_REMOTE/monthly/" --min-age 366d 2>/dev/null || true

echo "[backup] done: db-$stamp.dump.age"
