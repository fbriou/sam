# Pillar 1: Memory System

## Overview

The memory system gives MyClaw the ability to remember past conversations and recall relevant context. It works in two layers:

1. **Obsidian Vault** (human-readable): Markdown files you edit in Obsidian
2. **SQLite + sqlite-vec** (searchable): Vector embeddings for semantic search (RAG)

## Architecture

```
Vault (markdown files)
  ↓ chunking
Chunks (~500 tokens each)
  ↓ Voyage API embedding
Vectors (1024 dimensions)
  ↓ stored in
SQLite + sqlite-vec
  ↓ searched by
MCP Server (search_memory tool)
  ↓ used by
Claude Code (when answering your questions)
```

## Vault Files

| File | Purpose | Who writes |
|------|---------|-----------|
| `soul.md` | Assistant personality and tone | You |
| `user.md` | Your preferences, projects, context | You |
| `heartbeat.md` | Proactive check checklist | You |
| `memories/*.md` | Daily conversation summaries | Bot (auto-generated) |
| `skills/*.md` | Skill definitions | You |

## How RAG Works

### 1. Chunking (`src/memory/vault.ts`)

Markdown files are split into chunks of ~2000 characters:
- First split at heading boundaries (`##` or `###`)
- If a section is too long, split at paragraph boundaries
- Each chunk keeps track of its source file and position

### 2. Embedding (`src/memory/embeddings.ts`)

Each chunk is converted to a 1024-dimension vector using:
- **Model**: Anthropic Voyage `voyage-3-lite`
- **Batch processing**: Up to 128 texts per API call
- **Two input types**: `document` for vault content, `query` for search queries

### 3. Storage (`src/memory/rag.ts`)

Vectors are stored in SQLite using the `sqlite-vec` extension:
- `memory_chunks` table: chunk text, source file, creation date
- `memory_vec` virtual table: float[1024] vectors for cosine similarity

### 4. Retrieval (MCP Server — `src/mcp/server.ts`)

When Claude Code calls `search_memory(query)`:
1. The query is embedded with `input_type: "query"`
2. sqlite-vec finds the top-K most similar vectors
3. Corresponding chunk text is returned to Claude Code

## MCP Server

The MCP server exposes three tools to Claude Code:

| Tool | Purpose |
|------|---------|
| `search_memory(query, limit?)` | Semantic search over all vault content and past conversations |
| `get_recent_conversations(n?)` | Get the last N messages for immediate context |
| `save_memory(content, source?)` | Manually save a fact for future recall |

Configured in `.claude/settings.json`:
```json
{
  "mcpServers": {
    "myclaw-memory": {
      "command": "node",
      "args": ["dist/mcp/server.js"]
    }
  }
}
```

## Initial Embedding

To populate the vector store for the first time:

```bash
npx tsx scripts/embed-vault.ts
```

This reads all vault `.md` files, chunks them, embeds via Voyage API, and stores in SQLite.

## Vault Sync (Google Drive + rclone)

See [Google Drive Setup](../setup/google-drive.md) for details.

Summary:
- **Local**: Edit vault in Obsidian → Google Drive Desktop syncs to cloud
- **VPS**: rclone cron pulls from Google Drive every 5 minutes
- **Memories**: Bot writes to `memories/` → rclone pushes back to Google Drive

## Key Files

| File | Purpose |
|------|---------|
| `src/memory/vault.ts` | Read vault files, split into chunks |
| `src/memory/embeddings.ts` | Voyage API embedding (embed, batch, query) |
| `src/memory/rag.ts` | SQLite + sqlite-vec store/query/search |
| `src/mcp/server.ts` | MCP server exposing RAG tools to Claude Code |
| `scripts/embed-vault.ts` | One-time vault embedding script |
