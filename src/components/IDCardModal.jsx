import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Download, Sparkles, Building2 } from 'lucide-react';

export default function IDCardModal({ worker, isOpen, onClose, companyName = 'Kranti Industries' }) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!worker || !isOpen) return;

    // The QR contains standard identifier: e.g. "WORKER:KRA-101"
    const qrText = `WORKER:${worker.id}`;
    QRCode.toDataURL(qrText, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(url => {
      setQrDataUrl(url);
    }).catch(err => {
      console.error('QR generation error:', err);
    });
  }, [worker, isOpen]);

  if (!isOpen || !worker) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 no-print">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Worker QR Identity Pass</span>
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Card Area */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-950/50 print-area">
          
          {/* Physical ID Badge Layout */}
          <div className="w-[300px] bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden text-slate-900 flex flex-col items-center">
            
            {/* Badge Top Header */}
            <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3.5 text-center relative">
              <div className="absolute top-2.5 left-3 w-2 h-2 rounded-full bg-emerald-400"></div>
              <p className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">OFFICIAL ID PASS</p>
              <h4 className="text-sm font-black tracking-tight">{companyName}</h4>
            </div>

            {/* Worker Avatar & Info */}
            <div className="p-4 flex flex-col items-center text-center w-full">
              
              <div className="w-18 h-18 rounded-full bg-emerald-600 text-white font-black text-2xl flex items-center justify-center shadow-md mb-2 border-4 border-white">
                {worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>

              <h3 className="text-lg font-black text-slate-950 leading-tight">{worker.name}</h3>
              <p className="text-xs font-bold text-emerald-700 mt-0.5">{worker.designation}</p>
              
              <div className="mt-1 bg-slate-100 px-3 py-0.5 rounded-full border border-slate-300 text-[11px] font-mono font-extrabold text-slate-800">
                ID: {worker.id}
              </div>

              {/* QR Code */}
              <div className="mt-4 p-2.5 bg-white rounded-xl border-2 border-slate-900 shadow-xs flex flex-col items-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR Code for ${worker.id}`} className="w-36 h-36" />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-400">Generating QR...</div>
                )}
                <span className="text-[10px] font-black tracking-wider text-slate-500 mt-1 uppercase">
                  Scan at Gate Terminal
                </span>
              </div>

              {/* Footer specs */}
              <div className="w-full mt-4 pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-500 font-medium px-2">
                <span>Dept: {worker.department}</span>
                <span>Active Employee</span>
              </div>

            </div>

            {/* Bottom Color Bar */}
            <div className="w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600"></div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-3 no-print">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold text-sm transition cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print ID Card</span>
          </button>
        </div>

      </div>
    </div>
  );
}
