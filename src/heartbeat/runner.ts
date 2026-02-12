import Anthropic from "@anthropic-ai/sdk";
import { CronJob } from "cron";
import { Bot } from "grammy";
import { createHash } from "crypto";
import type { Database } from "better-sqlite3";
import type { Config } from "../config.js";
import { readVaultFile } from "../memory/vault.js";

const HEARTBEAT_PROMPT = `You are a proactive personal assistant. Below is a checklist of things to check.
Review each item and report only if there's something actionable or noteworthy.

Rules:
- If there is nothing to report, respond with exactly: HEARTBEAT_OK
- If there IS something to report, be concise (max 500 characters)
- Don't repeat yourself — only report new or changed information
- Use the current date/time to determine which checks apply (every/daily/weekly)
- Be helpful but not annoying — only message if it's worth interrupting the user

Current date/time: ${new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })}

Checklist:
`;

/**
 * Check if the current time is within active hours.
 */
function isWithinActiveHours(config: Config): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.ACTIVE_HOURS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value || "0"
  );
  const currentTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    currentTime >= config.ACTIVE_HOURS_START &&
    currentTime <= config.ACTIVE_HOURS_END
  );
}

/**
 * Check if a response was already delivered in the last 24 hours.
 */
function isDuplicate(db: Database, responseHash: string): boolean {
  const row = db
    .prepare(
      "SELECT id FROM heartbeat_log WHERE response_hash = ? AND created_at > datetime('now', '-24 hours')"
    )
    .get(responseHash);
  return !!row;
}

/**
 * Log a heartbeat response.
 */
function logHeartbeat(
  db: Database,
  responseHash: string,
  content: string,
  delivered: boolean
): void {
  db.prepare(
    "INSERT INTO heartbeat_log (response_hash, content, delivered) VALUES (?, ?, ?)"
  ).run(responseHash, content, delivered ? 1 : 0);
}

/**
 * Start the heartbeat cron runner.
 *
 * Every 30 minutes (configurable), this:
 * 1. Checks if within active hours
 * 2. Reads heartbeat.md from the vault
 * 3. Sends the checklist to Claude Haiku via the Anthropic SDK
 * 4. If the response is NOT "HEARTBEAT_OK", sends it to your Telegram chat
 * 5. Deduplicates responses within a 24h window
 */
export function startHeartbeat(
  config: Config,
  db: Database,
  bot: Bot
): CronJob {
  const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  const job = new CronJob(
    config.HEARTBEAT_INTERVAL_CRON,
    async () => {
      try {
        // Check active hours
        if (!isWithinActiveHours(config)) {
          console.log("[heartbeat] Outside active hours, skipping");
          return;
        }

        // Read heartbeat checklist
        const checklist = readVaultFile(config.VAULT_PATH, "heartbeat.md");
        if (!checklist || !checklist.trim()) {
          console.log("[heartbeat] heartbeat.md is empty, skipping");
          return;
        }

        console.log("[heartbeat] Running heartbeat check...");

        // Call Claude Haiku (cheap, fast)
        const response = await anthropic.messages.create({
          model: config.HEARTBEAT_MODEL,
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: HEARTBEAT_PROMPT + checklist,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        // Check if nothing to report
        if (text.includes("HEARTBEAT_OK")) {
          console.log("[heartbeat] HEARTBEAT_OK — nothing to report");
          logHeartbeat(
            db,
            createHash("sha256").update(text).digest("hex"),
            text,
            false
          );
          return;
        }

        // Check for duplicates
        const hash = createHash("sha256").update(text).digest("hex");
        if (isDuplicate(db, hash)) {
          console.log("[heartbeat] Duplicate response, skipping delivery");
          return;
        }

        // Deliver to Telegram
        console.log("[heartbeat] Delivering heartbeat message to Telegram");
        await bot.api.sendMessage(config.TELEGRAM_CHAT_ID, text, {
          parse_mode: "HTML",
        });

        logHeartbeat(db, hash, text, true);
        console.log("[heartbeat] Message delivered");
      } catch (err) {
        console.error("[heartbeat] Error:", err);
      }
    },
    null, // onComplete
    false, // start immediately? No — we start it manually
    config.ACTIVE_HOURS_TZ
  );

  job.start();
  console.log(
    `[heartbeat] Cron started: ${config.HEARTBEAT_INTERVAL_CRON} (${config.ACTIVE_HOURS_TZ})`
  );

  return job;
}
