import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { UnifiedStretch } from './components/UnifiedStretch';
import { ResolutionVisualizer } from './components/ResolutionVisualizer';
import { Settings } from './components/Settings';
import { HardwareScaling } from './components/HardwareScaling';
import { UpdateModal } from './components/UpdateModal';
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
  isBadModeErrorMessage,
  checkAppUpdates,
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
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [_latestVersion, setLatestVersion] = useState('');

  // Background update check on startup (delayed 2.5s so app startup is instantaneous)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkAppUpdates()
        .then((res) => {
          if (res.has_update) {
            setHasUpdate(true);
            setLatestVersion(res.latest_version);
          }
        })
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (message: string, type: 'success' | 'info' = 'success', durationMs = 3500) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, durationMs);
  };

  const errorToMessage = (e: unknown): string => {
    if (e instanceof Error) return e.message;
    return String(e);
  };

  /** BADMODE (-2) means the mode was never Added: toast the Add guidance and land on Settings. */
  const handleBadModeError = (e: unknown): boolean => {
    const msg = errorToMessage(e);
    if (isBadModeErrorMessage(msg)) {
      showToast(msg, 'info', 7000);
      // Brief delay so the toast is visible while landing on Settings.
      setTimeout(() => {
        setCurrentTab('settings');
      }, 900);
      return true;
    }
    return false;
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

    // Keyboard shortcut navigation (1-4)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === '1') setCurrentTab('switcher');
      if (e.key === '2') setCurrentTab('visualizer');
      if (e.key === '3') setCurrentTab('settings');
      if (e.key === '4') setCurrentTab('gpu');
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
          if (['switcher', 'visualizer', 'settings', 'gpu'].includes(req)) {
            setCurrentTab(req as TabType);
          } else if (req === 'borderless' || req === 'display' || req === 'monitors') {
            // Legacy alias: Window Stretcher merged into switcher grid
            setCurrentTab('switcher');
          } else if (['config', 'custom', 'cru', 'custom_res'].includes(req)) {
            // Legacy aliases: custom builder merged into the settings tab
            setCurrentTab('settings');
          } else if (req === 'sens') {
            // Legacy alias: sens matcher merged into the switcher tab
            setCurrentTab('switcher');
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

  // Unified grid tab fills viewport with no scroll; other tabs keep scroll.
  // 'borderless' is a legacy alias that renders the same unified grid.
  // Tabs that fit exactly within the viewport without body page scrolling
  const isFitViewportTab =
    currentTab === 'switcher' ||
    currentTab === 'borderless' ||
    currentTab === 'visualizer' ||
    currentTab === 'settings';
  const effectiveTab: TabType = currentTab === 'borderless' ? 'switcher' : currentTab;

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
      if (!handleBadModeError(e)) {
        showToast(errorToMessage(e), 'info');
      }
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
      if (!handleBadModeError(e)) {
        showToast(errorToMessage(e), 'info');
      }
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
        currentTab={effectiveTab}
        onSelectTab={setCurrentTab}
        displayInfo={displayInfo}
        gpuInfo={gpuInfo}
        hasUpdate={hasUpdate}
        onOpenUpdates={() => setIsUpdateModalOpen(true)}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-m3-surface">
        {/* TopBar Header */}
        <TopBar
          currentTab={effectiveTab}
          displayInfo={displayInfo}
          gpuInfo={gpuInfo}
          shortcut={shortcut}
          onToggleProfile={handleToggle}
          isLoading={isLoading}
          hasUpdate={hasUpdate}
          onOpenUpdates={() => setIsUpdateModalOpen(true)}
        />
        {/* Scrollable View Content (unified grid locks to viewport, no scroll) */}
        <main
          ref={mainRef}
          className={
            isFitViewportTab
              ? 'flex-1 min-h-0 overflow-hidden p-3'
              : 'flex-1 overflow-y-auto p-3.5 sm:p-4'
          }
        >
          <div className={isFitViewportTab ? 'h-full min-h-0 w-full' : 'max-w-6xl mx-auto h-full w-full'}>
            <AnimatePresence mode="wait">
              <motion.div
                key={effectiveTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={isFitViewportTab ? 'h-full min-h-0' : 'h-full'}
              >
                {(currentTab === 'switcher' || currentTab === 'borderless') && (
                  <UnifiedStretch
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

                {currentTab === 'settings' && (
                  <Settings
                    displayInfo={displayInfo}
                    onStretchResChanged={(w, h) => setPreferredStretched([w, h])}
                    onRefreshDisplayInfo={loadAllTelemetry}
                  />
                )}

                {currentTab === 'gpu' && (
                  <HardwareScaling
                    gpuInfo={gpuInfo}
                    onOpenControlPanel={handleOpenControlPanel}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* In-App Update Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        onUpdateStatusChange={(has, ver) => {
          setHasUpdate(has);
          setLatestVersion(ver);
        }}
      />

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
