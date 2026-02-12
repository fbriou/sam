import { createHash } from "crypto";
import { Bot } from "grammy";
import type { Database } from "better-sqlite3";
import type { Config } from "../config.js";
import { spawnClaude } from "../claude/client.js";
import { allowListMiddleware, rateLimitMiddleware } from "./security.js";
import { markdownToTelegramHtml, chunkText } from "./formatter.js";
import { maybeSummarize } from "../memory/summarizer.js";

/**
 * Create and configure the Telegram bot.
 *
 * The bot is a thin orchestrator:
 * 1. Receives a message from Telegram
 * 2. Spawns `claude -p` with the message text
 * 3. Saves both user and assistant messages to SQLite
 * 4. Converts the response to Telegram HTML
 * 5. Chunks and sends the response back
 */
export function createBot(config: Config, db: Database): Bot {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

  // --- Middleware chain ---

  // 1. Allow-list: only authorized Telegram users
  bot.use(allowListMiddleware(config.TELEGRAM_ALLOWED_IDS));

  // 2. Rate limiting: max 10 messages per minute
  bot.use(rateLimitMiddleware(10));

  // --- Handlers ---

  // /start command
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "MyClaw is ready. Send me a message and I'll help you out."
    );
  });

  // Main text message handler
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id;

    // Show "typing" indicator while processing
    await ctx.replyWithChatAction("typing");

    // Keep typing indicator alive for long-running requests
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4_000);

    try {
      // Spawn Claude Code CLI with session per chat
      // Claude Code requires a valid UUID — derive one deterministically from the chat ID
      const hash = createHash("md5").update(`myclaw-${chatId}`).digest("hex");
      const sessionId = [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)].join("-");
      const result = await spawnClaude(text, {
        sessionId,
        outputFormat: "json",
        maxTurns: 5,
      });

      // Save conversation to SQLite
      const insertStmt = db.prepare(
        "INSERT INTO conversations (telegram_chat_id, role, content) VALUES (?, ?, ?)"
      );
      insertStmt.run(chatId, "user", text);
      insertStmt.run(chatId, "assistant", result.text);

      // Convert and send response
      const htmlResponse = markdownToTelegramHtml(result.text);
      const chunks = chunkText(htmlResponse, 4096);

      for (const chunk of chunks) {
        try {
          await ctx.reply(chunk, { parse_mode: "HTML" });
        } catch {
          // If HTML parsing fails, send as plain text
          await ctx.reply(chunk);
        }
      }

      // Trigger auto-summarization check (runs in background, doesn't block response)
      maybeSummarize(config, db).catch((err) =>
        console.error("[summarizer] Background summarization error:", err)
      );
    } catch (err) {
      console.error("[telegram] Error processing message:", err);
      await ctx.reply(
        "Sorry, something went wrong. Please try again in a moment."
      );
    } finally {
      clearInterval(typingInterval);
    }
  });

  // Handle photos with captions
  bot.on("message:photo", async (ctx) => {
    const caption = ctx.message.caption;
    if (caption) {
      // For now, just process the caption as text
      // TODO: Phase 3+ — handle image analysis
      await ctx.reply(
        "I received your photo. Image analysis isn't implemented yet, but I can help with the caption text."
      );
    }
  });

  // Error handler
  bot.catch((err) => {
    console.error("[telegram] Bot error:", err.error);
  });

  return bot;
}

/**
 * Start the bot in the appropriate mode based on environment.
 *
 * - Development: long polling (simpler, no HTTPS needed)
 * - Production: webhooks (more efficient, requires Caddy + HTTPS)
 */
export async function startBot(bot: Bot, config: Config): Promise<void> {
  if (config.NODE_ENV === "production") {
    // TODO: Phase 7 — webhook mode
    // For now, use long polling even in production
    console.log("[telegram] Starting bot in long polling mode...");
    bot.start();
  } else {
    console.log("[telegram] Starting bot in long polling mode...");
    bot.start();
  }

  console.log("[telegram] Bot is running");
}
