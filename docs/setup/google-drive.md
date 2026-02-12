# Google Drive + rclone Setup

## On Your Mac (Local Development)

### 1. Install Google Drive for Desktop

Download from [drive.google.com/download](https://drive.google.com/download) if not already installed.

### 2. Create the Vault Folder

In Finder, create a folder in Google Drive:
```
~/Google Drive/My Drive/sam-vault/
```

### 3. Link to Your Project

Either symlink the vault:
```bash
ln -s "$HOME/Google Drive/My Drive/sam-vault" ./vault
```

Or set the path in `.env`:
```
VAULT_PATH=/Users/yourname/Google Drive/My Drive/sam-vault
```

### 4. Open in Obsidian

1. Open Obsidian
2. Click "Open folder as vault"
3. Select `sam-vault` from Google Drive
4. Now everything you edit syncs automatically

## On the Server (Production)

rclone is installed via NixOS configuration and sync is handled by systemd timers (defined in `nixos/sam.nix`).

### rclone Configuration

The rclone config is deployed automatically by the GitHub Actions deploy workflow from the `RCLONE_CONFIG` secret. It's placed at `/var/lib/sam/.config/rclone/rclone.conf`.

To set up the secret initially, configure rclone on your Mac:
```bash
rclone config
# → New remote
# → Name: gdrive
# → Storage: Google Drive
# → Follow the OAuth flow in your browser
```

Copy the config content and save it as the `RCLONE_CONFIG` GitHub secret:
```bash
cat ~/.config/rclone/rclone.conf
```

### Systemd Timers

Three timers handle all sync (defined in `nixos/sam.nix`):

| Timer | Frequency | What it does |
|-------|-----------|--------------|
| `sam-vault-pull` | Every 5 min | Google Drive → `/var/lib/sam/vault` |
| `sam-vault-push` | Every 5 min (offset) | `/var/lib/sam/vault/memories/` → Google Drive |
| `sam-db-backup` | Daily at 03:00 | `/var/lib/sam/data/sam.db` → Google Drive |

### Verify

```bash
# Check timer status
systemctl list-timers sam-*

# Check recent sync logs
journalctl -u sam-vault-pull --since "10 minutes ago" --no-pager

# Manual sync
sudo -u sam rclone sync gdrive:vault /var/lib/sam/vault --config /var/lib/sam/.config/rclone/rclone.conf -v
```

## How the Sync Flows

```
You edit soul.md in Obsidian (Mac)
  → Google Drive Desktop syncs to cloud (instant)
  → rclone systemd timer on server pulls changes (within 5 min)
  → Next Claude Code invocation sees updated soul.md

Bot generates a daily summary
  → Writes to vault/memories/2026-02-12.md on server
  → rclone systemd timer pushes to Google Drive (within 5 min)
  → You see it in Obsidian (via Google Drive Desktop sync)
```

## Troubleshooting

**rclone token expired**: Re-run `rclone config` on your Mac, update the `RCLONE_CONFIG` GitHub secret, and redeploy.

**Sync conflicts**: The sync is partitioned — you write soul/user/skills, the bot writes memories. No conflicts should occur.

**Files not syncing**: Check timer logs: `journalctl -u sam-vault-pull -f --no-pager`
