import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const envSchema = z.object({
  // Anthropic API (optional if using CLAUDE_CODE_OAUTH_TOKEN)
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  CLAUDE_CODE_OAUTH_TOKEN: z.string().optional().default(""),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_ALLOWED_IDS: z
    .string()
    .min(1, "TELEGRAM_ALLOWED_IDS is required")
    .transform((val) => val.split(",").map(Number)),
  TELEGRAM_CHAT_ID: z
    .string()
    .min(1, "TELEGRAM_CHAT_ID is required")
    .transform(Number),
  WEBHOOK_SECRET: z.string().min(8, "WEBHOOK_SECRET must be at least 8 chars"),

  // Paths
  VAULT_PATH: z.string().default("./vault"),
  DB_PATH: z.string().default("./data/sam.db"),

  // Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Heartbeat
  ACTIVE_HOURS_START: z.string().default("08:00"),
  ACTIVE_HOURS_END: z.string().default("22:00"),
  ACTIVE_HOURS_TZ: z.string().default("Europe/Paris"),
  HEARTBEAT_INTERVAL_CRON: z.string().default("*/30 * * * *"),

  // Models
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-5-20250929"),
  HEARTBEAT_MODEL: z.string().default("claude-haiku-4-5-20251001"),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      console.error(`Configuration errors:\n${errors}`);
      process.exit(1);
    }
    _config = result.data;
  }
  return _config;
}
