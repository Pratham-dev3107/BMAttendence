import React, { useState, useEffect } from 'react';
import { X, Settings, Save } from 'lucide-react';
import { updateSettings } from '../utils/api';

export default function SettingsModal({ isOpen, onClose, currentSettings, onSettingsUpdated }) {
  const [formData, setFormData] = useState({
    companyName: 'Kranti Industries',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    graceMinutes: 15,
    fullDayMinHours: 8,
    halfDayMinHours: 4,
    overtimeThresholdHours: 8.5
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      setFormData({
        companyName: currentSettings.companyName || 'Kranti Industries',
        shiftStart: currentSettings.shiftStart || '09:00',
        shiftEnd: currentSettings.shiftEnd || '18:00',
        graceMinutes: currentSettings.graceMinutes ?? 15,
        fullDayMinHours: currentSettings.fullDayMinHours ?? 8,
        halfDayMinHours: currentSettings.halfDayMinHours ?? 4,
        overtimeThresholdHours: currentSettings.overtimeThresholdHours ?? 8.5
      });
    }
  }, [currentSettings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await updateSettings({
        ...formData,
        graceMinutes: Number(formData.graceMinutes),
        fullDayMinHours: Number(formData.fullDayMinHours),
        halfDayMinHours: Number(formData.halfDayMinHours),
        overtimeThresholdHours: Number(formData.overtimeThresholdHours)
      });
      onSettingsUpdated(updated);
      onClose();
    } catch (err) {
      alert('Error updating settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Shift & Attendance Rules</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Company / Factory Name
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Shift Start Time
              </label>
              <input
                type="time"
                value={formData.shiftStart}
                onChange={(e) => setFormData({ ...formData, shiftStart: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Shift End Time
              </label>
              <input
                type="time"
                value={formData.shiftEnd}
                onChange={(e) => setFormData({ ...formData, shiftEnd: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Grace Period (Mins)
              </label>
              <input
                type="number"
                value={formData.graceMinutes}
                onChange={(e) => setFormData({ ...formData, graceMinutes: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                OT Threshold (Hrs)
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.overtimeThresholdHours}
                onChange={(e) => setFormData({ ...formData, overtimeThresholdHours: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Full Day Min (Hrs)
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.fullDayMinHours}
                onChange={(e) => setFormData({ ...formData, fullDayMinHours: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Half Day Min (Hrs)
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.halfDayMinHours}
                onChange={(e) => setFormData({ ...formData, halfDayMinHours: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
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
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
