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

// POST /api/attendance/punch - Record In/Out punch with anti-stutter & mode intelligence
router.post('/punch', (req, res) => {
  try {
    const { workerId, type, method = 'QR', markedBy = 'Gatekeeper', date, time, force = false } = req.body;

    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }

    const worker = db.getWorkers().find(w => w.id.toUpperCase() === workerId.toUpperCase());
    if (!worker) {
      return res.status(404).json({ error: `Worker with ID "${workerId}" not found in system.` });
    }

    const punchDate = date || dayjs().format('YYYY-MM-DD');
    const now = dayjs();
    const punchTime = time || now.format('HH:mm:ss');
    const timestamp = date && time ? dayjs(`${date} ${time}`).valueOf() : now.valueOf();

    let record = db.findAttendanceRecord(worker.id, punchDate);
    if (!record) {
      record = {
        id: uuidv4(),
        workerId: worker.id,
        date: punchDate,
        punches: [],
        manualStatus: null,
        notes: ''
      };
    }

    const lastPunch = record.punches.length > 0 ? record.punches[record.punches.length - 1] : null;

    // -------------------------------------------------------------
    // ANTI-SPAM & INTELLIGENT PUNCH RESOLUTION
    // -------------------------------------------------------------
    let punchType = type; // Can be 'IN', 'OUT', or 'AUTO'

    // 1. If explicit 'IN' requested:
    if (punchType === 'IN') {
      if (lastPunch && lastPunch.type === 'IN') {
        const secondsSince = Math.floor((timestamp - lastPunch.timestamp) / 1000);
        // If punched IN within last 10 minutes, do not duplicate
        if (secondsSince < 600 && !force) {
          return res.json({
            success: true,
            alreadyPunched: true,
            message: `${worker.name} is already punched IN today at ${lastPunch.time}`,
            punchType: 'IN',
            punchTime: lastPunch.time,
            worker,
            record
          });
        }
      }
    } 
    // 2. If explicit 'OUT' requested:
    else if (punchType === 'OUT') {
      if (record.punches.length === 0 && !force) {
        return res.status(400).json({ 
          error: `${worker.name} has no IN punch today. Punch IN first before punching OUT.` 
        });
      }
      if (lastPunch && lastPunch.type === 'OUT') {
        const secondsSince = Math.floor((timestamp - lastPunch.timestamp) / 1000);
        if (secondsSince < 600 && !force) {
          return res.json({
            success: true,
            alreadyPunched: true,
            message: `${worker.name} is already punched OUT today at ${lastPunch.time}`,
            punchType: 'OUT',
            punchTime: lastPunch.time,
            worker,
            record
          });
        }
      }
    } 
    // 3. If 'AUTO' mode:
    else {
      if (!lastPunch) {
        punchType = 'IN'; // First punch of the day is ALWAYS IN
      } else {
        const secondsSinceLast = Math.floor((timestamp - lastPunch.timestamp) / 1000);

        // Strict accidental double-scan protection (within 3 minutes)
        if (secondsSinceLast < 180 && !force) {
          return res.json({
            success: true,
            alreadyPunched: true,
            message: `${worker.name} already punched ${lastPunch.type} just now at ${lastPunch.time}`,
            punchType: lastPunch.type,
            punchTime: lastPunch.time,
            worker,
            record
          });
        }

        // If last punch was IN and more than 15 minutes passed -> Punch OUT
        // If last punch was OUT and worker comes back -> Punch IN
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
