# NixOS Deployment (Hetzner Cloud)

## Overview

MyClaw runs natively on a NixOS server (Hetzner Cloud CX22, ~€4/mo). Deployment is fully automated via GitHub Actions with two modes:

- **Quick deploy** (~2 min): Update code + NixOS config on existing server
- **Full deploy** (~15 min): Create server from scratch with OpenTofu + nixos-anywhere

## Infrastructure

| Component | Tool |
|-----------|------|
| Server provisioning | OpenTofu (Hetzner Cloud provider) |
| OS installation | nixos-anywhere (NixOS 24.11 + disko) |
| Configuration | Nix flakes (`flake.nix`, `nixos/`) |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) |
| Secrets | GitHub Secrets → assembled into `.env` on server |

## Server Specs

- **Type**: CX22 (2 vCPU, 4GB RAM, 40GB disk)
- **OS**: NixOS 24.11
- **Location**: Nuremberg, Germany (nbg1)
- **Cost**: ~€4/month
- **Firewall**: SSH only (port 22), ICMP

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `HETZNER_API_TOKEN` | Hetzner Cloud API token |
| `SSH_PUBLIC_KEY` | Ed25519 public key |
| `SSH_PRIVATE_KEY` | Ed25519 private key |
| `ALLOWED_SSH_IP` | Your home IP in CIDR (e.g. 1.2.3.4/32) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_ALLOWED_IDS` | Comma-separated Telegram user IDs |
| `TELEGRAM_CHAT_ID` | Chat ID for heartbeat delivery |
| `WEBHOOK_SECRET` | Random string |
| `RCLONE_CONFIG` | rclone.conf content (Google Drive remote) |

## First-Time Setup

### 1. Generate SSH key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/myclaw -C "myclaw-deploy"
```

### 2. Create Hetzner API token

Go to [console.hetzner.cloud](https://console.hetzner.cloud/) → API Tokens → Generate.

### 3. Configure rclone locally

```bash
rclone config
# → New remote → name: "gdrive" → type: Google Drive → follow browser OAuth
```

Copy the config: `cat ~/.config/rclone/rclone.conf` → save as `RCLONE_CONFIG` secret.

### 4. Add all GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → add each secret.

### 5. Run full deploy

Trigger the Deploy workflow manually with `full` mode, or push to `main`.

## Day-to-Day Operations

```bash
# SSH in
ssh root@<server-ip>

# Check service status
systemctl status myclaw

# View logs
journalctl -u myclaw -f --no-pager

# Check rclone timers
systemctl list-timers myclaw-*

# Restart service
systemctl restart myclaw

# Manual vault sync
sudo -u myclaw rclone sync gdrive:vault /var/lib/myclaw/vault --config /var/lib/myclaw/.config/rclone/rclone.conf
```

## Updating

Push to `main` triggers auto-deploy (quick mode). The workflow:
1. Builds TypeScript in CI
2. SCPs dist/, runtime/, package files to server
3. Runs `npm ci --production` on server
4. Updates NixOS config if changed
5. Restarts the service

## Destroying

Run the **Destroy Infrastructure** workflow (type "destroy" to confirm). This deletes the server, firewall, and SSH key from Hetzner.
