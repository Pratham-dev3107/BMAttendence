import express from 'express';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { db } from '../db.js';

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

const router = express.Router();

function getNowIST() {
  return dayjs().tz('Asia/Kolkata');
}

// GET /api/reports/monthly - Full matrix sheet with Sunday-cut policy & automated payroll (IST)
router.get('/monthly', async (req, res) => {
  const nowIST = getNowIST();
  const monthStr = req.query.month || nowIST.format('YYYY-MM'); // e.g. '2026-11'
  const settings = db.getSettings();
  const allWorkers = await db.getWorkers();
  const workers = allWorkers.filter(w => w.status === 'active');
  const attendanceRecords = await db.getAttendanceByMonth(monthStr);

  const startOfMonth = dayjs.tz(`${monthStr}-01`, 'Asia/Kolkata');
  const daysInMonth = startOfMonth.daysInMonth();
  const today = nowIST.format('YYYY-MM-DD');

  // Generate list of days in the month with week numbers
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const currentDay = startOfMonth.date(d);
    const dateFormatted = currentDay.format('YYYY-MM-DD');
    const isSunday = currentDay.day() === (settings.weeklyOffDay ?? 0);
    const isFuture = dateFormatted > today;
    const weekNumber = currentDay.isoWeek();

    days.push({
      dayNumber: d,
      date: dateFormatted,
      dayName: currentDay.format('ddd'),
      isWeeklyOff: isSunday,
      isFuture,
      weekNumber
    });
  }

  const totalSundaysInMonth = days.filter(d => d.isWeeklyOff).length;

  // Build matrix for each worker
  const matrix = workers.map(worker => {
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let weeklyOffCount = 0;
    let totalHoursWorked = 0;
    let totalOvertimeHours = 0;

    const dailyAttendance = days.map(day => {
      const record = attendanceRecords.find(r => r.workerId === worker.id && r.date === day.date);

      let status = '-';
      let hours = 0;
      let ot = 0;
      let inTime = null;
      let outTime = null;

      if (record) {
        hours = record.totalHours || 0;
        ot = record.overtimeHours || 0;
        inTime = record.firstIn;
        outTime = record.lastOut;

        if (record.manualStatus) {
          status = record.manualStatus;
        } else if (record.status === 'PRESENT') {
          status = 'P';
        } else if (record.status === 'HALF_DAY') {
          status = 'HD';
        } else if (record.status === 'ABSENT') {
          status = 'A';
        } else {
          status = record.punches?.length > 0 ? 'P' : 'A';
        }
      } else if (!day.isFuture) {
        if (day.isWeeklyOff) {
          status = 'WO';
        } else {
          status = 'A';
        }
      } else if (day.isWeeklyOff) {
        status = 'WO';
      }

      if (!day.isFuture) {
        if (status === 'P' || status === 'PRESENT') {
          presentDays += 1;
        } else if (status === 'HD' || status === 'HALF_DAY') {
          halfDays += 1;
        } else if (status === 'WO') {
          weeklyOffCount += 1;
        } else if (status === 'A' || status === 'ABSENT') {
          absentDays += 1;
        }
        totalHoursWorked += hours;
        totalOvertimeHours += ot;
      }

      return {
        date: day.date,
        dayNumber: day.dayNumber,
        dayName: day.dayName,
        weekNumber: day.weekNumber,
        isWeeklyOff: day.isWeeklyOff,
        status,
        hours,
        ot,
        inTime,
        outTime,
        recordId: record ? record.id : null
      };
    });

    // -------------------------------------------------------------
    // POLICY: SUNDAY DEDUCTION RULES
    // -------------------------------------------------------------
    const weekGroups = {};
    dailyAttendance.forEach(d => {
      if (!weekGroups[d.weekNumber]) {
        weekGroups[d.weekNumber] = { offs: 0, hasSunday: false };
      }
      if (d.status === 'A' || d.status === 'ABSENT') {
        weekGroups[d.weekNumber].offs += 1;
      } else if (d.status === 'HD' || d.status === 'HALF_DAY') {
        weekGroups[d.weekNumber].offs += 0.5;
      }
      if (d.isWeeklyOff) {
        weekGroups[d.weekNumber].hasSunday = true;
      }
    });

    let weeklyCutCount = 0;
    const cutReasons = [];

    Object.keys(weekGroups).forEach(wk => {
      const g = weekGroups[wk];
      if (g.offs >= (settings.weeklyOffCutThreshold ?? 3) && g.hasSunday) {
        weeklyCutCount += 1;
        cutReasons.push(`Week ${wk}: ${g.offs} offs (Sunday Cut)`);
      }
    });

    let totalSundaysCut = weeklyCutCount;
    const totalEffectiveOffs = absentDays + (halfDays * 0.5);

    const monthlyCutThreshold = settings.monthlyOffCutThreshold ?? 4;
    const monthlyMaxCut = settings.monthlyMaxSundayCut ?? 2;

    if (totalEffectiveOffs >= monthlyCutThreshold) {
      if (totalSundaysCut < monthlyMaxCut) {
        totalSundaysCut = monthlyMaxCut;
        cutReasons.push(`Month total: ${totalEffectiveOffs} offs (2 Sundays Cut)`);
      }
    }

    totalSundaysCut = Math.min(totalSundaysCut, totalSundaysInMonth);
    const paidSundays = Math.max(0, totalSundaysInMonth - totalSundaysCut);

    // Automated payroll calculation
    const effectivePresentDays = presentDays + (halfDays * 0.5);
    let estimatedPay = 0;
    const hourlyShiftHours = settings.fullDayMinHours || 8.5;

    if (worker.wageType === 'daily') {
      const dailyRate = worker.rate || 0;
      const hourlyRate = dailyRate / hourlyShiftHours;
      const basePay = effectivePresentDays * dailyRate;
      const otPay = totalOvertimeHours * hourlyRate * 1.0;
      estimatedPay = Math.round(basePay + otPay);
    } else {
      const monthlyRate = worker.rate || 0;
      const perDayRate = monthlyRate / daysInMonth;
      const payableDays = effectivePresentDays + paidSundays;
      const basePay = payableDays * perDayRate;
      const hourlyRate = perDayRate / hourlyShiftHours;
      const otPay = totalOvertimeHours * hourlyRate;
      estimatedPay = Math.round(Math.min(monthlyRate, basePay) + otPay);
    }

    return {
      worker,
      days: dailyAttendance,
      summary: {
        presentDays,
        halfDays,
        absentDays,
        totalSundays: totalSundaysInMonth,
        sundaysCut: totalSundaysCut,
        paidSundays,
        sundaysCutReasons: cutReasons,
        effectiveDays: effectivePresentDays,
        totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
        totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
        estimatedPay
      }
    };
  });

  res.json({
    month: monthStr,
    monthName: startOfMonth.format('MMMM YYYY'),
    days,
    totalSundaysInMonth,
    matrix,
    company: settings.companyName,
    policy: {
      shift: `${settings.shiftStart || '08:30'} to ${settings.shiftEnd || '17:00'}`,
      overtime: 'Work past 5:00 PM (17:00)',
      weeklyRule: '3 offs in any week = 1 Sunday cut',
      monthlyRule: '4+ offs in month = 2 Sundays cut'
    }
  });
});

export default router;
