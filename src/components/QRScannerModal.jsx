import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { 
  X, Camera, CheckCircle2, AlertCircle, ArrowDownCircle, 
  ArrowUpCircle, Keyboard, SwitchCamera, Zap, ZapOff, Sparkles, LogIn, LogOut, RefreshCw 
} from 'lucide-react';
import { playBeepSound, playPunchInSound, playPunchOutSound, playErrorSound, triggerHaptic } from '../utils/sound';

export default function QRScannerModal({ isOpen, onClose, onPunchSuccess, workers = [] }) {
  // Mode: 'IN' (Morning gate) | 'OUT' (Evening gate) | 'AUTO'
  const [punchMode, setPunchMode] = useState('IN');
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastScannedCodeRef = useRef({ code: '', time: 0 });

  // 1. Camera Initialization & Lifecycle
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanResult(null);
      setErrorMsg(null);
      return;
    }

    let isSubscribed = true;

    async function startCamera() {
      try {
        // Enumerate video input devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (isSubscribed) {
          setAvailableCameras(videoDevices);
        }

        // Constraints: prefer back camera
        let videoConstraints = {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };

        if (selectedCameraId) {
          videoConstraints = { deviceId: { exact: selectedCameraId } };
        } else if (videoDevices.length > 0) {
          const backCam = videoDevices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('environment')
          );
          if (backCam) {
            videoConstraints = { deviceId: { exact: backCam.id } };
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });

        if (!isSubscribed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setCameraActive(true);

          // Check torch capability
          const track = stream.getVideoTracks()[0];
          const capabilities = track?.getCapabilities ? track.getCapabilities() : {};
          setTorchSupported(!!capabilities.torch);

          // Start continuous QR detection loop
          startDetectionLoop();
        }
      } catch (err) {
        console.error('Camera error:', err);
        if (isSubscribed) {
          setErrorMsg('Camera access unavailable. Please grant camera permission or enter Worker ID manually.');
        }
      }
    }

    startCamera();

    return () => {
      isSubscribed = false;
      stopCamera();
    };
  }, [isOpen, selectedCameraId]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  };

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch error:', e);
    }
  };

  // Switch between available cameras
  const handleSwitchCamera = () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCameraId(availableCameras[nextIndex].deviceId);
  };

  // 2. High-Speed Frame Analysis Loop (BarcodeDetector + jsQR)
  const startDetectionLoop = () => {
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let detector = null;
    if (hasBarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        detector = null;
      }
    }

    let lastTick = 0;

    const tick = async (timestamp) => {
      if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // Throttle analysis to ~20 FPS (every 50ms) to conserve CPU
      if (timestamp - lastTick > 50 && !isProcessing) {
        lastTick = timestamp;

        try {
          const video = videoRef.current;
          const width = video.videoWidth;
          const height = video.videoHeight;

          let detectedText = null;

          // Priority 1: Native Hardware BarcodeDetector (Chrome/Android 60fps)
          if (detector) {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0) {
              detectedText = barcodes[0].rawValue;
            }
          }

          // Priority 2: Pure JS jsQR engine on offscreen canvas
          if (!detectedText && canvasRef.current && width > 0 && height > 0) {
            const canvas = canvasRef.current;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const qr = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (qr && qr.data) {
              detectedText = qr.data;
            }
          }

          if (detectedText) {
            handleDecodedCode(detectedText);
          }
        } catch (e) {
          // Ignore individual frame parse errors
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  // 3. Worker Code Parsing & Verification
  const parseWorkerCode = (rawText) => {
    if (!rawText) return null;
    let code = rawText.trim();

    if (code.toUpperCase().startsWith('WORKER:')) {
      code = code.substring(7).trim();
    } else if (code.toUpperCase().startsWith('ID:')) {
      code = code.substring(3).trim();
    }

    const exactMatch = workers.find(w => 
      w.id.toUpperCase() === code.toUpperCase() ||
      w.id.toUpperCase() === `KRA-${code}`.toUpperCase()
    );

    if (exactMatch) return exactMatch.id;

    if (!isNaN(code) && !code.toUpperCase().startsWith('KRA-')) {
      return `KRA-${code}`;
    }

    return code.toUpperCase();
  };

  const handleDecodedCode = async (rawCode) => {
    const now = Date.now();
    // Prevent re-triggering on same QR within 2.5 seconds
    if (lastScannedCodeRef.current.code === rawCode && (now - lastScannedCodeRef.current.time) < 2500) {
      return;
    }

    lastScannedCodeRef.current = { code: rawCode, time: now };
    setIsProcessing(true);

    try {
      const workerId = parseWorkerCode(rawCode);
      if (!workerId) throw new Error('Unrecognized QR code format');

      playBeepSound();

      // Submit punch with currently chosen punchMode: 'IN', 'OUT', or 'AUTO'
      const result = await onPunchSuccess(workerId, punchMode, 'QR');

      if (result.alreadyPunched) {
        triggerHaptic([30, 30]);
      } else if (result.punchType === 'IN') {
        playPunchInSound();
      } else {
        playPunchOutSound();
      }

      setScanResult({
        success: true,
        alreadyPunched: !!result.alreadyPunched,
        message: result.message,
        worker: result.worker,
        punchType: result.punchType,
        time: result.punchTime
      });

      // Show result overlay for 1.8 seconds, then ready for next
      setTimeout(() => {
        setScanResult(null);
        setIsProcessing(false);
      }, 1800);

    } catch (err) {
      playErrorSound();
      setErrorMsg(err.message || 'Worker not found in database');
      setTimeout(() => {
        setErrorMsg(null);
        setIsProcessing(false);
      }, 2200);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedCode(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Hidden offscreen canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-tight">High-Speed Scanner</h3>
              <p className="text-[11px] text-emerald-400 font-bold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Ready to Scan</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {availableCameras.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Switch Camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            {torchSupported && (
              <button
                onClick={handleToggleTorch}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  torchOn ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Flash / Torch"
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

        {/* 🌟 PUNCH MODE SELECTOR (Clear & Explicit) */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Punch Mode:</span>
          
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 flex-1 justify-end max-w-[260px]">
            <button
              type="button"
              onClick={() => setPunchMode('IN')}
              className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                punchMode === 'IN'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>CHECK IN</span>
            </button>

            <button
              type="button"
              onClick={() => setPunchMode('OUT')}
              className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                punchMode === 'OUT'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>CHECK OUT</span>
            </button>

            <button
              type="button"
              onClick={() => setPunchMode('AUTO')}
              className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                punchMode === 'AUTO'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>AUTO</span>
            </button>
          </div>
        </div>

        {/* Live Camera Viewfinder */}
        <div className="relative p-3 flex-1 flex flex-col items-center justify-center bg-black min-h-[300px] overflow-hidden">
          
          <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border-2 border-slate-700 bg-black flex items-center justify-center">
            <video 
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted
            />

            {/* Viewfinder Target Reticle */}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
              {/* Corner brackets */}
              <div className="flex justify-between">
                <div className={`w-8 h-8 border-t-4 border-l-4 rounded-tl-xl transition-colors ${
                  punchMode === 'IN' ? 'border-emerald-400' : punchMode === 'OUT' ? 'border-rose-400' : 'border-indigo-400'
                }`}></div>
                <div className={`w-8 h-8 border-t-4 border-r-4 rounded-tr-xl transition-colors ${
                  punchMode === 'IN' ? 'border-emerald-400' : punchMode === 'OUT' ? 'border-rose-400' : 'border-indigo-400'
                }`}></div>
              </div>

              {/* Animated Laser Scanning Line */}
              {cameraActive && !scanResult && (
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-pulse"></div>
              )}

              <div className="flex justify-between">
                <div className={`w-8 h-8 border-b-4 border-l-4 rounded-bl-xl transition-colors ${
                  punchMode === 'IN' ? 'border-emerald-400' : punchMode === 'OUT' ? 'border-rose-400' : 'border-indigo-400'
                }`}></div>
                <div className={`w-8 h-8 border-b-4 border-r-4 rounded-br-xl transition-colors ${
                  punchMode === 'IN' ? 'border-emerald-400' : punchMode === 'OUT' ? 'border-rose-400' : 'border-indigo-400'
                }`}></div>
              </div>
            </div>
          </div>

          {/* Success / Status Overlay Banner */}
          {scanResult && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in zoom-in duration-200">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-3 shadow-2xl ${
                scanResult.alreadyPunched
                  ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-400'
                  : scanResult.punchType === 'IN' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400 shadow-emerald-500/30' 
                    : 'bg-rose-500/20 text-rose-400 border-2 border-rose-400 shadow-rose-500/30'
              }`}>
                {scanResult.alreadyPunched ? (
                  <CheckCircle2 className="w-12 h-12 text-amber-400" />
                ) : scanResult.punchType === 'IN' ? (
                  <ArrowDownCircle className="w-12 h-12 text-emerald-400" />
                ) : (
                  <ArrowUpCircle className="w-12 h-12 text-rose-400" />
                )}
              </div>

              <h4 className="text-2xl font-black text-white tracking-tight">{scanResult.worker?.name}</h4>
              <p className="text-sm font-semibold text-slate-400 mb-3">{scanResult.worker?.designation} • ID: {scanResult.worker?.id}</p>
              
              <div className={`inline-flex items-center space-x-2 px-6 py-2.5 rounded-2xl text-base font-black uppercase tracking-wider shadow-xl ${
                scanResult.alreadyPunched
                  ? 'bg-amber-500 text-slate-950'
                  : scanResult.punchType === 'IN' 
                    ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/40' 
                    : 'bg-rose-500 text-white shadow-rose-500/40'
              }`}>
                <span>{scanResult.alreadyPunched ? 'ALREADY PUNCHED' : `PUNCHED ${scanResult.punchType}`}</span>
                <span>•</span>
                <span className="font-mono">{scanResult.time}</span>
              </div>

              {scanResult.alreadyPunched && (
                <p className="text-xs text-amber-300 font-semibold mt-2">{scanResult.message}</p>
              )}
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
            Mode: <strong className={punchMode === 'IN' ? 'text-emerald-400' : punchMode === 'OUT' ? 'text-rose-400' : 'text-indigo-400'}>
              {punchMode === 'IN' ? 'CHECK IN ONLY' : punchMode === 'OUT' ? 'CHECK OUT ONLY' : 'AUTO TOGGLE'}
            </strong>
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
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim() || isProcessing}
              className={`font-black px-5 py-2.5 rounded-xl text-sm transition cursor-pointer text-white ${
                punchMode === 'IN' ? 'bg-emerald-600 hover:bg-emerald-500' : punchMode === 'OUT' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              Punch {punchMode === 'AUTO' ? '' : punchMode}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
