# Sam Architecture

## Overview

Sam is a personal AI assistant that communicates via Telegram, powered by the Claude Agent SDK. It's built around 4 pillars inspired by OpenClaw: Memory, Heartbeat, Telegram, and Skills.

## Architecture Diagram

```
┌─────────────┐    grammY     ┌──────────────────┐   Agent SDK      ┌──────────────┐
│  Telegram    │◄────────────►│  Node.js App      │─────────────────►│  Claude       │
│  (you)       │              │  (orchestrator)   │   query()         │  (brain)      │
└─────────────┘              │                    │                   │               │
                              │  - telegram/bot   │                   │  - systemPrompt│
                              │  - heartbeat/cron │                   │  - WebSearch  │
                              │  - security       │                   │  - MCP ──────►│
                              └────────┬──────────┘                   └──────────────┘│
                                       │                                              │
                              ┌────────▼──────────┐                                   │
                              │  SQLite + sqlite-vec│◄─────────────────────────────────┘
                              │  (conversations +   │         MCP tool calls
                              │   vector embeddings)│         (search_memory)
                              └────────┬──────────┘
                                       │ rclone sync (5min)
                              ┌────────▼──────────┐
                              │  Obsidian Vault    │
                              │  (Google Drive)    │
                              │  soul.md, user.md  │
                              │  memories/, tasks.md│
                              │  skills/           │
                              └───────────────────┘
```

## Data Flow

### Startup

1. `npm run dev` (or `npm start`) launches `src/index.ts`
2. **Google Drive sync**: Runs `scripts/sync.sh pull` to fetch latest vault + DB from Google Drive (non-fatal — if rclone isn't configured, continues with local data)
3. Database initialized
4. Telegram bot started (long polling)
5. Heartbeat cron started

### Conversation (Telegram → Claude → Response)

1. You send a message on Telegram
2. grammY bot receives the update
3. Security middleware checks your Telegram user ID against the allow-list
4. The orchestrator calls `askClaude()` which uses the Agent SDK `query()` with `runtime/CLAUDE.md` as `systemPrompt`
5. Claude receives the personality, rules, and response format from the system prompt
6. Claude may call MCP tools (`search_memory`) for RAG retrieval or `WebSearch` for live info
7. Claude returns a text response
8. The orchestrator saves both user message and assistant response to SQLite
9. The response is converted from markdown to Telegram HTML
10. If response > 4096 chars, it's chunked into multiple messages
11. Bot sends the reply

### Memory (RAG Pipeline)

1. Vault markdown files (soul.md, user.md, memories/) are split into ~500-token chunks
2. Each chunk is embedded via Anthropic Voyage API (voyage-3-lite, 1024 dimensions)
3. Vectors are stored in SQLite via the sqlite-vec extension
4. When Claude Code calls `search_memory(query)`:
   - The query is embedded
   - Cosine similarity search finds top-5 matching chunks
   - Chunk text is returned to Claude Code as context

### Vault Sync

```
You edit soul.md in Obsidian (Mac)
  → Google Drive Desktop syncs to cloud (instant)
  → rclone systemd timer on server pulls changes (within 5 min)
  → Next Claude Code invocation sees the update

Bot generates daily summary
  → Writes to vault/memories/YYYY-MM-DD.md
  → rclone systemd timer pushes to Google Drive (within 5 min)
  → You see it in Obsidian
```

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source code |
| `src/claude/` | Agent SDK client wrapper |
| `src/telegram/` | grammY bot, security middleware, formatter |
| `src/memory/` | Vault reader, embeddings, RAG |
| `src/mcp/` | Custom MCP server for memory tools |
| `src/heartbeat/` | Proactive cron runner |
| `src/db/` | SQLite client and schema |
| `runtime/` | Agent SDK runtime context (CLAUDE.md used as systemPrompt) |
| `vault/` | Obsidian vault (synced via Google Drive) |
| `docs/` | Project documentation |
| `scripts/` | Setup and utility scripts |
| `data/` | SQLite database file |

## Key Design Decisions

- **Claude Agent SDK as the brain**: See [ADR-001](decisions/adr-001-claude-code-as-brain.md)
- **SQLite over PostgreSQL**: Single file, no server, sqlite-vec for vectors, perfect for single-user
- **Obsidian vault**: Human-readable memory layer, editable from any device via Google Drive
- **MCP for RAG**: Standard protocol, Claude Code loads it natively
