import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CheckCircle2, AlertCircle, ArrowDownCircle, ArrowUpCircle, Keyboard } from 'lucide-react';
import { playBeepSound, playPunchInSound, playPunchOutSound, playErrorSound } from '../utils/sound';

export default function QRScannerModal({ isOpen, onClose, onPunchSuccess, workers }) {
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      setScanResult(null);
      setErrorMsg(null);
      return;
    }

    let isSubscribed = true;

    async function startScanner() {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isSubscribed) {
              handleCodeScanned(decodedText);
            }
          },
          () => {}
        );
        if (isSubscribed) {
          setCameraActive(true);
        }
      } catch (err) {
        console.error('Camera start error:', err);
        if (isSubscribed) {
          setErrorMsg('Camera access unavailable. You can enter the Worker ID below.');
        }
      }
    }

    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        }).catch(err => console.warn(err));
      } else {
        scannerRef.current = null;
      }
    }
    setCameraActive(false);
  };

  const handleCodeScanned = async (rawCode) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      let workerId = rawCode.trim();
      if (workerId.startsWith('WORKER:')) {
        workerId = workerId.replace('WORKER:', '').trim();
      } else if (!workerId.startsWith('KRA-') && !isNaN(workerId)) {
        workerId = `KRA-${workerId}`;
      }

      playBeepSound();

      // Punch API call with 'AUTO' toggle
      const result = await onPunchSuccess(workerId, 'AUTO', 'QR');

      if (result.punchType === 'IN') {
        playPunchInSound();
      } else {
        playPunchOutSound();
      }

      setScanResult({
        success: true,
        worker: result.worker,
        punchType: result.punchType,
        time: result.punchTime
      });

      // Show result overlay then continue scanning
      setTimeout(() => {
        setScanResult(null);
        setIsProcessing(false);
      }, 2000);

    } catch (err) {
      playErrorSound();
      setErrorMsg(err.message || 'Worker not recognized');
      setTimeout(() => {
        setErrorMsg(null);
        setIsProcessing(false);
      }, 2500);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeScanned(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Scan Worker QR Badge</h3>
              <p className="text-[11px] text-slate-400">Automatic In / Out punch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera / Scan Feed */}
        <div className="relative p-4 flex-1 flex flex-col items-center justify-center bg-black min-h-[300px]">
          
          <div id="qr-reader" className="w-full max-w-[300px] rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner"></div>

          {/* Success Result Overlay */}
          {scanResult && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in zoom-in duration-200">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-xl ${
                scanResult.punchType === 'IN' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500' 
                  : 'bg-rose-500/20 text-rose-400 border-2 border-rose-500'
              }`}>
                {scanResult.punchType === 'IN' ? (
                  <ArrowDownCircle className="w-10 h-10 text-emerald-400" />
                ) : (
                  <ArrowUpCircle className="w-10 h-10 text-rose-400" />
                )}
              </div>
              <h4 className="text-2xl font-black text-white">{scanResult.worker?.name}</h4>
              <p className="text-sm font-semibold text-slate-400 mb-3">{scanResult.worker?.designation} • {scanResult.worker?.id}</p>
              
              <div className={`inline-flex items-center space-x-2 px-5 py-2 rounded-xl text-sm font-extrabold uppercase tracking-wide shadow-lg ${
                scanResult.punchType === 'IN' ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30' : 'bg-rose-500 text-white shadow-rose-500/30'
              }`}>
                <span>{scanResult.punchType === 'IN' ? 'GATE IN' : 'GATE OUT'}</span>
                <span>•</span>
                <span className="font-mono">{scanResult.time}</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="absolute bottom-4 left-4 right-4 bg-rose-950/90 border border-rose-600 text-rose-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center space-x-2 z-20">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3 text-center font-medium">
            Position QR code inside the frame to scan
          </p>
        </div>

        {/* Manual ID Input Fallback */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or type ID (e.g. KRA-101 or 101)..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim() || isProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition cursor-pointer"
            >
              Punch
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
