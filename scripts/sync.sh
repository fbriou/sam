#!/usr/bin/env bash
# scripts/sync.sh — Sync vault and database with Google Drive via rclone
#
# Usage:
#   ./scripts/sync.sh pull    # Pull vault + DB from Google Drive
#   ./scripts/sync.sh push    # Push vault + DB to Google Drive
#   ./scripts/sync.sh status  # Show what would change (dry-run)
#
# Prerequisites:
#   - rclone installed (brew install rclone)
#   - rclone configured with a "gdrive:" remote (rclone config)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VAULT_DIR="${VAULT_PATH:-$PROJECT_DIR/vault}"
DATA_DIR="$(dirname "${DB_PATH:-$PROJECT_DIR/data/sam.db}")"
DB_FILE="$(basename "${DB_PATH:-$PROJECT_DIR/data/sam.db}")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if ! command -v rclone &> /dev/null; then
  echo -e "${RED}Error: rclone not installed. Install with: brew install rclone${NC}"
  exit 1
fi

if ! rclone listremotes 2>/dev/null | grep -q "^gdrive:"; then
  echo -e "${RED}Error: rclone remote 'gdrive:' not configured. Run: rclone config${NC}"
  exit 1
fi

case "${1:-help}" in
  pull)
    echo -e "${GREEN}[sync] Pulling vault from Google Drive...${NC}"
    rclone sync gdrive:vault "$VAULT_DIR" --exclude ".obsidian/**" --progress

    echo -e "${GREEN}[sync] Pulling DB backup from Google Drive...${NC}"
    mkdir -p "$DATA_DIR"
    rclone copy "gdrive:backups/sam/$DB_FILE" "$DATA_DIR" --progress

    # Remove stale WAL/SHM (from a different machine/architecture)
    rm -f "$DATA_DIR/${DB_FILE}-wal" "$DATA_DIR/${DB_FILE}-shm"

    echo -e "${GREEN}[sync] Done. Run 'npm run embed-vault' if vault content changed.${NC}"
    ;;

  push)
    echo -e "${YELLOW}[sync] Pushing vault to Google Drive...${NC}"
    rclone sync "$VAULT_DIR" gdrive:vault --exclude ".obsidian/**" --progress

    echo -e "${YELLOW}[sync] Pushing DB to Google Drive...${NC}"
    mkdir -p "$DATA_DIR"
    rclone copy "$DATA_DIR/$DB_FILE" "gdrive:backups/sam/" --progress

    echo -e "${GREEN}[sync] Done.${NC}"
    ;;

  status)
    echo -e "${YELLOW}[sync] Vault differences (local vs Google Drive):${NC}"
    rclone check "$VAULT_DIR" gdrive:vault --exclude ".obsidian/**" 2>&1 || true

    echo ""
    echo -e "${YELLOW}[sync] DB backup on Google Drive:${NC}"
    rclone lsl "gdrive:backups/sam/" 2>&1 || echo "  No backups found"
    ;;

  *)
    echo "Usage: $0 {pull|push|status}"
    echo ""
    echo "  pull    - Download vault and DB from Google Drive"
    echo "  push    - Upload vault and DB to Google Drive"
    echo "  status  - Show differences (dry-run)"
    exit 1
    ;;
esac
