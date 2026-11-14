import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, Smartphone, Clock, Building2, LogOut, User } from 'lucide-react';

export default function Navbar({ 
  currentUser, 
  onLogout, 
  activeTab, 
  setActiveTab, 
  onOpenMobileConnect, 
  settings 
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="bg-slate-900/95 backdrop-blur-md text-white shadow-md border-b border-slate-800 sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Name */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group select-none" 
            onClick={() => setActiveTab(isAdmin ? 'admin' : 'gatekeeper')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  {settings?.companyName || 'Kranti Industries'}
                </span>
                <span className="hidden sm:inline-flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Shift: 8:30 AM - 5:00 PM</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Smart QR In/Out System</p>
            </div>
          </div>

          {/* Clock & Live Status */}
          <div className="hidden lg:flex items-center space-x-2.5 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/60 text-slate-300 shadow-inner">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-100 font-mono">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-medium">
              {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Action & Role Switcher */}
          <div className="flex items-center space-x-2">
            
            {/* Connect Mobile Button */}
            <button
              onClick={onOpenMobileConnect}
              className="flex items-center space-x-1.5 bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white px-3 py-2 rounded-xl border border-slate-700/80 text-xs sm:text-sm font-semibold transition-all duration-150 shadow-sm cursor-pointer"
              title="Open Terminal on Guard Mobile Phone"
            >
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Connect Mobile</span>
            </button>

            {/* Toggle Tabs (Only visible for Admin, Guard is locked to Gatekeeper) */}
            {isAdmin && (
              <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </button>

                <button
                  onClick={() => setActiveTab('gatekeeper')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'gatekeeper'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Scanner</span>
                </button>
              </div>
            )}

            {/* User Badge & Logout */}
            <div className="flex items-center space-x-1 pl-1">
              <div className="hidden sm:flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs">
                <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-indigo-400' : 'bg-emerald-400'}`}></span>
                <span className="font-bold text-slate-200 capitalize">{currentUser?.username || 'User'}</span>
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
