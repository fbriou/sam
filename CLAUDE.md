# MyClaw — Development Guide

## Project Overview

MyClaw is a personal AI assistant powered by Claude Code CLI, communicating via Telegram.
Built with Node.js 22 + TypeScript, grammY, SQLite + sqlite-vec, and a custom MCP server.

## Runtime vs Development

This project has **two** Claude Code contexts:

1. **Development** (this file): Read by Claude Code in your IDE when working on the codebase
2. **Runtime** (`runtime/CLAUDE.md`): Read by `claude -p` when processing Telegram messages

The `runtime/` directory is the working directory for `claude -p`. It contains:
- `CLAUDE.md` — Bot personality, MCP tools, skills, rules
- `.claude/settings.json` — MCP server config (paths prefixed with `../` relative to runtime/)
- `.claude/skills` — Symlink to `../../vault/skills`

The root `.claude/settings.json` is used by Claude Code IDE during development.

## Architecture

```
Telegram → grammY bot → spawns claude -p (cwd: runtime/) → MCP server → SQLite + RAG → response
```

Key source files:
- `src/index.ts` — Entry point: boots Telegram bot + heartbeat cron
- `src/claude/client.ts` — Spawns `claude -p` with `cwd: runtime/`
- `src/telegram/bot.ts` — grammY bot, middleware chain, message handler
- `src/telegram/security.ts` — Allow-list + rate limiting middleware
- `src/telegram/formatter.ts` — Markdown → Telegram HTML + chunking
- `src/memory/vault.ts` — Read vault files, split into chunks
- `src/memory/embeddings.ts` — Voyage API embeddings (voyage-3-lite, 1024 dims)
- `src/memory/rag.ts` — SQLite + sqlite-vec store/query
- `src/memory/summarizer.ts` — Auto-summarize conversations → daily memory files
- `src/mcp/server.ts` — MCP server: search_memory, get_recent_conversations, save_memory
- `src/heartbeat/runner.ts` — Cron-based proactive check-ins (Haiku)
- `src/config.ts` — Zod-validated environment config
- `src/db/schema.ts` — SQLite migrations (conversations, memory_chunks, memory_vec, heartbeat_log)
- `src/db/client.ts` — Database connection singleton

## Key Directories

| Directory | Purpose | In git? |
|-----------|---------|---------|
| `src/` | TypeScript source | Yes |
| `runtime/` | Claude Code runtime context for bot | Yes |
| `vault/` | Obsidian vault (synced via Google Drive) | No |
| `data/` | SQLite database | No |
| `dist/` | Compiled JS output | No |
| `docs/` | Project documentation | Yes |
| `scripts/` | Setup and utility scripts | Yes |
| `openclaw/` | Reference implementation (not committed) | No |

## Coding Conventions

- TypeScript strict mode, ES2022 target, ESNext modules
- File extensions in imports: `./foo.js` (not `.ts`)
- Console logging with `[module]` prefixes: `[telegram]`, `[mcp]`, `[heartbeat]`, `[summarizer]`, `[myclaw]`
- Zod for config validation
- `better-sqlite3` (synchronous) for database operations
- Error handling: try/catch in handlers, `.catch()` for background tasks

## Build & Run

```bash
npm run dev          # Development with tsx
npm run build        # Compile TypeScript
npm start            # Run compiled output
npm run embed-vault  # Re-embed vault files into sqlite-vec
```

## Deployment

Server runs natively on NixOS (Hetzner Cloud). See `nixos/` and `terraform/` directories.
GitHub Actions handles deployment (`.github/workflows/deploy.yml`): quick mode (~2min) or full mode (~15min).

## Documentation

All docs are in `docs/`:
- `architecture.md` — System overview and data flow
- `pillars/01-memory.md` — Memory system (RAG, MCP, vault sync, summarization)
- `pillars/02-heartbeat.md` — Heartbeat system (cron, active hours)
- `pillars/03-telegram.md` — Telegram bot (grammY, security, webhooks)
- `pillars/04-skills.md` — Skills registry (vault/skills/, symlink)
- `setup/` — Local dev, VPS deploy, Google Drive, Telegram bot setup
- `operations/` — Disaster recovery, backups, monitoring
- `decisions/adr-001-claude-code-as-brain.md` — Why claude -p, not direct API

Changes are tracked in `CHANGELOG.md` by phase.
