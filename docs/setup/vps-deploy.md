# VPS Deployment (Hetzner)

## 1. Create a Hetzner VPS

1. Go to [console.hetzner.cloud](https://console.hetzner.cloud/)
2. Create a new server:
   - **Type**: CX22 (2 vCPU, 4GB RAM, 40GB disk) — ~4 EUR/month
   - **OS**: Ubuntu 24.04
   - **Location**: Falkenstein (EU, cheapest)
   - **SSH key**: Add your public key
   - **No extras needed**

3. Note the IP address once created.

## 2. DNS Setup

Point a domain or subdomain to your VPS:
```
myclaw.yourdomain.com → A record → <vps-ip>
```

Caddy will auto-provision a Let's Encrypt TLS certificate.

## 3. Run the Setup Script

SSH in as root (first and last time):
```bash
ssh root@<vps-ip>
bash <(curl -sL https://raw.githubusercontent.com/fbriou/sam/main/scripts/vps-setup.sh)
```

This installs: Docker, Caddy, rclone, UFW, fail2ban. Creates the `deploy` user.

After setup, **root SSH is disabled**. Always connect as:
```bash
ssh deploy@<vps-ip>
```

## 4. Configure rclone (Google Drive)

On your Mac first (to get the OAuth token):
```bash
rclone config
# → New remote → name: "gdrive" → type: Google Drive → follow browser OAuth
```

Copy the token from `~/.config/rclone/rclone.conf`.

On the VPS:
```bash
rclone config
# → New remote → name: "gdrive" → type: Google Drive → paste token
```

Test:
```bash
rclone ls gdrive:myclaw-vault/
```

## 5. Set Up Vault Sync Cron

Create `/etc/cron.d/myclaw-sync`:
```cron
# Pull vault changes (your edits in Obsidian)
*/5 * * * * deploy rclone sync gdrive:myclaw-vault /opt/myclaw/vault --exclude "memories/**" 2>&1 | logger -t myclaw-sync

# Push memories back to Google Drive
*/5 * * * * deploy rclone sync /opt/myclaw/vault/memories/ gdrive:myclaw-vault/memories/ 2>&1 | logger -t myclaw-sync

# Backup SQLite DB (hourly)
0 * * * * deploy rclone copy /opt/myclaw/data/myclaw.db gdrive:myclaw-backups/db/ 2>&1 | logger -t myclaw-backup
```

## 6. Create the `.env` File

```bash
nano /opt/myclaw/.env
```

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
TELEGRAM_BOT_TOKEN=7123456:ABC...
TELEGRAM_ALLOWED_IDS=123456789
TELEGRAM_CHAT_ID=123456789
WEBHOOK_SECRET=<openssl rand -hex 16>
VAULT_PATH=/app/vault
DB_PATH=/app/data/myclaw.db
NODE_ENV=production
ACTIVE_HOURS_START=08:00
ACTIVE_HOURS_END=22:00
ACTIVE_HOURS_TZ=Europe/Paris
HEARTBEAT_INTERVAL_CRON=*/30 * * * *
```

## 7. Copy Compose Files

```bash
cd /opt/myclaw
# Copy these from the repo:
# - docker-compose.yml
# - docker-compose.prod.yml
# - Caddyfile
```

Or clone the repo:
```bash
git clone https://github.com/fbriou/sam.git /opt/myclaw/repo
cp /opt/myclaw/repo/docker-compose*.yml /opt/myclaw/
cp /opt/myclaw/repo/Caddyfile /opt/myclaw/
```

Update the Caddyfile domain:
```bash
sed -i 's/{$CADDY_DOMAIN:localhost}/myclaw.yourdomain.com/' /opt/myclaw/Caddyfile
```

## 8. Deploy

```bash
cd /opt/myclaw
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 9. Verify

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f --tail 50

# Send a test message on Telegram
```

## GitHub Actions (Auto-Deploy)

After the first manual deploy, pushes to `main` auto-deploy via GitHub Actions.

### Required GitHub Secrets

Go to your repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP or domain |
| `VPS_SSH_KEY` | Private SSH key for the `deploy` user |

The workflow (`.github/workflows/deploy.yml`) builds a Docker image, pushes to GHCR, then SSH into the VPS to pull and restart.

## Day-to-Day Operations

```bash
# SSH in
ssh deploy@myclaw.yourdomain.com

# Check bot status
cd /opt/myclaw && docker compose ps

# View logs
docker compose logs -f --tail 100

# Restart
docker compose restart

# Manual vault sync
rclone sync gdrive:myclaw-vault /opt/myclaw/vault --exclude "memories/**"

# Check DB
docker compose exec myclaw node -e "
  const db = require('better-sqlite3')('/app/data/myclaw.db');
  console.log('Messages:', db.prepare('SELECT count(*) as c FROM conversations').get().c);
"
```
