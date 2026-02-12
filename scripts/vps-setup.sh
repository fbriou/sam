#!/usr/bin/env bash
#
# MyClaw VPS Setup Script
# Run as root on a fresh Ubuntu 24.04 VPS (Hetzner CX22).
#
# Usage: curl -sL <raw-github-url>/scripts/vps-setup.sh | bash
#        or: bash scripts/vps-setup.sh
#
set -euo pipefail

echo "=== MyClaw VPS Setup ==="

# --- 1. Create deploy user ---
if ! id "deploy" &>/dev/null; then
  echo "[1/8] Creating deploy user..."
  adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy
  echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy

  # Copy root's SSH keys to deploy user
  mkdir -p /home/deploy/.ssh
  cp /root/.ssh/authorized_keys /home/deploy/.ssh/
  chown -R deploy:deploy /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  chmod 600 /home/deploy/.ssh/authorized_keys
  echo "  deploy user created with SSH keys"
else
  echo "[1/8] deploy user already exists, skipping"
fi

# --- 2. Install Docker ---
echo "[2/8] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | bash
  usermod -aG docker deploy
  systemctl enable docker
  echo "  Docker installed"
else
  echo "  Docker already installed"
fi

# --- 3. Install Docker Compose plugin ---
echo "[3/8] Checking Docker Compose..."
if docker compose version &>/dev/null; then
  echo "  Docker Compose plugin available"
else
  echo "  Installing Docker Compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
fi

# --- 4. Install Caddy ---
echo "[4/8] Installing Caddy..."
if ! command -v caddy &>/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
  systemctl stop caddy  # We'll run Caddy via Docker, not systemd
  systemctl disable caddy
  echo "  Caddy installed (systemd disabled — using Docker)"
else
  echo "  Caddy already installed"
fi

# --- 5. Install rclone ---
echo "[5/8] Installing rclone..."
if ! command -v rclone &>/dev/null; then
  curl https://rclone.org/install.sh | bash
  echo "  rclone installed"
else
  echo "  rclone already installed"
fi

# --- 6. Configure UFW firewall ---
echo "[6/8] Configuring UFW..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (Caddy redirect)
ufw allow 443/tcp  # HTTPS (Caddy)
echo "y" | ufw enable
echo "  UFW configured (22, 80, 443 only)"

# --- 7. Harden SSH ---
echo "[7/8] Hardening SSH..."
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Install fail2ban
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
echo "  SSH hardened (key-only, no root, fail2ban active)"

# --- 8. Create app directory structure ---
echo "[8/8] Creating /opt/myclaw..."
mkdir -p /opt/myclaw/{data,vault}
chown -R deploy:deploy /opt/myclaw

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. SSH in as deploy:  ssh deploy@$(hostname -I | awk '{print $1}')"
echo "  2. Configure rclone:  rclone config  (set up Google Drive remote)"
echo "  3. Create .env file:  nano /opt/myclaw/.env"
echo "  4. Copy docker-compose files to /opt/myclaw/"
echo "  5. Set up rclone cron: see docs/setup/google-drive.md"
echo "  6. Deploy: docker compose pull && docker compose up -d"
