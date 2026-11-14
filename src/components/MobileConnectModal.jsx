import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Wifi, Copy, Check } from 'lucide-react';
import { fetchNetworkIp } from '../utils/api';

export default function MobileConnectModal({ isOpen, onClose }) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    fetchNetworkIp().then(data => {
      setNetworkInfo(data);
      const url = data.mobileUrl || `http://${window.location.hostname}:5000`;
      QRCode.toDataURL(url, { width: 220, margin: 1 }).then(urlStr => {
        setQrDataUrl(urlStr);
      }).catch(console.error);
    }).catch(err => {
      const fallbackUrl = `http://${window.location.hostname}:5000`;
      QRCode.toDataURL(fallbackUrl, { width: 220, margin: 1 }).then(urlStr => {
        setQrDataUrl(urlStr);
      });
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const mobileUrl = networkInfo?.mobileUrl || `http://${window.location.hostname}:5000`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Connect Guard Phone</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          
          <div className="bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-2 text-left">
            <Wifi className="w-4 h-4 flex-shrink-0 text-sky-400" />
            <span>Make sure the phone and this computer are connected to the <strong>same Wi-Fi or Hotspot</strong>.</span>
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
            <p>3. It installs as a full-screen app for one-touch access at the gate!</p>
          </div>

        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
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
