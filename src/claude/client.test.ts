import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Agent SDK
const mockQueryIterator = vi.fn();
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(() => ({
    [Symbol.asyncIterator]: () => ({
      next: mockQueryIterator,
    }),
  })),
}));

// Mock fs.readFileSync for CLAUDE.md loading
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue("You are Sam, a personal assistant."),
  };
});

import { simpleQuery, askClaude } from "./client.js";
import { query } from "@anthropic-ai/claude-agent-sdk";

const mockQuery = vi.mocked(query);

beforeEach(() => {
  vi.clearAllMocks();

  // Default: return a success result then done
  mockQueryIterator
    .mockResolvedValueOnce({
      value: {
        type: "result",
        subtype: "success",
        result: "Hello from Claude!",
        session_id: "session-123",
      },
      done: false,
    })
    .mockResolvedValueOnce({ value: undefined, done: true });
});

describe("simpleQuery", () => {
  it("calls query with correct options", async () => {
    await simpleQuery("test prompt");

    expect(mockQuery).toHaveBeenCalledWith({
      prompt: "test prompt",
      options: {
        maxTurns: 1,
        permissionMode: "dontAsk",
      },
    });
  });

  it("passes model when provided", async () => {
    await simpleQuery("test", { model: "claude-haiku-4-5-20251001" });

    expect(mockQuery).toHaveBeenCalledWith({
      prompt: "test",
      options: {
        maxTurns: 1,
        permissionMode: "dontAsk",
        model: "claude-haiku-4-5-20251001",
      },
    });
  });

  it("returns text from success result", async () => {
    const result = await simpleQuery("hello");
    expect(result).toBe("Hello from Claude!");
  });

  it("returns empty string when no success result", async () => {
    mockQueryIterator
      .mockReset()
      .mockResolvedValueOnce({
        value: { type: "message", content: "ignored" },
        done: false,
      })
      .mockResolvedValueOnce({ value: undefined, done: true });

    const result = await simpleQuery("hello");
    expect(result).toBe("");
  });
});

describe("askClaude", () => {
  it("passes systemPrompt and MCP config", async () => {
    await askClaude("hello");

    const call = mockQuery.mock.calls[0][0] as any;
    expect(call.options.systemPrompt).toContain("Sam");
    expect(call.options.mcpServers).toHaveProperty("sam-memory");
  });

  it("passes tools and allowedTools", async () => {
    await askClaude("hello");

    const call = mockQuery.mock.calls[0][0] as any;
    expect(call.options.tools).toContain("Bash");
    expect(call.options.tools).toContain("WebSearch");
    expect(call.options.allowedTools).toContain("mcp__sam-memory__search_memory");
  });

  it("returns text and sessionId", async () => {
    const result = await askClaude("hello");
    expect(result.text).toBe("Hello from Claude!");
    expect(result.sessionId).toBe("session-123");
  });

  it("passes resume option with sessionId", async () => {
    await askClaude("hello", { sessionId: "prev-session" });

    const call = mockQuery.mock.calls[0][0] as any;
    expect(call.options.resume).toBe("prev-session");
  });

  it("passes model option", async () => {
    await askClaude("hello", { model: "claude-opus-4-6" });

    const call = mockQuery.mock.calls[0][0] as any;
    expect(call.options.model).toBe("claude-opus-4-6");
  });

  it("retries without resume on stale session error", async () => {
    // First call: throw session error
    mockQuery
      .mockImplementationOnce(() => ({
        [Symbol.asyncIterator]: () => ({
          next: vi.fn().mockRejectedValueOnce(new Error("session not found")),
        }),
      }))
      // Second call (retry): return success
      .mockImplementationOnce(() => ({
        [Symbol.asyncIterator]: () => ({
          next: vi
            .fn()
            .mockResolvedValueOnce({
              value: {
                type: "result",
                subtype: "success",
                result: "Retried!",
                session_id: "new-session",
              },
              done: false,
            })
            .mockResolvedValueOnce({ value: undefined, done: true }),
        }),
      }));

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await askClaude("hello", { sessionId: "stale-session" });

    expect(result.text).toBe("Retried!");
    expect(result.sessionId).toBe("new-session");

    // Verify retry was called without resume
    const retryCall = mockQuery.mock.calls[1][0] as any;
    expect(retryCall.options.resume).toBeUndefined();
    consoleSpy.mockRestore();
  });
});

// Smoke test lives in client.smoke.test.ts (separate file, no mocks)
