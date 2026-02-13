import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getConfig } from "./config.js";
import { getDb, closeDb } from "./db/client.js";
import { createBot, startBot } from "./telegram/bot.js";
import { startHeartbeat } from "./heartbeat/runner.js";

function syncFromGoogleDrive() {
  const projectDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const syncScript = join(projectDir, "scripts", "sync.sh");

  try {
    console.log("[sam] Syncing vault from Google Drive...");
    execSync(`bash "${syncScript}" pull`, {
      stdio: "inherit",
      timeout: 60_000,
    });
    console.log("[sam] Sync complete.");
  } catch (err) {
    console.warn(
      "[sam] Google Drive sync skipped (rclone not configured or sync failed). Continuing with local data."
    );
  }
}

async function main() {
  console.log("[sam] Starting Sam...");

  // Sync vault + DB from Google Drive before boot
  syncFromGoogleDrive();

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
