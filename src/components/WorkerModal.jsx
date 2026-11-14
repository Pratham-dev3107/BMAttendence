import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, DollarSign, Briefcase, Phone, User } from 'lucide-react';

export default function WorkerModal({ isOpen, onClose, onSave, editingWorker }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    department: 'Fabrication',
    designation: 'Worker',
    wageType: 'daily',
    rate: 600
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingWorker) {
      setFormData({
        name: editingWorker.name || '',
        phone: editingWorker.phone || '',
        department: editingWorker.department || 'Fabrication',
        designation: editingWorker.designation || 'Worker',
        wageType: editingWorker.wageType || 'daily',
        rate: editingWorker.rate || 0
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        department: 'Fabrication',
        designation: 'Helper',
        wageType: 'daily',
        rate: 600
      });
    }
  }, [editingWorker, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      await onSave(formData, editingWorker?.id);
      onClose();
    } catch (err) {
      alert(err.message || 'Error saving worker profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {editingWorker ? 'Edit Staff Member' : 'Add New Staff Member'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Phone & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Department
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none cursor-pointer"
              >
                <option value="Fabrication">Fabrication</option>
                <option value="Machining">Machining</option>
                <option value="Assembly">Assembly</option>
                <option value="Packaging">Packaging</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Office / Staff">Office / Staff</option>
                <option value="Security">Security</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>

          {/* Designation & Wage Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Designation / Role
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Welder, Fitter, Helper"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Compensation Scheme
              </label>
              <select
                value={formData.wageType}
                onChange={(e) => setFormData({ ...formData, wageType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none cursor-pointer"
              >
                <option value="daily">Daily Wage</option>
                <option value="monthly">Monthly Fixed Salary</option>
              </select>
            </div>
          </div>

          {/* Rate / Salary */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {formData.wageType === 'daily' ? 'Daily Rate (₹ per day)' : 'Monthly Salary (₹)'}
            </label>
            <div className="relative">
              <span className="text-slate-500 font-bold absolute left-3.5 top-1/2 -translate-y-1/2">₹</span>
              <input
                type="number"
                min="0"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder={formData.wageType === 'daily' ? 'e.g. 700' : 'e.g. 20000'}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-bold"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.name.trim()}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Saving...' : editingWorker ? 'Update Worker' : 'Save Worker'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
