import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Scissors, QrCode, FileText, Download, Check, Sparkles, ExternalLink } from 'lucide-react';

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

  // Split workers into pages: exactly 3 per page or 6 per page
  const itemsPerPage = layoutMode === '3_PER_PAGE' ? 3 : 6;
  const pages = [];
  for (let i = 0; i < workers.length; i += itemsPerPage) {
    pages.push(workers.slice(i, i + itemsPerPage));
  }

  // Native Browser Print Dialog
  const handlePrint = () => {
    window.print();
  };

  // Open standalone clean print tab (100% immune to modal CSS / overflow restrictions)
  const handleOpenStandalonePrintTab = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${companyName} - All Staff QR Badges</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }
    .top-toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .print-btn {
      background: #10b981;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #059669;
    }
    .sheet-page {
      width: 190mm;
      margin: 20px auto;
      background: #ffffff;
      padding: 10mm;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border-radius: 12px;
      page-break-after: always;
      break-after: page;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .card-3 {
      border: 2px solid #0f172a;
      border-radius: 14px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      margin-bottom: 6px;
    }
    .cut-line {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 10px 0;
      color: #94a3b8;
      font-size: 10px;
      font-family: monospace;
    }
    .cut-line::before, .cut-line::after {
      content: "";
      flex: 1;
      border-top: 1px dashed #cbd5e1;
    }
    .cut-line span {
      padding: 0 8px;
      font-weight: 700;
    }
    .badge-pill {
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .gate-pill {
      background: #dcfce7;
      color: #166534;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid #bbf7d0;
    }
    .worker-name {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      margin: 4px 0 2px 0;
    }
    .worker-role {
      font-size: 13px;
      font-weight: 700;
      color: #475569;
    }
    .id-box {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
      margin-top: 6px;
    }
    .id-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      display: block;
      line-height: 1;
    }
    .id-val {
      font-family: monospace;
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 1px;
    }
    .qr-box {
      border: 2px solid #0f172a;
      border-radius: 10px;
      padding: 6px;
      background: #ffffff;
      text-align: center;
    }
    .qr-img {
      width: 100px;
      height: 100px;
      display: block;
    }
    .qr-caption {
      font-family: monospace;
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    @media print {
      body {
        background: #ffffff !important;
      }
      .top-toolbar {
        display: none !important;
      }
      .sheet-page {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .sheet-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      @page {
        size: A4 portrait;
        margin: 10mm 12mm;
      }
    }
  </style>
</head>
<body>
  <div class="top-toolbar">
    <div>
      <strong>${companyName}</strong> - All Staff QR Badges (${workers.length} Workers, Exactly 3 per A4 Page)
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Print All Pages (A4)</button>
  </div>

  ${pages.map((pWorkers, pIdx) => `
    <div class="sheet-page">
      <div class="sheet-header">
        <span>${companyName.toUpperCase()} • STAFF IDENTITY PASSES</span>
        <span>PAGE ${pIdx + 1} OF ${pages.length}</span>
      </div>

      ${pWorkers.map((w, wIdx) => `
        <div class="card-3">
          <div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="badge-pill">${companyName}</span>
              <span class="gate-pill">GATE PASS</span>
            </div>
            <div class="worker-name">${w.name}</div>
            <div class="worker-role">${w.designation || 'Worker'} • ${w.department || 'Production'}</div>
            <div class="id-box">
              <span class="id-label">WORKER ID</span>
              <span class="id-val">${w.id}</span>
            </div>
          </div>
          <div class="qr-box">
            <img class="qr-img" src="${qrMap[w.id] || ''}" alt="${w.id}" />
            <div class="qr-caption">${w.id}</div>
          </div>
        </div>
        ${wIdx < pWorkers.length - 1 ? `
          <div class="cut-line">
            <span>✂️ CUT ALONG LINE</span>
          </div>
        ` : ''}
      `).join('')}
    </div>
  `).join('')}

</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150 print-portal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bulk-print-modal-wrapper bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden print:bg-white print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none">
        
        {/* Modal Top Bar (Hidden during Print) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/95 print-hide">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <span>Print All Staff Badges (A4 Sheets)</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  {workers.length} Workers • {pages.length} Pages
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each A4 page fits exactly 3 large worker badges with scissors cut-lines.
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
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 print-hide">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Format:</span>
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
                <span>3 Cards / Page (A4 Large)</span>
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
              onClick={handleOpenStandalonePrintTab}
              disabled={isGenerating}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
              title="Open full page print preview in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open in New Tab</span>
            </button>

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
        <div className="bulk-print-scroll-area flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/60 print:bg-white print:p-0 print:overflow-visible">
          
          {isGenerating ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-bold text-white">Generating HD QR Badges for all {workers.length} workers...</p>
            </div>
          ) : (
            <div className="space-y-8 print:space-y-0">
              {pages.map((pageWorkers, pageIdx) => (
                <div 
                  key={pageIdx} 
                  className="print-page-sheet bg-white text-slate-900 rounded-3xl p-6 shadow-xl max-w-[210mm] mx-auto border border-slate-300 print:shadow-none print:border-none print:p-0 print:rounded-none print:max-w-none print:m-0"
                >
                  {/* Sheet Header Watermark */}
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-slate-500 text-[11px] font-bold">
                    <span>{companyName.toUpperCase()} • OFFICIAL QR ID PASSES</span>
                    <span>PAGE {pageIdx + 1} OF {pages.length}</span>
                  </div>

                  {/* Badges Layout */}
                  {layoutMode === '3_PER_PAGE' ? (
                    // 🌟 3 PER PAGE: Compact horizontal badges with cutting guide
                    <div className="space-y-2">
                      {pageWorkers.map((worker, wIdx) => (
                        <div key={worker.id} className="relative">
                          
                          {/* Badge Card */}
                          <div className="border-2 border-slate-900 rounded-2xl p-3.5 flex items-center justify-between gap-4 bg-white shadow-xs">
                            
                            {/* Left Side: Worker Details */}
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center space-x-2">
                                <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                  {companyName}
                                </span>
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-200">
                                  GATE PASS
                                </span>
                              </div>

                              <div>
                                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                                  {worker.name}
                                </h3>
                                <p className="text-xs font-bold text-slate-600 mt-0.5">
                                  {worker.designation || 'Worker'} • <span className="text-slate-500">{worker.department || 'Production'}</span>
                                </p>
                              </div>

                              <div className="pt-0.5 flex items-center space-x-3 text-xs">
                                <div className="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none">WORKER ID</span>
                                  <span className="text-base font-black font-mono text-slate-950 tracking-wider">
                                    {worker.id}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  <p>• Fast Gate Scanner Pass</p>
                                  <p>• Kranti Attendance System</p>
                                </div>
                              </div>
                            </div>

                            {/* Right Side: High-Resolution Scannable QR Code */}
                            <div className="flex flex-col items-center justify-center p-1.5 bg-white border-2 border-slate-900 rounded-xl">
                              {qrMap[worker.id] ? (
                                <img 
                                  src={qrMap[worker.id]} 
                                  alt={`QR ${worker.id}`} 
                                  className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                                />
                              ) : (
                                <div className="w-24 h-24 bg-slate-200 animate-pulse rounded-lg" />
                              )}
                              <span className="text-[10px] font-mono font-black text-slate-900 mt-0.5">
                                {worker.id}
                              </span>
                            </div>

                          </div>

                          {/* Cutting Guide Line (only between cards, not after the last card of the page) */}
                          {wIdx < pageWorkers.length - 1 && (
                            <div className="flex items-center justify-center space-x-2 my-2 text-slate-400 text-[10px] font-mono">
                              <span className="flex-1 border-t border-dashed border-slate-300"></span>
                              <span className="flex items-center space-x-1 px-2 text-slate-400 font-bold">
                                <Scissors className="w-3.5 h-3.5" />
                                <span>CUT ALONG LINE</span>
                              </span>
                              <span className="flex-1 border-t border-dashed border-slate-300"></span>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  ) : (
                    // 🌟 6 PER PAGE: 2 Columns x 3 Rows
                    <div className="grid grid-cols-2 gap-3">
                      {pageWorkers.map((worker) => (
                        <div 
                          key={worker.id}
                          className="border-2 border-dashed border-slate-400 rounded-xl p-3 flex flex-col justify-between bg-white shadow-xs"
                        >
                          <div>
                            <div className="flex items-center justify-between border-b pb-1 mb-1.5">
                              <span className="text-[9px] font-black text-slate-800 uppercase">{companyName}</span>
                              <span className="text-[9px] font-black font-mono text-indigo-600">{worker.id}</span>
                            </div>

                            <div className="text-center my-1">
                              <h4 className="text-sm font-black text-slate-900 leading-tight">{worker.name}</h4>
                              <p className="text-[10px] font-bold text-slate-600">{worker.designation || 'Worker'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-center justify-center my-1">
                            {qrMap[worker.id] && (
                              <img 
                                src={qrMap[worker.id]} 
                                alt={`QR ${worker.id}`} 
                                className="w-24 h-24 object-contain"
                              />
                            )}
                            <span className="text-xs font-mono font-black text-slate-800 tracking-wider mt-0.5">
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

      {/* Embedded Print CSS that eliminates blank pages and restores all pages */}
      <style>{`
        @media print {
          /* Hide non-print UI */
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          .print-hide {
            display: none !important;
          }

          .print-portal {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          .bulk-print-modal-wrapper {
            position: static !important;
            display: block !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
            overflow: visible !important;
          }

          .bulk-print-scroll-area {
            position: static !important;
            display: block !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .print-page-sheet {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 4mm 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }

          .print-page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
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
