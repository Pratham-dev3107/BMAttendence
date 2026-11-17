import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, DollarSign, Plus, Printer, 
  Edit, Trash2, Sliders, FileSpreadsheet, ArrowDownRight, 
  ArrowUpRight, AlertCircle, CheckCircle2, ShieldCheck, 
  Search, RefreshCw, QrCode 
} from 'lucide-react';
import MonthlySheet from './MonthlySheet';
import BulkPrintBadgesModal from './BulkPrintBadgesModal';
import { fetchWorkers, deleteWorker } from '../utils/api';

export default function AdminView({ 
  todayData, 
  onRefreshToday, 
  onOpenAddWorker, 
  onOpenEditWorker,
  onOpenIDCard,
  onOpenSettings,
  onSelectDayForEdit 
}) {
  const [adminTab, setAdminTab] = useState('LIVE_TODAY'); // 'LIVE_TODAY' | 'MONTHLY_SHEET' | 'WORKERS'
  const [workersList, setWorkersList] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [searchWorker, setSearchWorker] = useState('');
  const [isBulkPrintOpen, setIsBulkPrintOpen] = useState(false);

  const stats = todayData?.stats || {
    totalWorkers: 0,
    presentCount: 0,
    insideCount: 0,
    outsideCount: 0,
    absentCount: 0,
    totalOT: 0
  };

  const loadWorkers = async () => {
    try {
      setWorkersLoading(true);
      const data = await fetchWorkers();
      setWorkersList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setWorkersLoading(false);
    }
  };

  useEffect(() => {
    if (adminTab === 'WORKERS') {
      loadWorkers();
    }
  }, [adminTab, todayData]);

  const handleDeleteWorker = async (worker) => {
    if (!confirm(`Are you sure you want to remove ${worker.name} (${worker.id})?`)) return;
    // Instant optimistic UI removal
    setWorkersList(prev => prev.filter(w => w.id !== worker.id));
    try {
      await deleteWorker(worker.id);
      onRefreshToday();
    } catch (err) {
      alert(err.message || 'Failed to remove worker');
      loadWorkers();
    }
  };

  const filteredWorkers = workersList.filter(w => 
    w.name.toLowerCase().includes(searchWorker.toLowerCase()) ||
    w.id.toLowerCase().includes(searchWorker.toLowerCase()) ||
    w.department.toLowerCase().includes(searchWorker.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5 pb-24">
      
      {/* Top Welcome & Quick Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Management Portal
            </span>
            <span className="text-slate-400 text-xs font-medium">Administrative Controls</span>
          </div>
          <h2 className="text-2xl font-black mt-1.5 tracking-tight">Admin Dashboard & Reports</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Attendance sheets, overtime calculation, payroll estimates, and printable QR badges.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={onOpenAddWorker}
            className="flex-1 md:flex-initial flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Worker</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-700 transition"
            title="Shift & Overtime Settings"
          >
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Shift Settings</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Staff</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{stats.totalWorkers}</p>
          <span className="text-[11px] text-slate-400 font-medium">Registered workers</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <span>Present Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">{stats.presentCount}</p>
          <span className="text-[11px] text-emerald-700 font-bold">
            {stats.insideCount} currently inside
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 text-xs font-bold uppercase tracking-wider">
            <span>Absent Today</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 mt-2">{stats.absentCount}</p>
          <span className="text-[11px] text-slate-400 font-medium">No punch recorded</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold uppercase tracking-wider">
            <span>Logged OT</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 mt-2">+{stats.totalOT}h</p>
          <span className="text-[11px] text-amber-700 font-bold">Overtime hours today</span>
        </div>

      </div>

      {/* Admin Tab Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setAdminTab('LIVE_TODAY')}
          className={`flex items-center space-x-2 py-3 px-4 font-bold text-sm border-b-2 whitespace-nowrap transition cursor-pointer ${
            adminTab === 'LIVE_TODAY'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Today's Live Punch Log</span>
        </button>

        <button
          onClick={() => setAdminTab('MONTHLY_SHEET')}
          className={`flex items-center space-x-2 py-3 px-4 font-bold text-sm border-b-2 whitespace-nowrap transition cursor-pointer ${
            adminTab === 'MONTHLY_SHEET'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Monthly Attendance Sheet (Excel)</span>
        </button>

        <button
          onClick={() => setAdminTab('WORKERS')}
          className={`flex items-center space-x-2 py-3 px-4 font-bold text-sm border-b-2 whitespace-nowrap transition cursor-pointer ${
            adminTab === 'WORKERS'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory & QR Cards</span>
        </button>
      </div>

      {/* Tab 1: Today's Live Attendance Table */}
      {adminTab === 'LIVE_TODAY' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-base">Real-Time Attendance Log</h3>
            <button
              onClick={onRefreshToday}
              className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Worker</th>
                  <th className="py-3 px-3">Role & Dept</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">In Time</th>
                  <th className="py-3 px-3">Out Time</th>
                  <th className="py-3 px-3">Total Hrs</th>
                  <th className="py-3 px-3">OT Hrs</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(todayData?.list || []).map((item) => {
                  const worker = item.worker;
                  const isInside = item.currentStatus === 'IN';
                  const isPresent = item.punches.length > 0 || item.status === 'PRESENT';

                  return (
                    <tr key={worker.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900">{worker.name}</div>
                        <span className="text-xs font-mono text-slate-400 font-semibold">{worker.id}</span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 text-xs">{worker.designation}</span>
                        <div className="text-[11px] text-slate-500">{worker.department}</div>
                      </td>

                      <td className="py-3 px-3">
                        {isInside ? (
                          <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            <span>INSIDE</span>
                          </span>
                        ) : isPresent ? (
                          <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            Shift Ended
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                            ABSENT
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-xs text-slate-700 font-semibold">
                        {item.firstIn || '-'}
                      </td>

                      <td className="py-3 px-3 font-mono text-xs text-slate-700 font-semibold">
                        {item.lastOut || '-'}
                      </td>

                      <td className="py-3 px-3 font-bold text-slate-800 font-mono">
                        {item.totalHours > 0 ? (
                          <div>
                            <span>{item.totalHours}h</span>
                            {item.outsideHours > 0 && (
                              <span className="block text-[10px] text-amber-600 font-medium font-sans">
                                (-{item.outsideHours}h outside)
                              </span>
                            )}
                          </div>
                        ) : '-'}
                      </td>

                      <td className="py-3 px-3">
                        {item.overtimeHours > 0 ? (
                          <span className="bg-amber-100 text-amber-800 text-xs font-extrabold px-2 py-0.5 rounded border border-amber-300">
                            +{item.overtimeHours}h
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onSelectDayForEdit && onSelectDayForEdit(worker, item)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                        >
                          Manual Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Monthly Sheet & Excel Generator */}
      {adminTab === 'MONTHLY_SHEET' && (
        <MonthlySheet onSelectDayForEdit={onSelectDayForEdit} />
      )}

      {/* Tab 3: Staff Management & Printable QR Badges */}
      {adminTab === 'WORKERS' && (
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchWorker}
                onChange={(e) => setSearchWorker(e.target.value)}
                placeholder="Search staff members..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-2.5 w-full sm:w-auto">
              <button
                onClick={() => setIsBulkPrintOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-95"
                title="Print All Worker QR Badges on A4 Sheets (3 Cards per page with cut lines)"
              >
                <Printer className="w-4 h-4" />
                <span>Print All Badges (A4)</span>
              </button>

              <button
                onClick={onOpenAddWorker}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Worker</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkers.map((worker) => (
              <div 
                key={worker.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-black text-lg flex items-center justify-center shadow-sm">
                        {worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-base">{worker.name}</h4>
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {worker.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1 text-xs text-slate-600">
                    <p><strong className="text-slate-800">Role:</strong> {worker.designation}</p>
                    <p><strong className="text-slate-800">Department:</strong> {worker.department}</p>
                    <p><strong className="text-slate-800">Phone:</strong> {worker.phone || 'N/A'}</p>
                    <p>
                      <strong className="text-slate-800">Rate:</strong> {worker.wageType === 'daily' ? `₹${worker.rate}/day` : `₹${worker.rate}/month`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenIDCard(worker)}
                    className="flex-1 flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer shadow-xs"
                    title="View QR Identity Pass & Download"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View QR Pass</span>
                  </button>

                  <button
                    onClick={() => onOpenEditWorker(worker)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                    title="Edit Worker"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteWorker(worker)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    title="Delete Worker"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* Bulk Print A4 Badges Modal */}
      <BulkPrintBadgesModal
        isOpen={isBulkPrintOpen}
        onClose={() => setIsBulkPrintOpen(false)}
        workers={workersList}
        companyName="Kranti Industries"
      />

    </div>
  );
}
