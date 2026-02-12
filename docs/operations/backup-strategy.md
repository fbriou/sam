# Backup Strategy

## Overview

MyClaw uses a partitioned backup approach: different data types are backed up differently based on their origin and importance.

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

### Systemd timer (`myclaw-db-backup`)

Defined in `nixos/myclaw.nix`. Runs daily at 03:00:
```
rclone copy /var/lib/myclaw/data/myclaw.db gdrive:backups/myclaw/ --config /var/lib/myclaw/.config/rclone/rclone.conf
```

### Where backups go

```
Google Drive/
  backups/
    myclaw/
      myclaw.db          ← Latest copy (overwritten daily)
```

### Verify backups

```bash
# Check timer status
systemctl status myclaw-db-backup.timer

# Check latest backup timestamp
sudo -u myclaw rclone lsl gdrive:backups/myclaw/myclaw.db --config /var/lib/myclaw/.config/rclone/rclone.conf

# Check backup size (should grow over time)
sudo -u myclaw rclone size gdrive:backups/myclaw/ --config /var/lib/myclaw/.config/rclone/rclone.conf
```

## Vault Sync

### Pull (Google Drive → Server)

Your edits in Obsidian sync to the server every 5 minutes via the `myclaw-vault-pull` systemd timer:
```
rclone sync gdrive:vault /var/lib/myclaw/vault --config /var/lib/myclaw/.config/rclone/rclone.conf
```

### Push (Server → Google Drive)

Bot-generated memories sync back every 5 minutes (offset by 2.5 min) via the `myclaw-vault-push` systemd timer:
```
rclone sync /var/lib/myclaw/vault/memories/ gdrive:vault/memories/ --config /var/lib/myclaw/.config/rclone/rclone.conf
```

### Why partitioned?

- **You** write: soul.md, user.md, heartbeat.md, skills/ — via Obsidian
- **Bot** writes: memories/ — via auto-summarization

No sync conflicts because each side owns different files.

## Monitoring

### Check sync status

```bash
# Timer status
systemctl list-timers myclaw-*

# Recent sync activity
journalctl -u myclaw-vault-pull --since "1 hour ago" --no-pager
journalctl -u myclaw-vault-push --since "1 hour ago" --no-pager

# Recent backup activity
journalctl -u myclaw-db-backup --since "2 days ago" --no-pager
```

### Manual sync

```bash
# Force pull vault
sudo -u myclaw rclone sync gdrive:vault /var/lib/myclaw/vault --config /var/lib/myclaw/.config/rclone/rclone.conf -v

# Force backup DB
sudo -u myclaw rclone copy /var/lib/myclaw/data/myclaw.db gdrive:backups/myclaw/ --config /var/lib/myclaw/.config/rclone/rclone.conf -v
```

## Recovery

See [disaster-recovery.md](disaster-recovery.md) for full recovery procedures.

Quick restore:
```bash
# Restore vault
sudo -u myclaw rclone sync gdrive:vault /var/lib/myclaw/vault --config /var/lib/myclaw/.config/rclone/rclone.conf

# Restore DB
sudo -u myclaw rclone copy gdrive:backups/myclaw/myclaw.db /var/lib/myclaw/data/ --config /var/lib/myclaw/.config/rclone/rclone.conf

# Re-embed if DB is missing or corrupted
cd /var/lib/myclaw/app && sudo -u myclaw node dist/scripts/embed-vault.js
```
