/**
 * Embed all vault markdown files into sqlite-vec.
 *
 * Run this script to initially populate or re-populate the vector store:
 *   npx tsx scripts/embed-vault.ts
 *
 * This reads all .md files from the vault, chunks them, generates embeddings
 * via Anthropic Voyage API, and stores them in SQLite.
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { getDb, closeDb } from "../src/db/client.js";
import { chunkEntireVault } from "../src/memory/vault.js";
import { embedAndStoreChunks } from "../src/memory/rag.js";

const VAULT_PATH = process.env.VAULT_PATH || "./vault";
const DB_PATH = process.env.DB_PATH || "./data/sam.db";

async function main() {
  console.log(`[embed] Embedding vault at: ${VAULT_PATH}`);
  console.log(`[embed] Database at: ${DB_PATH}`);

  const db = getDb(DB_PATH);

  // Chunk all vault files
  const chunks = chunkEntireVault(VAULT_PATH);
  console.log(`[embed] Total chunks to embed: ${chunks.length}`);

  if (chunks.length === 0) {
    console.log("[embed] No chunks found. Is the vault empty?");
    closeDb();
    return;
  }

  // Embed and store
  await embedAndStoreChunks(db, chunks);

  console.log("[embed] Done!");
  closeDb();
}

main().catch((err) => {
  console.error("[embed] Error:", err);
  closeDb();
  process.exit(1);
});
