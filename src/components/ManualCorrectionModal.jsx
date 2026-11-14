import React, { useState, useEffect } from 'react';
import { X, Edit3, Check, Clock } from 'lucide-react';

export default function ManualCorrectionModal({ item, isOpen, onClose, onSave }) {
  const [status, setStatus] = useState('PRESENT');
  const [firstIn, setFirstIn] = useState('09:00:00');
  const [lastOut, setLastOut] = useState('18:00:00');
  const [totalHours, setTotalHours] = useState('9');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setStatus(item.status === 'P' ? 'PRESENT' : item.status === 'HD' ? 'HALF_DAY' : item.status === 'A' ? 'ABSENT' : item.status || 'PRESENT');
      setFirstIn(item.inTime || item.firstIn || '09:00:00');
      setLastOut(item.outTime || item.lastOut || '18:00:00');
      setTotalHours(String(item.hours || item.totalHours || '9'));
      setOvertimeHours(String(item.ot || item.overtimeHours || '0'));
      setNotes(item.notes || '');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSave({
        workerId: item.workerId || item.worker?.id,
        date: item.date,
        status,
        firstIn,
        lastOut,
        totalHours: Number(totalHours),
        overtimeHours: Number(overtimeHours),
        notes
      });
      onClose();
    } catch (err) {
      alert(err.message || 'Error saving correction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Manual Record Override</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs">
            <p className="text-slate-400">Worker: <span className="font-bold text-white">{item.worker?.name || item.workerName}</span> ({item.workerId || item.worker?.id})</p>
            <p className="text-slate-400 mt-0.5">Date: <span className="font-bold text-white">{item.date}</span></p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none cursor-pointer"
            >
              <option value="PRESENT">PRESENT (P) - Full Day</option>
              <option value="HALF_DAY">HALF_DAY (HD) - Half Day</option>
              <option value="ABSENT">ABSENT (A) - Absent</option>
              <option value="WO">WEEKLY OFF (WO) - Sunday/Holiday</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                In Time
              </label>
              <input
                type="text"
                value={firstIn}
                onChange={(e) => setFirstIn(e.target.value)}
                placeholder="09:00:00"
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Out Time
              </label>
              <input
                type="text"
                value={lastOut}
                onChange={(e) => setLastOut(e.target.value)}
                placeholder="18:00:00"
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Total Worked (Hrs)
              </label>
              <input
                type="number"
                step="0.5"
                value={totalHours}
                onChange={(e) => setTotalHours(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Overtime (Hrs)
              </label>
              <input
                type="number"
                step="0.5"
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Reason / Admin Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Guard punch missed / Verified by Supervisor"
              className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Correction'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
