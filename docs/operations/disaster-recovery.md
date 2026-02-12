# Disaster Recovery

## Principle

The server is 100% disposable. Run the full deploy workflow and everything is recreated from scratch. Nothing critical lives only on the server.

## What Lives Where

| Data | Primary Location | Backed Up To | Recovery |
|------|-----------------|--------------|----------|
| **Code** | GitHub repo | — | `git clone` |
| **NixOS config** | GitHub repo (`nixos/`, `flake.nix`) | — | Full deploy recreates it |
| **Terraform state** | GitHub Actions cache | — | Full deploy recreates resources |
| **vault/** (soul, user, skills) | Google Drive | Obsidian (local Mac) | rclone pulls from Drive |
| **vault/memories/** | Generated on server | Google Drive (rclone pushes) | rclone pulls from Drive |
| **SQLite DB** | Server `/var/lib/myclaw/data/` | Google Drive (daily backup) | rclone pulls backup |
| **.env secrets** | Server `/var/lib/myclaw/.env` | GitHub Secrets (source of truth) | Deploy workflow assembles it |

## Full Recovery Procedure

Time estimate: ~15 minutes (full deploy workflow does everything).

### Option A: Run the full deploy workflow (recommended)

1. Go to GitHub → Actions → **Deploy MyClaw** → Run workflow → select **full**
2. Wait ~15 minutes
3. Done. The workflow creates a new server, installs NixOS, deploys the app, and assembles `.env` from secrets.

### Option B: Manual recovery

If GitHub Actions is down:

#### 1. Create a new server

On [Hetzner Cloud](https://console.hetzner.cloud/):
- CX22, Ubuntu 24.04, add your SSH key

#### 2. Install NixOS

From your local machine (with Nix installed):
```bash
# Inject your SSH key into nixos/configuration.nix first
nix run github:nix-community/nixos-anywhere -- \
  --flake .#myclaw \
  --target-host root@<new-ip>
```

#### 3. Deploy application

```bash
SSH_OPTS="-o StrictHostKeyChecking=no"
npm ci && npx tsc
scp $SSH_OPTS -r dist package.json package-lock.json runtime root@<new-ip>:/var/lib/myclaw/app/
ssh $SSH_OPTS root@<new-ip> "cd /var/lib/myclaw/app && npm ci --production"
ssh $SSH_OPTS root@<new-ip> "npm install -g @anthropic-ai/claude-code"
```

#### 4. Restore data

```bash
# Create .env on the server (copy values from GitHub Secrets or password manager)
ssh root@<new-ip> "nano /var/lib/myclaw/.env"

# Deploy rclone config
scp ~/.config/rclone/rclone.conf root@<new-ip>:/var/lib/myclaw/.config/rclone/

# Pull vault from Google Drive
ssh root@<new-ip> "sudo -u myclaw rclone sync gdrive:vault /var/lib/myclaw/vault --config /var/lib/myclaw/.config/rclone/rclone.conf"

# Pull latest DB backup
ssh root@<new-ip> "sudo -u myclaw rclone copy gdrive:backups/myclaw/myclaw.db /var/lib/myclaw/data/ --config /var/lib/myclaw/.config/rclone/rclone.conf"
```

#### 5. Start and verify

```bash
ssh root@<new-ip> "chown -R myclaw:myclaw /var/lib/myclaw && systemctl restart myclaw"
# Send a Telegram message — bot should respond
```

## What If SQLite Is Lost?

If the DB backup is old or missing:
1. The bot still works — it just loses conversation history and embeddings
2. Re-embed the vault: `ssh root@<ip> "cd /var/lib/myclaw/app && sudo -u myclaw node dist/scripts/embed-vault.js"`
3. New conversations will be saved normally

## Preventive Measures

- **Verify backups**: `ssh root@<ip> "sudo -u myclaw rclone lsl gdrive:backups/myclaw/"` should show recent files
- **Monitor timers**: `ssh root@<ip> "systemctl list-timers myclaw-*"` should show next run times
- **Keep GitHub Secrets updated**: After any .env change, update the corresponding secret
