import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Sparkles, Building2, Copy, Check, Download, QrCode, ShieldCheck } from 'lucide-react';

// Canvas rounded rectangle helper
function drawRoundRect(ctx, x, y, width, height, radius) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    radius = { tl: 0, tr: 0, br: 0, bl: 0, ...radius };
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
}

export default function IDCardModal({ worker, isOpen, onClose, companyName = 'Kranti Industries' }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!worker || !isOpen) {
      setQrDataUrl('');
      return;
    }

    // Clean ID format e.g. "KRA-101"
    const qrText = String(worker.id || '').trim();
    QRCode.toDataURL(qrText, {
      width: 360,
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

  // 🌟 Download FULL ID CARD (with Company Header, Photo, Name, ID, QR code, Dept)
  const handleDownloadFullBadge = async () => {
    if (!qrDataUrl || isGeneratingDownload) return;
    setIsGeneratingDownload(true);

    try {
      const canvas = document.createElement('canvas');
      const width = 640;
      const height = 940;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // 1. Background Card (White rounded card with border)
      ctx.fillStyle = '#ffffff';
      drawRoundRect(ctx, 0, 0, width, height, 36);
      ctx.fill();

      // 2. Card Header Banner (Navy gradient)
      const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
      headerGrad.addColorStop(0, '#0f172a');
      headerGrad.addColorStop(0.5, '#1e293b');
      headerGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = headerGrad;
      drawRoundRect(ctx, 0, 0, width, 140, { tl: 36, tr: 36, bl: 0, br: 0 });
      ctx.fill();

      // Top Status Indicator Dot
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(45, 52, 7, 0, Math.PI * 2);
      ctx.fill();

      // Subtitle "OFFICIAL ID PASS"
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFFICIAL IDENTITY BADGE', width / 2, 48);

      // Company Name
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText((companyName || 'KRANTI INDUSTRIES').toUpperCase(), width / 2, 88);

      // 3. Worker Avatar Circle
      const avatarY = 215;
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(width / 2, avatarY, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#a7f3d0';
      ctx.stroke();

      // Initials inside circle
      const initials = (worker.name || 'W')
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, width / 2, avatarY);
      ctx.textBaseline = 'alphabetic';

      // Worker Full Name
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(worker.name, width / 2, 312);

      // Designation
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(worker.designation || 'Staff Member', width / 2, 342);

      // Worker ID Pill Tag
      const idText = `ID: ${worker.id}`;
      ctx.font = '900 17px "Courier New", Courier, monospace';
      const textWidth = ctx.measureText(idText).width;
      const pillW = Math.max(textWidth + 40, 160);
      const pillH = 34;
      const pillX = (width - pillW) / 2;
      const pillY = 362;
      ctx.fillStyle = '#f1f5f9';
      drawRoundRect(ctx, pillX, pillY, pillW, pillH, 17);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      drawRoundRect(ctx, pillX, pillY, pillW, pillH, 17);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.fillText(idText, width / 2, pillY + 24);

      // 4. Ultra-Sharp QR Code
      const qrSize = 280;
      const qrX = (width - qrSize) / 2;
      const qrY = 422;

      // QR Background Box with subtle frame
      ctx.fillStyle = '#ffffff';
      drawRoundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 20);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      drawRoundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 20);
      ctx.stroke();

      // Load QR Image onto canvas
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';

      await new Promise((res, rej) => {
        qrImg.onload = () => {
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
          res();
        };
        qrImg.onerror = rej;
        qrImg.src = qrDataUrl;
      });

      // Label below QR
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('SCAN AT GATE TERMINAL FOR IN / OUT', width / 2, qrY + qrSize + 26);

      // Separator Line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(50, qrY + qrSize + 48);
      ctx.lineTo(width - 50, qrY + qrSize + 48);
      ctx.stroke();

      // 5. Footer info
      ctx.fillStyle = '#64748b';
      ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Dept: ${worker.department || 'General'}`, 50, qrY + qrSize + 76);

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('✓ Active Staff Member', width - 50, qrY + qrSize + 76);

      // 6. Bottom color bar
      const bottomGrad = ctx.createLinearGradient(0, 0, width, 0);
      bottomGrad.addColorStop(0, '#10b981');
      bottomGrad.addColorStop(0.5, '#14b8a6');
      bottomGrad.addColorStop(1, '#6366f1');
      ctx.fillStyle = bottomGrad;
      drawRoundRect(ctx, 0, height - 16, width, 16, { tl: 0, tr: 0, bl: 36, br: 36 });
      ctx.fill();

      // Card outer border
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      drawRoundRect(ctx, 0, 0, width, height, 36);
      ctx.stroke();

      // Convert to image and trigger download
      const fullCardUrl = canvas.toDataURL('image/png');
      const cleanName = (worker.name || 'Worker').replace(/[^a-zA-Z0-9]/g, '_');
      const a = document.createElement('a');
      a.href = fullCardUrl;
      a.download = `ID_Badge_${worker.id}_${cleanName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (e) {
      console.error('Error generating full badge image:', e);
      alert('Could not download full badge image.');
    } finally {
      setIsGeneratingDownload(false);
    }
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
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-800 no-print bg-slate-950/90 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-white">Worker QR Identity Pass</h3>
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

        {/* Printable Card Area - Compact, Fitted & 100% Fully Visible */}
        <div className="p-3 sm:p-4 flex flex-col items-center justify-center bg-slate-950/50 print-area overflow-y-auto flex-1">
          
          {/* Physical ID Badge Layout - Scaled for complete visibility */}
          <div 
            ref={cardRef}
            className="w-full max-w-[275px] sm:max-w-[310px] bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden text-slate-900 flex flex-col items-center transition-all"
          >
            {/* Badge Top Header */}
            <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3 text-center relative">
              <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <p className="text-[9px] font-black tracking-widest text-emerald-400 uppercase">OFFICIAL ID PASS</p>
              <h4 className="text-xs sm:text-sm font-black tracking-tight mt-0.5">{companyName}</h4>
            </div>

            {/* Worker Avatar & Info */}
            <div className="p-3 sm:p-4 flex flex-col items-center text-center w-full">
              
              <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-md mb-1.5 border-2 border-emerald-500/30">
                {(worker.name || 'W').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>

              <h3 className="text-base sm:text-lg font-black text-slate-950 leading-tight">{worker.name}</h3>
              <p className="text-xs font-bold text-emerald-700 mt-0.5">{worker.designation || 'Staff Member'}</p>
              
              <div 
                onClick={copyId}
                className="mt-1 bg-slate-100 hover:bg-slate-200 px-3 py-0.5 rounded-full border border-slate-300 text-[11px] font-mono font-black text-slate-800 flex items-center space-x-1 cursor-pointer transition"
                title="Click to copy ID"
              >
                <span>ID: {worker.id}</span>
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
              </div>

              {/* Ultra-Sharp QR Code */}
              <div className="mt-2.5 p-2 bg-white rounded-2xl border-2 border-slate-950 shadow-sm flex flex-col items-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR Code for ${worker.id}`} className="w-36 h-36 sm:w-42 sm:h-42 object-contain" />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-400">Generating QR...</div>
                )}
                <span className="text-[9px] font-black tracking-wider text-slate-600 mt-1 uppercase">
                  Scan at Gate Terminal
                </span>
              </div>

              {/* Footer specs */}
              <div className="w-full mt-2.5 pt-2 border-t border-slate-100 flex justify-between text-[10px] sm:text-[11px] text-slate-500 font-semibold px-1">
                <span>Dept: {worker.department || 'General'}</span>
                <span className="text-emerald-700 font-bold">✓ Active Staff</span>
              </div>

            </div>

            {/* Bottom Color Bar */}
            <div className="w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600"></div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap gap-2 no-print flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold text-xs sm:text-sm transition cursor-pointer"
          >
            Close
          </button>
          
          {/* 🌟 Download Complete ID Badge Card (Image with all details) */}
          <button
            type="button"
            onClick={handleDownloadFullBadge}
            disabled={isGeneratingDownload || !qrDataUrl}
            className="flex-1 flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
            title="Download full printable photo ID card with worker details and QR code"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingDownload ? 'Saving Card...' : 'Download Full ID Card'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            title="Print paper badge"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>

      </div>
    </div>
  );
}
