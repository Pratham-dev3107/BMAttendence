import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Download, Calendar, ChevronLeft, ChevronRight, FileSpreadsheet, ShieldAlert, Clock, Info } from 'lucide-react';
import { fetchMonthlyReport } from '../utils/api';

export default function MonthlySheet({ onSelectDayForEdit }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // 'YYYY-MM'
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReport(selectedMonth);
  }, [selectedMonth]);

  const loadReport = async (month) => {
    try {
      setLoading(true);
      const data = await fetchMonthlyReport(month);
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(prevDate.toISOString().substring(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(nextDate.toISOString().substring(0, 7));
  };

  // 1-Click Excel (.xlsx) Export with Sunday Cut breakdown
  const exportToExcel = () => {
    if (!reportData) return;

    const days = reportData.days || [];
    const matrix = reportData.matrix || [];

    // Header row
    const headers = ['Worker ID', 'Name', 'Department', 'Designation', 'Wage Type', 'Rate (₹)'];
    days.forEach(d => {
      headers.push(`${d.dayNumber} (${d.dayName})`);
    });
    headers.push(
      'Present Days', 
      'Half Days', 
      'Absent Days', 
      'Total Sundays',
      'Sundays Cut (Penalty)', 
      'Paid Sundays', 
      'Total Hours', 
      'Overtime Hrs (Post 5PM)', 
      'Estimated Payout (₹)'
    );

    // Data rows
    const rows = matrix.map(m => {
      const row = [
        m.worker.id,
        m.worker.name,
        m.worker.department,
        m.worker.designation,
        m.worker.wageType,
        m.worker.rate
      ];

      m.days.forEach(d => {
        row.push(d.status);
      });

      row.push(
        m.summary.presentDays,
        m.summary.halfDays,
        m.summary.absentDays,
        m.summary.totalSundays,
        m.summary.sundaysCut,
        m.summary.paidSundays,
        m.summary.totalHoursWorked,
        m.summary.totalOvertimeHours,
        m.summary.estimatedPay
      );

      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Attendance_${selectedMonth}`);

    XLSX.writeFile(workbook, `Attendance_Payroll_${reportData.company || 'Kranti'}_${selectedMonth}.xlsx`);
  };

  const days = reportData?.days || [];
  const matrix = reportData?.matrix || [];

  return (
    <div className="space-y-4">
      
      {/* Attendance & Sunday Cut Policy Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Automated Attendance & Overtime Rules</h4>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1 font-medium">
              <span>⏰ <strong>Shift:</strong> 8:30 AM – 5:00 PM</span>
              <span>⚡ <strong>Overtime:</strong> Work past 5:00 PM</span>
              <span>🚫 <strong>Sunday Policy:</strong> 3 offs in a week = 1 Sunday Cut | 4+ offs in month = 2 Sundays Cut</span>
            </div>
          </div>
        </div>

        <button
          onClick={exportToExcel}
          disabled={loading || matrix.length === 0}
          className="w-full md:w-auto flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex-shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Download Payroll Excel (.xlsx)</span>
        </button>
      </div>

      {/* Top Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Month Selector */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-800 text-sm focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Legend pills */}
        <div className="hidden lg:flex items-center space-x-3 text-xs font-bold">
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block shadow-xs"></span>
            <span className="text-slate-600">P = Present</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-amber-400 inline-block shadow-xs"></span>
            <span className="text-slate-600">HD = Half Day</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 inline-block shadow-xs"></span>
            <span className="text-slate-600">A = Absent</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-slate-200 inline-block shadow-xs"></span>
            <span className="text-slate-600">WO = Sunday</span>
          </span>
        </div>

      </div>

      {/* Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <p className="animate-pulse font-bold text-slate-600">Calculating attendance & Sunday cuts...</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-full text-left border-collapse text-xs">
              
              {/* Header */}
              <thead className="bg-slate-900 text-white sticky top-0 z-20">
                <tr>
                  <th className="py-3 px-3 font-bold sticky left-0 bg-slate-900 z-30 min-w-[150px] shadow-sm">
                    Worker Name & ID
                  </th>
                  <th className="py-3 px-2 font-bold min-w-[85px]">Dept</th>

                  {/* Day Columns */}
                  {days.map((d) => (
                    <th
                      key={d.dayNumber}
                      className={`py-2 px-1 text-center font-bold min-w-[32px] ${
                        d.isWeeklyOff ? 'bg-slate-800 text-amber-300' : ''
                      }`}
                    >
                      <div>{d.dayNumber}</div>
                      <div className="text-[9px] font-normal uppercase opacity-75">{d.dayName}</div>
                    </th>
                  ))}

                  {/* Summary Headers */}
                  <th className="py-3 px-2 text-center font-bold bg-emerald-950 text-emerald-200 min-w-[40px]">P</th>
                  <th className="py-3 px-2 text-center font-bold bg-amber-950 text-amber-200 min-w-[40px]">HD</th>
                  <th className="py-3 px-2 text-center font-bold bg-rose-950 text-rose-200 min-w-[40px]">A</th>
                  <th className="py-3 px-2 text-center font-bold bg-red-900 text-white min-w-[65px]" title="Sundays Cut due to 3 weekly or 4 monthly offs">Sun Cut</th>
                  <th className="py-3 px-2 text-center font-bold bg-sky-950 text-sky-200 min-w-[55px]">Paid Sun</th>
                  <th className="py-3 px-2 text-center font-bold bg-indigo-950 text-indigo-200 min-w-[55px]">Total Hrs</th>
                  <th className="py-3 px-2 text-center font-bold bg-purple-950 text-purple-200 min-w-[55px]">OT (Post 5PM)</th>
                  <th className="py-3 px-3 text-right font-bold bg-emerald-900 text-white min-w-[95px]">Est. Pay</th>
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-slate-100">
                {matrix.map((row) => {
                  const worker = row.worker;
                  const s = row.summary;

                  return (
                    <tr key={worker.id} className="hover:bg-slate-50 transition">
                      
                      {/* Sticky Worker Name */}
                      <td className="py-2.5 px-3 font-bold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-xs border-r border-slate-100">
                        <div className="truncate max-w-[130px] font-black">{worker.name}</div>
                        <span className="text-[10px] text-slate-400 font-mono font-semibold">{worker.id}</span>
                      </td>

                      <td className="py-2 px-2 text-slate-500 font-semibold whitespace-nowrap">
                        {worker.department}
                      </td>

                      {/* Day cells */}
                      {row.days.map((day) => {
                        let cellClass = 'text-slate-300';
                        if (day.status === 'P' || day.status === 'PRESENT') {
                          cellClass = 'bg-emerald-500 text-white font-black shadow-2xs';
                        } else if (day.status === 'HD' || day.status === 'HALF_DAY') {
                          cellClass = 'bg-amber-400 text-slate-950 font-black';
                        } else if (day.status === 'A' || day.status === 'ABSENT') {
                          cellClass = 'bg-rose-500 text-white font-black';
                        } else if (day.status === 'WO') {
                          cellClass = 'bg-slate-100 text-slate-500 font-bold';
                        }

                        return (
                          <td
                            key={day.dayNumber}
                            onClick={() => onSelectDayForEdit && onSelectDayForEdit(worker, day)}
                            title={`${worker.name} - Day ${day.dayNumber}: ${day.status}${day.inTime ? ` (${day.inTime} - ${day.outTime || 'now'})` : ''}`}
                            className="p-0.5 text-center cursor-pointer hover:opacity-80 transition"
                          >
                            <div className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center text-[11px] ${cellClass}`}>
                              {day.status}
                            </div>
                          </td>
                        );
                      })}

                      {/* Summary values */}
                      <td className="py-2 px-2 text-center font-bold text-emerald-700 bg-emerald-50/40">
                        {s.presentDays}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-amber-700 bg-amber-50/40">
                        {s.halfDays}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-rose-700 bg-rose-50/40">
                        {s.absentDays}
                      </td>

                      {/* Sunday Cut Penalty Column */}
                      <td className="py-2 px-2 text-center font-extrabold bg-red-50/60">
                        {s.sundaysCut > 0 ? (
                          <span 
                            className="bg-rose-600 text-white text-[11px] px-2 py-0.5 rounded-md font-bold shadow-xs cursor-help inline-block"
                            title={s.sundaysCutReasons?.join('; ') || 'Sunday cut due to excess leaves'}
                          >
                            -{s.sundaysCut} Sun
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>

                      {/* Paid Sundays */}
                      <td className="py-2 px-2 text-center font-bold text-sky-800 bg-sky-50/40">
                        {s.paidSundays}/{s.totalSundays}
                      </td>

                      <td className="py-2 px-2 text-center font-bold text-indigo-700 bg-indigo-50/40 font-mono">
                        {s.totalHoursWorked}h
                      </td>
                      <td className="py-2 px-2 text-center font-extrabold text-purple-700 bg-purple-50/40 font-mono">
                        {s.totalOvertimeHours > 0 ? `+${s.totalOvertimeHours}h` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-slate-900 bg-emerald-50/80 font-mono">
                        ₹{s.estimatedPay.toLocaleString('en-IN')}
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

      </div>

    </div>
  );
}
