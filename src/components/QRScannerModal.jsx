import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  X, Camera, CheckCircle2, AlertCircle, ArrowDownCircle, 
  ArrowUpCircle, Keyboard, SwitchCamera, Zap, ZapOff, Sparkles 
} from 'lucide-react';
import { playBeepSound, playPunchInSound, playPunchOutSound, playErrorSound } from '../utils/sound';

export default function QRScannerModal({ isOpen, onClose, onPunchSuccess, workers = [] }) {
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      setScanResult(null);
      setErrorMsg(null);
      return;
    }

    let isSubscribed = true;

    async function initAndStart() {
      try {
        // Enumerate cameras
        let cameras = [];
        try {
          cameras = await Html5Qrcode.getCameras();
          if (isSubscribed) {
            setAvailableCameras(cameras || []);
          }
        } catch (e) {
          console.warn('Could not enumerate cameras:', e);
        }

        const html5QrCode = new Html5Qrcode('qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
        scannerRef.current = html5QrCode;

        // Dynamic responsive qrbox sizing
        const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(180, Math.min(280, Math.floor(minEdge * 0.75)));
          return { width: size, height: size };
        };

        const config = {
          fps: 20, // High-speed sampling
          qrbox: qrboxFunction,
          aspectRatio: 1.0,
          showTorchButtonIfSupported: false
        };

        // Determine camera target: prefer back/environment camera
        let cameraConfig = { facingMode: 'environment' };
        if (cameras && cameras.length > 0) {
          // Find back camera if possible
          const backCam = cameras.find(c => 
            c.label.toLowerCase().includes('back') || 
            c.label.toLowerCase().includes('rear') || 
            c.label.toLowerCase().includes('environment')
          );
          cameraConfig = backCam ? { deviceId: { exact: backCam.id } } : { deviceId: { exact: cameras[0].id } };
        }

        await html5QrCode.start(
          cameraConfig,
          config,
          (decodedText) => {
            if (isSubscribed) {
              handleCodeScanned(decodedText);
            }
          },
          () => {} // Silent on individual frame non-detections
        );

        if (isSubscribed) {
          setCameraActive(true);
          // Check torch capability
          try {
            const capabilities = html5QrCode.getRunningTrackCapabilities();
            if (capabilities && capabilities.torch) {
              setTorchSupported(true);
            }
          } catch {
            setTorchSupported(false);
          }
        }
      } catch (err) {
        console.error('Camera start error:', err);
        if (isSubscribed) {
          setErrorMsg('Camera access unavailable or blocked. Please allow camera permissions or type ID below.');
        }
      }
    }

    const timer = setTimeout(() => {
      initAndStart();
    }, 150);

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
    setTorchOn(false);
  };

  // Switch camera between front and back
  const handleSwitchCamera = async () => {
    if (!scannerRef.current || availableCameras.length < 2) return;
    try {
      const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
      setCurrentCameraIndex(nextIndex);
      const nextCam = availableCameras[nextIndex];

      await scannerRef.current.stop();
      await scannerRef.current.start(
        { deviceId: { exact: nextCam.id } },
        {
          fps: 20,
          qrbox: (w, h) => {
            const minEdge = Math.min(w, h);
            const size = Math.max(180, Math.min(280, Math.floor(minEdge * 0.75)));
            return { width: size, height: size };
          },
          aspectRatio: 1.0
        },
        handleCodeScanned,
        () => {}
      );
    } catch (e) {
      console.warn('Switch camera error:', e);
    }
  };

  // Toggle Torch/Flash
  const handleToggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Smart worker code parser
  const parseWorkerCode = (rawText) => {
    if (!rawText) return null;
    let code = rawText.trim();

    // Strip prefix like "WORKER:" or "ID:"
    if (code.toUpperCase().startsWith('WORKER:')) {
      code = code.substring(7).trim();
    } else if (code.toUpperCase().startsWith('ID:')) {
      code = code.substring(3).trim();
    }

    // Try finding direct match in workers list
    const exactMatch = workers.find(w => 
      w.id.toUpperCase() === code.toUpperCase() ||
      w.id.toUpperCase() === `KRA-${code}`.toUpperCase()
    );

    if (exactMatch) return exactMatch.id;

    // Fallback: If numeric only (e.g. "101")
    if (!isNaN(code) && !code.toUpperCase().startsWith('KRA-')) {
      return `KRA-${code}`;
    }

    return code.toUpperCase();
  };

  const handleCodeScanned = async (rawCode) => {
    if (isProcessing) return;
    setIsProcessing(true);

    // Pause camera scanning during punch feedback
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        scannerRef.current.pause(true);
      } catch (e) {
        console.warn(e);
      }
    }

    try {
      const workerId = parseWorkerCode(rawCode);
      if (!workerId) throw new Error('Invalid QR code scanned');

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

      // Show result overlay for 1.8 seconds, then resume scanning
      setTimeout(() => {
        setScanResult(null);
        setIsProcessing(false);
        if (scannerRef.current) {
          try {
            scannerRef.current.resume();
          } catch (e) {
            console.warn(e);
          }
        }
      }, 1800);

    } catch (err) {
      playErrorSound();
      setErrorMsg(err.message || 'Worker not recognized in system');
      setTimeout(() => {
        setErrorMsg(null);
        setIsProcessing(false);
        if (scannerRef.current) {
          try {
            scannerRef.current.resume();
          } catch (e) {
            console.warn(e);
          }
        }
      }, 2000);
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white leading-tight">Instant QR Scanner</h3>
              <p className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Active 20 FPS Scanner</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {/* Camera switch if multiple */}
            {availableCameras.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Switch Camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            {/* Torch toggle */}
            {torchSupported && (
              <button
                onClick={handleToggleTorch}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  torchOn ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Toggle Flash"
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera / Scan Feed Viewport */}
        <div className="relative p-3 flex-1 flex flex-col items-center justify-center bg-black min-h-[320px] overflow-hidden">
          
          {/* QR Viewfinder container */}
          <div className="relative w-full max-w-[320px] rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-black">
            <div id="qr-reader" className="w-full"></div>
            
            {/* Animated Laser Scanning Line */}
            {cameraActive && !scanResult && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse"></div>
                {/* Visual Viewfinder Corners */}
                <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg"></div>
                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg"></div>
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg"></div>
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg"></div>
              </div>
            )}
          </div>

          {/* Success Result Overlay */}
          {scanResult && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in zoom-in duration-200">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-3.5 shadow-2xl ${
                scanResult.punchType === 'IN' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400 shadow-emerald-500/30' 
                  : 'bg-rose-500/20 text-rose-400 border-2 border-rose-400 shadow-rose-500/30'
              }`}>
                {scanResult.punchType === 'IN' ? (
                  <ArrowDownCircle className="w-12 h-12 text-emerald-400" />
                ) : (
                  <ArrowUpCircle className="w-12 h-12 text-rose-400" />
                )}
              </div>
              <h4 className="text-2xl font-black text-white tracking-tight">{scanResult.worker?.name}</h4>
              <p className="text-sm font-semibold text-slate-400 mb-3">{scanResult.worker?.designation} • ID: {scanResult.worker?.id}</p>
              
              <div className={`inline-flex items-center space-x-2.5 px-6 py-2.5 rounded-2xl text-base font-black uppercase tracking-wider shadow-xl ${
                scanResult.punchType === 'IN' ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/40' : 'bg-rose-500 text-white shadow-rose-500/40'
              }`}>
                <span>{scanResult.punchType === 'IN' ? 'PUNCHED IN' : 'PUNCHED OUT'}</span>
                <span>•</span>
                <span className="font-mono">{scanResult.time}</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="absolute bottom-4 left-4 right-4 bg-rose-950/95 border border-rose-600 text-rose-200 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center space-x-2.5 z-30 shadow-2xl">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-2.5 text-center font-medium">
            Hold worker badge 6–10 inches from camera
          </p>
        </div>

        {/* Manual ID Input Fallback */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800">
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
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold px-5 py-2.5 rounded-xl text-sm transition cursor-pointer"
            >
              Punch
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
