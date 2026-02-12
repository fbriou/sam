# Changelog

All notable changes to MyClaw are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Phase 1 — Foundation (2026-02-12)

- **Added**: Project scaffold (`package.json`, `tsconfig.json`, `.env.example`, `.gitignore`)
- **Added**: `CLAUDE.md` — soul file defining assistant identity, memory tools, skills, rules, and response format
- **Added**: `.claude/settings.json` — MCP server configuration for myclaw-memory
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
