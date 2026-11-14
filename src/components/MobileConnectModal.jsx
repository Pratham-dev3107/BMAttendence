import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Wifi, Copy, Check } from 'lucide-react';
import { fetchNetworkIp } from '../utils/api';

export default function MobileConnectModal({ isOpen, onClose }) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Compute best mobile URL
  const getMobileUrl = (info) => {
    // If running in HTTPS or deployed on Vercel/cloud, use exact origin
    if (typeof window !== 'undefined' && (window.location.protocol === 'https:' || !window.location.port || window.location.hostname.includes('vercel.app'))) {
      return window.location.origin;
    }
    // If local network IP was retrieved
    if (info?.mobileUrl) return info.mobileUrl;
    if (info?.ip && info.ip !== '127.0.0.1' && info.ip !== 'localhost') {
      return `http://${info.ip}:${info.port || 5000}`;
    }
    return `http://${window.location.hostname}:${window.location.port || 5000}`;
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchNetworkIp().then(data => {
      setNetworkInfo(data);
      const url = getMobileUrl(data);
      QRCode.toDataURL(url, { width: 240, margin: 1 }).then(urlStr => {
        setQrDataUrl(urlStr);
      }).catch(console.error);
    }).catch(err => {
      const fallbackUrl = getMobileUrl(null);
      QRCode.toDataURL(fallbackUrl, { width: 240, margin: 1 }).then(urlStr => {
        setQrDataUrl(urlStr);
      });
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const mobileUrl = getMobileUrl(networkInfo);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Connect Guard Phone</h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center space-y-4 overflow-y-auto">
          
          <div className="bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-2 text-left w-full">
            <Wifi className="w-4 h-4 flex-shrink-0 text-sky-400" />
            <span>Scan this QR with phone camera to open the Gate Terminal on mobile.</span>
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-3 rounded-2xl border-4 border-slate-800 shadow-xl">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Mobile Connect QR" className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">Loading QR...</div>
            )}
          </div>

          <div className="w-full">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Or open this URL on mobile browser:</p>
            <div className="flex items-center space-x-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <span className="font-mono text-xs font-bold text-emerald-400 flex-1 truncate select-all">{mobileUrl}</span>
              <button 
                type="button"
                onClick={copyToClipboard}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                title="Copy URL"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 w-full text-xs text-slate-400 space-y-1.5">
            <p className="font-bold text-slate-200">💡 Installation Pro Tip:</p>
            <p>1. Open this link in Chrome or Safari on the phone.</p>
            <p>2. Tap the browser menu and select <strong className="text-white">"Add to Home Screen"</strong>.</p>
            <p>3. It installs as a full-screen app for instant one-touch access at the gate!</p>
          </div>

        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
