import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dotenv so it doesn't load the real .env file
vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

const VALID_ENV = {
  TELEGRAM_BOT_TOKEN: "123:ABC",
  TELEGRAM_ALLOWED_IDS: "111,222",
  TELEGRAM_CHAT_ID: "111",
  WEBHOOK_SECRET: "secretsecret",
};

describe("getConfig", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear all env vars that config.ts reads
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ALLOWED_IDS;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.WEBHOOK_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.VAULT_PATH;
    delete process.env.DB_PATH;
    delete process.env.NODE_ENV;
    delete process.env.ACTIVE_HOURS_START;
    delete process.env.ACTIVE_HOURS_END;
    delete process.env.ACTIVE_HOURS_TZ;
    delete process.env.HEARTBEAT_INTERVAL_CRON;
    delete process.env.CLAUDE_MODEL;
    delete process.env.HEARTBEAT_MODEL;
  });

  async function loadConfig(envOverrides: Record<string, string> = {}) {
    const env = { ...VALID_ENV, ...envOverrides };
    for (const [key, value] of Object.entries(env)) {
      process.env[key] = value;
    }

    const { getConfig } = await import("./config.js");
    return getConfig();
  }

  it("returns config with valid env", async () => {
    const config = await loadConfig();
    expect(config.TELEGRAM_BOT_TOKEN).toBe("123:ABC");
  });

  it("transforms TELEGRAM_ALLOWED_IDS to number array", async () => {
    const config = await loadConfig();
    expect(config.TELEGRAM_ALLOWED_IDS).toEqual([111, 222]);
  });

  it("transforms TELEGRAM_CHAT_ID to number", async () => {
    const config = await loadConfig();
    expect(config.TELEGRAM_CHAT_ID).toBe(111);
  });

  it("defaults ANTHROPIC_API_KEY to empty string", async () => {
    const config = await loadConfig();
    expect(config.ANTHROPIC_API_KEY).toBe("");
  });

  it("defaults CLAUDE_CODE_OAUTH_TOKEN to empty string", async () => {
    const config = await loadConfig();
    expect(config.CLAUDE_CODE_OAUTH_TOKEN).toBe("");
  });

  it("applies default NODE_ENV", async () => {
    const config = await loadConfig();
    expect(config.NODE_ENV).toBe("development");
  });

  it("applies default model values", async () => {
    const config = await loadConfig();
    expect(config.CLAUDE_MODEL).toBe("claude-sonnet-4-5-20250929");
    expect(config.HEARTBEAT_MODEL).toBe("claude-haiku-4-5-20251001");
  });

  it("applies default paths", async () => {
    const config = await loadConfig();
    expect(config.VAULT_PATH).toBe("./vault");
    expect(config.DB_PATH).toBe("./data/sam.db");
  });

  it("applies default heartbeat config", async () => {
    const config = await loadConfig();
    expect(config.ACTIVE_HOURS_START).toBe("08:00");
    expect(config.ACTIVE_HOURS_END).toBe("22:00");
    expect(config.ACTIVE_HOURS_TZ).toBe("Europe/Paris");
    expect(config.HEARTBEAT_INTERVAL_CRON).toBe("*/30 * * * *");
  });

  it("exits on missing TELEGRAM_BOT_TOKEN", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    process.env.TELEGRAM_ALLOWED_IDS = "111";
    process.env.TELEGRAM_CHAT_ID = "111";
    process.env.WEBHOOK_SECRET = "secretsecret";
    // No TELEGRAM_BOT_TOKEN

    const { getConfig } = await import("./config.js");
    expect(() => getConfig()).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("exits on short WEBHOOK_SECRET", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_ALLOWED_IDS = "111";
    process.env.TELEGRAM_CHAT_ID = "111";
    process.env.WEBHOOK_SECRET = "short";

    const { getConfig } = await import("./config.js");
    expect(() => getConfig()).toThrow("process.exit");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("accepts custom ANTHROPIC_API_KEY", async () => {
    const config = await loadConfig({ ANTHROPIC_API_KEY: "sk-test-123" });
    expect(config.ANTHROPIC_API_KEY).toBe("sk-test-123");
  });
});
