# Backup Strategy

## Overview

MyClaw uses a partitioned backup approach: different data types are backed up differently based on their origin and importance.

## Backup Matrix

| Data | Method | Frequency | Retention | Location |
|------|--------|-----------|-----------|----------|
| Code | Git push | Every commit | Unlimited | GitHub |
| Vault (your edits) | Google Drive Desktop | Instant | Google Drive history | Google Drive |
| Vault (memories) | rclone push | Every 5 min | Unlimited | Google Drive |
| SQLite DB | rclone copy | Hourly | All versions | Google Drive |
| .env secrets | Manual | On change | Latest | GitHub Secrets |

## SQLite Backup

The SQLite database contains conversations and vector embeddings. It's backed up hourly.

### Cron job (`/etc/cron.d/myclaw-sync`)

```cron
0 * * * * deploy rclone copy /opt/myclaw/data/myclaw.db gdrive:myclaw-backups/db/ 2>&1 | logger -t myclaw-backup
```

### Where backups go

```
Google Drive/
  myclaw-backups/
    db/
      myclaw.db          ← Latest copy (overwritten hourly)
```

### Verify backups

```bash
# Check latest backup timestamp
rclone lsl gdrive:myclaw-backups/db/myclaw.db

# Check backup size (should grow over time)
rclone size gdrive:myclaw-backups/db/
```

## Vault Sync

### Pull (Google Drive → VPS)

Your edits in Obsidian sync to the VPS every 5 minutes:
```cron
*/5 * * * * deploy rclone sync gdrive:myclaw-vault /opt/myclaw/vault --exclude "memories/**"
```

### Push (VPS → Google Drive)

Bot-generated memories sync back every 5 minutes:
```cron
*/5 * * * * deploy rclone sync /opt/myclaw/vault/memories/ gdrive:myclaw-vault/memories/
```

### Why partitioned?

- **You** write: soul.md, user.md, heartbeat.md, skills/ — via Obsidian
- **Bot** writes: memories/ — via auto-summarization

No sync conflicts because each side owns different files.

## Monitoring

### Check sync logs

```bash
# Recent sync activity
journalctl -t myclaw-sync --since "1 hour ago"

# Recent backup activity
journalctl -t myclaw-backup --since "2 hours ago"
```

### Manual sync

```bash
# Force pull vault
rclone sync gdrive:myclaw-vault /opt/myclaw/vault --exclude "memories/**" -v

# Force backup DB
rclone copy /opt/myclaw/data/myclaw.db gdrive:myclaw-backups/db/ -v
```

## Recovery

See [disaster-recovery.md](disaster-recovery.md) for full recovery procedures.

Quick restore:
```bash
# Restore vault
rclone sync gdrive:myclaw-vault /opt/myclaw/vault

# Restore DB
rclone copy gdrive:myclaw-backups/db/myclaw.db /opt/myclaw/data/

# Re-embed if DB is missing or corrupted
docker compose exec myclaw node dist/scripts/embed-vault.js
```
