# Disaster Recovery

## Principle

The VPS is 100% disposable. You can destroy it, recreate it, and be running again in under 10 minutes. Nothing critical lives only on the VPS.

## What Lives Where

| Data | Primary Location | Backed Up To | Recovery |
|------|-----------------|--------------|----------|
| **Code** | GitHub repo | GHCR (Docker images) | `git clone` or `docker pull` |
| **vault/** (soul, user, skills, heartbeat) | Google Drive | Obsidian (local Mac) | rclone pulls from Drive |
| **vault/memories/** | Generated on VPS | Google Drive (rclone pushes) | rclone pulls from Drive |
| **SQLite DB** (conversations + vectors) | VPS `data/myclaw.db` | Google Drive (hourly backup) | rclone pulls backup |
| **.env secrets** | VPS `/opt/myclaw/.env` | GitHub Secrets (source of truth) | Re-create from GitHub Secrets |
| **Caddy TLS certs** | VPS (auto-renewed) | — | Caddy auto-regenerates on startup |

## Full Recovery Procedure

Time estimate: ~10 minutes (mostly waiting for Docker pull).

### 1. Create a new VPS

On [Hetzner Cloud](https://console.hetzner.cloud/):
- CX22, Ubuntu 24.04, add your SSH key

### 2. Run setup script

```bash
ssh root@<new-ip>
bash <(curl -sL https://raw.githubusercontent.com/fbriou/sam/main/scripts/vps-setup.sh)
```

### 3. Configure rclone

```bash
ssh deploy@<new-ip>
rclone config
# Paste your Google Drive token (from your Mac's ~/.config/rclone/rclone.conf)
```

### 4. Restore data

```bash
# Pull vault from Google Drive
rclone sync gdrive:myclaw-vault /opt/myclaw/vault

# Pull latest DB backup
rclone copy gdrive:myclaw-backups/db/myclaw.db /opt/myclaw/data/
```

### 5. Create .env

```bash
nano /opt/myclaw/.env
# Copy values from GitHub Secrets or your password manager
```

### 6. Copy compose files and deploy

```bash
cd /opt/myclaw
git clone https://github.com/fbriou/sam.git repo
cp repo/docker-compose*.yml .
cp repo/Caddyfile .
# Update domain in Caddyfile

docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 7. Update DNS

Point `myclaw.yourdomain.com` to the new VPS IP.

### 8. Restore rclone cron

```bash
sudo cp repo/docs/operations/cron-template /etc/cron.d/myclaw-sync
```

### 9. Verify

- Send a Telegram message — bot should respond
- Check `docker compose logs -f` for errors
- Check `rclone ls gdrive:myclaw-vault/` for connectivity

### 10. Update GitHub Secrets

If the VPS IP changed, update `VPS_HOST` in GitHub repo → Settings → Secrets.

## What If SQLite Is Lost?

If the DB backup is old or missing:
1. The bot still works — it just loses conversation history and embeddings
2. Re-embed the vault: `docker compose exec myclaw node dist/scripts/embed-vault.js`
3. New conversations will be saved normally

## Preventive Measures

- **Verify backups weekly**: `rclone ls gdrive:myclaw-backups/db/` should show recent files
- **Monitor sync**: `journalctl -t myclaw-sync --since "1 hour ago"` should show activity
- **Keep GitHub Secrets updated**: After any .env change, update the corresponding GitHub Secret
