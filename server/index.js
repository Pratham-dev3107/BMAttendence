import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import workersRouter from './routes/workers.js';
import attendanceRouter from './routes/attendance.js';
import reportsRouter from './routes/reports.js';
import settingsRouter from './routes/settings.js';
import mongoose from 'mongoose';
import { connectMongo, isMongoConnected, getLastMongoError, WorkerModel } from './mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/workers', workersRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.get('/api/network-ip', (req, res, next) => {
  req.url = '/network-ip';
  settingsRouter(req, res, next);
});

// Static uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Diagnostic endpoint to check MongoDB on Vercel
app.get('/api/debug-mongo', async (req, res) => {
  const result = {
    connected: isMongoConnected(),
    readyState: mongoose.connection?.readyState,
    envUri: !!process.env.MONGODB_URI,
    error: null,
    timeMs: 0
  };
  const start = Date.now();
  try {
    const conn = await connectMongo();
    result.connected = isMongoConnected();
    result.readyState = mongoose.connection?.readyState;
    result.timeMs = Date.now() - start;
    result.lastError = getLastMongoError();
    if (result.connected) {
      const count = await WorkerModel.countDocuments();
      result.workerCount = count;
    }
  } catch (err) {
    result.error = {
      message: err.message,
      name: err.name,
      stack: err.stack
    };
    result.timeMs = Date.now() - start;
  }
  res.json(result);
});

// Production: serve built frontend
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Kranti Attendance API Server is running on port 5000.');
    }
  });
});

// Export app for Vercel serverless deployment
export default app;

// Listen if run directly
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Kranti Attendance Server running at http://localhost:${PORT}`);
  });
}
