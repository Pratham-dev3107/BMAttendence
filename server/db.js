import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { 
  connectMongo, 
  isMongoConnected,
  WorkerModel, 
  AttendanceModel, 
  SettingModel, 
  UserModel 
} from './mongo.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

const defaultData = {
  users: [
    {
      id: 'usr_admin',
      username: 'admin',
      password: 'admin123',
      name: 'System Admin',
      role: 'admin'
    },
    {
      id: 'usr_guard',
      username: 'guard',
      password: 'guard123',
      name: 'Main Gate Security',
      role: 'gatekeeper'
    }
  ],
  settings: {
    companyName: 'Kranti Industries',
    shiftStart: '08:30',
    shiftEnd: '17:00',
    graceMinutes: 15,
    fullDayMinHours: 8.5,
    halfDayMinHours: 4.5,
    overtimeThresholdHours: 8.5,
    weeklyOffDay: 0,
    weeklyOffCutThreshold: 3,
    monthlyOffCutThreshold: 4,
    monthlyMaxSundayCut: 2
  },
  workers: [],
  attendance: [],
  advances: []
};

class Database {
  constructor() {
    this.data = this.loadLocal();
    // Warm up connection in background without blocking server startup
    connectMongo().catch(() => {});
  }

  loadLocal() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || defaultData.users,
          settings: { ...defaultData.settings, ...(parsed.settings || {}) },
          workers: parsed.workers || defaultData.workers,
          attendance: parsed.attendance || [],
          advances: parsed.advances || []
        };
      }
    } catch (err) {
      // Ephemeral filesystem on Vercel is fine
    }
    return JSON.parse(JSON.stringify(defaultData));
  }

  saveLocal(dataToSave = this.data) {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      // Read-only filesystem on Vercel, ignore
    }
  }

  getUsers() {
    return this.data.users || defaultData.users;
  }

  findUser(username, password) {
    const users = this.getUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  }

  getSettings() {
    return this.data.settings;
  }

  async updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveLocal();

    try {
      await connectMongo();
      await SettingModel.findOneAndUpdate(
        { key: 'main_settings' }, 
        { $set: { key: 'main_settings', ...this.data.settings } }, 
        { upsert: true, new: true }
      );
    } catch (e) {
      console.warn('Mongo updateSettings warning:', e.message);
    }
    return this.data.settings;
  }

  async getWorkers() {
    try {
      await connectMongo();
      const cloudWorkers = await WorkerModel.find({ status: { $ne: 'deleted' } }).lean();
      if (cloudWorkers && cloudWorkers.length > 0) {
        this.data.workers = cloudWorkers;
        this.saveLocal();
        return cloudWorkers;
      }
    } catch (err) {
      console.warn('Mongo getWorkers warning, using fallback:', err.message);
    }
    return this.data.workers || [];
  }

  async findWorker(workerId) {
    if (!workerId) return null;
    const clean = String(workerId).trim().toUpperCase();
    const cleanDigits = clean.replace(/\D/g, '');

    // 1. Search memory
    let found = (this.data.workers || []).find(w => {
      const wId = String(w.id || '').toUpperCase();
      const wDigits = wId.replace(/\D/g, '');
      return wId === clean || 
             wId === `KRA-${clean}` || 
             (cleanDigits && wDigits === cleanDigits);
    });
    if (found) return found;

    // 2. Search MongoDB Atlas
    try {
      await connectMongo();
      const query = {
        $or: [
          { id: clean },
          { id: `KRA-${clean}` },
          { id: new RegExp(`^${clean}$`, 'i') }
        ]
      };
      if (cleanDigits) {
        query.$or.push({ id: new RegExp(cleanDigits, 'i') });
      }
      const doc = await WorkerModel.findOne(query).lean();
      if (doc) {
        if (!this.data.workers.some(w => w.id === doc.id)) {
          this.data.workers.push(doc);
          this.saveLocal();
        }
        return doc;
      }
    } catch (err) {
      console.warn('Mongo findWorker error:', err.message);
    }

    return null;
  }

  async addWorker(worker) {
    if (!worker || !worker.id) return null;

    const cleanId = String(worker.id).trim().toUpperCase();
    const cleanWorker = { ...worker, id: cleanId };

    // Update in-memory array immediately
    const idx = (this.data.workers || []).findIndex(w => String(w.id || '').toUpperCase() === cleanId);
    if (idx >= 0) {
      this.data.workers[idx] = cleanWorker;
    } else {
      this.data.workers.push(cleanWorker);
    }
    this.saveLocal();

    // Persist directly and await in MongoDB Atlas
    try {
      await connectMongo();
      await WorkerModel.findOneAndUpdate(
        { id: cleanId },
        { $set: cleanWorker },
        { upsert: true, new: true }
      );
      console.log(`✅ Permanently saved worker ${cleanId} (${cleanWorker.name}) to MongoDB Atlas`);
    } catch (err) {
      console.error('Mongo addWorker error:', err.message);
    }

    return cleanWorker;
  }

  async updateWorker(id, updates) {
    const cleanId = String(id).trim().toUpperCase();
    const idx = (this.data.workers || []).findIndex(w => String(w.id || '').toUpperCase() === cleanId);
    if (idx !== -1) {
      this.data.workers[idx] = { ...this.data.workers[idx], ...updates, id: cleanId };
      this.saveLocal();
    }

    try {
      await connectMongo();
      const updated = await WorkerModel.findOneAndUpdate(
        { id: cleanId },
        { $set: updates },
        { new: true }
      );
      if (updated) return updated.toObject();
    } catch (err) {
      console.warn('Mongo updateWorker error:', err.message);
    }
    return idx !== -1 ? this.data.workers[idx] : null;
  }

  async deleteWorker(id) {
    if (!id) return null;

    const cleanId = String(id).trim().toUpperCase();

    // 1. Remove from memory immediately
    const idx = (this.data.workers || []).findIndex(w => 
      String(w.id || '').toUpperCase() === cleanId ||
      String(w.id || '').replace(/\D/g, '') === cleanId.replace(/\D/g, '')
    );
    let removed = null;
    if (idx !== -1) {
      removed = this.data.workers.splice(idx, 1)[0];
    }

    this.data.attendance = (this.data.attendance || []).filter(a => 
      String(a.workerId || '').toUpperCase() !== cleanId
    );
    this.saveLocal();

    // 2. Remove permanently from MongoDB Atlas
    try {
      await connectMongo();
      await Promise.all([
        WorkerModel.deleteMany({
          $or: [
            { id: cleanId },
            { id: id },
            { id: new RegExp(`^${cleanId}$`, 'i') }
          ]
        }),
        AttendanceModel.deleteMany({
          $or: [
            { workerId: cleanId },
            { workerId: id },
            { workerId: new RegExp(`^${cleanId}$`, 'i') }
          ]
        })
      ]);
      console.log(`✅ Permanently deleted worker ${cleanId} from MongoDB Atlas`);
    } catch (err) {
      console.error('Mongo deleteWorker error:', err.message);
    }

    return removed || { id: cleanId };
  }

  async getAttendanceByDate(dateStr) {
    try {
      await connectMongo();
      const docs = await AttendanceModel.find({ date: dateStr }).lean();
      if (docs && docs.length > 0) {
        for (const d of docs) {
          const idx = this.data.attendance.findIndex(a => a.id === d.id);
          if (idx >= 0) this.data.attendance[idx] = d;
          else this.data.attendance.push(d);
        }
        return docs;
      }
    } catch (err) {
      console.warn('Mongo getAttendanceByDate error:', err.message);
    }
    return this.data.attendance.filter(a => a.date === dateStr);
  }

  async getAttendanceByMonth(yearMonth) {
    try {
      await connectMongo();
      const docs = await AttendanceModel.find({ date: new RegExp(`^${yearMonth}`) }).lean();
      if (docs && docs.length > 0) {
        for (const d of docs) {
          const idx = this.data.attendance.findIndex(a => a.id === d.id);
          if (idx >= 0) this.data.attendance[idx] = d;
          else this.data.attendance.push(d);
        }
        return docs;
      }
    } catch (err) {
      console.warn('Mongo getAttendanceByMonth error:', err.message);
    }
    return this.data.attendance.filter(a => a.date.startsWith(yearMonth));
  }

  findAttendanceRecord(workerId, dateStr) {
    return this.data.attendance.find(a => a.workerId === workerId && a.date === dateStr);
  }

  async saveAttendanceRecord(record) {
    const idx = this.data.attendance.findIndex(a => a.id === record.id);
    if (idx !== -1) {
      this.data.attendance[idx] = record;
    } else {
      this.data.attendance.push(record);
    }
    this.saveLocal();

    try {
      await connectMongo();
      await AttendanceModel.findOneAndUpdate(
        { id: record.id }, 
        { $set: record }, 
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Mongo saveAttendanceRecord error:', err.message);
    }
    return record;
  }
}

export const db = new Database();
