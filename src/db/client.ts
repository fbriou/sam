import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { initDb } from "./schema.js";

let _db: Database.Database | null = null;

export function getDb(dbPath: string): Database.Database {
  if (!_db) {
    // Ensure data directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    _db = initDb(dbPath);
    console.log(`[db] SQLite database opened at ${dbPath}`);
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    console.log("[db] Database connection closed");
  }
}
