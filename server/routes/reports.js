import express from 'express';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { db } from '../db.js';

dayjs.extend(isoWeek);

const router = express.Router();

// GET /api/reports/monthly - Full matrix sheet with Sunday-cut policy & automated payroll
router.get('/monthly', (req, res) => {
  const monthStr = req.query.month || dayjs().format('YYYY-MM'); // e.g. '2026-11'
  const settings = db.getSettings();
  const workers = db.getWorkers().filter(w => w.status === 'active');
  const attendanceRecords = db.getAttendanceByMonth(monthStr);

  const startOfMonth = dayjs(`${monthStr}-01`);
  const daysInMonth = startOfMonth.daysInMonth();
  const today = dayjs().format('YYYY-MM-DD');

  // Generate list of days in the month with week numbers
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const currentDay = startOfMonth.date(d);
    const dateFormatted = currentDay.format('YYYY-MM-DD');
    const isSunday = currentDay.day() === (settings.weeklyOffDay ?? 0);
    const isFuture = dateFormatted > today;

    // Week bucket: ISO week number or standard 7-day chunk
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

    // Map each day's status
    const dailyAttendance = days.map(day => {
      const record = attendanceRecords.find(r => r.workerId === worker.id && r.date === day.date);

      let status = '-'; // Future default
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
          status = 'A'; // Past weekday without record
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
    // 1. If 3 offs in a single week -> Cut that week's Sunday
    // 2. If 4 or more offs in the month -> Cut at least 2 Sundays
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

    // Check weekly condition (>= 3 offs in a single week)
    Object.keys(weekGroups).forEach(wk => {
      const g = weekGroups[wk];
      if (g.offs >= (settings.weeklyOffCutThreshold ?? 3) && g.hasSunday) {
        weeklyCutCount += 1;
        cutReasons.push(`Week ${wk}: ${g.offs} offs (Sunday Cut)`);
      }
    });

    let totalSundaysCut = weeklyCutCount;
    const totalEffectiveOffs = absentDays + (halfDays * 0.5);

    // Check monthly condition (>= 4 offs in the month -> at least 2 Sundays cut)
    const monthlyCutThreshold = settings.monthlyOffCutThreshold ?? 4;
    const monthlyMaxCut = settings.monthlyMaxSundayCut ?? 2;

    if (totalEffectiveOffs >= monthlyCutThreshold) {
      if (totalSundaysCut < monthlyMaxCut) {
        totalSundaysCut = monthlyMaxCut;
        cutReasons.push(`Month total: ${totalEffectiveOffs} offs (2 Sundays Cut)`);
      }
    }

    // Cannot cut more Sundays than exist in the month
    totalSundaysCut = Math.min(totalSundaysCut, totalSundaysInMonth);
    const paidSundays = Math.max(0, totalSundaysInMonth - totalSundaysCut);

    // -------------------------------------------------------------
    // AUTOMATED SALARY CALCULATION
    // -------------------------------------------------------------
    const effectivePresentDays = presentDays + (halfDays * 0.5);
    let estimatedPay = 0;
    const hourlyShiftHours = settings.fullDayMinHours || 8.5;

    if (worker.wageType === 'daily') {
      const dailyRate = worker.rate || 0;
      const hourlyRate = dailyRate / hourlyShiftHours;
      // Daily wage: Effective worked days * daily rate + OT
      const basePay = effectivePresentDays * dailyRate;
      const otPay = totalOvertimeHours * hourlyRate * 1.0; // Standard 1x or 1.5x OT
      estimatedPay = Math.round(basePay + otPay);
    } else {
      // Monthly fixed salary:
      // (Salary / daysInMonth) * (Worked Days + Paid Sundays) + OT
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
