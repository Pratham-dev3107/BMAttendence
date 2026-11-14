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
  workers: [
    {
      id: 'KRA-101',
      name: 'Ramesh Kumar',
      phone: '9876543210',
      department: 'Fabrication',
      designation: 'Senior Welder',
      wageType: 'daily',
      rate: 750,
      photo: '',
      status: 'active',
      createdAt: '2026-01-01'
    },
    {
      id: 'KRA-102',
      name: 'Suresh Yadav',
      phone: '9812345678',
      department: 'Machining',
      designation: 'Lathe Operator',
      wageType: 'daily',
      rate: 800,
      photo: '',
      status: 'active',
      createdAt: '2026-01-05'
    },
    {
      id: 'KRA-103',
      name: 'Mukesh Sharma',
      phone: '9723456789',
      department: 'Assembly',
      designation: 'Fitter',
      wageType: 'monthly',
      rate: 22000,
      photo: '',
      status: 'active',
      createdAt: '2026-01-10'
    },
    {
      id: 'KRA-104',
      name: 'Rajesh Verma',
      phone: '9934567890',
      department: 'Packaging',
      designation: 'Helper',
      wageType: 'daily',
      rate: 550,
      photo: '',
      status: 'active',
      createdAt: '2026-02-01'
    },
    {
      id: 'KRA-105',
      name: 'Sunil Singh',
      phone: '9645678901',
      department: 'Maintenance',
      designation: 'Electrician',
      wageType: 'monthly',
      rate: 25000,
      photo: '',
      status: 'active',
      createdAt: '2026-02-15'
    }
  ],
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
        await SettingModel.create({ key: 'main_settings', ...this.data.settings });
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
      if (cloudWorkers && cloudWorkers.length > 0) {
        this.data.workers = cloudWorkers.map(w => w.toObject());
      } else {
        for (const w of this.data.workers) {
          await WorkerModel.findOneAndUpdate({ id: w.id }, w, { upsert: true });
        }
      }

      // 4. Attendance
      const cloudAttendance = await AttendanceModel.find({});
      if (cloudAttendance && cloudAttendance.length > 0) {
        this.data.attendance = cloudAttendance.map(a => a.toObject());
      } else {
        for (const a of this.data.attendance) {
          await AttendanceModel.findOneAndUpdate({ id: a.id }, a, { upsert: true });
        }
      }

      this.saveLocal();
    } catch (err) {
      console.error('Error syncing with MongoDB:', err);
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

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveLocal();

    if (this.mongoConnected) {
      SettingModel.findOneAndUpdate(
        { key: 'main_settings' }, 
        { key: 'main_settings', ...this.data.settings }, 
        { upsert: true }
      ).catch(console.error);
    }
    return this.data.settings;
  }

  getWorkers() {
    return this.data.workers;
  }

  addWorker(worker) {
    this.data.workers.push(worker);
    this.saveLocal();

    if (this.mongoConnected) {
      WorkerModel.create(worker).catch(console.error);
    }
    return worker;
  }

  updateWorker(id, updates) {
    const idx = this.data.workers.findIndex(w => w.id === id);
    if (idx !== -1) {
      this.data.workers[idx] = { ...this.data.workers[idx], ...updates };
      this.saveLocal();

      if (this.mongoConnected) {
        WorkerModel.findOneAndUpdate({ id }, updates).catch(console.error);
      }
      return this.data.workers[idx];
    }
    return null;
  }

  deleteWorker(id) {
    const idx = this.data.workers.findIndex(w => w.id === id);
    if (idx !== -1) {
      const removed = this.data.workers.splice(idx, 1);
      this.saveLocal();

      if (this.mongoConnected) {
        WorkerModel.deleteOne({ id }).catch(console.error);
      }
      return removed[0];
    }
    return null;
  }

  getAttendanceByDate(dateStr) {
    return this.data.attendance.filter(a => a.date === dateStr);
  }

  getAttendanceByMonth(yearMonth) {
    return this.data.attendance.filter(a => a.date.startsWith(yearMonth));
  }

  findAttendanceRecord(workerId, dateStr) {
    return this.data.attendance.find(a => a.workerId === workerId && a.date === dateStr);
  }

  saveAttendanceRecord(record) {
    const idx = this.data.attendance.findIndex(a => a.id === record.id);
    if (idx !== -1) {
      this.data.attendance[idx] = record;
    } else {
      this.data.attendance.push(record);
    }
    this.saveLocal();

    if (this.mongoConnected) {
      AttendanceModel.findOneAndUpdate({ id: record.id }, record, { upsert: true }).catch(console.error);
    }
    return record;
  }
}

export const db = new Database();
