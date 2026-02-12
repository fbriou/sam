# Monitoring & Operations

## Checking Bot Status

```bash
ssh root@<server-ip>

# Service status
systemctl status myclaw

# Live logs
journalctl -u myclaw -f --no-pager

# Last 50 lines
journalctl -u myclaw -n 50 --no-pager
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
journalctl -u myclaw --since "1 hour ago" --no-pager | grep heartbeat
```

### Vault sync is working
```bash
# Check pull timer
systemctl status myclaw-vault-pull.timer

# Check push timer
systemctl status myclaw-vault-push.timer

# Recent sync logs
journalctl -u myclaw-vault-pull --since "10 minutes ago" --no-pager
journalctl -u myclaw-vault-push --since "10 minutes ago" --no-pager
```

### DB backups are running
```bash
# Check timer
systemctl status myclaw-db-backup.timer

# Check latest backup on Google Drive
sudo -u myclaw rclone lsl gdrive:backups/myclaw/myclaw.db --config /var/lib/myclaw/.config/rclone/rclone.conf
```

## Common Issues

### Bot not responding

1. Check service is running: `systemctl status myclaw`
2. Check logs: `journalctl -u myclaw -n 50 --no-pager`
3. Verify `.env` has correct `TELEGRAM_BOT_TOKEN`: `cat /var/lib/myclaw/.env | grep TELEGRAM`
4. Check your user ID is in `TELEGRAM_ALLOWED_IDS`

### Heartbeat not sending messages

1. Check active hours: bot only sends between `ACTIVE_HOURS_START` and `ACTIVE_HOURS_END`
2. Check `vault/heartbeat.md` is not empty
3. Check logs for `HEARTBEAT_OK` (means nothing to report)
4. Check `ANTHROPIC_API_KEY` is valid

### Memory/RAG not working

1. Check embeddings exist:
```bash
sudo -u myclaw node -e "const db=require('better-sqlite3')('/var/lib/myclaw/data/myclaw.db'); console.log(db.prepare('SELECT count(*) as c FROM memory_chunks').get())"
```
2. Re-embed vault:
```bash
cd /var/lib/myclaw/app && sudo -u myclaw node dist/scripts/embed-vault.js
```
3. Check `ANTHROPIC_API_KEY` has Voyage API access

### rclone sync failing

1. Check rclone config exists: `ls -la /var/lib/myclaw/.config/rclone/rclone.conf`
2. Test rclone: `sudo -u myclaw rclone lsd gdrive: --config /var/lib/myclaw/.config/rclone/rclone.conf`
3. If token expired: re-run `rclone config` on your Mac, update `RCLONE_CONFIG` GitHub secret, redeploy
4. Check timer logs: `journalctl -u myclaw-vault-pull -f --no-pager`

## Restarting

```bash
# Restart app
systemctl restart myclaw

# Check it came back up
systemctl status myclaw
```

## Updating

Push to `main` triggers auto-deploy via GitHub Actions (~2 min). Or manually:

```bash
# On server — only if you need to restart without redeploying
systemctl restart myclaw
```
