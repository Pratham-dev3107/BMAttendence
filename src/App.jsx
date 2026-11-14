import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import GatekeeperView from './components/GatekeeperView';
import AdminView from './components/AdminView';
import LoginView from './components/LoginView';
import QRScannerModal from './components/QRScannerModal';
import WorkerModal from './components/WorkerModal';
import IDCardModal from './components/IDCardModal';
import SettingsModal from './components/SettingsModal';
import MobileConnectModal from './components/MobileConnectModal';
import ManualCorrectionModal from './components/ManualCorrectionModal';
import { 
  fetchTodayAttendance, 
  punchAttendance, 
  createWorker, 
  updateWorker, 
  fetchSettings, 
  manualOverrideAttendance 
} from './utils/api';

export default function App() {
  // Auth state persisted in localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('kranti_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('kranti_user');
      const u = saved ? JSON.parse(saved) : null;
      return u?.role === 'admin' ? 'admin' : 'gatekeeper';
    } catch {
      return 'gatekeeper';
    }
  });

  const [todayData, setTodayData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastPunchFeedback, setLastPunchFeedback] = useState(null);

  // Modals state
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [isIDCardModalOpen, setIsIDCardModalOpen] = useState(false);
  const [selectedWorkerForID, setSelectedWorkerForID] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMobileConnectOpen, setIsMobileConnectOpen] = useState(false);
  const [isManualCorrectionOpen, setIsManualCorrectionOpen] = useState(false);
  const [selectedDayForEdit, setSelectedDayForEdit] = useState(null);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('kranti_user', JSON.stringify(user));
    if (user.role === 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('gatekeeper');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('kranti_user');
  };

  // Load today attendance
  const loadTodayData = useCallback(async () => {
    try {
      const data = await fetchTodayAttendance();
      setTodayData(data);
    } catch (err) {
      console.error('Error fetching today attendance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load settings
  const loadInitialSettings = useCallback(async () => {
    try {
      const s = await fetchSettings();
      setSettings(s);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    loadTodayData();
    loadInitialSettings();

    // Auto-refresh every 12 seconds to keep live data synced across mobile & desktop
    const interval = setInterval(() => {
      loadTodayData();
    }, 12000);

    return () => clearInterval(interval);
  }, [currentUser, loadTodayData, loadInitialSettings]);

  // Handle In/Out Punch
  const handlePunch = async (workerId, type = 'AUTO', method = 'QR') => {
    const result = await punchAttendance({ 
      workerId, 
      type, 
      method,
      markedBy: currentUser?.name || currentUser?.username || 'Gatekeeper'
    });
    
    // Set feedback toast
    setLastPunchFeedback({
      worker: result.worker,
      punchType: result.punchType,
      punchTime: result.punchTime
    });

    // Auto clear feedback after 5 seconds
    setTimeout(() => {
      setLastPunchFeedback(null);
    }, 5000);

    loadTodayData();
    return result;
  };

  // Handle Save Worker
  const handleSaveWorker = async (formData, workerId) => {
    if (workerId) {
      await updateWorker(workerId, formData);
    } else {
      await createWorker(formData);
    }
    loadTodayData();
  };

  // Handle Manual Override
  const handleSaveOverride = async (payload) => {
    await manualOverrideAttendance(payload);
    loadTodayData();
  };

  // If not logged in, render Login View
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        companyName={settings?.companyName || 'Kranti Industries'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans select-none">
      
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMobileConnect={() => setIsMobileConnectOpen(true)}
        settings={settings}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'gatekeeper' || currentUser.role === 'gatekeeper' ? (
          <GatekeeperView
            todayData={todayData}
            onPunch={handlePunch}
            onOpenQRScanner={() => setIsQRScannerOpen(true)}
            loading={loading}
            lastPunchFeedback={lastPunchFeedback}
          />
        ) : (
          <AdminView
            todayData={todayData}
            onRefreshToday={loadTodayData}
            onOpenAddWorker={() => {
              setEditingWorker(null);
              setIsWorkerModalOpen(true);
            }}
            onOpenEditWorker={(worker) => {
              setEditingWorker(worker);
              setIsWorkerModalOpen(true);
            }}
            onOpenIDCard={(worker) => {
              setSelectedWorkerForID(worker);
              setIsIDCardModalOpen(true);
            }}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onSelectDayForEdit={(worker, day) => {
              setSelectedDayForEdit({ ...day, worker, workerId: worker.id, workerName: worker.name });
              setIsManualCorrectionOpen(true);
            }}
          />
        )}
      </main>

      {/* QR Code Scanner Camera Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onPunchSuccess={handlePunch}
        workers={todayData?.list?.map(i => i.worker) || []}
      />

      {/* Worker Add / Edit Modal */}
      <WorkerModal
        isOpen={isWorkerModalOpen}
        onClose={() => {
          setIsWorkerModalOpen(false);
          setEditingWorker(null);
        }}
        onSave={handleSaveWorker}
        editingWorker={editingWorker}
      />

      {/* Worker QR ID Badge Print Modal */}
      <IDCardModal
        isOpen={isIDCardModalOpen}
        onClose={() => {
          setIsIDCardModalOpen(false);
          setSelectedWorkerForID(null);
        }}
        worker={selectedWorkerForID}
        companyName={settings?.companyName}
      />

      {/* Shift & Attendance Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentSettings={settings}
        onSettingsUpdated={(newSettings) => setSettings(newSettings)}
      />

      {/* Connect Mobile QR Modal */}
      <MobileConnectModal
        isOpen={isMobileConnectOpen}
        onClose={() => setIsMobileConnectOpen(false)}
      />

      {/* Manual Override / Correction Modal */}
      <ManualCorrectionModal
        isOpen={isManualCorrectionOpen}
        onClose={() => {
          setIsManualCorrectionOpen(false);
          setSelectedDayForEdit(null);
        }}
        item={selectedDayForEdit}
        onSave={handleSaveOverride}
      />

    </div>
  );
}
