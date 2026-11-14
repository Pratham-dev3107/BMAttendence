import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../db.js';

const router = express.Router();

// Helper to calculate hours & exact Overtime past 5:00 PM (17:00)
function calculateAttendanceMetrics(punches, settings, dateStr) {
  if (!punches || punches.length === 0) {
    return {
      firstIn: null,
      lastOut: null,
      totalHours: 0,
      overtimeHours: 0,
      status: 'ABSENT',
      currentStatus: 'OUT'
    };
  }

  const sortedPunches = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  const firstInPunch = sortedPunches.find(p => p.type === 'IN');
  const lastPunch = sortedPunches[sortedPunches.length - 1];
  const outPunches = sortedPunches.filter(p => p.type === 'OUT');
  const lastOutPunch = outPunches.length > 0 ? outPunches[outPunches.length - 1] : null;

  let totalMilliseconds = 0;
  let inTime = null;

  for (const punch of sortedPunches) {
    if (punch.type === 'IN') {
      inTime = punch.timestamp;
    } else if (punch.type === 'OUT' && inTime !== null) {
      totalMilliseconds += (punch.timestamp - inTime);
      inTime = null;
    }
  }

  const totalHours = Math.round((totalMilliseconds / (1000 * 60 * 60)) * 100) / 100;
  
  const minFull = settings.fullDayMinHours || 8.5;
  const minHalf = settings.halfDayMinHours || 4.5;
  const shiftEndTime = settings.shiftEnd || '17:00'; // 5:00 PM

  // Calculate Overtime: Any work done past 17:00 (5:00 PM)
  let overtimeHours = 0;
  if (lastOutPunch && dateStr) {
    const shiftEndTimestamp = dayjs(`${dateStr} ${shiftEndTime}`).valueOf();
    if (lastOutPunch.timestamp > shiftEndTimestamp && totalHours >= minHalf) {
      // Overtime is difference between lastOut and shiftEnd
      const otMs = lastOutPunch.timestamp - shiftEndTimestamp;
      overtimeHours = Math.round((otMs / (1000 * 60 * 60)) * 10) / 10;
    }
  }

  // Fallback: If total hours exceeded shift duration threshold
  if (overtimeHours === 0 && totalHours > minFull) {
    overtimeHours = Math.round((totalHours - minFull) * 10) / 10;
  }

  let status = 'ABSENT';
  if (totalHours >= minFull) {
    status = 'PRESENT';
  } else if (totalHours >= minHalf) {
    status = 'HALF_DAY';
  } else if (sortedPunches.some(p => p.type === 'IN')) {
    status = 'PRESENT'; // Currently inside or working today
  }

  return {
    firstIn: firstInPunch ? firstInPunch.time : null,
    lastOut: lastOutPunch ? lastOutPunch.time : null,
    totalHours,
    overtimeHours: Math.max(0, overtimeHours),
    status,
    currentStatus: lastPunch.type // 'IN' or 'OUT'
  };
}

// GET /api/attendance/today - Get attendance status for all workers today
router.get('/today', (req, res) => {
  const todayStr = req.query.date || dayjs().format('YYYY-MM-DD');
  const settings = db.getSettings();
  const workers = db.getWorkers().filter(w => w.status === 'active');
  const todayRecords = db.getAttendanceByDate(todayStr);

  const workerAttendanceList = workers.map(worker => {
    const record = todayRecords.find(r => r.workerId === worker.id);
    const punches = record ? record.punches : [];
    const metrics = calculateAttendanceMetrics(punches, settings, todayStr);

    return {
      worker,
      recordId: record ? record.id : null,
      date: todayStr,
      punches,
      firstIn: metrics.firstIn,
      lastOut: metrics.lastOut,
      totalHours: metrics.totalHours,
      overtimeHours: metrics.overtimeHours,
      status: record?.manualStatus || (punches.length === 0 ? 'ABSENT' : metrics.status),
      currentStatus: metrics.currentStatus, // 'IN' or 'OUT'
      isLate: metrics.firstIn && settings.shiftStart ? 
        dayjs(`${todayStr} ${metrics.firstIn}`).isAfter(dayjs(`${todayStr} ${settings.shiftStart}`).add(settings.graceMinutes || 15, 'minute')) : false
    };
  });

  const totalWorkers = workers.length;
  const presentCount = workerAttendanceList.filter(w => w.punches.length > 0 || w.status === 'PRESENT' || w.status === 'HALF_DAY').length;
  const insideCount = workerAttendanceList.filter(w => w.currentStatus === 'IN').length;
  const absentCount = totalWorkers - presentCount;
  const totalOT = workerAttendanceList.reduce((acc, curr) => acc + (curr.overtimeHours || 0), 0);

  res.json({
    date: todayStr,
    stats: {
      totalWorkers,
      presentCount,
      insideCount,
      outsideCount: totalWorkers - insideCount,
      absentCount,
      totalOT: Math.round(totalOT * 10) / 10
    },
    list: workerAttendanceList
  });
});

// POST /api/attendance/punch - Record In/Out punch with millisecond precision
router.post('/punch', (req, res) => {
  try {
    const { workerId, type, method = 'QR', markedBy = 'Gatekeeper', date, time } = req.body;

    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }

    const worker = db.getWorkers().find(w => w.id === workerId);
    if (!worker) {
      return res.status(404).json({ error: `Worker with ID "${workerId}" not found.` });
    }

    const punchDate = date || dayjs().format('YYYY-MM-DD');
    const now = dayjs();
    const punchTime = time || now.format('HH:mm:ss');
    const timestamp = date && time ? dayjs(`${date} ${time}`).valueOf() : now.valueOf();

    let record = db.findAttendanceRecord(workerId, punchDate);
    if (!record) {
      record = {
        id: uuidv4(),
        workerId,
        date: punchDate,
        punches: [],
        manualStatus: null,
        notes: ''
      };
    }

    // Determine punch type if AUTO: IN if first punch or last was OUT; OUT if last was IN
    let punchType = type;
    if (!punchType || punchType === 'AUTO') {
      if (record.punches.length === 0) {
        punchType = 'IN';
      } else {
        const lastPunch = record.punches[record.punches.length - 1];
        punchType = lastPunch.type === 'IN' ? 'OUT' : 'IN';
      }
    }

    const newPunch = {
      id: uuidv4(),
      type: punchType,
      time: punchTime,
      timestamp,
      method,
      markedBy
    };

    record.punches.push(newPunch);

    const settings = db.getSettings();
    const metrics = calculateAttendanceMetrics(record.punches, settings, punchDate);

    record.firstIn = metrics.firstIn;
    record.lastOut = metrics.lastOut;
    record.totalHours = metrics.totalHours;
    record.overtimeHours = metrics.overtimeHours;
    record.status = record.manualStatus || metrics.status;
    record.currentStatus = metrics.currentStatus;

    db.saveAttendanceRecord(record);

    res.json({
      success: true,
      message: `${worker.name} punched ${punchType} at ${punchTime}`,
      punchType,
      punchTime,
      worker,
      record
    });
  } catch (error) {
    console.error('Punch error:', error);
    res.status(500).json({ error: 'Failed to record punch' });
  }
});

// POST /api/attendance/manual-override - Admin manual correction
router.post('/manual-override', (req, res) => {
  const { workerId, date, status, firstIn, lastOut, totalHours, overtimeHours, notes } = req.body;

  if (!workerId || !date) {
    return res.status(400).json({ error: 'workerId and date are required' });
  }

  let record = db.findAttendanceRecord(workerId, date);
  if (!record) {
    record = {
      id: uuidv4(),
      workerId,
      date,
      punches: []
    };
  }

  if (firstIn && lastOut) {
    const tIn = dayjs(`${date} ${firstIn}`).valueOf();
    const tOut = dayjs(`${date} ${lastOut}`).valueOf();
    record.punches = [
      { id: uuidv4(), type: 'IN', time: firstIn, timestamp: tIn, method: 'ADMIN_OVERRIDE', markedBy: 'Admin' },
      { id: uuidv4(), type: 'OUT', time: lastOut, timestamp: tOut, method: 'ADMIN_OVERRIDE', markedBy: 'Admin' }
    ];
  }

  record.manualStatus = status;
  record.status = status;
  record.firstIn = firstIn || record.firstIn;
  record.lastOut = lastOut || record.lastOut;
  if (totalHours !== undefined) record.totalHours = Number(totalHours);
  if (overtimeHours !== undefined) record.overtimeHours = Number(overtimeHours);
  record.notes = notes || record.notes;

  db.saveAttendanceRecord(record);

  res.json({ success: true, record });
});

export default router;
