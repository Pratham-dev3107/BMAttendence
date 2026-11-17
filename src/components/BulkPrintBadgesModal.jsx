import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Scissors, QrCode, FileText, Download, Check, Sparkles } from 'lucide-react';

export default function BulkPrintBadgesModal({ isOpen, onClose, workers = [], companyName = 'Kranti Industries' }) {
  const [qrMap, setQrMap] = useState({});
  const [layoutMode, setLayoutMode] = useState('3_PER_PAGE'); // '3_PER_PAGE' | '6_PER_PAGE'
  const [isGenerating, setIsGenerating] = useState(true);

  // Generate QR code data URLs for all workers
  useEffect(() => {
    if (!isOpen || workers.length === 0) return;
    setIsGenerating(true);

    const generateQRs = async () => {
      const map = {};
      await Promise.all(
        workers.map(async (w) => {
          try {
            const url = await QRCode.toDataURL(String(w.id || '').trim(), {
              width: 320,
              margin: 1,
              errorCorrectionLevel: 'H',
              color: { dark: '#000000', light: '#ffffff' }
            });
            map[w.id] = url;
          } catch (e) {
            console.error('QR generation error for', w.id, e);
          }
        })
      );
      setQrMap(map);
      setIsGenerating(false);
    };

    generateQRs();
  }, [isOpen, workers]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Split workers into pages
  const itemsPerPage = layoutMode === '3_PER_PAGE' ? 3 : 6;
  const pages = [];
  for (let i = 0; i < workers.length; i += itemsPerPage) {
    pages.push(workers.slice(i, i + itemsPerPage));
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Top Bar (Hidden during Print) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <span>Print All Staff Badges (A4 Sheets)</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  {workers.length} Workers
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Print on A4 paper or card sheet, cut along dashed lines, and laminate for gate scanning.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Layout Switcher (Hidden during Print) */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Layout:</span>
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setLayoutMode('3_PER_PAGE')}
                className={`py-1.5 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
                  layoutMode === '3_PER_PAGE'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>3 Cards / Page (Large Badges)</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('6_PER_PAGE')}
                className={`py-1.5 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
                  layoutMode === '6_PER_PAGE'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>6 Cards / Page (Pocket Size)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print All (A4 Sheet / PDF)</span>
            </button>
          </div>
        </div>

        {/* Printable Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/60 print:bg-white print:p-0 print:overflow-visible">
          
          {isGenerating ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-bold text-white">Generating HD QR Badges for all workers...</p>
            </div>
          ) : (
            <div className="space-y-8 print:space-y-0">
              {pages.map((pageWorkers, pageIdx) => (
                <div 
                  key={pageIdx} 
                  className="bg-white text-slate-900 rounded-3xl p-6 shadow-xl max-w-[210mm] mx-auto border border-slate-300 print:shadow-none print:border-none print:p-0 print:rounded-none print:max-w-none print:page-break-after"
                  style={{ minHeight: '270mm' }}
                >
                  {/* Sheet Header Watermark (Subtle) */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 text-slate-500 text-[11px] font-bold">
                    <span>{companyName.toUpperCase()} • OFFICIAL QR ID PASSES</span>
                    <span>PAGE {pageIdx + 1} OF {pages.length}</span>
                  </div>

                  {/* Badges Layout */}
                  {layoutMode === '3_PER_PAGE' ? (
                    // 🌟 3 PER PAGE: Wide horizontal badges with cutting guide
                    <div className="space-y-4">
                      {pageWorkers.map((worker) => (
                        <div key={worker.id} className="relative group">
                          
                          {/* Badge Card */}
                          <div className="border-2 border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 bg-white shadow-xs hover:border-emerald-600 transition">
                            
                            {/* Left Side: Worker Details */}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center space-x-2">
                                <span className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                  {companyName}
                                </span>
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-200">
                                  STAFF PASS
                                </span>
                              </div>

                              <div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                                  {worker.name}
                                </h3>
                                <p className="text-sm font-bold text-slate-600 mt-0.5">
                                  {worker.designation || 'Worker'} • <span className="text-slate-500">{worker.department || 'Production'}</span>
                                </p>
                              </div>

                              <div className="pt-1 flex items-center space-x-3 text-xs">
                                <div className="bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none">WORKER ID</span>
                                  <span className="text-base font-black font-mono text-indigo-700 tracking-wider">
                                    {worker.id}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  <p>• Fast Gate Scanner Pass</p>
                                  <p>• Kranti Attendance System</p>
                                </div>
                              </div>
                            </div>

                            {/* Right Side: High-Resolution Scannable QR Code */}
                            <div className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-200 rounded-xl">
                              {qrMap[worker.id] ? (
                                <img 
                                  src={qrMap[worker.id]} 
                                  alt={`QR ${worker.id}`} 
                                  className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                                />
                              ) : (
                                <div className="w-28 h-28 bg-slate-200 animate-pulse rounded-lg" />
                              )}
                              <span className="text-[10px] font-mono font-black text-slate-600 mt-1">
                                {worker.id}
                              </span>
                            </div>

                          </div>

                          {/* Cutting Guide Line */}
                          <div className="flex items-center justify-center space-x-2 my-2.5 text-slate-400 text-[10px] font-mono print:text-slate-400">
                            <span className="flex-1 border-t-2 border-dashed border-slate-300"></span>
                            <span className="flex items-center space-x-1 px-2 text-slate-400 font-bold">
                              <Scissors className="w-3.5 h-3.5" />
                              <span>CUT ALONG LINE</span>
                            </span>
                            <span className="flex-1 border-t-2 border-dashed border-slate-300"></span>
                          </div>

                        </div>
                      ))}
                    </div>
                  ) : (
                    // 🌟 6 PER PAGE: 2 Columns x 3 Rows (Standard Card Size 54mm x 86mm)
                    <div className="grid grid-cols-2 gap-4">
                      {pageWorkers.map((worker) => (
                        <div 
                          key={worker.id}
                          className="border-2 border-dashed border-slate-400 rounded-2xl p-4 flex flex-col justify-between bg-white shadow-xs relative"
                        >
                          <div>
                            <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                              <span className="text-[9px] font-black text-slate-800 uppercase">{companyName}</span>
                              <span className="text-[9px] font-black font-mono text-indigo-600">{worker.id}</span>
                            </div>

                            <div className="text-center my-2">
                              <h4 className="text-base font-black text-slate-900 leading-tight">{worker.name}</h4>
                              <p className="text-[11px] font-bold text-slate-600">{worker.designation || 'Worker'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-center justify-center my-1">
                            {qrMap[worker.id] && (
                              <img 
                                src={qrMap[worker.id]} 
                                alt={`QR ${worker.id}`} 
                                className="w-28 h-28 object-contain"
                              />
                            )}
                            <span className="text-xs font-mono font-black text-slate-800 tracking-wider mt-1">
                              {worker.id}
                            </span>
                          </div>

                          <div className="text-center pt-1 border-t border-slate-200 text-[9px] text-slate-500 font-bold">
                            Kranti Attendance • Gate ID Pass
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* Embedded Print CSS for exact A4 rendering */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }
          .fixed, .fixed * {
            visibility: visible;
          }
          .fixed {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
        }
      `}</style>
    </div>
  );
}
