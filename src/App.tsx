import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { GlobalSwitcher } from './components/GlobalSwitcher';
import { ResolutionVisualizer } from './components/ResolutionVisualizer';
import { CustomResolution } from './components/CustomResolution';
import { DisplayManager } from './components/DisplayManager';
import { HardwareScaling } from './components/HardwareScaling';
import { BorderlessStudio } from './components/BorderlessStudio';
import { Settings } from './components/Settings';
import type { DisplayInfo, ShortcutBinding, GpuInfo, TabType } from './types';
import {
  fetchDisplayInfo,
  fetchShortcut,
  fetchGpuInfo,
  fetchPreferredStretchedRes,
  applyResolution,
  toggleProfile,
  saveShortcut,
  openGpuControlPanel,
  checkRequestedTab,
  trimMemory,
  isTauri,
} from './utils/ipc';
import { listen } from '@tauri-apps/api/event';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('switcher');
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null);
  const [shortcut, setShortcut] = useState<ShortcutBinding | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [preferredStretched, setPreferredStretched] = useState<[number, number]>([2090, 1440]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const loadAllTelemetry = async () => {
    try {
      const [disp, sc, gpu, prefRes] = await Promise.all([
        fetchDisplayInfo(),
        fetchShortcut(),
        fetchGpuInfo(),
        fetchPreferredStretchedRes(),
      ]);
      setDisplayInfo(disp);
      setShortcut(sc);
      setGpuInfo(gpu);
      if (prefRes && prefRes[0] > 0 && prefRes[1] > 0) {
        setPreferredStretched(prefRes);
      }
    } catch (e) {
      console.error('Failed to load telemetry', e);
    }
  };

  useEffect(() => {
    loadAllTelemetry();

    // Keyboard shortcut navigation (1-7)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === '1') setCurrentTab('switcher');
      if (e.key === '2') setCurrentTab('visualizer');
      if (e.key === '3') setCurrentTab('custom_res');
      if (e.key === '4') setCurrentTab('displays');
      if (e.key === '5') setCurrentTab('gpu');
      if (e.key === '6') setCurrentTab('borderless');
      if (e.key === '7') setCurrentTab('settings');
    };
    window.addEventListener('keydown', handleKeyDown);

    // Listen for background global hotkey toggle events from Rust backend
    let unlistenFn: (() => void) | undefined;
    if (isTauri()) {
      listen<DisplayInfo>('display-mode-changed', (event) => {
        setDisplayInfo(event.payload);
        showToast(
          `Switched to ${event.payload.current_width}×${event.payload.current_height} @ ${event.payload.current_hz}Hz!`,
          'success'
        );
      }).then((unlisten) => {
        unlistenFn = unlisten;
      });
    }

    // Trim memory footprint on launch
    trimMemory();

    const handleBlur = () => {
      trimMemory();
    };
    window.addEventListener('blur', handleBlur);

    // Poll for tab switch requests (e.g. from automation or scripts) with low-overhead 2000ms interval
    const tabInterval = setInterval(async () => {
      try {
        const req = await checkRequestedTab();
        if (req) {
          if (['switcher', 'visualizer', 'custom_res', 'displays', 'gpu', 'borderless', 'settings'].includes(req)) {
            setCurrentTab(req as TabType);
          } else if (req === 'config') {
            setCurrentTab('settings');
          } else if (req === 'display' || req === 'monitors') {
            setCurrentTab('displays');
          } else if (req === 'custom' || req === 'cru') {
            setCurrentTab('custom_res');
          }
        }
      } catch (_) {}
    }, 2000);

    return () => {
      clearInterval(tabInterval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      if (unlistenFn) unlistenFn();
    };
  }, []);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [currentTab]);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const updated = await toggleProfile();
      setDisplayInfo(updated);
      showToast(
        `Switched to ${updated.current_width}×${updated.current_height} (${updated.active_profile === 'stretched' ? '1.45:1 True Stretch' : 'Native 16:9'})`,
        'success'
      );
    } catch (e) {
      showToast(String(e), 'info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyResolution = async (w: number, h: number, hz: number) => {
    setIsLoading(true);
    try {
      await applyResolution(w, h, hz);
      const updated = await fetchDisplayInfo();
      setDisplayInfo(updated);
      showToast(`Applied ${w}×${h} @ ${hz}Hz`, 'success');
    } catch (e) {
      showToast(String(e), 'info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveShortcut = async (binding: ShortcutBinding) => {
    try {
      await saveShortcut(binding);
      setShortcut(binding);
      showToast('Global hotkey saved and activated!', 'success');
    } catch (e) {
      showToast(String(e), 'info');
    }
  };

  const handleOpenControlPanel = async (vendor: string) => {
    try {
      await openGpuControlPanel(vendor);
      showToast(`Opened ${vendor} Control Panel`, 'info');
    } catch (e) {
      showToast(String(e), 'info');
    }
  };

  return (
    <div className="h-screen w-screen bg-m3-surface text-m3-on-surface flex overflow-hidden selection:bg-m3-primary-container selection:text-m3-on-primary-container antialiased font-sans">
      {/* Left Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        displayInfo={displayInfo}
        gpuInfo={gpuInfo}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-m3-surface">
        {/* TopBar Header */}
        <TopBar
          currentTab={currentTab}
          displayInfo={displayInfo}
          gpuInfo={gpuInfo}
          shortcut={shortcut}
          onToggleProfile={handleToggle}
          isLoading={isLoading}
        />

        {/* Scrollable View Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-3.5 sm:p-4">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {currentTab === 'switcher' && (
                  <GlobalSwitcher
                    displayInfo={displayInfo}
                    shortcut={shortcut}
                    preferredStretched={preferredStretched}
                    onToggle={handleToggle}
                    onApplyResolution={handleApplyResolution}
                    onSaveShortcut={handleSaveShortcut}
                    isLoading={isLoading}
                  />
                )}

                {currentTab === 'visualizer' && (
                  <ResolutionVisualizer
                    displayInfo={displayInfo}
                    onApplyResolution={handleApplyResolution}
                  />
                )}

                {currentTab === 'custom_res' && (
                  <CustomResolution
                    displayInfo={displayInfo}
                    onRefreshDisplayInfo={loadAllTelemetry}
                  />
                )}

                {currentTab === 'displays' && (
                  <DisplayManager onRefreshTelemetry={loadAllTelemetry} />
                )}

                {currentTab === 'gpu' && (
                  <HardwareScaling
                    gpuInfo={gpuInfo}
                    onOpenControlPanel={handleOpenControlPanel}
                  />
                )}

                {currentTab === 'borderless' && <BorderlessStudio />}

                {currentTab === 'settings' && (
                  <Settings
                    displayInfo={displayInfo}
                    onStretchResChanged={(w, h) => setPreferredStretched([w, h])}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Persistent Bottom Status Bar */}
        <footer className="h-8 px-5 border-t border-m3-outline-subtle bg-m3-surface-container-lowest/70 text-xs text-m3-on-surface-variant flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-m3-primary shadow-[0_0_6px_rgba(208,188,255,0.6)]" />
            <span className="text-[11px] text-m3-secondary font-medium">
              TrueStretch Studio • Material 3 Expressive
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-m3-outline">
            <span>Win32 GDI Display API</span>
            <span>•</span>
            <span>0.0 ms Frame Overhead</span>
            <span>•</span>
            <span>VALORANT 1.45:1 Golden Ratio</span>
          </div>
        </footer>
      </div>

      {/* Animated Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-full bg-m3-surface-bright text-m3-on-surface border border-m3-primary/40 shadow-m3-3 text-xs font-medium flex items-center space-x-2.5 backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-m3-primary" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
