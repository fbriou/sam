import { writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import type { Database } from "better-sqlite3";
import type { Config } from "../config.js";
import { chunkVaultFile } from "./vault.js";
import { embedAndStoreChunks } from "./rag.js";
import { simpleQuery } from "../claude/client.js";

const SUMMARIZE_PROMPT = `You are summarizing a conversation for a personal assistant's memory.
Extract the key information:

1. Key facts and decisions made
2. Action items or tasks mentioned
3. Important dates or deadlines
4. People or projects discussed
5. Any preferences or opinions expressed

Format as a concise markdown section with bullet points.
Include a one-line summary at the top.
Keep it under 500 words.

Conversation to summarize:
`;

/**
 * Check if there are enough unsummarized messages to trigger summarization.
 * Returns the messages if threshold is met, null otherwise.
 */
export function getUnsummarizedMessages(
  db: Database,
  threshold: number = 20
): Array<{ role: string; content: string; created_at: string }> | null {
  // Get the last summarization timestamp
  const lastSummary = db
    .prepare(
      "SELECT MAX(created_at) as last_at FROM memory_chunks WHERE source_file LIKE 'memories/%'"
    )
    .get() as { last_at: string | null };

  // Count messages since last summarization
  let query: string;
  let params: any[];

  if (lastSummary?.last_at) {
    query =
      "SELECT role, content, created_at FROM conversations WHERE created_at > ? ORDER BY created_at ASC";
    params = [lastSummary.last_at];
  } else {
    query =
      "SELECT role, content, created_at FROM conversations ORDER BY created_at ASC";
    params = [];
  }

  const messages = db.prepare(query).all(...params) as Array<{
    role: string;
    content: string;
    created_at: string;
  }>;

  if (messages.length < threshold) {
    return null;
  }

  return messages;
}

/**
 * Summarize a batch of messages and save to the vault as a daily memory file.
 *
 * Uses the Agent SDK for summarization. The summary is:
 * 1. Appended to vault/memories/YYYY-MM-DD.md
 * 2. Chunked and embedded into sqlite-vec for RAG (if ANTHROPIC_API_KEY is set for Voyage API)
 */
export async function summarizeAndSave(
  config: Config,
  db: Database,
  messages: Array<{ role: string; content: string; created_at: string }>
): Promise<void> {
  // Format conversation for the prompt
  const conversation = messages
    .map((m) => `[${m.created_at}] ${m.role}: ${m.content}`)
    .join("\n\n");

  console.log(
    `[summarizer] Summarizing ${messages.length} messages...`
  );

  const summary = await simpleQuery(SUMMARIZE_PROMPT + conversation, {
    model: config.HEARTBEAT_MODEL,
  });

  if (!summary.trim()) {
    console.log("[summarizer] Empty summary, skipping");
    return;
  }

  // Determine today's date for the filename
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const memoryFile = `memories/${today}.md`;
  const fullPath = join(config.VAULT_PATH, memoryFile);

  // Ensure memories directory exists
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Append to today's memory file (multiple summaries per day)
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: config.ACTIVE_HOURS_TZ,
  });

  const entry = `\n## ${timestamp}\n\n${summary}\n`;

  if (existsSync(fullPath)) {
    appendFileSync(fullPath, entry, "utf-8");
  } else {
    writeFileSync(fullPath, `# Memories — ${today}\n${entry}`, "utf-8");
  }

  console.log(`[summarizer] Saved summary to ${memoryFile}`);

  // Re-embed the memory file into sqlite-vec (requires ANTHROPIC_API_KEY for Voyage API)
  if (config.ANTHROPIC_API_KEY) {
    const chunks = chunkVaultFile(config.VAULT_PATH, memoryFile);
    if (chunks.length > 0) {
      await embedAndStoreChunks(db, chunks);
      console.log(
        `[summarizer] Embedded ${chunks.length} chunks from ${memoryFile}`
      );
    }
  } else {
    console.log("[summarizer] Skipping embedding (no ANTHROPIC_API_KEY for Voyage API)");
  }
}

/**
 * Run the summarization check.
 * Call this periodically (e.g., after every N messages or on a cron).
 */
export async function maybeSummarize(
  config: Config,
  db: Database
): Promise<void> {
  const messages = getUnsummarizedMessages(db, 20);
  if (!messages) {
    return; // Not enough messages yet
  }

  await summarizeAndSave(config, db, messages);
}
