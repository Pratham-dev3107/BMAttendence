import React, { useState } from 'react';
import { 
  QrCode, Search, LogIn, LogOut, Clock, 
  UserCheck, ArrowDownRight, ArrowUpRight, 
  Sparkles, CheckCircle2, X
} from 'lucide-react';
import { playPunchInSound, playPunchOutSound, playErrorSound } from '../utils/sound';

export default function GatekeeperView({ 
  todayData, 
  onPunch, 
  onOpenQRScanner, 
  loading,
  lastPunchFeedback 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'INSIDE' | 'OUTSIDE'
  const [pendingWorkerId, setPendingWorkerId] = useState(null);

  const stats = todayData?.stats || {
    totalWorkers: 0,
    presentCount: 0,
    insideCount: 0,
    outsideCount: 0
  };

  const list = todayData?.list || [];

  const filteredList = list.filter(item => {
    const worker = item.worker;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = 
      !query ||
      worker.name.toLowerCase().includes(query) ||
      worker.id.toLowerCase().includes(query) ||
      worker.department.toLowerCase().includes(query) ||
      worker.designation.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (filterMode === 'INSIDE') return item.currentStatus === 'IN';
    if (filterMode === 'OUTSIDE') return item.currentStatus !== 'IN';

    return true;
  });

  const handleManualPunch = async (workerId, type) => {
    try {
      setPendingWorkerId(workerId);
      
      // Play audio & haptics immediately for zero perceived latency
      if (type === 'IN') {
        playPunchInSound();
      } else {
        playPunchOutSound();
      }

      await onPunch(workerId, type, 'MANUAL');
    } catch (err) {
      playErrorSound();
      alert(err.message || 'Error recording attendance');
    } finally {
      setPendingWorkerId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4 pb-24">
      
      {/* Top Banner / Quick QR Scanner Trigger */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-3xl p-4 sm:p-6 text-white shadow-xl shadow-emerald-950/10 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-white/20 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Gate Terminal
            </span>
            <span className="text-emerald-100 text-xs font-medium">Quick In/Out Marker</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-1.5 tracking-tight">Worker Attendance Marker</h2>
          <p className="text-emerald-100 text-xs sm:text-sm mt-0.5 max-w-md">
            Scan worker QR ID card for 1-second auto punch or tap IN/OUT below.
          </p>
        </div>

        {/* Big QR Scanner Button */}
        <button
          onClick={onOpenQRScanner}
          className="w-full sm:w-auto flex items-center justify-center space-x-2.5 bg-white text-slate-950 hover:bg-emerald-50 active:scale-95 px-6 py-3.5 rounded-2xl font-extrabold shadow-lg shadow-black/20 transition-all duration-200 cursor-pointer"
        >
          <QrCode className="w-6 h-6 text-emerald-600" />
          <span className="text-base font-black tracking-tight">Scan QR Badge</span>
        </button>
      </div>

      {/* Floating Success Feedback Toast */}
      {lastPunchFeedback && (
        <div className="bg-slate-900 border-2 border-emerald-500/80 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center space-x-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-md ${
              lastPunchFeedback.punchType === 'IN' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
            }`}>
              {lastPunchFeedback.punchType === 'IN' ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
            </div>
            <div>
              <p className="font-extrabold text-sm sm:text-base leading-snug">
                {lastPunchFeedback.worker?.name} — <span className={lastPunchFeedback.punchType === 'IN' ? 'text-emerald-400' : 'text-rose-400'}>
                  PUNCHED {lastPunchFeedback.punchType}
                </span>
              </p>
              <p className="text-xs text-slate-300 font-mono">
                {lastPunchFeedback.punchTime} • ID: {lastPunchFeedback.worker?.id}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Success</span>
          </span>
        </div>
      )}

      {/* Live Counter Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div 
          onClick={() => setFilterMode('ALL')}
          className={`bg-white border rounded-2xl p-3 sm:p-4 shadow-xs text-center cursor-pointer transition-all duration-150 ${
            filterMode === 'ALL' ? 'border-slate-800 ring-2 ring-slate-800/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Staff</span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.totalWorkers}</p>
        </div>

        <div 
          onClick={() => setFilterMode('INSIDE')}
          className={`bg-white border rounded-2xl p-3 sm:p-4 shadow-xs text-center cursor-pointer transition-all duration-150 ${
            filterMode === 'INSIDE' ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Inside Now</span>
          </span>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{stats.insideCount}</p>
        </div>

        <div 
          onClick={() => setFilterMode('OUTSIDE')}
          className={`bg-white border rounded-2xl p-3 sm:p-4 shadow-xs text-center cursor-pointer transition-all duration-150 ${
            filterMode === 'OUTSIDE' ? 'border-slate-700 bg-slate-100 ring-2 ring-slate-700/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Outside</span>
          <p className="text-xl sm:text-2xl font-black text-slate-700 mt-0.5">{stats.outsideCount}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by worker name, ID (e.g. 101), role, department..."
            className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-2xl pl-11 pr-10 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex bg-slate-200/80 p-1 rounded-2xl self-start sm:self-center shadow-inner">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
              filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({list.length})
          </button>
          <button
            onClick={() => setFilterMode('INSIDE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
              filterMode === 'INSIDE' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inside ({stats.insideCount})
          </button>
          <button
            onClick={() => setFilterMode('OUTSIDE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
              filterMode === 'OUTSIDE' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Outside ({stats.outsideCount})
          </button>
        </div>
      </div>

      {/* Workers Attendance List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-400">
            <UserCheck className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-base">No workers found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search or add new staff from the Admin dashboard.</p>
          </div>
        ) : (
          filteredList.map((item) => {
            const worker = item.worker;
            const isInside = item.currentStatus === 'IN';
            const isBusy = pendingWorkerId === worker.id;
            const punches = item.punches || [];

            return (
              <div 
                key={worker.id}
                className={`bg-white border rounded-2xl p-4 shadow-xs transition-all duration-200 ${
                  isInside ? 'border-emerald-300 bg-emerald-50/20 shadow-emerald-500/5' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  
                  {/* Left: Worker Details */}
                  <div className="flex items-center space-x-3.5">
                    {/* Avatar Initials */}
                    <div className={`w-13 h-13 rounded-2xl flex items-center justify-center font-black text-base shadow-inner flex-shrink-0 transition-transform ${
                      isInside ? 'bg-emerald-600 text-white scale-102 ring-4 ring-emerald-500/10' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-black text-slate-900 text-base sm:text-lg leading-tight">{worker.name}</h4>
                        <span className="text-[11px] font-mono font-extrabold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-300">
                          {worker.id}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {worker.designation} • <span className="text-slate-800 font-bold">{worker.department}</span>
                      </p>

                      {/* Current Status Pill */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {isInside ? (
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            <span>INSIDE • In: {item.firstIn || 'Now'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            <span>OUTSIDE</span>
                            {item.lastOut && <span>• Last Out: {item.lastOut}</span>}
                          </span>
                        )}

                        {item.totalHours > 0 && (
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                            ⏱️ {item.totalHours} hrs
                          </span>
                        )}

                        {item.overtimeHours > 0 && (
                          <span className="text-xs font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                            OT: +{item.overtimeHours}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Punch Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    
                    {/* Punch IN Button */}
                    <button
                      onClick={() => handleManualPunch(worker.id, 'IN')}
                      disabled={isBusy}
                      className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-5 py-3 rounded-xl font-black text-sm shadow-sm active:scale-95 transition-all duration-150 cursor-pointer ${
                        isInside 
                          ? 'bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 border border-slate-200' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      }`}
                    >
                      <LogIn className="w-4 h-4" />
                      <span>PUNCH IN</span>
                    </button>

                    {/* Punch OUT Button */}
                    <button
                      onClick={() => handleManualPunch(worker.id, 'OUT')}
                      disabled={isBusy}
                      className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-5 py-3 rounded-xl font-black text-sm shadow-sm active:scale-95 transition-all duration-150 cursor-pointer ${
                        !isInside 
                          ? 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-800 border border-slate-200' 
                          : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>PUNCH OUT</span>
                    </button>

                  </div>

                </div>

                {/* Punch timeline log */}
                {punches.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center space-x-2 text-[11px] text-slate-500 overflow-x-auto">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">Today Log:</span>
                    {punches.map((p, idx) => (
                      <span 
                        key={idx}
                        className={`px-2 py-0.5 rounded-md font-semibold font-mono whitespace-nowrap ${
                          p.type === 'IN' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' : 'bg-rose-50 text-rose-800 border border-rose-200/60'
                        }`}
                      >
                        {p.type}: {p.time} ({p.method === 'QR' ? 'QR' : 'Manual'})
                      </span>
                    ))}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
