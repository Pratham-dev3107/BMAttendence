import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { 
  connectMongo, 
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
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
    this.mongoConnected = false;
    this.initMongo();
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
      console.error('Error loading database, resetting to default:', err);
    }
    this.saveLocal(defaultData);
    return JSON.parse(JSON.stringify(defaultData));
  }

  saveLocal(dataToSave = this.data) {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      // On Vercel serverless, filesystem is read-only, which is expected
    }
  }

  async initMongo() {
    if (!process.env.MONGODB_URI) return;
    try {
      const conn = await connectMongo();
      if (conn) {
        this.mongoConnected = true;
        await this.syncFromMongo();
      }
    } catch (err) {
      console.warn('MongoDB init warning:', err.message);
    }
  }

  async syncFromMongo() {
    try {
      // 1. Settings
      const cloudSettings = await SettingModel.findOne({ key: 'main_settings' });
      if (cloudSettings) {
        this.data.settings = { ...this.data.settings, ...cloudSettings.toObject() };
      } else {
        await SettingModel.findOneAndUpdate(
          { key: 'main_settings' },
          { $set: { key: 'main_settings', ...this.data.settings } },
          { upsert: true, new: true }
        );
      }

      // 2. Users
      const cloudUsers = await UserModel.find({});
      if (cloudUsers && cloudUsers.length > 0) {
        this.data.users = cloudUsers.map(u => u.toObject());
      } else {
        for (const u of this.data.users) {
          await UserModel.findOneAndUpdate({ username: u.username }, u, { upsert: true });
        }
      }

      // 3. Workers
      const cloudWorkers = await WorkerModel.find({});
      this.data.workers = (cloudWorkers || []).map(w => w.toObject());

      // 4. Attendance
      const cloudAttendance = await AttendanceModel.find({});
      this.data.attendance = (cloudAttendance || []).map(a => a.toObject());

      this.saveLocal();
    } catch (err) {
      console.error('Error syncing with MongoDB:', err);
    }
  }

  async ensureMongoReady() {
    if (this.mongoConnected && mongoose.connection.readyState === 1) return true;
    try {
      const conn = await connectMongo();
      if (conn) {
        this.mongoConnected = true;
        if (!this.initialSynced) {
          this.initialSynced = true;
          this.syncFromMongo().catch(console.warn);
        }
        return true;
      }
    } catch (e) {
      console.warn('ensureMongoReady warning:', e.message);
    }
    return false;
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
    await this.ensureMongoReady();
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveLocal();

    if (this.mongoConnected) {
      SettingModel.findOneAndUpdate(
        { key: 'main_settings' }, 
        { $set: { key: 'main_settings', ...this.data.settings } }, 
        { upsert: true, new: true }
      ).catch(e => console.error('Mongo updateSettings error:', e));
    }
    return this.data.settings;
  }

  async getWorkers() {
    await this.ensureMongoReady();
    if (this.data.workers && this.data.workers.length > 0) {
      return this.data.workers;
    }
    if (this.mongoConnected) {
      try {
        const cloudWorkers = await WorkerModel.find({ status: { $ne: 'deleted' } }).lean();
        if (cloudWorkers && cloudWorkers.length > 0) {
          this.data.workers = cloudWorkers;
          this.saveLocal();
        }
      } catch (err) {
        console.warn('Mongo getWorkers error:', err);
      }
    }
    return this.data.workers || [];
  }

  async findWorker(workerId) {
    if (!workerId) return null;
    await this.ensureMongoReady();

    const clean = String(workerId).trim().toUpperCase();
    const cleanDigits = clean.replace(/\D/g, '');

    // 1. Search in-memory cache (Instant 0ms)
    let found = (this.data.workers || []).find(w => {
      const wId = String(w.id || '').toUpperCase();
      const wDigits = wId.replace(/\D/g, '');
      return wId === clean || 
             wId === `KRA-${clean}` || 
             (cleanDigits && wDigits === cleanDigits);
    });
    if (found) return found;

    // 2. Search MongoDB Atlas directly
    if (this.mongoConnected) {
      try {
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
        console.warn('Mongo findWorker error:', err);
      }
    }

    return null;
  }

  async addWorker(worker) {
    await this.ensureMongoReady();
    const idx = this.data.workers.findIndex(w => w.id === worker.id);
    if (idx >= 0) {
      this.data.workers[idx] = worker;
    } else {
      this.data.workers.push(worker);
    }
    this.saveLocal();

    // Fast direct write to MongoDB Atlas
    if (this.mongoConnected) {
      WorkerModel.findOneAndUpdate(
        { id: worker.id },
        { $set: worker },
        { upsert: true, new: true }
      ).catch(err => console.error('Mongo addWorker error:', err));
    }
    return worker;
  }

  async updateWorker(id, updates) {
    await this.ensureMongoReady();
    const idx = this.data.workers.findIndex(w => w.id === id);
    if (idx !== -1) {
      this.data.workers[idx] = { ...this.data.workers[idx], ...updates };
      this.saveLocal();
    }

    if (this.mongoConnected) {
      WorkerModel.findOneAndUpdate(
        { id },
        { $set: updates },
        { new: true }
      ).catch(err => console.error('Mongo updateWorker error:', err));
    }
    return idx !== -1 ? this.data.workers[idx] : null;
  }

  async deleteWorker(id) {
    await this.ensureMongoReady();
    const idx = this.data.workers.findIndex(w => w.id === id);
    let removed = null;
    if (idx !== -1) {
      removed = this.data.workers.splice(idx, 1)[0];
      this.saveLocal();
    }

    if (this.mongoConnected) {
      WorkerModel.deleteOne({ id }).catch(err => console.error('Mongo deleteWorker error:', err));
    }
    return removed;
  }

  async getAttendanceByDate(dateStr) {
    await this.ensureMongoReady();
    if (this.mongoConnected) {
      try {
        const docs = await AttendanceModel.find({ date: dateStr });
        if (docs && docs.length > 0) {
          // Merge with memory
          for (const d of docs) {
            const dObj = d.toObject();
            const idx = this.data.attendance.findIndex(a => a.id === dObj.id);
            if (idx >= 0) this.data.attendance[idx] = dObj;
            else this.data.attendance.push(dObj);
          }
        }
      } catch (err) {
        console.warn('Mongo getAttendanceByDate error:', err);
      }
    }
    return this.data.attendance.filter(a => a.date === dateStr);
  }

  async getAttendanceByMonth(yearMonth) {
    await this.ensureMongoReady();
    if (this.mongoConnected) {
      try {
        const docs = await AttendanceModel.find({ date: new RegExp(`^${yearMonth}`) });
        if (docs && docs.length > 0) {
          for (const d of docs) {
            const dObj = d.toObject();
            const idx = this.data.attendance.findIndex(a => a.id === dObj.id);
            if (idx >= 0) this.data.attendance[idx] = dObj;
            else this.data.attendance.push(dObj);
          }
        }
      } catch (err) {
        console.warn('Mongo getAttendanceByMonth error:', err);
      }
    }
    return this.data.attendance.filter(a => a.date.startsWith(yearMonth));
  }

  findAttendanceRecord(workerId, dateStr) {
    return this.data.attendance.find(a => a.workerId === workerId && a.date === dateStr);
  }

  async saveAttendanceRecord(record) {
    await this.ensureMongoReady();
    const idx = this.data.attendance.findIndex(a => a.id === record.id);
    if (idx !== -1) {
      this.data.attendance[idx] = record;
    } else {
      this.data.attendance.push(record);
    }
    this.saveLocal();

    if (this.mongoConnected) {
      try {
        await AttendanceModel.findOneAndUpdate(
          { id: record.id }, 
          { $set: record }, 
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error('Mongo saveAttendanceRecord error:', err);
      }
    }
    return record;
  }
}

export const db = new Database();
