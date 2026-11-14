import React, { useState } from 'react';
import { Building2, ShieldCheck, UserCheck, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import { loginUser } from '../utils/api';

export default function LoginView({ onLoginSuccess, companyName = 'Kranti Industries' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await loginUser(username.trim(), password.trim());
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (user, pass) => {
    setUsername(user);
    setPassword(pass);
    try {
      setLoading(true);
      setError(null);
      const res = await loginUser(user, pass);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-center items-center p-4">
      
      {/* Background ambient glow */}
      <div className="absolute w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative backdrop-blur-xl z-10">
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-xl shadow-emerald-500/20 mb-3">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{companyName}</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Smart Attendance & Automated Payroll System</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 bg-rose-950/80 border border-rose-600/80 text-rose-300 text-xs font-semibold px-4 py-2.5 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="guard or admin"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-600/25 active:scale-98 transition cursor-pointer"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Click Quick Demo Sign-in */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center mb-3 flex items-center justify-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>1-Click Demo Login</span>
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickLogin('guard', 'guard123')}
              className="flex flex-col items-center p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-800/80 transition active:scale-95 text-center cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Gatekeeper</span>
              <span className="text-[10px] text-slate-500">guard / guard123</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="flex flex-col items-center p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-800/80 transition active:scale-95 text-center cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Admin</span>
              <span className="text-[10px] text-slate-500">admin / admin123</span>
            </button>
          </div>
        </div>

      </div>

      <p className="text-xs text-slate-500 mt-6 text-center">
        Kranti Attendance System • Standard Shift 8:30 AM - 5:00 PM
      </p>

    </div>
  );
}

