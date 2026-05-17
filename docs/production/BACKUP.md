# Backup & Recovery — Payment Status Indexer

> Runbook for backing up and restoring the indexer's database. The
> indexer is a **read-only** cache of on-chain events, so the
> authoritative source is always the TON blockchain. Backups exist to
> shorten recovery time, not to protect from data loss.

This document covers the SQLite-on-volume deployment (used in local
development and single-VM production) and the managed PostgreSQL
deployment (used in Kubernetes). The same migration history file
(`schema_migrations` table — see `docs/database-schema.md`) is captured
in both cases so restores can verify the schema version before any
service is started.

---

## 1. Recovery objectives

| Tier            | RPO (data loss)         | RTO (downtime)            |
|-----------------|-------------------------|---------------------------|
| Local dev       | Best effort             | Manual rebuild from chain |
| Staging         | 24 h                    | < 4 h                     |
| Production      | 24 h via daily snapshot | < 1 h with hot restore    |

If the backup is older than the indexer's confirmation window
(`INDEXER_CONFIRMATION_BLOCKS`, default 10), the restored service will
still self-heal by re-indexing from the chain up to the current head.

---

## 2. Backup schedule

| Environment   | Engine        | Frequency               | Retention             | Trigger                                     |
|---------------|---------------|-------------------------|-----------------------|---------------------------------------------|
| Local dev     | SQLite        | None (transient)        | n/a                   | n/a                                         |
| Single-VM     | SQLite        | Daily (02:00 UTC)       | 30 daily snapshots    | systemd timer → `backup-indexer.sh`         |
| Kubernetes    | PostgreSQL    | Daily (02:00 UTC)       | 30 daily snapshots    | CronJob → managed snapshot or `pg_dump`     |
| Kubernetes    | PostgreSQL    | Continuous WAL (PITR)   | 7 days                | Managed provider (RDS/CloudSQL)             |

Backups must be:

- **Compressed** with `gzip -9` (or `zstd -19`) — payload is small but
  highly compressible because of repeated NFT addresses.
- **Checksummed** with SHA-256 — every backup file has a sibling
  `*.sha256` manifest.
- **Encrypted at rest** — use the storage provider's KMS-backed
  encryption (e.g. `s3:bucket-key-enabled`, GCS CMEK).
- **Versioned** — when using object storage, enable versioning so a
  bad backup overwrite is recoverable.

Database credentials, KMS keys, and bucket URIs are stored in the
secret store (Vault / Kubernetes Secrets / AWS Secrets Manager) — never
in the repository. See `docs/production/INFRASTRUCTURE.md` for the
expected secret layout.

---

## 3. SQLite backup procedure (single-VM)

### 3.1 Create a backup

The indexer holds an exclusive WAL lock while writing. Use SQLite's
`.backup` command rather than `cp` — it issues `BEGIN IMMEDIATE` and
produces a consistent snapshot even while the service runs.

```bash
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR=/var/backups/tonbankcard/indexer
mkdir -p "$BACKUP_DIR"

sqlite3 /var/lib/tonbankcard/indexer.db \
  ".backup '$BACKUP_DIR/indexer-$TIMESTAMP.db'"

gzip -9 "$BACKUP_DIR/indexer-$TIMESTAMP.db"
sha256sum "$BACKUP_DIR/indexer-$TIMESTAMP.db.gz" \
  > "$BACKUP_DIR/indexer-$TIMESTAMP.db.gz.sha256"

# Push to encrypted object storage.
aws s3 cp "$BACKUP_DIR/indexer-$TIMESTAMP.db.gz" \
  s3://tonbankcard-backups/indexer/ \
  --sse aws:kms --sse-kms-key-id "$KMS_KEY_ID"
aws s3 cp "$BACKUP_DIR/indexer-$TIMESTAMP.db.gz.sha256" \
  s3://tonbankcard-backups/indexer/ --sse aws:kms --sse-kms-key-id "$KMS_KEY_ID"

# Retention: keep 30 days locally.
find "$BACKUP_DIR" -name 'indexer-*.db.gz*' -mtime +30 -delete
```

Wrap the snippet in `/usr/local/bin/backup-indexer.sh` and schedule it
with a systemd timer (`/etc/systemd/system/backup-indexer.timer`,
`OnCalendar=*-*-* 02:00:00`).

### 3.2 Verify the snapshot

```bash
gunzip -t "$BACKUP_DIR/indexer-$TIMESTAMP.db.gz"
sha256sum -c "$BACKUP_DIR/indexer-$TIMESTAMP.db.gz.sha256"
gunzip -k "$BACKUP_DIR/indexer-$TIMESTAMP.db.gz"
sqlite3 "$BACKUP_DIR/indexer-$TIMESTAMP.db" 'PRAGMA integrity_check;'
sqlite3 "$BACKUP_DIR/indexer-$TIMESTAMP.db" \
  'SELECT version, name, applied_at FROM schema_migrations ORDER BY version;'
```

`PRAGMA integrity_check` must print `ok`. The migration history must
match the running service's migrations (use `npm run db:migrate:status`
on the indexer to compare).

### 3.3 Restore

```bash
systemctl stop tonbankcard-indexer
mv /var/lib/tonbankcard/indexer.db /var/lib/tonbankcard/indexer.db.bad
aws s3 cp s3://tonbankcard-backups/indexer/indexer-$TIMESTAMP.db.gz .
gunzip indexer-$TIMESTAMP.db.gz
sha256sum -c indexer-$TIMESTAMP.db.gz.sha256  # check before installing
install -m 0640 -o tonbankcard -g tonbankcard \
  indexer-$TIMESTAMP.db /var/lib/tonbankcard/indexer.db
systemctl start tonbankcard-indexer
journalctl -u tonbankcard-indexer -f
```

After startup the indexer will:

1. Open the restored SQLite file.
2. Run `applySqliteMigrationsSync` (no-op if `schema_migrations`
   already lists every shipped migration).
3. Resume from `indexer_state.latest_block_indexed`.
4. Replay the chain to current head — this fills any gap covered by
   the RPO window.

---

## 4. PostgreSQL backup procedure (Kubernetes)

### 4.1 Managed snapshots (preferred)

The recommended path is to rely on the managed provider:

- **AWS RDS** — enable automated backups with a 7-day retention plus
  daily manual snapshots replicated to a secondary region.
- **GCP Cloud SQL** — enable automated backups + point-in-time recovery.

For both providers, encryption at rest uses the provider's KMS.
Confirm by inspecting the instance's "Encryption" panel.

### 4.2 `pg_dump` fallback (Kubernetes CronJob)

```yaml
# infra/helm/indexer/templates/cronjob-backup.yaml (excerpt)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: indexer-postgres-backup
spec:
  schedule: "0 2 * * *"
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: postgres:16-alpine
              env:
                - name: PGURL
                  valueFrom:
                    secretKeyRef:
                      name: tonbankcard-indexer
                      key: DATABASE_URL
              command: ["/bin/sh", "-c"]
              args:
                - |
                  set -euo pipefail
                  TS=$(date -u +%Y%m%dT%H%M%SZ)
                  pg_dump --format=custom --compress=9 "$PGURL" > "/tmp/indexer-$TS.dump"
                  sha256sum "/tmp/indexer-$TS.dump" > "/tmp/indexer-$TS.dump.sha256"
                  aws s3 cp "/tmp/indexer-$TS.dump" \
                    s3://tonbankcard-backups/indexer/ \
                    --sse aws:kms --sse-kms-key-id "$KMS_KEY_ID"
                  aws s3 cp "/tmp/indexer-$TS.dump.sha256" \
                    s3://tonbankcard-backups/indexer/ \
                    --sse aws:kms --sse-kms-key-id "$KMS_KEY_ID"
```

### 4.3 Verify the snapshot

```bash
sha256sum -c indexer-$TS.dump.sha256
pg_restore --list indexer-$TS.dump | head    # smoke test
# Restore into a scratch database and check migration history:
createdb verify_indexer
pg_restore --clean --if-exists --dbname=verify_indexer indexer-$TS.dump
psql verify_indexer -c 'SELECT version, name, applied_at FROM schema_migrations ORDER BY version;'
dropdb verify_indexer
```

The migration history must match `npm run db:migrate:status`.

### 4.4 Restore

```bash
# 1. Scale the indexer Deployment to zero so no writer reconnects.
kubectl -n tonbankcard scale deploy/indexer --replicas=0

# 2. Drop and recreate the target database (managed provider equivalent).
psql "$ADMIN_PGURL" -c 'DROP DATABASE IF EXISTS tonbankcard_indexer;'
psql "$ADMIN_PGURL" -c 'CREATE DATABASE tonbankcard_indexer;'

# 3. Restore.
pg_restore --no-owner --no-privileges --dbname="$PGURL" indexer-$TS.dump

# 4. Scale back up.
kubectl -n tonbankcard scale deploy/indexer --replicas=1
kubectl -n tonbankcard logs -f deploy/indexer
```

The indexer entry point calls the async `Migrator.up()` before opening
the API listener, so any migrations introduced after the snapshot will
be applied automatically. Migrations whose checksum has changed since
the snapshot are reported as `DRIFT` by `npm run db:migrate:status` —
investigate before continuing.

---

## 5. Disaster scenario — total loss

If both the live database and all backups are unrecoverable, the
indexer can still be reconstructed because every row is derived from
the blockchain:

```bash
# Start with an empty database and let the indexer rebuild from genesis.
rm -f /var/lib/tonbankcard/indexer.db        # SQLite
# or
psql "$ADMIN_PGURL" -c 'DROP DATABASE tonbankcard_indexer; CREATE DATABASE tonbankcard_indexer;'

# Apply migrations and start the service.
DB_PATH=/var/lib/tonbankcard/indexer.db npm run db:migrate
systemctl start tonbankcard-indexer
```

Full rebuild time scales linearly with `INDEXER_START_BLOCK`. Plan for
several hours on mainnet; the service is read-only during rebuild and
its `/health` endpoint reports `ready=false` until it catches up.

---

## 6. Quarterly disaster-recovery drill

The on-call rotation runs a restore drill every quarter against the
staging environment. The drill must:

1. Pick a backup older than 24 h.
2. Restore it into a scratch namespace / VM.
3. Run `npm run db:migrate:status` and confirm zero drift.
4. Boot the indexer and run the API smoke tests (`api/scripts/smoke.sh`).
5. Record start time, end time, and any deviations in
   `docs/production/on-call.md`.

A failed drill is a P2 incident — the SLO for restore time
(< 1 h) is part of the production SLA in `docs/production/SLA.md`.
