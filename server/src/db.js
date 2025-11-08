import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'data.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath);

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

export async function migrate() {
  await run(`PRAGMA foreign_keys = ON;`);
  await run(`CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );`);

  await run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    ord INTEGER DEFAULT 0,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  );`);

  await run(`CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    ord INTEGER DEFAULT 0,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  );`);

  // New users table (per meeting), unique name within a meeting
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(meeting_id, name),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  );`);

  // Ensure assignments table exists; migrate old schema (with TEXT user) to new schema (with user_id FK)
  await run(`CREATE TABLE IF NOT EXISTS assignments (
    meeting_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    section_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (meeting_id, task_id, section_id, user_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);

  // Detect old schema: if a column named 'user' exists in assignments_old (from previous versions)
  const tableInfo = await all(`PRAGMA table_info(assignments)`);
  const hasUserText = tableInfo.some((c) => c.name === 'user');
  const hasUserId = tableInfo.some((c) => c.name === 'user_id');

  if (hasUserText && !hasUserId) {
    // We need to migrate from TEXT user to user_id
    // 1) Create users from distinct (meeting_id, user)
    const rows = await all(`SELECT DISTINCT meeting_id, user as name FROM assignments`);
    for (const r of rows) {
      try {
        await run(`INSERT OR IGNORE INTO users (meeting_id, name) VALUES (?, ?)`, [r.meeting_id, r.name]);
      } catch (_) {}
    }
    // 2) Create new table with user_id
    await run(`CREATE TABLE IF NOT EXISTS assignments_new (
      meeting_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (meeting_id, task_id, section_id, user_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`);
    // 3) Copy data into new table
    await run(`INSERT INTO assignments_new (meeting_id, task_id, section_id, user_id, created_at)
               SELECT a.meeting_id, a.task_id, a.section_id, u.id as user_id, a.created_at
               FROM assignments a
               JOIN users u ON u.meeting_id = a.meeting_id AND u.name = a.user`);
    // 4) Drop old table and rename new
    await run(`DROP TABLE assignments`);
    await run(`ALTER TABLE assignments_new RENAME TO assignments`);
  }
}
