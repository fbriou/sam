# Changelog

All notable changes to Sam are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Local Testing Fix (2026-02-12)

- **Fixed**: `src/telegram/bot.ts` — Session ID must be a valid UUID (Claude Code CLI requirement); derive deterministically from chat ID via MD5 hash

### Phase 8 — NixOS Deployment (2026-02-12)

- **Added**: `flake.nix` — NixOS 24.11 flake with disko for Hetzner Cloud
- **Added**: `nixos/configuration.nix` — System config (SSH, firewall, packages, service user)
- **Added**: `nixos/sam.nix` — systemd service with security hardening + 3 rclone timers (vault pull, vault push, DB backup)
- **Added**: `nixos/disk-config.nix` — GPT disk partitioning for nixos-anywhere
- **Added**: `terraform/main.tf` — Hetzner Cloud server, firewall, SSH key (cx22, ~€4/mo)
- **Added**: `terraform/variables.tf` — Infrastructure variables
- **Added**: `terraform/outputs.tf` — Server IP, SSH command, firewall ID
- **Added**: `terraform/versions.tf` — OpenTofu >= 1.6.0, hcloud provider
- **Rewritten**: `.github/workflows/deploy.yml` — Two-mode NixOS deployment (quick ~2min, full ~15min)
- **Added**: `.github/workflows/destroy.yml` — Safe infrastructure teardown with confirmation
- **Removed**: `Dockerfile`, `docker-compose.yml`, `.dockerignore` — Docker no longer used (native NixOS on server, `npm run dev` locally)
- **Removed**: `docker-compose.prod.yml` — No Docker on server
- **Removed**: `Caddyfile` — No reverse proxy needed (Telegram long polling)
- **Removed**: `scripts/vps-setup.sh` — Replaced by declarative NixOS configuration
- **Updated**: `.gitignore` — Added terraform state, openclaw-with-nixox-and-vps

### Phase 1 — Foundation (2026-02-12)

- **Added**: Project scaffold (`package.json`, `tsconfig.json`, `.env.example`, `.gitignore`)
- **Added**: `CLAUDE.md` — soul file defining assistant identity, memory tools, skills, rules, and response format
- **Added**: `.claude/settings.json` — MCP server configuration for sam-memory
- **Added**: `src/config.ts` — Zod-validated environment variable loader
- **Added**: `src/db/schema.ts` — SQLite schema with migrations (conversations, memory_chunks, memory_vec, heartbeat_log)
- **Added**: `src/db/client.ts` — Database connection manager with graceful shutdown
- **Added**: `src/index.ts` — Entry point with config loading, DB init, and signal handlers
- **Added**: `docs/architecture.md` — System overview with diagrams and data flow
- **Added**: `docs/decisions/adr-001-claude-code-as-brain.md` — Architecture Decision Record
- **Added**: `CHANGELOG.md` — This file

### Phase 2 — Telegram Bot (2026-02-12)

- **Added**: `src/claude/client.ts` — Claude Code CLI wrapper (spawn `claude -p`, JSON output, session management)
- **Added**: `src/telegram/bot.ts` — grammY Telegram bot with middleware chain, message handler, typing indicator
- **Added**: `src/telegram/security.ts` — Allow-list middleware (silent reject) and rate limiter (10/min)
- **Added**: `src/telegram/formatter.ts` — Markdown → Telegram HTML converter with smart chunking (4096 char limit)
- **Updated**: `src/index.ts` — Wire Telegram bot into boot sequence with graceful shutdown
- **Added**: `docs/pillars/03-telegram.md` — Telegram pillar deep dive
- **Added**: `docs/setup/telegram-bot.md` — BotFather setup guide

### Phase 3 — Memory System (2026-02-12)

- **Added**: `src/memory/vault.ts` — Vault reader with recursive file listing and smart chunking (heading + paragraph splits)
- **Added**: `src/memory/embeddings.ts` — Anthropic Voyage API embeddings (single, batch, query modes)
- **Added**: `src/memory/rag.ts` — SQLite + sqlite-vec RAG: store chunks, remove by file, semantic search
- **Added**: `src/mcp/server.ts` — Custom MCP server exposing `search_memory`, `get_recent_conversations`, `save_memory` tools
- **Added**: `scripts/embed-vault.ts` — One-time vault embedding script
- **Added**: `vault/soul.md` — Initial assistant personality definition
- **Added**: `vault/user.md` — User profile template
- **Added**: `vault/heartbeat.md` — Proactive check checklist
- **Added**: `docs/pillars/01-memory.md` — Memory system deep dive (RAG pipeline, MCP tools, vault sync)
- **Added**: `docs/setup/google-drive.md` — Google Drive + rclone configuration guide

### Phase 4 — Skills Registry (2026-02-12)

- **Added**: `vault/skills/summarize.md` — Summarize texts into bullet points
- **Added**: `vault/skills/diagram.md` — Generate Mermaid diagrams
- **Added**: `vault/skills/translate.md` — Translate between languages
- **Added**: `.claude/skills` → symlink to `vault/skills/` (Claude Code native skill loading)
- **Updated**: `CLAUDE.md` — Listed available skills
- **Added**: `docs/pillars/04-skills.md` — Skills pillar documentation

### Phase 5 — Heartbeat System (2026-02-12)

- **Added**: `src/heartbeat/runner.ts` — Cron-based heartbeat with Anthropic SDK (Haiku), active hours, duplicate suppression
- **Updated**: `src/index.ts` — Wire heartbeat into boot sequence with graceful shutdown
- **Added**: `docs/pillars/02-heartbeat.md` — Heartbeat pillar documentation

### Phase 6 — Auto-Summarization (2026-02-12)

- **Added**: `src/memory/summarizer.ts` — Conversation auto-summarizer (Haiku, 20-message threshold, daily memory files)
- **Updated**: `src/telegram/bot.ts` — Trigger `maybeSummarize()` in background after each message response
- **Updated**: `docs/pillars/01-memory.md` — Added auto-summarization section with flow, format, and configuration

### Phase 7 — Deployment (2026-02-12)

- **Added**: `Dockerfile` — Multi-stage build (Node.js 22, Claude Code CLI, non-root user)
- **Added**: `docker-compose.yml` — Local development compose (build from source)
- **Added**: `docker-compose.prod.yml` — Production overrides (GHCR image + Caddy reverse proxy)
- **Added**: `Caddyfile` — Auto-TLS reverse proxy for Telegram webhooks
- **Added**: `.dockerignore` — Excludes vault, data, openclaw from Docker context
- **Added**: `.github/workflows/deploy.yml` — Build → GHCR → SSH deploy to VPS
- **Added**: `scripts/vps-setup.sh` — One-time VPS provisioning (Docker, Caddy, rclone, UFW, fail2ban)
- **Added**: `docs/setup/local-dev.md` — Local development quickstart guide
- **Added**: `docs/setup/vps-deploy.md` — Full VPS deployment walkthrough
- **Added**: `docs/operations/disaster-recovery.md` — Recovery runbook (VPS is disposable)
- **Added**: `docs/operations/backup-strategy.md` — SQLite backup, vault sync, monitoring
- **Added**: `docs/operations/monitoring.md` — Logs, health checks, troubleshooting

### Split CLAUDE.md — Development vs Runtime (2026-02-12)

- **Added**: `runtime/CLAUDE.md` — Bot personality, MCP tools, skills, rules (moved from root)
- **Added**: `runtime/.claude/settings.json` — MCP server config with `../` prefixed paths
- **Added**: `runtime/.claude/skills` — Symlink to `../../vault/skills`
- **Updated**: `CLAUDE.md` (root) — Rewritten as development guide (project structure, conventions, build commands)
- **Updated**: `src/claude/client.ts` — Default cwd changed to `runtime/` for `claude -p` invocations
- **Updated**: `Dockerfile` — Copy `runtime/` instead of root `.claude/`
- **Updated**: `.dockerignore` — Include `runtime/` directory
- **Updated**: `docs/architecture.md` — Document runtime/ directory and cwd change
