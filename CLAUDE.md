# Sam — Development Guide

## Project Overview

Sam is a personal AI assistant powered by the Claude Agent SDK, communicating via Telegram.
Built with Node.js 22 + TypeScript, grammY, SQLite + sqlite-vec, and a custom MCP server.

## Runtime vs Development

This project has **two** contexts:

1. **Development** (this file): Read by Claude Code in your IDE when working on the codebase
2. **Runtime** (`runtime/CLAUDE.md`): Loaded as `systemPrompt` by the Agent SDK when processing Telegram messages

The `runtime/` directory contains:
- `CLAUDE.md` — Bot personality, MCP tools, skills, rules (passed directly as `systemPrompt`)
- `.claude/settings.json` — MCP server config (legacy, not used at runtime — MCP is configured via SDK options)
- `.claude/skills` — Symlink to `../../vault/skills` (recreated on deploy)

The root `.claude/settings.json` is used by Claude Code IDE during development.
The root `.claude/commands/` contains dev slash commands:
- `/prime` — Load full project context for a new development session
- `/doc-check` — Audit docs against source code to catch drift (run before committing)

## Architecture

```
Telegram → grammY bot → Agent SDK query() → MCP server → SQLite + RAG → response
```

Key source files:
- `src/index.ts` — Entry point: Google Drive sync → Telegram bot → heartbeat cron
- `src/claude/client.ts` — Agent SDK wrapper: query() with systemPrompt, MCP, WebSearch, Bash
- `src/telegram/bot.ts` — grammY bot, middleware chain, message handler
- `src/telegram/security.ts` — Allow-list + rate limiting middleware
- `src/telegram/formatter.ts` — Markdown → Telegram HTML + chunking
- `src/memory/vault.ts` — Read vault files, split into chunks
- `src/memory/embeddings.ts` — Voyage API embeddings (voyage-3-lite, 1024 dims)
- `src/memory/rag.ts` — SQLite + sqlite-vec store/query
- `src/memory/summarizer.ts` — Auto-summarize conversations → daily memory files
- `src/mcp/server.ts` — MCP server: search_memory, get_recent_conversations, save_memory, manage_tasks, manage_recipes, gdrive_*
- `src/heartbeat/runner.ts` — Cron-based proactive check-ins (Haiku)
- `src/config.ts` — Zod-validated environment config
- `src/db/schema.ts` — SQLite migrations (conversations, memory_chunks, memory_vec, heartbeat_log)
- `src/db/client.ts` — Database connection singleton
- `scripts/sync.sh` — Local rclone sync (pull/push vault + DB from Google Drive)
- `scripts/restore.sh` — Full restore from Google Drive backups (cross-platform)

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

## Commit Rules — ALWAYS FOLLOW

**Docs go stale fast.** The codebase was once refactored from CLI to Agent SDK while the docs still described `claude -p` and `spawnClaude()`. Don't let that happen again.

Before every commit, you MUST check **all four** of these — no exceptions:

1. **Update `CHANGELOG.md`** — Add an entry describing what changed
2. **Review `CLAUDE.md`** (this file) — Does the architecture section, file list, or directory table still match the code? Update if not.
3. **Review `docs/`** — Do the pillar docs, setup guides, and architecture doc still describe how the code actually works? Update if not.
4. **Review `runtime/CLAUDE.md`** — Do the tool names, skill names, and response rules still match the implementation? Update if not.

**Never commit code changes without reviewing and updating all relevant documentation first.** If you're not sure whether a doc needs updating, read it and check.

## Coding Conventions

- TypeScript strict mode, ES2022 target, ESNext modules
- File extensions in imports: `./foo.js` (not `.ts`)
- Console logging with `[module]` prefixes: `[telegram]`, `[mcp]`, `[heartbeat]`, `[summarizer]`, `[sam]`
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

3 GitHub Actions workflows:
- `quick-deploy.yml` — Update existing server: nixos-rebuild + app deploy (~2min). Auto-triggers on push to main.
- `full-deploy.yml` — Fresh server from scratch: Terraform + nixos-anywhere + app deploy (~15min). Manual only.
- `destroy.yml` — Tear down all Hetzner resources. Manual with "destroy" confirmation.

Shared logic lives in composite actions under `.github/actions/` (setup-hcloud, setup-ssh, deploy-app).

## Documentation

All docs are in `docs/`:
- `architecture.md` — System overview and data flow
- `pillars/01-memory.md` — Memory system (RAG, MCP, vault sync, summarization)
- `pillars/02-heartbeat.md` — Heartbeat system (cron, active hours)
- `pillars/03-telegram.md` — Telegram bot (grammY, security, webhooks)
- `pillars/04-skills.md` — Skills registry (vault/skills/, symlink)
- `setup/` — Local dev, VPS deploy, Google Drive, Telegram bot setup
- `operations/` — Disaster recovery, backups, monitoring
- `decisions/adr-001-claude-code-as-brain.md` — Why Claude Agent SDK, not direct API

Changes are tracked in `CHANGELOG.md` by phase.
