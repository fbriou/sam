import type { Database } from "better-sqlite3";
import type { VaultChunk } from "./vault.js";
import { embedQuery, embedBatch } from "./embeddings.js";

/**
 * Store chunks and their embeddings in SQLite + sqlite-vec.
 *
 * This is called during initial vault embedding and when new memories are created.
 * It replaces all chunks for a given source file (full re-embed per file).
 */
export async function storeChunks(
  db: Database,
  chunks: VaultChunk[],
  embeddings: number[][]
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Chunk/embedding count mismatch: ${chunks.length} vs ${embeddings.length}`
    );
  }

  const insertChunk = db.prepare(
    "INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)"
  );

  const insertVec = db.prepare(
    "INSERT INTO memory_vec (id, embedding) VALUES (?, ?)"
  );

  const transaction = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const result = insertChunk.run(
        chunks[i].sourceFile,
        chunks[i].chunkIndex,
        chunks[i].content
      );
      const chunkId = result.lastInsertRowid;

      // sqlite-vec expects a Float32Array for the embedding
      const vecBuffer = new Float32Array(embeddings[i]).buffer;
      insertVec.run(chunkId, Buffer.from(vecBuffer));
    }
  });

  transaction();
  console.log(`[rag] Stored ${chunks.length} chunks with embeddings`);
}

/**
 * Remove all chunks for a given source file.
 * Called before re-embedding a file to avoid duplicates.
 */
export function removeChunksForFile(db: Database, sourceFile: string): void {
  // Get chunk IDs to remove from vector table too
  const chunkIds = db
    .prepare("SELECT id FROM memory_chunks WHERE source_file = ?")
    .all(sourceFile)
    .map((row: any) => row.id);

  if (chunkIds.length === 0) return;

  const deleteChunks = db.prepare(
    "DELETE FROM memory_chunks WHERE source_file = ?"
  );
  const deleteVec = db.prepare("DELETE FROM memory_vec WHERE id = ?");

  const transaction = db.transaction(() => {
    deleteChunks.run(sourceFile);
    for (const id of chunkIds) {
      deleteVec.run(id);
    }
  });

  transaction();
  console.log(
    `[rag] Removed ${chunkIds.length} chunks for file: ${sourceFile}`
  );
}

/**
 * Search for the most relevant memory chunks given a query.
 *
 * 1. Embed the query using Voyage API (input_type: "query")
 * 2. Use sqlite-vec cosine distance to find top-K matches
 * 3. Return chunk content with source file info
 */
export async function searchMemory(
  db: Database,
  query: string,
  limit: number = 5
): Promise<Array<{ content: string; sourceFile: string; distance: number }>> {
  // Embed the query
  const queryEmbedding = await embedQuery(query);
  const vecBuffer = new Float32Array(queryEmbedding).buffer;

  // sqlite-vec cosine distance search
  const results = db
    .prepare(
      `
    SELECT
      v.id,
      v.distance,
      c.content,
      c.source_file
    FROM memory_vec v
    JOIN memory_chunks c ON c.id = v.id
    WHERE v.embedding MATCH ?
    ORDER BY v.distance
    LIMIT ?
  `
    )
    .all(Buffer.from(vecBuffer), limit);

  return (results as any[]).map((row) => ({
    content: row.content,
    sourceFile: row.source_file,
    distance: row.distance,
  }));
}

/**
 * Embed and store an entire vault.
 * Used during initial setup and periodic re-embedding.
 */
export async function embedAndStoreChunks(
  db: Database,
  chunks: VaultChunk[]
): Promise<void> {
  if (chunks.length === 0) {
    console.log("[rag] No chunks to embed");
    return;
  }

  console.log(`[rag] Embedding ${chunks.length} chunks...`);

  // Get unique source files to clear old data
  const sourceFiles = [...new Set(chunks.map((c) => c.sourceFile))];
  for (const file of sourceFiles) {
    removeChunksForFile(db, file);
  }

  // Batch embed all chunks
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedBatch(texts);

  // Store chunks and embeddings
  await storeChunks(db, chunks, embeddings);

  console.log(
    `[rag] Embedded and stored ${chunks.length} chunks from ${sourceFiles.length} files`
  );
}
