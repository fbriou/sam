# Pillar 3: Telegram Integration

## Overview

Sam uses a single Telegram bot built with [grammY](https://grammy.dev/) as the communication channel. The bot is a thin orchestrator: it receives messages, calls `askClaude()` via the Agent SDK, and sends back the response.

## Architecture

```
You (Telegram) → grammY Bot → Security Middleware → Agent SDK query() → Response → Telegram
```

### Message Flow

1. You send a message on Telegram
2. grammY receives the update (via long polling)
3. **Allow-list middleware** checks your Telegram user ID — rejects unauthorized users silently
4. **Rate limit middleware** checks message frequency — max 10/minute
5. Bot shows "typing" indicator
6. `askClaude()` calls the Agent SDK `query()` with `runtime/CLAUDE.md` as `systemPrompt`, the MCP server, and session resume for conversation continuity
7. Both user message and assistant response are saved to SQLite `conversations` table
8. Response is converted from markdown to Telegram HTML
9. If > 4096 chars, response is chunked at paragraph/sentence boundaries
10. Bot sends the reply

## Key Files

| File | Purpose |
|------|---------|
| `src/telegram/bot.ts` | Bot setup, middleware chain, message handler |
| `src/telegram/security.ts` | Allow-list and rate limiting middleware |
| `src/telegram/formatter.ts` | Markdown → Telegram HTML conversion, chunking |
| `src/claude/client.ts` | Agent SDK wrapper (`query()` with systemPrompt, MCP, WebSearch) |

## Security

### Allow-list

Only Telegram user IDs listed in `TELEGRAM_ALLOWED_IDS` can interact with the bot. All other users are silently ignored — no error message is sent (to avoid revealing the bot exists).

Set your ID in `.env`:
```
TELEGRAM_ALLOWED_IDS=123456789
```

To find your Telegram user ID, send `/start` to [@userinfobot](https://t.me/userinfobot).

### Rate Limiting

Max 10 messages per minute per user. Prevents abuse if a Telegram ID is compromised.

## Formatting

Claude outputs standard markdown. Telegram supports a subset of HTML:
- `**bold**` → `<b>bold</b>`
- `*italic*` → `<i>italic</i>`
- `` `code` `` → `<code>code</code>`
- ```` ```lang\ncode\n``` ```` → `<pre><code>code</code></pre>`
- `[text](url)` → `<a href="url">text</a>`
- `~~strikethrough~~` → `<s>strikethrough</s>`

## Session Management

Each Telegram chat gets its own Agent SDK session tracked via an in-memory `Map<chatId, sessionId>`. When `askClaude()` is called:
- The previous `sessionId` for the chat is passed as `resume` to `query()`
- The Agent SDK resumes the conversation, preserving context across messages
- If the session is stale (expired or corrupted), `askClaude()` retries with a fresh session
- Different chats (e.g., private vs group) have separate sessions

## Running

The bot uses long polling (no inbound HTTP port required). Run locally with `npm run dev` or on the server via the `sam` systemd service.
