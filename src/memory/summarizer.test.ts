import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock dependencies
vi.mock("../claude/client.js", () => ({
  simpleQuery: vi.fn(),
}));

vi.mock("./rag.js", () => ({
  embedAndStoreChunks: vi.fn(),
}));

vi.mock("./vault.js", () => ({
  chunkVaultFile: vi.fn().mockReturnValue([{ sourceFile: "memories/2026-02-12.md", chunkIndex: 0, content: "test" }]),
}));

import {
  getUnsummarizedMessages,
  summarizeAndSave,
  maybeSummarize,
} from "./summarizer.js";
import { simpleQuery } from "../claude/client.js";
import { embedAndStoreChunks } from "./rag.js";
import type { Config } from "../config.js";

const mockSimpleQuery = vi.mocked(simpleQuery);
const mockEmbedAndStore = vi.mocked(embedAndStoreChunks);

let tempDir: string;

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    ANTHROPIC_API_KEY: "",
    CLAUDE_CODE_OAUTH_TOKEN: "",
    TELEGRAM_BOT_TOKEN: "test",
    TELEGRAM_ALLOWED_IDS: [111],
    TELEGRAM_CHAT_ID: 111,
    WEBHOOK_SECRET: "secretsecret",
    VAULT_PATH: tempDir,
    DB_PATH: "./data/sam.db",
    NODE_ENV: "test",
    ACTIVE_HOURS_START: "08:00",
    ACTIVE_HOURS_END: "22:00",
    ACTIVE_HOURS_TZ: "UTC",
    HEARTBEAT_INTERVAL_CRON: "*/30 * * * *",
    CLAUDE_MODEL: "claude-sonnet-4-5-20250929",
    HEARTBEAT_MODEL: "claude-haiku-4-5-20251001",
    ...overrides,
  } as Config;
}

const MESSAGES = [
  { role: "user", content: "Hello", created_at: "2026-02-12T10:00:00" },
  { role: "assistant", content: "Hi there!", created_at: "2026-02-12T10:00:01" },
];

beforeEach(() => {
  vi.clearAllMocks();
  tempDir = mkdtempSync(join(tmpdir(), "summarizer-test-"));
});

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe("getUnsummarizedMessages", () => {
  it("returns null when below threshold", () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ last_at: null }),
        all: vi.fn().mockReturnValue([{ role: "user", content: "hi", created_at: "2026-02-12" }]),
      }),
    } as any;

    expect(getUnsummarizedMessages(db, 20)).toBeNull();
  });

  it("returns messages when above threshold", () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: "user",
      content: `msg ${i}`,
      created_at: `2026-02-12T${String(i).padStart(2, "0")}:00:00`,
    }));

    const db = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ last_at: null }),
        all: vi.fn().mockReturnValue(messages),
      }),
    } as any;

    const result = getUnsummarizedMessages(db, 20);
    expect(result).toHaveLength(25);
  });
});

describe("summarizeAndSave", () => {
  it("calls simpleQuery with formatted conversation", async () => {
    mockSimpleQuery.mockResolvedValue("Summary of conversation");
    const config = makeConfig();

    await summarizeAndSave(config, {} as any, MESSAGES);

    expect(mockSimpleQuery).toHaveBeenCalledOnce();
    const prompt = mockSimpleQuery.mock.calls[0][0];
    expect(prompt).toContain("Hello");
    expect(prompt).toContain("Hi there!");
  });

  it("writes summary to vault memories file", async () => {
    mockSimpleQuery.mockResolvedValue("Key facts:\n- User said hello");
    const config = makeConfig();

    await summarizeAndSave(config, {} as any, MESSAGES);

    const today = new Date().toISOString().split("T")[0];
    const content = readFileSync(join(tempDir, "memories", `${today}.md`), "utf-8");
    expect(content).toContain("Key facts");
    expect(content).toContain("User said hello");
  });

  it("appends to existing memory file", async () => {
    const today = new Date().toISOString().split("T")[0];
    mkdirSync(join(tempDir, "memories"), { recursive: true });
    writeFileSync(join(tempDir, "memories", `${today}.md`), "# Existing\n\nOld content\n");

    mockSimpleQuery.mockResolvedValue("New summary");
    await summarizeAndSave(makeConfig(), {} as any, MESSAGES);

    const content = readFileSync(join(tempDir, "memories", `${today}.md`), "utf-8");
    expect(content).toContain("Old content");
    expect(content).toContain("New summary");
  });

  it("skips embedding when no ANTHROPIC_API_KEY", async () => {
    mockSimpleQuery.mockResolvedValue("Summary");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await summarizeAndSave(makeConfig({ ANTHROPIC_API_KEY: "" }), {} as any, MESSAGES);

    expect(mockEmbedAndStore).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("embeds when ANTHROPIC_API_KEY is set", async () => {
    mockSimpleQuery.mockResolvedValue("Summary");
    mockEmbedAndStore.mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await summarizeAndSave(
      makeConfig({ ANTHROPIC_API_KEY: "sk-test" }),
      {} as any,
      MESSAGES
    );

    expect(mockEmbedAndStore).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("skips on empty summary", async () => {
    mockSimpleQuery.mockResolvedValue("   ");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await summarizeAndSave(makeConfig(), {} as any, MESSAGES);

    // No file written
    const today = new Date().toISOString().split("T")[0];
    expect(() =>
      readFileSync(join(tempDir, "memories", `${today}.md`))
    ).toThrow();
    consoleSpy.mockRestore();
  });
});

describe("maybeSummarize", () => {
  it("does nothing when below threshold", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ last_at: null }),
        all: vi.fn().mockReturnValue([]),
      }),
    } as any;

    await maybeSummarize(makeConfig(), db);
    expect(mockSimpleQuery).not.toHaveBeenCalled();
  });
});
