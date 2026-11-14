import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Sparkles, Building2, Copy, Check, Download } from 'lucide-react';

export default function IDCardModal({ worker, isOpen, onClose, companyName = 'Kranti Industries' }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!worker || !isOpen) {
      setQrDataUrl('');
      return;
    }

    // Clean ID format e.g. "KRA-101"
    const qrText = String(worker.id || '');
    QRCode.toDataURL(qrText, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'H', // 30% error correction: scans instantly even with reflections/glare
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(url => {
      setQrDataUrl(url);
    }).catch(err => {
      console.error('QR generation error:', err);
    });

    // Escape key listener to close
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [worker, isOpen, onClose]);

  if (!isOpen || !worker) return null;

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Print error:', e);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_Badge_${worker.id}_${worker.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyId = () => {
    try {
      navigator.clipboard.writeText(worker.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 no-print bg-slate-950/90">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Worker QR Identity Pass</h3>
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

        {/* Printable Card Area */}
        <div className="p-5 flex flex-col items-center justify-center bg-slate-950/50 print-area overflow-y-auto">
          
          {/* Physical ID Badge Layout */}
          <div 
            ref={cardRef}
            className="w-[290px] sm:w-[310px] bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden text-slate-900 flex flex-col items-center"
          >
            {/* Badge Top Header */}
            <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3.5 text-center relative">
              <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <p className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">OFFICIAL ID PASS</p>
              <h4 className="text-sm font-black tracking-tight mt-0.5">{companyName}</h4>
            </div>

            {/* Worker Avatar & Info */}
            <div className="p-4 sm:p-5 flex flex-col items-center text-center w-full">
              
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white font-black text-2xl flex items-center justify-center shadow-lg mb-2 border-2 border-emerald-500/30">
                {worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>

              <h3 className="text-lg font-black text-slate-950 leading-tight">{worker.name}</h3>
              <p className="text-xs font-bold text-emerald-700 mt-0.5">{worker.designation}</p>
              
              <div 
                onClick={copyId}
                className="mt-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-0.5 rounded-full border border-slate-300 text-xs font-mono font-black text-slate-800 flex items-center space-x-1 cursor-pointer transition"
                title="Click to copy ID"
              >
                <span>ID: {worker.id}</span>
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
              </div>

              {/* Ultra-Sharp QR Code */}
              <div className="mt-3 p-2 bg-white rounded-2xl border-2 border-slate-950 shadow-md flex flex-col items-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR Code for ${worker.id}`} className="w-40 h-40 object-contain" />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">Generating QR...</div>
                )}
                <span className="text-[10px] font-black tracking-wider text-slate-600 mt-1 uppercase">
                  Scan at Gate Terminal
                </span>
              </div>

              {/* Footer specs */}
              <div className="w-full mt-3.5 pt-2.5 border-t border-slate-100 flex justify-between text-[11px] text-slate-500 font-semibold px-2">
                <span>Dept: {worker.department}</span>
                <span className="text-emerald-700 font-bold">Active Staff</span>
              </div>

            </div>

            {/* Bottom Color Bar */}
            <div className="w-full h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600"></div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap gap-2 no-print">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[80px] px-3.5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold text-xs sm:text-sm transition cursor-pointer"
          >
            Close
          </button>
          
          <button
            type="button"
            onClick={handleDownloadQR}
            className="flex-1 flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
            title="Download QR code image to send on WhatsApp"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Pass</span>
          </button>
        </div>

      </div>
    </div>
  );
}
