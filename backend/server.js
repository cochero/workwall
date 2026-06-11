import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import clientsRouter from './routes/clients.js';
import usersRouter from './routes/users.js';
import projectsRouter from './routes/projects.js';
import postsRouter from './routes/posts.js';
import commentsRouter from './routes/comments.js';
import filesRouter from './routes/files.js';
import notificationsRouter from './routes/notifications.js';
import feedRouter from './routes/feed.js';
import listsRouter from './routes/lists.js';
import meetingsRouter from './routes/meetings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', postsRouter);
app.use('/api', commentsRouter);
app.use('/api', filesRouter);
app.use('/api', notificationsRouter);
app.use('/api', feedRouter);
app.use('/api', listsRouter);
app.use('/api', meetingsRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `File too large (max ${config.maxUploadMb} MB)` });
  }
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(config.port, () => {
  console.log(`Workwall API on http://127.0.0.1:${config.port} (${config.env}, storage: ${config.storageDriver})`);
});
