# Pillar 1: Memory System

## Overview

The memory system gives Sam the ability to remember past conversations and recall relevant context. It works in two layers:

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
| `tasks.md` | Task tracking (Obsidian-compatible) | Bot (via MCP) |
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
| `manage_tasks(action, text?, priority?, due?)` | Add, complete, or list tasks in `vault/tasks.md` |

Configured in `.claude/settings.json`:
```json
{
  "mcpServers": {
    "sam-memory": {
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
- **Local**: rclone sync via `scripts/sync.sh pull` / `push`
- **Server**: rclone systemd timers pull vault and push memories/tasks every 5 min
- **Memories**: Bot writes to `memories/` → rclone pushes back to Google Drive
- **Tasks**: Bot writes to `tasks.md` → rclone pushes back to Google Drive

## Auto-Summarization (`src/memory/summarizer.ts`)

As conversations accumulate, the bot automatically summarizes them into daily memory files. This creates a long-term memory that persists across sessions.

### How It Works

1. **Trigger**: After every Telegram message response, `maybeSummarize()` runs in the background
2. **Threshold check**: Counts messages since the last summarization — triggers at 20+ unsummarized messages
3. **Summarization**: Sends the batch to Haiku (cheap, fast) with a prompt to extract key facts, decisions, action items, and dates
4. **Save**: Appends the summary to `vault/memories/YYYY-MM-DD.md` (multiple summaries per day are supported)
5. **Re-embed**: Chunks the updated memory file and stores vectors in sqlite-vec for RAG retrieval

### Flow

```
Message #20 arrives → bot responds
  → maybeSummarize() fires (background, non-blocking)
  → 20+ unsummarized messages found
  → Haiku extracts key facts
  → Appends to vault/memories/2026-02-12.md
  → Re-embeds into sqlite-vec
  → rclone pushes to Google Drive (within 5 min)
  → You see it in Obsidian
```

### Memory File Format

```markdown
# Memories — 2026-02-12

## 14:30:00

- **Summary**: Discussed project deadlines and deployment strategy
- Decided to use Hetzner CX22 for VPS hosting
- Action: Set up DNS for sam.yourdomain.com by Friday
- Mentioned interest in adding email notifications later

## 18:45:00

- **Summary**: Debugged SQLite connection issue
- Fixed WAL mode conflict with concurrent reads
- Action: Add connection pooling if performance degrades
```

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Threshold | 20 messages | Minimum unsummarized messages to trigger |
| Model | Haiku | Cost-efficient for routine summarization |
| Max tokens | 1024 | Keeps summaries concise |

## Key Files

| File | Purpose |
|------|---------|
| `src/memory/vault.ts` | Read vault files, split into chunks |
| `src/memory/embeddings.ts` | Voyage API embedding (embed, batch, query) |
| `src/memory/rag.ts` | SQLite + sqlite-vec store/query/search |
| `src/memory/summarizer.ts` | Auto-summarize conversations into daily memory files |
| `src/mcp/server.ts` | MCP server exposing RAG tools to Claude Code |
| `scripts/embed-vault.ts` | One-time vault embedding script |
