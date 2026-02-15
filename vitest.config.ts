import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load .env so smoke tests can access CLAUDE_CODE_OAUTH_TOKEN
config();

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
