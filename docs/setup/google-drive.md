# Google Drive + rclone Setup

## On Your Mac (Local Development)

### 1. Install Google Drive for Desktop

Download from [drive.google.com/download](https://drive.google.com/download) if not already installed.

### 2. Create the Vault Folder

In Finder, create a folder in Google Drive:
```
~/Google Drive/My Drive/myclaw-vault/
```

### 3. Link to Your Project

Either symlink the vault:
```bash
ln -s "$HOME/Google Drive/My Drive/myclaw-vault" ./vault
```

Or set the path in `.env`:
```
VAULT_PATH=/Users/yourname/Google Drive/My Drive/myclaw-vault
```

### 4. Open in Obsidian

1. Open Obsidian
2. Click "Open folder as vault"
3. Select `myclaw-vault` from Google Drive
4. Now everything you edit syncs automatically

## On the VPS (Production)

### 1. Install rclone

```bash
curl https://rclone.org/install.sh | sudo bash
```

### 2. Configure Google Drive Remote

**Important**: rclone needs a browser for OAuth. Do this on your Mac first.

On your Mac:
```bash
rclone config
# → New remote
# → Name: gdrive
# → Storage: Google Drive
# → Follow the OAuth flow in your browser
```

Copy the token from `~/.config/rclone/rclone.conf`:
```bash
cat ~/.config/rclone/rclone.conf
```

On the VPS:
```bash
rclone config
# → New remote
# → Name: gdrive
# → Storage: Google Drive
# → When asked for token: paste the token from your Mac
```

Test the connection:
```bash
rclone ls gdrive:myclaw-vault/
```

### 3. Set Up Cron Sync

Create `/etc/cron.d/myclaw-sync`:

```cron
# Pull vault changes from Google Drive (your edits to soul.md, skills, etc.)
*/5 * * * * deploy rclone sync gdrive:myclaw-vault /opt/myclaw/vault --exclude "memories/**" 2>&1 | logger -t myclaw-sync

# Push generated memories back to Google Drive
*/5 * * * * deploy rclone sync /opt/myclaw/vault/memories/ gdrive:myclaw-vault/memories/ 2>&1 | logger -t myclaw-sync

# Backup SQLite DB to Google Drive (hourly)
0 * * * * deploy rclone copy /opt/myclaw/data/myclaw.db gdrive:myclaw-backups/db/ 2>&1 | logger -t myclaw-backup
```

### 4. Verify

```bash
# Check logs
journalctl -t myclaw-sync --since "5 minutes ago"

# Manual sync
rclone sync gdrive:myclaw-vault /opt/myclaw/vault --exclude "memories/**" -v
```

## How the Sync Flows

```
You edit soul.md in Obsidian (Mac)
  → Google Drive Desktop syncs to cloud (instant)
  → rclone cron on VPS pulls changes (within 5 min)
  → Next Claude Code invocation sees updated soul.md

Bot generates a daily summary
  → Writes to vault/memories/2026-02-12.md on VPS
  → rclone cron pushes to Google Drive (within 5 min)
  → You see it in Obsidian (via Google Drive Desktop sync)
```

## Troubleshooting

**rclone token expired**: Re-run `rclone config` on your Mac, copy new token to VPS.

**Sync conflicts**: The sync is partitioned — you write soul/user/skills, the bot writes memories. No conflicts should occur.

**Files not syncing**: Check rclone logs: `journalctl -t myclaw-sync -f`
