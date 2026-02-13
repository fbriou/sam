# NixOS Deployment (Hetzner Cloud)

## Overview

Sam runs natively on a NixOS server (Hetzner Cloud CX33, ~€5/mo). Deployment is fully automated via 3 GitHub Actions workflows:

- **Quick Deploy** (`quick-deploy.yml`, ~2 min): Update code + NixOS config on existing server. Auto-triggers on push to main.
- **Full Deploy** (`full-deploy.yml`, ~15 min): Create server from scratch with OpenTofu + nixos-anywhere. Manual only, requires `production` environment approval.
- **Destroy** (`destroy.yml`): Tear down all Hetzner resources. Manual with "destroy" confirmation.

Shared logic lives in composite actions under `.github/actions/` (setup-hcloud, setup-ssh, deploy-app).

## Infrastructure

| Component | Tool |
|-----------|------|
| Server provisioning | OpenTofu (Hetzner Cloud provider) |
| OS installation | nixos-anywhere (NixOS 24.11 + disko) |
| Configuration | Nix flakes (`flake.nix`, `nixos/`) |
| CI/CD | GitHub Actions (3 workflows + 3 composite actions) |
| Secrets | GitHub Secrets → assembled into `.env` on server |

## Server Specs

- **Type**: CX33 (2 vCPU, 4GB RAM, 40GB disk)
- **OS**: NixOS 24.11
- **Location**: Nuremberg, Germany (nbg1)
- **Cost**: ~€5/month
- **Firewall**: SSH only (port 22), ICMP

## GitHub Secrets Required

Add these at: repo → Settings → Secrets and variables → Actions → New repository secret.

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `HETZNER_API_TOKEN` | Hetzner Cloud API token | [console.hetzner.cloud](https://console.hetzner.cloud/) → Security → API Tokens → Generate |
| `SSH_PRIVATE_KEY` | Ed25519 private key | `cat ~/.ssh/id_ed25519` (or generate: `ssh-keygen -t ed25519`) |
| `SSH_PUBLIC_KEY` | Ed25519 public key | `cat ~/.ssh/id_ed25519.pub` |
| `ALLOWED_SSH_IP` | Your public IP in CIDR format | `curl -s https://api.ipify.org` then append `/32` (e.g. `86.123.45.67/32`) |
| `ANTHROPIC_API_KEY` | Anthropic API key | From your `.env` or [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | From your `.env` (created via @BotFather) |
| `TELEGRAM_ALLOWED_IDS` | Comma-separated Telegram user IDs | From your `.env` (get IDs via @userinfobot) |
| `TELEGRAM_CHAT_ID` | Chat ID for heartbeat delivery | From your `.env` (usually same as your user ID) |
| `WEBHOOK_SECRET` | Random string (8+ chars) | `openssl rand -hex 16` or from your `.env` |
| `RCLONE_CONFIG` | Full rclone config file content | `cat ~/.config/rclone/rclone.conf` |

You also need a **`production` environment**: repo → Settings → Environments → New environment → name it `production`. This adds an approval gate on full-deploy and destroy.

## First-Time Setup

### 1. Generate SSH key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/sam -C "sam-deploy"
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

### 5. Create `production` environment

Go to repo → Settings → Environments → New environment → name: `production`.

### 6. Run full deploy

Go to GitHub → Actions → **Full Deploy Sam** → Run workflow.

## Day-to-Day Operations

```bash
# SSH in
ssh root@<server-ip>

# Check service status
systemctl status sam

# View logs
journalctl -u sam -f --no-pager

# Check rclone timers
systemctl list-timers sam-*

# Restart service
systemctl restart sam

# Manual vault sync
sudo -u sam rclone sync gdrive:vault /var/lib/sam/vault --config /var/lib/sam/.config/rclone/rclone.conf
```

## Updating

Push to `main` triggers **Quick Deploy** automatically. The workflow:
1. Checks server exists (fails fast if not)
2. Adds temporary firewall rule for GitHub runner
3. Updates NixOS config via `nixos-rebuild switch`
4. Builds TypeScript in CI
5. SCPs dist/, runtime/, package files to server
6. Runs `npm ci --production` on server
7. Restarts the service
8. Removes temporary firewall rule

## Destroying

Run the **Destroy Sam Infrastructure** workflow (type "destroy" to confirm). This deletes the server, firewall, and SSH key from Hetzner. Requires `production` environment approval.
