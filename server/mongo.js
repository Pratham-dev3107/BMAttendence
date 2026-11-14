import mongoose from 'mongoose';

// Disable command buffering so operations fail fast if not connected
mongoose.set('bufferCommands', false);

export const DEFAULT_MONGO_URI = 'mongodb://prathamvashisht3107_db_user:5neZqLna0uozzAjr@ac-cbp06zd-shard-00-00.it9khey.mongodb.net:27017,ac-cbp06zd-shard-00-01.it9khey.mongodb.net:27017,ac-cbp06zd-shard-00-02.it9khey.mongodb.net:27017/kranti_attendance?ssl=true&replicaSet=atlas-bvj6l9-shard-0&authSource=admin';

// Global cached connection across serverless cold starts
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

// Schemas for MongoDB Atlas
const WorkerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: String,
  department: String,
  designation: String,
  wageType: { type: String, default: 'daily' },
  rate: { type: Number, default: 0 },
  photo: String,
  status: { type: String, default: 'active' },
  createdAt: String
});

const PunchSchema = new mongoose.Schema({
  id: String,
  type: { type: String, enum: ['IN', 'OUT'] },
  time: String,
  timestamp: Number,
  method: String,
  markedBy: String
});

const AttendanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  workerId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  punches: [PunchSchema],
  firstIn: String,
  lastOut: String,
  totalHours: Number,
  overtimeHours: Number,
  status: String,
  manualStatus: String,
  currentStatus: String,
  notes: String
});

const SettingSchema = new mongoose.Schema({
  key: { type: String, default: 'main_settings', unique: true },
  companyName: String,
  shiftStart: String,
  shiftEnd: String,
  graceMinutes: Number,
  fullDayMinHours: Number,
  halfDayMinHours: Number,
  overtimeThresholdHours: Number,
  weeklyOffDay: Number,
  weeklyOffCutThreshold: Number,
  monthlyOffCutThreshold: Number,
  monthlyMaxSundayCut: Number
});

const UserSchema = new mongoose.Schema({
  id: String,
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: String,
  role: String
});

export const WorkerModel = mongoose.models.Worker || mongoose.model('Worker', WorkerSchema);
export const AttendanceModel = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
export const SettingModel = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

export function isMongoConnected() {
  return !!(mongoose.connection && mongoose.connection.readyState === 1);
}

export async function connectMongo(uri = process.env.MONGODB_URI || DEFAULT_MONGO_URI) {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cached.promise) {
    const targetUri = uri || DEFAULT_MONGO_URI;
    cached.promise = mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
    }).then(m => {
      console.log('✅ Connected to MongoDB Atlas');
      return m.connection;
    }).catch(err => {
      cached.promise = null;
      console.error('❌ MongoDB Atlas connection error:', err.message);
      return null;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    return null;
  }
}
