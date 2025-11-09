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

  // Users table: global users only with id and name
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );`);

  // Migrate old users schema (with meeting_id) to global users only
  const usersInfo = await all(`PRAGMA table_info(users)`);
  const usersHasMeetingId = usersInfo.some(c => c.name === 'meeting_id');
  if (usersHasMeetingId) {
    // Create new users table without meeting_id and without created_at; preserve IDs
    await run(`CREATE TABLE IF NOT EXISTS users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );`);
    await run(`INSERT INTO users_new (id, name)
               SELECT id, name FROM users`);
    await run(`DROP TABLE users`);
    await run(`ALTER TABLE users_new RENAME TO users`);
  }

  // Ensure users table has only id and name (drop created_at if present)
  const usersInfo2 = await all(`PRAGMA table_info(users)`);
  const usersHasCreatedAt = usersInfo2.some(c => c.name === 'created_at');
  if (usersHasCreatedAt) {
    await run(`CREATE TABLE IF NOT EXISTS users_new2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );`);
    await run(`INSERT OR IGNORE INTO users_new2 (id, name) SELECT id, name FROM users`);
    await run(`DROP TABLE users`);
    await run(`ALTER TABLE users_new2 RENAME TO users`);
  }

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

  // Detect old schema: if a column named 'user' exists in assignments (from previous versions)
  const tableInfo = await all(`PRAGMA table_info(assignments)`);
  const hasUserText = tableInfo.some((c) => c.name === 'user');
  const hasUserId = tableInfo.some((c) => c.name === 'user_id');

  if (hasUserText && !hasUserId) {
    // We need to migrate from TEXT user to user_id (global users)
    // 1) Ensure users exist globally for each distinct user name
    const rows = await all(`SELECT DISTINCT user as name FROM assignments`);
    for (const r of rows) {
      try {
        await run(`INSERT INTO users (name) VALUES (?)`, [r.name]);
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
    // 3) Copy data into new table using join by name
    await run(`INSERT INTO assignments_new (meeting_id, task_id, section_id, user_id, created_at)
               SELECT a.meeting_id, a.task_id, a.section_id, u.id as user_id, a.created_at
               FROM assignments a
               JOIN users u ON u.name = a.user`);
    // 4) Drop old table and rename new
    await run(`DROP TABLE assignments`);
    await run(`ALTER TABLE assignments_new RENAME TO assignments`);
  }

  // Remove legacy meeting_users table if it exists
  await run(`DROP TABLE IF EXISTS meeting_users`);
}
