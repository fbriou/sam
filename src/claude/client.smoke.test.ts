import { describe, it, expect } from "vitest";
import { simpleQuery } from "./client.js";

describe("smoke", () => {
  it.skipIf(!process.env.CLAUDE_CODE_OAUTH_TOKEN)(
    "simpleQuery returns a response with real OAuth token",
    async () => {
      const result = await simpleQuery("Respond with exactly this text and nothing else: TEST_OK");
      expect(result).toContain("TEST_OK");
    },
    60_000
  );
});
