import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export function initDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma("journal_mode = WAL");

  // Load sqlite-vec extension for vector similarity search
  sqliteVec.load(db);

  // Run migrations
  migrate(db);

  return db;
}

function migrate(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((row: any) => row.name)
  );

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      db.exec(migration.sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(
        migration.name
      );
      console.log(`[db] Applied migration: ${migration.name}`);
    }
  }
}

const migrations = [
  {
    name: "001_conversations",
    sql: `
      CREATE TABLE conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_chat_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_conv_chat ON conversations(telegram_chat_id, created_at);
    `,
  },
  {
    name: "002_memory_chunks",
    sql: `
      CREATE TABLE memory_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_file TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_chunks_source ON memory_chunks(source_file);
    `,
  },
  {
    name: "003_memory_vec",
    sql: `
      CREATE VIRTUAL TABLE memory_vec USING vec0(
        id INTEGER PRIMARY KEY,
        embedding float[1024]
      );
    `,
  },
  {
    name: "004_heartbeat_log",
    sql: `
      CREATE TABLE heartbeat_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        response_hash TEXT NOT NULL,
        content TEXT NOT NULL,
        delivered INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_heartbeat_hash ON heartbeat_log(response_hash, created_at);
    `,
  },
];
