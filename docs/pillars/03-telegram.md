# Pillar 3: Telegram Integration

## Overview

MyClaw uses a single Telegram bot built with [grammY](https://grammy.dev/) as the communication channel. The bot is a thin proxy: it receives messages, spawns `claude -p`, and sends back the response.

## Architecture

```
You (Telegram) → grammY Bot → Security Middleware → Claude Code CLI → Response → Telegram
```

### Message Flow

1. You send a message on Telegram
2. grammY receives the update (via long polling in dev, webhooks in production)
3. **Allow-list middleware** checks your Telegram user ID — rejects unauthorized users silently
4. **Rate limit middleware** checks message frequency — max 10/minute
5. Bot shows "typing" indicator
6. `spawnClaude()` runs `claude -p "your message" --output-format json --session-id tg-<chatId>`
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
| `src/claude/client.ts` | Claude Code CLI wrapper (`claude -p`) |

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

### Webhook Security (Production)

In production, the bot uses webhooks with a secret path:
```
https://myclaw.yourdomain.com/webhook/<WEBHOOK_SECRET>
```

The `WEBHOOK_SECRET` is a random string that makes the URL unguessable. Only Telegram knows this URL.

## Formatting

Claude outputs standard markdown. Telegram supports a subset of HTML:
- `**bold**` → `<b>bold</b>`
- `*italic*` → `<i>italic</i>`
- `` `code` `` → `<code>code</code>`
- ```` ```lang\ncode\n``` ```` → `<pre><code>code</code></pre>`
- `[text](url)` → `<a href="url">text</a>`
- `~~strikethrough~~` → `<s>strikethrough</s>`

## Session Management

Each Telegram chat gets its own Claude Code session via `--session-id tg-<chatId>`. This means:
- Conversation context persists across messages
- Different chats (e.g., private vs group) have separate sessions
- Sessions are managed by Claude Code, not by our code

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Update method | Long polling | Webhooks |
| HTTPS | Not needed | Required (Caddy) |
| Latency | Higher (~1s polling) | Lower (instant webhook) |
| Setup | Just run `npm run dev` | Configure Caddy + DNS |
