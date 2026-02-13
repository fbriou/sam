#!/usr/bin/env bash
# scripts/restore.sh — Restore Sam from Google Drive backups
#
# Pulls vault and DB from Google Drive, prepares for first run.
# Works on both macOS and Linux. Idempotent (safe to run multiple times).
#
# Usage:
#   ./scripts/restore.sh           # Full restore (vault + DB)
#   ./scripts/restore.sh --vault   # Restore vault only
#   ./scripts/restore.sh --db      # Restore DB only
#   ./scripts/restore.sh --check   # Verify backups exist (no download)
#   ./scripts/restore.sh --embed   # Also re-embed vault after restore

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

VAULT_DIR="${VAULT_PATH:-$PROJECT_DIR/vault}"
DATA_DIR="$(dirname "${DB_PATH:-$PROJECT_DIR/data/sam.db}")"
DB_FILE="$(basename "${DB_PATH:-$PROJECT_DIR/data/sam.db}")"

# Colors (with fallback for non-interactive)
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

log()  { echo -e "${GREEN}[restore]${NC} $*"; }
warn() { echo -e "${YELLOW}[restore]${NC} $*"; }
err()  { echo -e "${RED}[restore]${NC} $*" >&2; }

# --- Preflight checks ---

check_prerequisites() {
  local ok=true

  if ! command -v rclone &> /dev/null; then
    err "rclone not found. Install:"
    err "  macOS:  brew install rclone"
    err "  Linux:  sudo apt install rclone  (or curl https://rclone.org/install.sh | sudo bash)"
    ok=false
  fi

  if ! command -v node &> /dev/null; then
    err "Node.js not found. Install Node.js 22+."
    ok=false
  fi

  if command -v rclone &> /dev/null; then
    if ! rclone listremotes 2>/dev/null | grep -q "^gdrive:"; then
      err "rclone remote 'gdrive:' not configured. Run: rclone config"
      ok=false
    fi
  fi

  if [ "$ok" = false ]; then
    exit 1
  fi
}

# --- Check backup existence ---

check_backups() {
  log "Checking Google Drive backups..."

  echo ""
  log "Vault files on Google Drive:"
  rclone lsl gdrive:vault/ --max-depth 1 2>/dev/null || warn "  No vault found on gdrive:vault/"

  echo ""
  log "Vault subdirectories:"
  rclone lsd gdrive:vault/ 2>/dev/null || warn "  None"

  echo ""
  log "DB backups on Google Drive:"
  rclone lsl gdrive:backups/sam/ 2>/dev/null || warn "  No DB backup found on gdrive:backups/sam/"
}

# --- Restore vault ---

do_restore_vault() {
  log "Restoring vault to: $VAULT_DIR"

  mkdir -p "$VAULT_DIR/memories"
  mkdir -p "$VAULT_DIR/skills"

  rclone sync gdrive:vault "$VAULT_DIR" \
    --exclude ".obsidian/**" \
    --progress

  # Verify key files exist
  local missing=0
  for f in soul.md user.md heartbeat.md; do
    if [ ! -f "$VAULT_DIR/$f" ]; then
      warn "  Missing: $VAULT_DIR/$f (you may need to create it)"
      missing=$((missing + 1))
    else
      log "  Found: $f"
    fi
  done

  if [ "$missing" -gt 0 ]; then
    warn "$missing vault files missing — check Google Drive or create them."
  fi

  log "Vault restored."
}

# --- Restore database ---

do_restore_db() {
  log "Restoring database to: $DATA_DIR/$DB_FILE"

  mkdir -p "$DATA_DIR"

  # Safety backup if DB exists
  if [ -f "$DATA_DIR/$DB_FILE" ] && [ -s "$DATA_DIR/$DB_FILE" ]; then
    local size
    size=$(wc -c < "$DATA_DIR/$DB_FILE" | tr -d ' ')
    warn "Existing database found ($size bytes)."

    local backup_name="${DB_FILE}.pre-restore.$(date +%Y%m%d-%H%M%S)"
    cp "$DATA_DIR/$DB_FILE" "$DATA_DIR/$backup_name"
    log "  Safety backup: $DATA_DIR/$backup_name"
  fi

  # Remove stale WAL/SHM (from a different machine/architecture)
  rm -f "$DATA_DIR/${DB_FILE}-wal" "$DATA_DIR/${DB_FILE}-shm"

  rclone copy "gdrive:backups/sam/$DB_FILE" "$DATA_DIR" --progress

  if [ ! -f "$DATA_DIR/$DB_FILE" ]; then
    warn "No DB backup found on Google Drive. Sam will create a fresh database on first run."
    warn "Run 'npm run embed-vault' after starting to populate the vector store."
  else
    local size
    size=$(wc -c < "$DATA_DIR/$DB_FILE" | tr -d ' ')
    log "Database restored ($size bytes)."
  fi
}

# --- Re-embed vault ---

do_embed() {
  if [ -f "$PROJECT_DIR/package.json" ] && [ -d "$PROJECT_DIR/node_modules" ]; then
    log "Re-embedding vault into sqlite-vec..."
    cd "$PROJECT_DIR"
    npx tsx scripts/embed-vault.ts
    log "Embedding complete."
  else
    warn "Skipping vault embedding (dependencies not installed)."
    warn "Run 'npm install && npm run embed-vault' to populate the vector store."
  fi
}

# --- Main ---

main() {
  echo -e "${BLUE}╔══════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     Sam — Restore from Backup    ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════╝${NC}"
  echo ""

  check_prerequisites

  local restore_vault=true
  local restore_db=true
  local check_only=false
  local do_embed_flag=false

  for arg in "$@"; do
    case "$arg" in
      --vault) restore_db=false ;;
      --db)    restore_vault=false ;;
      --check) check_only=true ;;
      --embed) do_embed_flag=true ;;
      --help|-h)
        echo "Usage: $0 [--vault] [--db] [--check] [--embed]"
        echo ""
        echo "  (no args)   Full restore (vault + DB)"
        echo "  --vault     Restore vault only"
        echo "  --db        Restore database only"
        echo "  --check     Verify backups exist (dry run)"
        echo "  --embed     Also re-embed vault after restore"
        exit 0
        ;;
    esac
  done

  if [ "$check_only" = true ]; then
    check_backups
    exit 0
  fi

  log "Project directory: $PROJECT_DIR"
  log "Vault target:      $VAULT_DIR"
  log "DB target:         $DATA_DIR/$DB_FILE"
  echo ""

  if [ "$restore_vault" = true ]; then
    do_restore_vault
    echo ""
  fi

  if [ "$restore_db" = true ]; then
    do_restore_db
    echo ""
  fi

  if [ "$do_embed_flag" = true ]; then
    do_embed
    echo ""
  fi

  log "Restore complete!"
  echo ""
  log "Next steps:"
  if [ "$do_embed_flag" = false ]; then
    log "  1. npm install          (if not done yet)"
    log "  2. npm run embed-vault  (re-embed vault into vector store)"
    log "  3. cp .env.example .env (configure environment variables)"
    log "  4. npm run dev          (start Sam)"
  else
    log "  1. cp .env.example .env (configure environment variables)"
    log "  2. npm run dev          (start Sam)"
  fi
}

main "$@"
