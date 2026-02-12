# Pillar 2: Heartbeat (Proactive Assistant)

## Overview

The heartbeat is a cron job that runs every 30 minutes, reads your `heartbeat.md` checklist, sends it to Claude Haiku, and delivers actionable messages to your Telegram chat. If nothing noteworthy, it stays silent.

## How It Works

```
Cron fires (*/30 * * * *)
  → Is it within active hours? (08:00-22:00 Europe/Paris)
  → If no → skip
  → Read vault/heartbeat.md
  → If empty → skip
  → Send checklist to Claude Haiku (cheap, fast)
  → Response contains "HEARTBEAT_OK"?
     → Yes → do nothing (nothing to report)
     → No → check for duplicates (24h window)
       → Not duplicate → send to Telegram
       → Duplicate → skip
```

## Why Haiku (not Claude Code CLI)

The heartbeat uses `@anthropic-ai/sdk` directly with the Haiku model instead of `claude -p` because:

1. **Cost**: Haiku is ~20x cheaper than Sonnet — heartbeats are routine checks
2. **Rate limits**: Doesn't consume Claude Code subscription limits
3. **Simplicity**: One-shot prompt, no session needed, no MCP tools
4. **Speed**: Direct API call is faster than spawning a CLI process

## Configuration

In `.env`:
```
HEARTBEAT_INTERVAL_CRON=*/30 * * * *   # Every 30 minutes
HEARTBEAT_MODEL=claude-haiku-4-5-20251001
ACTIVE_HOURS_START=08:00
ACTIVE_HOURS_END=22:00
ACTIVE_HOURS_TZ=Europe/Paris
TELEGRAM_CHAT_ID=123456789              # Where to deliver
```

## heartbeat.md Format

```markdown
# Proactive Checks

## Every heartbeat
- Item checked every time the cron fires

## Daily (first heartbeat of the day)
- Item checked once per day (morning)

## Weekly (Monday morning)
- Item checked once per week
```

The assistant uses the current date/time to determine which sections apply.

## Duplicate Suppression

Each heartbeat response is hashed (SHA-256). If the same hash appears in the `heartbeat_log` table within the last 24 hours, the message is not delivered. This prevents the bot from nagging you with the same information.

## Key Files

| File | Purpose |
|------|---------|
| `src/heartbeat/runner.ts` | Cron job, active hours check, Haiku API call, Telegram delivery |
| `vault/heartbeat.md` | Your checklist (edit in Obsidian) |
| `src/db/schema.ts` | `heartbeat_log` table for duplicate tracking |

## Adding External Integrations

The heartbeat checklist can reference external services. These are added as skills or via MCP tools:

- **Gmail**: "Check if I have unread important emails" (requires Gmail API MCP server)
- **Google Calendar**: "Check upcoming meetings in the next 2 hours" (requires Calendar API)
- **Todoist**: "Check overdue tasks" (requires Todoist API)

These integrations are added incrementally — each one is a separate MCP server or API call.

## Testing

Set the interval to 1 minute for testing:
```
HEARTBEAT_INTERVAL_CRON=* * * * *
```

Check logs:
```bash
journalctl -u sam -f --no-pager | grep heartbeat
```
