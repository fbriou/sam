import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  listVaultFiles,
  chunkVaultFile,
  readVaultFile,
  getVaultFileModTime,
} from "./vault.js";

let tempDir: string;

function createTempVault() {
  tempDir = mkdtempSync(join(tmpdir(), "vault-test-"));
  return tempDir;
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("listVaultFiles", () => {
  it("lists .md files recursively", () => {
    const vault = createTempVault();
    writeFileSync(join(vault, "soul.md"), "# Soul");
    mkdirSync(join(vault, "memories"));
    writeFileSync(join(vault, "memories", "2026-02-12.md"), "# Memories");

    const files = listVaultFiles(vault);
    expect(files).toContain("soul.md");
    expect(files).toContain(join("memories", "2026-02-12.md"));
  });

  it("skips hidden directories", () => {
    const vault = createTempVault();
    mkdirSync(join(vault, ".obsidian"));
    writeFileSync(join(vault, ".obsidian", "config.md"), "hidden");
    writeFileSync(join(vault, "visible.md"), "visible");

    const files = listVaultFiles(vault);
    expect(files).toEqual(["visible.md"]);
  });

  it("returns [] for non-existent path", () => {
    expect(listVaultFiles("/nonexistent/vault")).toEqual([]);
  });

  it("only lists .md files", () => {
    const vault = createTempVault();
    writeFileSync(join(vault, "note.md"), "# Note");
    writeFileSync(join(vault, "image.png"), "binary");

    const files = listVaultFiles(vault);
    expect(files).toEqual(["note.md"]);
  });
});

describe("chunkVaultFile", () => {
  it("returns [] for missing file", () => {
    const vault = createTempVault();
    expect(chunkVaultFile(vault, "missing.md")).toEqual([]);
  });

  it("returns [] for empty file", () => {
    const vault = createTempVault();
    writeFileSync(join(vault, "empty.md"), "   ");
    expect(chunkVaultFile(vault, "empty.md")).toEqual([]);
  });

  it("splits on heading boundaries", () => {
    const vault = createTempVault();
    const content = "# Title\nIntro\n\n## Section 1\nContent 1\n\n## Section 2\nContent 2";
    writeFileSync(join(vault, "doc.md"), content);

    const chunks = chunkVaultFile(vault, "doc.md");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].sourceFile).toBe("doc.md");
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
  });

  it("splits long sections at paragraph boundaries", () => {
    const vault = createTempVault();
    const longPara = "a".repeat(500);
    const content = `## Section\n\n${longPara}\n\n${longPara}\n\n${longPara}\n\n${longPara}\n\n${longPara}`;
    writeFileSync(join(vault, "long.md"), content);

    const chunks = chunkVaultFile(vault, "long.md", 1000);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("respects maxChunkChars", () => {
    const vault = createTempVault();
    const content = "Short content here";
    writeFileSync(join(vault, "short.md"), content);

    const chunks = chunkVaultFile(vault, "short.md", 5000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Short content here");
  });
});

describe("readVaultFile", () => {
  it("reads file content", () => {
    const vault = createTempVault();
    writeFileSync(join(vault, "soul.md"), "I am Sam");

    expect(readVaultFile(vault, "soul.md")).toBe("I am Sam");
  });

  it("returns null for missing file", () => {
    const vault = createTempVault();
    expect(readVaultFile(vault, "missing.md")).toBeNull();
  });
});

describe("getVaultFileModTime", () => {
  it("returns modification time in ms", () => {
    const vault = createTempVault();
    writeFileSync(join(vault, "file.md"), "content");

    const modTime = getVaultFileModTime(vault, "file.md");
    expect(modTime).toBeTypeOf("number");
    expect(modTime!).toBeGreaterThan(0);
  });

  it("returns null for missing file", () => {
    const vault = createTempVault();
    expect(getVaultFileModTime(vault, "missing.md")).toBeNull();
  });
});
