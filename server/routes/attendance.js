import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { db } from '../db.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata'); // Indian Standard Time (IST)

const router = express.Router();

function getNowIST() {
  return dayjs().tz('Asia/Kolkata');
}

// Helper to calculate hours, break/outside time, & exact Overtime
function calculateAttendanceMetrics(punches, settings, dateStr) {
  if (!punches || punches.length === 0) {
    return {
      firstIn: null,
      lastOut: null,
      totalHours: 0,
      outsideHours: 0,
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
  let totalOutsideMs = 0;
  let outTime = null;

  for (const punch of sortedPunches) {
    if (punch.type === 'IN') {
      inTime = punch.timestamp;
      // If worker was previously OUT, accumulate time spent outside
      if (outTime !== null) {
        totalOutsideMs += (punch.timestamp - outTime);
        outTime = null;
      }
    } else if (punch.type === 'OUT' && inTime !== null) {
      // Worker just went OUT: accumulate working time from inTime
      totalMilliseconds += (punch.timestamp - inTime);
      inTime = null;
      outTime = punch.timestamp;
    }
  }

  // Net actual working hours (excluding breaks / outside time)
  const totalHours = Math.round((totalMilliseconds / (1000 * 60 * 60)) * 100) / 100;
  const outsideHours = Math.round((totalOutsideMs / (1000 * 60 * 60)) * 100) / 100;
  
  const minFull = settings.fullDayMinHours || 8.5;
  const minHalf = settings.halfDayMinHours || 4.5;

  // Overtime: only net worked hours that exceed the full day shift threshold
  let overtimeHours = 0;
  if (totalHours > minFull) {
    overtimeHours = Math.round((totalHours - minFull) * 10) / 10;
  }

  let status = 'ABSENT';
  if (totalHours >= minFull) {
    status = 'PRESENT';
  } else if (totalHours >= minHalf) {
    status = 'HALF_DAY';
  } else if (sortedPunches.some(p => p.type === 'IN')) {
    status = 'PRESENT'; // Active inside or worked today
  }

  return {
    firstIn: firstInPunch ? firstInPunch.time : null,
    lastOut: lastOutPunch ? lastOutPunch.time : null,
    totalHours,
    outsideHours,
    overtimeHours: Math.max(0, overtimeHours),
    status,
    currentStatus: lastPunch.type // 'IN' or 'OUT'
  };
}

// GET /api/attendance/today - Get attendance status for all workers today (IST)
router.get('/today', async (req, res) => {
  const todayStr = req.query.date || getNowIST().format('YYYY-MM-DD');
  const settings = db.getSettings();
  const allWorkers = await db.getWorkers();
  const workers = allWorkers.filter(w => w.status === 'active');
  const todayRecords = await db.getAttendanceByDate(todayStr);

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
      outsideHours: metrics.outsideHours,
      overtimeHours: metrics.overtimeHours,
      status: record?.manualStatus || (punches.length === 0 ? 'ABSENT' : metrics.status),
      currentStatus: metrics.currentStatus, // 'IN' or 'OUT'
      isLate: metrics.firstIn && settings.shiftStart ? 
        dayjs.tz(`${todayStr} ${metrics.firstIn}`, 'Asia/Kolkata').isAfter(
          dayjs.tz(`${todayStr} ${settings.shiftStart}`, 'Asia/Kolkata').add(settings.graceMinutes || 15, 'minute')
        ) : false
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

// POST /api/attendance/punch - Record In/Out punch with exact local IST time
router.post('/punch', async (req, res) => {
  try {
    const { workerId, type, method = 'QR', markedBy = 'Gatekeeper', date, time, force = false } = req.body;

    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }

    const worker = await db.findWorker(workerId);
    if (!worker) {
      return res.status(404).json({ error: `Worker with ID "${workerId}" not found in system.` });
    }

    const nowIST = getNowIST();
    // Use client device time if provided, otherwise server IST time
    const punchDate = date || nowIST.format('YYYY-MM-DD');
    const punchTime = time || nowIST.format('HH:mm:ss');
    const timestamp = date && time 
      ? dayjs.tz(`${date} ${time}`, 'Asia/Kolkata').valueOf() 
      : nowIST.valueOf();

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

    let punchType = type; // Can be 'IN', 'OUT', or 'AUTO'

    // 🛡️ ANTI-DOUBLE-SCAN DEBOUNCE: Protect against rapid re-scanning within 60 seconds (1 minute)
    const COOLDOWN_SECONDS = 60;
    if (lastPunch && !force) {
      const secondsSinceLast = Math.floor((timestamp - lastPunch.timestamp) / 1000);
      if (secondsSinceLast < COOLDOWN_SECONDS) {
        return res.json({
          success: true,
          alreadyPunched: true,
          duplicatePrevented: true,
          message: `⚠️ ${worker.name} already punched ${lastPunch.type} just now at ${lastPunch.time}. Please wait 1 minute before next punch.`,
          punchType: lastPunch.type,
          punchTime: lastPunch.time,
          worker,
          record
        });
      }
    }

    // Auto In/Out toggle (1st scan IN, 2nd scan OUT, 3rd scan IN, 4th scan OUT)
    if (punchType === 'AUTO' || !punchType) {
      if (!lastPunch) {
        punchType = 'IN';
      } else {
        punchType = lastPunch.type === 'IN' ? 'OUT' : 'IN';
      }
    } 
    // Explicit 'IN' mode (Morning arrival override)
    else if (punchType === 'IN') {
      if (lastPunch && lastPunch.type === 'IN' && !force) {
        return res.json({
          success: true,
          alreadyPunched: true,
          duplicatePrevented: true,
          message: `${worker.name} is already punched IN today at ${lastPunch.time}`,
          punchType: 'IN',
          punchTime: lastPunch.time,
          worker,
          record
        });
      }
    } 
    // Explicit 'OUT' mode (Evening departure override)
    else if (punchType === 'OUT') {
      if (record.punches.length === 0 && !force) {
        return res.status(400).json({ 
          error: `${worker.name} has no IN punch today. Punch IN first before punching OUT.` 
        });
      }
      if (lastPunch && lastPunch.type === 'OUT' && !force) {
        return res.json({
          success: true,
          alreadyPunched: true,
          duplicatePrevented: true,
          message: `${worker.name} is already punched OUT today at ${lastPunch.time}`,
          punchType: 'OUT',
          punchTime: lastPunch.time,
          worker,
          record
        });
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

    await db.saveAttendanceRecord(record);

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
router.post('/manual-override', async (req, res) => {
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
    const tIn = dayjs.tz(`${date} ${firstIn}`, 'Asia/Kolkata').valueOf();
    const tOut = dayjs.tz(`${date} ${lastOut}`, 'Asia/Kolkata').valueOf();
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

  await db.saveAttendanceRecord(record);

  res.json({ success: true, record });
});

export default router;
