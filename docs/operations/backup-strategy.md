# Backup Strategy

## Overview

Sam uses a partitioned backup approach: different data types are backed up differently based on their origin and importance.

## Backup Matrix

| Data | Method | Frequency | Retention | Location |
|------|--------|-----------|-----------|----------|
| Code | Git push | Every commit | Unlimited | GitHub |
| Vault (your edits) | Google Drive Desktop | Instant | Google Drive history | Google Drive |
| Vault (memories) | rclone push | Every 5 min | Unlimited | Google Drive |
| SQLite DB | rclone copy | Daily (3:00) | Latest | Google Drive |
| .env secrets | Manual | On change | Latest | GitHub Secrets |

## SQLite Backup

The SQLite database contains conversations and vector embeddings. It's backed up daily via a systemd timer.

### Systemd timer (`sam-db-backup`)

Defined in `nixos/sam.nix`. Runs daily at 03:00:
```
rclone copy /var/lib/sam/data/sam.db gdrive:backups/sam/ --config /var/lib/sam/.config/rclone/rclone.conf
```

### Where backups go

```
Google Drive/
  backups/
    sam/
      sam.db          ← Latest copy (overwritten daily)
```

### Verify backups

```bash
# Check timer status
systemctl status sam-db-backup.timer

# Check latest backup timestamp
sudo -u sam rclone lsl gdrive:backups/sam/sam.db --config /var/lib/sam/.config/rclone/rclone.conf

# Check backup size (should grow over time)
sudo -u sam rclone size gdrive:backups/sam/ --config /var/lib/sam/.config/rclone/rclone.conf
```

## Vault Sync

### Pull (Google Drive → Server)

Your edits in Obsidian sync to the server every 5 minutes via the `sam-vault-pull` systemd timer:
```
rclone sync gdrive:vault /var/lib/sam/vault --config /var/lib/sam/.config/rclone/rclone.conf
```

### Push (Server → Google Drive)

Bot-generated memories sync back every 5 minutes (offset by 2.5 min) via the `sam-vault-push` systemd timer:
```
rclone sync /var/lib/sam/vault/memories/ gdrive:vault/memories/ --config /var/lib/sam/.config/rclone/rclone.conf
```

### Why partitioned?

- **You** write: soul.md, user.md, heartbeat.md, skills/ — via Obsidian
- **Bot** writes: memories/ — via auto-summarization

No sync conflicts because each side owns different files.

## Monitoring

### Check sync status

```bash
# Timer status
systemctl list-timers sam-*

# Recent sync activity
journalctl -u sam-vault-pull --since "1 hour ago" --no-pager
journalctl -u sam-vault-push --since "1 hour ago" --no-pager

# Recent backup activity
journalctl -u sam-db-backup --since "2 days ago" --no-pager
```

### Manual sync

```bash
# Force pull vault
sudo -u sam rclone sync gdrive:vault /var/lib/sam/vault --config /var/lib/sam/.config/rclone/rclone.conf -v

# Force backup DB
sudo -u sam rclone copy /var/lib/sam/data/sam.db gdrive:backups/sam/ --config /var/lib/sam/.config/rclone/rclone.conf -v
```

## Recovery

See [disaster-recovery.md](disaster-recovery.md) for full recovery procedures.

Quick restore:
```bash
# Restore vault
sudo -u sam rclone sync gdrive:vault /var/lib/sam/vault --config /var/lib/sam/.config/rclone/rclone.conf

# Restore DB
sudo -u sam rclone copy gdrive:backups/sam/sam.db /var/lib/sam/data/ --config /var/lib/sam/.config/rclone/rclone.conf

# Re-embed if DB is missing or corrupted
cd /var/lib/sam/app && sudo -u sam node dist/scripts/embed-vault.js
```
