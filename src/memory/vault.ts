import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * A chunk of text extracted from a vault markdown file.
 */
export interface VaultChunk {
  sourceFile: string; // Relative path within vault, e.g. "memories/2026-02-12.md"
  chunkIndex: number;
  content: string;
}

/**
 * Read all markdown files from the vault directory recursively.
 * Returns file paths relative to the vault root.
 */
export function listVaultFiles(vaultPath: string): string[] {
  if (!existsSync(vaultPath)) {
    console.warn(`[vault] Vault path does not exist: ${vaultPath}`);
    return [];
  }

  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith(".")) {
          walk(fullPath);
        }
      } else if (entry.name.endsWith(".md")) {
        files.push(relative(vaultPath, fullPath));
      }
    }
  }

  walk(vaultPath);
  return files;
}

/**
 * Read a single vault file and split it into chunks.
 *
 * Chunking strategy: split at heading boundaries (## or ###), then at
 * paragraph boundaries if a section is too long. Target chunk size is
 * ~500 tokens (~2000 characters).
 */
export function chunkVaultFile(
  vaultPath: string,
  filePath: string,
  maxChunkChars: number = 2000
): VaultChunk[] {
  const fullPath = join(vaultPath, filePath);
  if (!existsSync(fullPath)) {
    return [];
  }

  const content = readFileSync(fullPath, "utf-8");
  if (!content.trim()) {
    return [];
  }

  // Split on headings (## or ###)
  const sections = content.split(/(?=^#{2,3}\s)/m).filter((s) => s.trim());

  const chunks: VaultChunk[] = [];

  for (const section of sections) {
    if (section.length <= maxChunkChars) {
      chunks.push({
        sourceFile: filePath,
        chunkIndex: chunks.length,
        content: section.trim(),
      });
    } else {
      // Split long sections at paragraph boundaries
      const paragraphs = section.split(/\n\n+/);
      let current = "";

      for (const para of paragraphs) {
        if (current.length + para.length + 2 > maxChunkChars && current) {
          chunks.push({
            sourceFile: filePath,
            chunkIndex: chunks.length,
            content: current.trim(),
          });
          current = para;
        } else {
          current += (current ? "\n\n" : "") + para;
        }
      }

      if (current.trim()) {
        chunks.push({
          sourceFile: filePath,
          chunkIndex: chunks.length,
          content: current.trim(),
        });
      }
    }
  }

  return chunks;
}

/**
 * Read and chunk all markdown files in the vault.
 */
export function chunkEntireVault(
  vaultPath: string,
  maxChunkChars: number = 2000
): VaultChunk[] {
  const files = listVaultFiles(vaultPath);
  const allChunks: VaultChunk[] = [];

  for (const file of files) {
    const chunks = chunkVaultFile(vaultPath, file, maxChunkChars);
    allChunks.push(...chunks);
  }

  console.log(
    `[vault] Chunked ${files.length} files into ${allChunks.length} chunks`
  );
  return allChunks;
}

/**
 * Read a vault file's raw content. Used for loading soul.md, user.md, heartbeat.md.
 */
export function readVaultFile(
  vaultPath: string,
  filePath: string
): string | null {
  const fullPath = join(vaultPath, filePath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return readFileSync(fullPath, "utf-8");
}

/**
 * Get the last modified time of a vault file.
 */
export function getVaultFileModTime(
  vaultPath: string,
  filePath: string
): number | null {
  const fullPath = join(vaultPath, filePath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return statSync(fullPath).mtimeMs;
}
