# Monitoring & Operations

## Checking Bot Status

```bash
ssh root@<server-ip>

# Service status
systemctl status sam

# Live logs
journalctl -u sam -f --no-pager

# Last 50 lines
journalctl -u sam -n 50 --no-pager
```

## Log Messages

The bot logs with prefixed tags:

| Tag | Source |
|-----|--------|
| `[sam]` | Boot sequence, shutdown |
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
journalctl -u sam --since "1 hour ago" --no-pager | grep heartbeat
```

### Vault sync is working
```bash
# Check pull timer
systemctl status sam-vault-pull.timer

# Check push timer
systemctl status sam-vault-push.timer

# Recent sync logs
journalctl -u sam-vault-pull --since "10 minutes ago" --no-pager
journalctl -u sam-vault-push --since "10 minutes ago" --no-pager
```

### DB backups are running
```bash
# Check timer
systemctl status sam-db-backup.timer

# Check latest backup on Google Drive
sudo -u sam rclone lsl gdrive:backups/sam/sam.db --config /var/lib/sam/.config/rclone/rclone.conf
```

## Common Issues

### Bot not responding

1. Check service is running: `systemctl status sam`
2. Check logs: `journalctl -u sam -n 50 --no-pager`
3. Verify `.env` has correct `TELEGRAM_BOT_TOKEN`: `cat /var/lib/sam/.env | grep TELEGRAM`
4. Check your user ID is in `TELEGRAM_ALLOWED_IDS`

### Heartbeat not sending messages

1. Check active hours: bot only sends between `ACTIVE_HOURS_START` and `ACTIVE_HOURS_END`
2. Check `vault/heartbeat.md` is not empty
3. Check logs for `HEARTBEAT_OK` (means nothing to report)
4. Check `ANTHROPIC_API_KEY` is valid

### Memory/RAG not working

1. Check embeddings exist:
```bash
sudo -u sam node -e "const db=require('better-sqlite3')('/var/lib/sam/data/sam.db'); console.log(db.prepare('SELECT count(*) as c FROM memory_chunks').get())"
```
2. Re-embed vault:
```bash
cd /var/lib/sam/app && sudo -u sam node dist/scripts/embed-vault.js
```
3. Check `ANTHROPIC_API_KEY` has Voyage API access

### rclone sync failing

1. Check rclone config exists: `ls -la /var/lib/sam/.config/rclone/rclone.conf`
2. Test rclone: `sudo -u sam rclone lsd gdrive: --config /var/lib/sam/.config/rclone/rclone.conf`
3. If token expired: re-run `rclone config` on your Mac, update `RCLONE_CONFIG` GitHub secret, redeploy
4. Check timer logs: `journalctl -u sam-vault-pull -f --no-pager`

## Restarting

```bash
# Restart app
systemctl restart sam

# Check it came back up
systemctl status sam
```

## Updating

Push to `main` triggers auto-deploy via GitHub Actions (~2 min). Or manually:

```bash
# On server — only if you need to restart without redeploying
systemctl restart sam
```
