---
allowed-tools: Read, Glob, Grep
description: Audit documentation against source code to catch drift
---

# Doc-Check — Documentation Audit

Compare docs against source code and report any mismatches.

## Read — Documentation

- CLAUDE.md
- runtime/CLAUDE.md
- docs/architecture.md
- docs/pillars/01-memory.md
- docs/pillars/02-heartbeat.md
- docs/pillars/03-telegram.md
- docs/pillars/04-skills.md
- docs/pillars/05-recipes.md

## Read — Source code (for cross-reference)

- src/claude/client.ts
- src/mcp/server.ts
- src/telegram/bot.ts
- src/heartbeat/runner.ts
- src/memory/summarizer.ts
- src/config.ts

## Audit checklist

Run each check below. For each one, compare what the docs say against what the code actually does.

### 1. Function names

Do docs reference functions that actually exist in the code?

- `src/claude/client.ts` exports → check all docs reference `askClaude()`, `simpleQuery()` — flag if any doc still says `spawnClaude`, `claude -p`, or `@anthropic-ai/sdk` directly
- `src/telegram/bot.ts` exports → check for `createBot()`, `startBot()`
- `src/heartbeat/runner.ts` exports → check for `startHeartbeat()`
- `src/memory/summarizer.ts` exports → check for `maybeSummarize()`, `summarizeAndSave()`

### 2. MCP tool names

Does `runtime/CLAUDE.md` list the same tools as `src/mcp/server.ts`?

- Grep for `server.tool(` in `src/mcp/server.ts` to get the actual registered tool names
- Compare against the tool list in `runtime/CLAUDE.md`
- Also check `src/claude/client.ts` `allowedTools` array matches

### 3. Skill names

Does `runtime/CLAUDE.md` list the same skills as the vault?

- Glob `vault/skills/*.md` (or the Google Drive path if vault/ doesn't exist locally)
- Compare filenames against the skill list in `runtime/CLAUDE.md` and `docs/pillars/04-skills.md`

### 4. File paths

Does `CLAUDE.md` "Key source files" section match the actual repo?

- Glob `src/**/*.ts` (excluding test files)
- Check that every file listed in CLAUDE.md exists, and that no new non-test source files are missing from the list

### 5. Stale terms

Grep across all `docs/pillars/` files for known stale patterns:

- `claude -p`
- `spawnClaude`
- `Claude Code CLI`
- `@anthropic-ai/sdk`

These should NOT appear in pillar docs (they're valid in `docs/decisions/adr-001` which is a historical record).

### 6. Config keys

Does `docs/pillars/02-heartbeat.md` configuration section list the same env vars as `src/config.ts`?

- Read the Zod schema in `src/config.ts`
- Compare heartbeat-related keys against what the heartbeat doc lists

## Report

Output a structured report:

- **For each check**: state PASS or FAIL with details
- **If all pass**: "All docs in sync with code."
- **If any fail**: list each mismatch with the doc file, the stale reference, and what it should say based on the code
- Keep it concise — one line per mismatch
