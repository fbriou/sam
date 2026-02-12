# Monitoring & Operations

## Checking Bot Status

```bash
ssh deploy@myclaw.yourdomain.com

# Container status
cd /opt/myclaw
docker compose ps

# Live logs
docker compose logs -f --tail 100

# Last 50 lines from myclaw only
docker compose logs myclaw --tail 50
```

## Log Messages

The bot logs with prefixed tags:

| Tag | Source |
|-----|--------|
| `[myclaw]` | Boot sequence, shutdown |
| `[telegram]` | Bot lifecycle, errors |
| `[heartbeat]` | Cron checks, delivery |
| `[summarizer]` | Auto-summarization triggers |
| `[mcp]` | MCP server requests |

## Health Checks

### Bot is responding
Send a message on Telegram. You should get a response within 10 seconds.

### Heartbeat is running
Check logs for heartbeat activity:
```bash
docker compose logs myclaw | grep heartbeat
```

### Vault sync is working
```bash
journalctl -t myclaw-sync --since "10 minutes ago"
```

### DB backups are running
```bash
rclone lsl gdrive:myclaw-backups/db/myclaw.db
# Should show a timestamp within the last hour
```

## Common Issues

### Bot not responding

1. Check container is running: `docker compose ps`
2. Check logs: `docker compose logs myclaw --tail 50`
3. Verify `.env` has correct `TELEGRAM_BOT_TOKEN`
4. Check your user ID is in `TELEGRAM_ALLOWED_IDS`

### Heartbeat not sending messages

1. Check active hours: bot only sends between `ACTIVE_HOURS_START` and `ACTIVE_HOURS_END`
2. Check `vault/heartbeat.md` is not empty
3. Check logs for `HEARTBEAT_OK` (means nothing to report)
4. Check `ANTHROPIC_API_KEY` is valid

### Memory/RAG not working

1. Check embeddings exist: `docker compose exec myclaw node -e "const db=require('better-sqlite3')('/app/data/myclaw.db'); console.log(db.prepare('SELECT count(*) as c FROM memory_chunks').get())"`
2. Re-embed vault: `docker compose exec myclaw node dist/scripts/embed-vault.js`
3. Check `ANTHROPIC_API_KEY` has Voyage API access

### rclone sync failing

1. Check token: `rclone lsd gdrive:`
2. If token expired: re-run `rclone config` on your Mac, copy new token
3. Check logs: `journalctl -t myclaw-sync -f`

## Restarting

```bash
cd /opt/myclaw

# Restart app only
docker compose restart myclaw

# Full restart (app + caddy)
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

# Force recreate
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
```

## Updating

Push to `main` triggers auto-deploy via GitHub Actions. Or manually:

```bash
cd /opt/myclaw
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker image prune -f
```
