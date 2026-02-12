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
