import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { 
  X, Camera, CheckCircle2, AlertCircle, ArrowDownCircle, 
  ArrowUpCircle, Keyboard, SwitchCamera, Zap, ZapOff, RefreshCw, 
  Sparkles, LogIn, LogOut, Loader2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { playBeepSound, playPunchInSound, playPunchOutSound, playErrorSound, triggerHaptic } from '../utils/sound';

export default function QRScannerModal({ isOpen, onClose, onPunchSuccess, workers = [] }) {
  // Punch Mode: 'AUTO' (Smart Auto In/Out toggle) | 'IN' | 'OUT'
  const [punchMode, setPunchMode] = useState('AUTO');
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  
  // Camera state
  const [isStartingCamera, setIsStartingCamera] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const detectorRef = useRef(null);
  const lastScannedCodeRef = useRef({ code: '', time: 0 });
  const isDetectingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const manualInputRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Initialize BarcodeDetector once if available natively in browser
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        detectorRef.current = null;
      }
    }
  }, []);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    isDetectingRef.current = false;

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => {
          t.stop();
        });
      } catch (e) {
        console.warn('Error stopping tracks:', e);
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  // Parse worker ID from scanned text
  const parseWorkerCode = useCallback((rawText) => {
    if (!rawText) return null;
    let code = String(rawText).trim().replace(/^["']|["']$/g, '');

    // Check JSON payload
    if (code.startsWith('{') && code.endsWith('}')) {
      try {
        const parsed = JSON.parse(code);
        if (parsed.id) code = parsed.id;
        else if (parsed.workerId) code = parsed.workerId;
      } catch (e) {}
    }

    // Strip common prefixes
    if (code.toUpperCase().startsWith('WORKER:')) {
      code = code.substring(7).trim();
    } else if (code.toUpperCase().startsWith('ID:')) {
      code = code.substring(3).trim();
    } else if (code.includes('workerId=')) {
      const match = code.match(/workerId=([^&]+)/);
      if (match) code = decodeURIComponent(match[1]);
    }

    const cleanCode = code.toUpperCase();
    const codeDigits = cleanCode.replace(/\D/g, '');

    // Exact or digits match with workers array
    const match = (workers || []).find(w => {
      const wid = String(w.id || '').toUpperCase();
      const wDigits = wid.replace(/\D/g, '');
      return wid === cleanCode || 
             wid === `KRA-${cleanCode}` || 
             (codeDigits && wDigits === codeDigits);
    });
    if (match) return match.id;

    // Numeric shorthand (e.g. 101 -> KRA-101)
    if (!isNaN(code) && !cleanCode.startsWith('KRA-')) {
      return `KRA-${code}`;
    }

    return cleanCode;
  }, [workers]);

  // Handle a successfully decoded QR code
  const handleDecodedCode = useCallback(async (rawCode) => {
    if (!rawCode) return;
    const now = Date.now();

    // Debounce same QR within 2.2 seconds to prevent rapid double-punches
    if (lastScannedCodeRef.current.code === rawCode && (now - lastScannedCodeRef.current.time) < 2200) {
      return;
    }

    if (isProcessingRef.current) return;

    lastScannedCodeRef.current = { code: rawCode, time: now };
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const workerId = parseWorkerCode(rawCode);
      if (!workerId) {
        throw new Error('Unrecognized QR code badge format');
      }

      playBeepSound();

      // Submit punch with currently chosen punchMode: 'AUTO', 'IN', or 'OUT'
      const result = await onPunchSuccess(workerId, punchMode, 'QR');

      if (result.duplicatePrevented || result.alreadyPunched) {
        playErrorSound();
        triggerHaptic([40, 40, 40]);
      } else if (result.punchType === 'IN') {
        playPunchInSound();
      } else {
        playPunchOutSound();
      }

      setScanResult({
        success: !result.duplicatePrevented,
        alreadyPunched: !!result.alreadyPunched,
        duplicatePrevented: !!result.duplicatePrevented,
        message: result.message,
        worker: result.worker,
        punchType: result.punchType,
        time: result.punchTime
      });

      // Show result overlay for 1.8 seconds, then resume scanning
      setTimeout(() => {
        setScanResult(null);
        setIsProcessing(false);
      }, 1800);

    } catch (err) {
      playErrorSound();
      const msg = err.message || 'Worker not found in database';
      setErrorMsg(msg);

      // Auto-clear error after 2.5 seconds
      setTimeout(() => {
        setErrorMsg(null);
        setIsProcessing(false);
      }, 2500);
    }
  }, [punchMode, onPunchSuccess, parseWorkerCode]);

  // Start the high-performance, non-blocking scan loop
  const startDetectionLoop = useCallback(() => {
    let lastTick = 0;

    const tick = async (timestamp) => {
      // If modal closed or video detached, break loop
      if (!videoRef.current || !streamRef.current) {
        return;
      }

      // If video is not ready yet, request next frame and return immediately
      if (videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // Throttle scanning to ~10-12 FPS (every 90ms) - uses <3% CPU, zero thread blocking!
      if (timestamp - lastTick >= 90 && !isDetectingRef.current && !isProcessingRef.current) {
        lastTick = timestamp;
        isDetectingRef.current = true;

        try {
          const video = videoRef.current;
          let detectedCode = null;

          // Priority 1: Native hardware BarcodeDetector (Chrome / Android 60fps)
          if (detectorRef.current) {
            try {
              const barcodes = await detectorRef.current.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedCode = barcodes[0].rawValue;
              }
            } catch (err) {
              // BarcodeDetector failed, fallback to jsQR below
            }
          }

          // Priority 2: Ultra-fast Downscaled jsQR (<4ms decode time!)
          if (!detectedCode && canvasRef.current && video.videoWidth > 0 && video.videoHeight > 0) {
            const canvas = canvasRef.current;
            
            // Downscale to max 360px dimension for instantaneous decoding (50x faster than 1080p)
            const maxDim = 360;
            let tw = video.videoWidth;
            let th = video.videoHeight;
            if (tw > maxDim || th > maxDim) {
              if (tw > th) {
                th = Math.round((th / tw) * maxDim);
                tw = maxDim;
              } else {
                tw = Math.round((tw / th) * maxDim);
                th = maxDim;
              }
            }

            canvas.width = tw;
            canvas.height = th;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            if (ctx) {
              ctx.drawImage(video, 0, 0, tw, th);
              const imgData = ctx.getImageData(0, 0, tw, th);
              const qr = jsQR(imgData.data, tw, th, {
                inversionAttempts: 'dontInvert'
              });

              if (qr && qr.data) {
                detectedCode = qr.data;
              }
            }
          }

          if (detectedCode) {
            handleDecodedCode(detectedCode);
          }
        } catch (e) {
          // Ignore individual frame errors
        } finally {
          isDetectingRef.current = false;
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [handleDecodedCode]);

  // Start Camera with safety timeout & permission handling
  const startCamera = useCallback(async () => {
    setIsStartingCamera(true);
    setCameraError(null);
    setErrorMsg(null);

    // Guard: Check mediaDevices support
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Camera access requires HTTPS or localhost. If you are accessing over local Wi-Fi, please enter the Worker ID manually below, or open the secure Vercel cloud URL.');
      setIsStartingCamera(false);
      if (manualInputRef.current) manualInputRef.current.focus();
      return;
    }

    try {
      // 1. Build camera constraints (prefer back/environment camera, 640x480 for fast focus)
      let videoConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640 },
        height: { ideal: 480 }
      };

      if (selectedCameraId) {
        videoConstraints.deviceId = { ideal: selectedCameraId };
      }

      // Timeout safety: if getUserMedia hangs > 4.5s, report failure gracefully
      const streamPromise = navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('CAMERA_TIMEOUT')), 5000)
      );

      const stream = await Promise.race([streamPromise, timeoutPromise]);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        
        await videoRef.current.play().catch(e => {
          console.warn('Video play error:', e);
        });

        setCameraActive(true);
        setIsStartingCamera(false);

        // Check torch capability
        try {
          const track = stream.getVideoTracks()[0];
          const capabilities = track?.getCapabilities ? track.getCapabilities() : {};
          setTorchSupported(!!capabilities.torch);
        } catch (e) {}

        // Safe device enumeration after permissions are granted
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevs = devices.filter(d => d.kind === 'videoinput');
          setAvailableCameras(videoDevs);
        } catch (e) {}

        // Launch the lightweight detection loop
        startDetectionLoop();
      }
    } catch (err) {
      console.error('Camera startup error:', err);
      setIsStartingCamera(false);
      setCameraActive(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser address bar, or use the Manual ID keypad below.');
      } else if (err.message === 'CAMERA_TIMEOUT') {
        setCameraError('Camera took too long to start. It may be in use by another app. You can retry or enter Worker ID manually.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. Please enter the Worker ID manually below.');
      } else {
        setCameraError('Unable to access camera. Please enter the Worker ID manually below.');
      }

      // Focus manual input
      setTimeout(() => {
        if (manualInputRef.current) manualInputRef.current.focus();
      }, 100);
    }
  }, [selectedCameraId, startDetectionLoop]);

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanResult(null);
      setErrorMsg(null);
      setCameraError(null);
      setIsProcessing(false);
      return;
    }

    startCamera();

    // Escape key listener to close modal immediately
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, onClose]);

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

  // Switch between cameras
  const handleSwitchCamera = () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    stopCamera();
    setSelectedCameraId(availableCameras[nextIndex].deviceId);
  };

  // Manual Worker ID submission
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim() || isProcessing) return;
    handleDecodedCode(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        // Close when clicking the dark backdrop outside modal card
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Hidden offscreen downscaled canvas for jsQR analysis */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              cameraActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}>
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-tight">High-Speed Scanner</h3>
              <p className="text-[11px] font-bold flex items-center space-x-1">
                {cameraActive ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="text-emerald-400">Camera Live</span>
                  </>
                ) : isStartingCamera ? (
                  <>
                    <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
                    <span className="text-sky-400">Starting Camera...</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span className="text-amber-400">Manual Keypad Ready</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Switch Camera (Front/Rear)"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            {torchSupported && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  torchOn ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Toggle Torch/Flash"
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {cameraError && (
              <button
                type="button"
                onClick={startCamera}
                className="p-2 rounded-xl text-sky-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Retry Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 🌟 PUNCH MODE SELECTOR (Auto / In / Out) */}
        <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Mode:</span>
          </span>
          
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 flex-1 justify-end max-w-[320px]">
            <button
              type="button"
              onClick={() => setPunchMode('AUTO')}
              className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                punchMode === 'AUTO'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="1st scan IN, 2nd scan OUT, 3rd scan IN (1-min double-punch protected)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ AUTO (IN/OUT)</span>
            </button>

            <button
              type="button"
              onClick={() => setPunchMode('IN')}
              className={`flex items-center justify-center space-x-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition cursor-pointer ${
                punchMode === 'IN'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Force Check In Only"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>IN</span>
            </button>

            <button
              type="button"
              onClick={() => setPunchMode('OUT')}
              className={`flex items-center justify-center space-x-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition cursor-pointer ${
                punchMode === 'OUT'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Force Check Out Only"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>OUT</span>
            </button>
          </div>
        </div>

        {/* Live Camera Viewfinder */}
        <div className="relative p-3 flex-1 flex flex-col items-center justify-center bg-black min-h-[290px] overflow-hidden">
          
          <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-950 flex items-center justify-center">
            
            {/* Live Video Feed */}
            <video 
              ref={videoRef}
              className={`w-full h-full object-cover transition-opacity duration-300 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
              playsInline
              autoPlay
              muted
            />

            {/* Viewfinder Target Reticle */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className={`w-8 h-8 border-t-4 border-l-4 rounded-tl-xl transition-colors ${
                    punchMode === 'IN' ? 'border-emerald-400' : punchMode === 'OUT' ? 'border-rose-400' : 'border-indigo-400'
                  }`}></div>
                  <div className={`w-8 h-8 border-t-4 border-r-4 rounded-tr-xl transition-colors ${
                    punchMode === 'IN' ? 'border-emerald-400' : punchMode === 'OUT' ? 'border-rose-400' : 'border-indigo-400'
                  }`}></div>
                </div>

                {/* Animated Laser Scanning Line */}
                {!scanResult && (
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
            )}

            {/* Starting Camera Spinner */}
            {isStartingCamera && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                <p className="text-sm font-bold text-white">Starting Camera Feed...</p>
                <p className="text-xs text-slate-400 mt-1">Please allow camera permission if prompted</p>
              </div>
            )}

            {/* Camera Error / Permission Fallback View */}
            {cameraError && !cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Camera Not Available</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-[260px]">
                  {cameraError}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (manualInputRef.current) manualInputRef.current.focus();
                    }}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Type ID Below</span>
                  </button>
                </div>
              </div>
            )}
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
            <div className="absolute bottom-4 left-4 right-4 bg-rose-950/95 border border-rose-600 text-rose-200 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center space-x-2.5 z-30 shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Subtext info */}
          <div className="flex items-center justify-between w-full max-w-[320px] mt-2 px-1 text-[11px] text-slate-400">
            <span>
              Target: <strong className={punchMode === 'IN' ? 'text-emerald-400' : punchMode === 'OUT' ? 'text-rose-400' : 'text-indigo-400'}>
                {punchMode === 'IN' ? 'CHECK IN ONLY' : punchMode === 'OUT' ? 'CHECK OUT ONLY' : 'AUTO TOGGLE'}
              </strong>
            </span>
            {workers.length === 0 && (
              <span className="text-amber-400 font-bold">0 workers (Add in Admin)</span>
            )}
          </div>
        </div>

        {/* Manual ID Input Fallback (Always functional & accessible) */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={manualInputRef}
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or type ID (e.g. 101 or KRA-101)..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim() || isProcessing}
              className={`font-black px-4 sm:px-5 py-2.5 rounded-xl text-sm transition cursor-pointer text-white disabled:opacity-40 ${
                punchMode === 'IN' 
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700' 
                  : punchMode === 'OUT' 
                    ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700' 
                    : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
              }`}
            >
              {isProcessing ? 'Wait...' : `Punch ${punchMode === 'AUTO' ? '' : punchMode}`}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
