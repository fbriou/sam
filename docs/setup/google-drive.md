# Google Drive + rclone Setup

## On Your Mac (Local Development)

### 1. Install rclone

```bash
brew install rclone
```

### 2. Configure rclone

```bash
rclone config
# → New remote → Name: gdrive → Storage: Google Drive → follow OAuth
```

### 3. Sync vault and DB

Use the sync script to pull/push data:
```bash
./scripts/sync.sh pull    # Download vault + DB from Google Drive
./scripts/sync.sh push    # Upload vault + DB to Google Drive
./scripts/sync.sh status  # Check differences
```

### 4. Open in Obsidian

1. Open Obsidian
2. Click "Open folder as vault"
3. Select the `vault/` directory in your project
4. Run `./scripts/sync.sh pull` periodically to get latest changes

### 5. Restore from scratch

For a fresh machine, use the restore script:
```bash
./scripts/restore.sh           # Full restore (vault + DB)
./scripts/restore.sh --check   # Verify backups exist first
```

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
| `sam-vault-pull` | Every 5 min | Google Drive → `/var/lib/sam/vault` (excludes memories/, tasks.md) |
| `sam-vault-push` | Every 5 min (offset) | `/var/lib/sam/vault/memories/` → Google Drive |
| `sam-tasks-push` | Every 5 min (offset) | `/var/lib/sam/vault/tasks.md` → Google Drive |
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
  → Run ./scripts/sync.sh push (or Google Drive Desktop syncs)
  → rclone systemd timer on server pulls changes (within 5 min)
  → Next Agent SDK invocation sees updated soul.md

Bot generates a daily summary
  → Writes to vault/memories/2026-02-12.md on server
  → rclone systemd timer pushes to Google Drive (within 5 min)
  → Run ./scripts/sync.sh pull to see it locally

Bot tracks a task
  → Writes to vault/tasks.md on server
  → rclone systemd timer pushes to Google Drive (within 5 min)
  → You see it in Obsidian
```

## Troubleshooting

**rclone token expired**: Re-run `rclone config` on your Mac, update the `RCLONE_CONFIG` GitHub secret, and redeploy.

**Sync conflicts**: The sync is partitioned — you write soul/user/skills, the bot writes memories and tasks.md. No conflicts should occur.

**Files not syncing**: Check timer logs: `journalctl -u sam-vault-pull -f --no-pager`
