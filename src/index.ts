import { getConfig } from "./config.js";
import { getDb, closeDb } from "./db/client.js";
import { createBot, startBot } from "./telegram/bot.js";
import { startHeartbeat } from "./heartbeat/runner.js";

async function main() {
  console.log("[sam] Starting Sam...");

  // Load and validate config
  const config = getConfig();
  console.log(`[sam] Environment: ${config.NODE_ENV}`);

  // Initialize database
  const db = getDb(config.DB_PATH);
  console.log("[sam] Database initialized");

  // Start Telegram bot
  const bot = createBot(config, db);
  await startBot(bot, config);

  // Start heartbeat cron
  const heartbeatJob = startHeartbeat(config, db, bot);

  // Note: MCP server runs as a separate process (spawned by Claude Code)
  // See .claude/settings.json for MCP server configuration

  console.log("[sam] All systems booted. Ready.");

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n[sam] Shutting down...");
    heartbeatJob.stop();
    bot.stop();
    closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[sam] Fatal error:", err);
  process.exit(1);
});
