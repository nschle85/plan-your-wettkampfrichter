import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ensureSchema, run, all, get } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*'}
});

function room(meetingId) {
  return `meeting:${meetingId}`;
}

io.on('connection', (socket) => {
  socket.on('join', (meetingId) => {
    if (!meetingId) return;
    socket.join(room(meetingId));
  });
  socket.on('leave', (meetingId) => {
    socket.leave(room(meetingId));
  });
});

function emitUpdate(meetingId, payload) {
  io.to(room(meetingId)).emit('meeting:update', payload);
}

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Meetings
app.get('/api/meetings', async (req, res, next) => {
  try {
    const rows = await all('SELECT * FROM meetings ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { next(e); }
});

app.post('/api/meetings', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { id } = await run('INSERT INTO meetings (name) VALUES (?)', [name]);
    const meeting = await get('SELECT * FROM meetings WHERE id = ?', [id]);
    // Emit a global update so meeting lists in other tabs refresh live
    io.emit('meetings:update', { type: 'meeting:add', meeting });
    res.status(201).json(meeting);
  } catch (e) { next(e); }
});

// Full meeting payload (tasks, sections, assignments, users)
app.get('/api/meetings/:id/full', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const meeting = await get('SELECT * FROM meetings WHERE id = ?', [id]);
    if (!meeting) return res.status(404).json({ error: 'not found' });
    const tasks = await all('SELECT * FROM tasks WHERE meeting_id = ? ORDER BY ord, id', [id]);
    const sections = await all('SELECT * FROM sections WHERE meeting_id = ? ORDER BY ord, id', [id]);
    const users = await all(`SELECT DISTINCT u.id, u.name
                               FROM assignments a
                               JOIN users u ON u.id = a.user_id
                               WHERE a.meeting_id = ?
                               ORDER BY u.id`, [id]);
    const assignments = await all('SELECT * FROM assignments WHERE meeting_id = ?', [id]);
    res.json({ meeting, tasks, sections, users, assignments });
  } catch (e) { next(e); }
});

// Tasks
app.post('/api/meetings/:id/tasks', async (req, res, next) => {
  try {
    const meetingId = Number(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { id } = await run('INSERT INTO tasks (meeting_id, name, ord) VALUES (?, ?, ?)', [meetingId, name, 0]);
    const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    emitUpdate(meetingId, { type: 'task:add', task });
    res.status(201).json(task);
  } catch (e) { next(e); }
});

// Sections
app.post('/api/meetings/:id/sections', async (req, res, next) => {
  try {
    const meetingId = Number(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { id } = await run('INSERT INTO sections (meeting_id, name, ord) VALUES (?, ?, ?)', [meetingId, name, 0]);
    const section = await get('SELECT * FROM sections WHERE id = ?', [id]);
    emitUpdate(meetingId, { type: 'section:add', section });
    res.status(201).json(section);
  } catch (e) { next(e); }
});

// Users for a meeting (derived from assignments)
app.get('/api/meetings/:id/users', async (req, res, next) => {
  try {
    const meetingId = Number(req.params.id);
    const users = await all(`SELECT DISTINCT u.id, u.name
                              FROM assignments a
                              JOIN users u ON u.id = a.user_id
                              WHERE a.meeting_id = ?
                              ORDER BY u.id`, [meetingId]);
    res.json(users);
  } catch (e) { next(e); }
});

app.post('/api/meetings/:id/users', async (req, res, next) => {
  try {
    const meetingId = Number(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    // Create or fetch global user by name (no meeting link)
    let user = await get('SELECT id, name FROM users WHERE name = ?', [name]);
    if (!user) {
      const { id } = await run('INSERT INTO users (name) VALUES (?)', [name]);
      user = await get('SELECT id, name FROM users WHERE id = ?', [id]);
    }
    // No explicit meeting link; user will appear in this meeting only once assigned
    res.status(201).json(user);
  } catch (e) { next(e); }
});

// Remove a user only from this meeting (keep global user)
app.delete('/api/meetings/:id/users/:userId', async (req, res, next) => {
  try {
    const meetingId = Number(req.params.id);
    const userId = Number(req.params.userId);
    if (!meetingId || !userId) return res.status(400).json({ error: 'meetingId and userId required' });

    const exists = await get('SELECT 1 AS x FROM assignments WHERE meeting_id = ? AND user_id = ? LIMIT 1', [meetingId, userId]);
    if (!exists) return res.status(404).json({ error: 'not found' });

    // Delete meeting-scoped assignments for this user
    await run('DELETE FROM assignments WHERE meeting_id = ? AND user_id = ?', [meetingId, userId]);

    emitUpdate(meetingId, { type: 'user:delete', userId });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Toggle assignment (now uses userId FK)
app.post('/api/meetings/:id/assign', async (req, res, next) => {
  try {
    const meetingId = Number(req.params.id);
    const { taskId, sectionId, userId, selected } = req.body;
    if (!taskId || !sectionId || !userId) return res.status(400).json({ error: 'taskId, sectionId, userId required' });

    if (selected) {
      await run('INSERT OR IGNORE INTO assignments (meeting_id, task_id, section_id, user_id) VALUES (?, ?, ?, ?)', [meetingId, taskId, sectionId, userId]);
      const user = await get('SELECT id, name FROM users WHERE id = ?', [userId]);
      emitUpdate(meetingId, { type: 'assign:update', taskId, sectionId, userId, user, selected });
    } else {
      await run('DELETE FROM assignments WHERE meeting_id = ? AND task_id = ? AND section_id = ? AND user_id = ?', [meetingId, taskId, sectionId, userId]);
      emitUpdate(meetingId, { type: 'assign:update', taskId, sectionId, userId, selected });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Global users
app.get('/api/users', async (req, res, next) => {
  try {
    const users = await all('SELECT id, name FROM users ORDER BY id');
    res.json(users);
  } catch (e) { next(e); }
});

app.post('/api/users', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    let user = await get('SELECT id, name FROM users WHERE name = ?', [name]);
    if (!user) {
      const { id } = await run('INSERT INTO users (name) VALUES (?)', [name]);
      user = await get('SELECT id, name FROM users WHERE id = ?', [id]);
    }
    res.status(201).json(user);
  } catch (e) { next(e); }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error', details: err.message });
});

const PORT = process.env.PORT || 3000;

(async () => {
  await ensureSchema();
  server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
})();
