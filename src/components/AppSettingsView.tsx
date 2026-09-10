import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Power,
  Layers,
  Monitor,
  Info,
  Loader2,
  GitBranch,
} from 'lucide-react';
import type { UpdateInfo, MonitorDevice } from '../types';
import {
  checkAppUpdates,
  openExternalUrl,
  installAppUpdate,
  getAutostartEnabled,
  setAutostartEnabled,
  fetchAllMonitors,
  fetchOverlayMonitor,
  setOverlayMonitor,
} from '../utils/ipc';
import { APP_VERSION, appVersion } from '../utils/version';

interface AppSettingsViewProps {
  onUpdateStatusChange?: (hasUpdate: boolean, latestVersion: string) => void;
}

export const AppSettingsView: React.FC<AppSettingsViewProps> = ({
  onUpdateStatusChange,
}) => {
  const [currentVersion, setCurrentVersion] = useState(APP_VERSION);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // System settings state
  const [autostart, setAutostart] = useState(false);
  const [startMinimized, setStartMinimized] = useState(() => {
    return localStorage.getItem('aspect_start_minimized') === 'true';
  });
  const [closeToTray, setCloseToTray] = useState(() => {
    return localStorage.getItem('aspect_close_to_tray') !== 'false';
  });
  const [inGameToasts, setInGameToasts] = useState(() => {
    return localStorage.getItem('aspect_ingame_toasts') !== 'false';
  });

  // In-game overlay monitor picker
  const [monitors, setMonitors] = useState<MonitorDevice[]>([]);
  const [overlayMonitor, setOverlayMonitorSel] = useState('auto');
  const [monitorStatus, setMonitorStatus] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const ver = await appVersion();
    setCurrentVersion(ver);
    const auto = await getAutostartEnabled();
    setAutostart(auto);
    try {
      const [mons, ovMon] = await Promise.all([fetchAllMonitors(), fetchOverlayMonitor()]);
      setMonitors(mons.filter((m) => m.is_attached && !m.is_device_disabled));
      setOverlayMonitorSel(ovMon || 'auto');
    } catch {
      /* Monitor list unavailable (dev browser) — picker stays on Auto. */
    }
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    setChecking(true);
    setError(null);
    setInstallStatus(null);
    try {
      const res = await checkAppUpdates();
      setUpdateInfo(res);
      onUpdateStatusChange?.(res.has_update, res.latest_version);
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  }, [onUpdateStatusChange]);

  useEffect(() => {
    loadSettings();
    handleCheckUpdates();
  }, [loadSettings, handleCheckUpdates]);

  const handleToggleAutostart = async () => {
    const next = !autostart;
    setAutostart(next);
    await setAutostartEnabled(next);
  };

  const handleToggleStartMinimized = () => {
    const next = !startMinimized;
    setStartMinimized(next);
    localStorage.setItem('aspect_start_minimized', next ? 'true' : 'false');
  };

  const handleToggleCloseToTray = () => {
    const next = !closeToTray;
    setCloseToTray(next);
    localStorage.setItem('aspect_close_to_tray', next ? 'true' : 'false');
  };

  const handleToggleToasts = () => {
    const next = !inGameToasts;
    setInGameToasts(next);
    localStorage.setItem('aspect_ingame_toasts', next ? 'true' : 'false');
  };

  const handleOverlayMonitorChange = async (value: string) => {
    setOverlayMonitorSel(value);
    setMonitorStatus(null);
    try {
      await setOverlayMonitor(value);
      setMonitorStatus(
        value === 'auto'
          ? 'Auto — HUD sticks to the Valorant window.'
          : 'Pinned — HUD moves there within ~2 seconds.'
      );
    } catch (e) {
      setMonitorStatus(`Could not save: ${String(e)}`);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateInfo?.download_url) {
      if (updateInfo?.html_url) {
        openExternalUrl(updateInfo.html_url);
      }
      return;
    }

    setInstalling(true);
    setInstallStatus('Downloading update payload...');
    setError(null);

    try {
      const result = await installAppUpdate(updateInfo.download_url);
      setInstallStatus(result || 'Update downloaded and launching...');
    } catch (e) {
      setError(String(e));
      setInstalling(false);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto custom-scrollbar bg-m3-surface px-4 sm:px-8 py-6">
      <div className="max-w-4xl mx-auto w-full space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col space-y-1">
          <h1 className="text-xl sm:text-2xl font-black font-display text-m3-on-surface tracking-tight">
            Application Settings
          </h1>
          <p className="text-xs text-m3-outline">
            Software updater, Windows startup preferences, and system tray configuration.
          </p>
        </div>

        {/* Section 1: Software Updates */}
        <div className="rounded-3xl bg-m3-surface-container border border-m3-outline-subtle p-5 sm:p-6 shadow-m3-1 flex flex-col space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-m3-primary/10 border border-m3-primary/30 flex items-center justify-center text-m3-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-m3-on-surface font-display">
                  Software Updates
                </h2>
                <p className="text-[11px] text-m3-outline">
                  GitHub Releases channel • Current build v{currentVersion}
                </p>
              </div>
            </div>

            <button
              onClick={handleCheckUpdates}
              disabled={checking || installing}
              className="px-4 py-2 rounded-xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking...' : 'Check for Updates'}</span>
            </button>
          </div>

          {/* Update Status Card */}
          {checking ? (
            <div className="py-6 px-4 rounded-2xl bg-m3-surface-container-lowest border border-m3-outline-subtle flex flex-col items-center justify-center gap-2 text-center">
              <Loader2 className="w-6 h-6 text-m3-primary animate-spin" />
              <span className="text-xs text-m3-on-surface font-medium">Checking GitHub for releases...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-bold text-red-400">Update check error</span>
                <p className="text-[11px] text-red-300/80 mt-0.5 break-words">{error}</p>
              </div>
            </div>
          ) : updateInfo?.has_update ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-m3-primary/10 border border-m3-primary/40 flex flex-col space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-m3-primary animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold text-m3-primary">
                    New Version Available: {updateInfo.latest_version}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-m3-primary/20 text-m3-primary font-bold">
                  v{currentVersion} → {updateInfo.latest_version}
                </span>
              </div>

              {/* Release Title & Notes */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-m3-on-surface">
                  {updateInfo.release_title}
                </h3>
                <div className="p-3 rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle/70 custom-scrollbar max-h-36 overflow-y-auto text-xs text-m3-on-surface-variant font-mono whitespace-pre-wrap leading-relaxed">
                  {updateInfo.release_notes}
                </div>
              </div>

              {installStatus && (
                <div className="flex items-center gap-2 text-xs font-semibold text-m3-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{installStatus}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  onClick={() => openExternalUrl(updateInfo.html_url)}
                  className="px-3.5 py-1.5 rounded-xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Release Notes</span>
                </button>
                <button
                  onClick={handleInstallUpdate}
                  disabled={installing}
                  className="px-4 py-1.5 rounded-xl bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {installing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{installing ? 'Installing...' : 'Install Update Now'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold text-emerald-300">You are on the latest version</span>
                <p className="text-[11px] text-emerald-400/80">
                  Recon v{currentVersion} is completely up to date.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Windows Startup & Tray */}
        <div className="rounded-3xl bg-m3-surface-container border border-m3-outline-subtle p-5 sm:p-6 shadow-m3-1 flex flex-col space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-m3-secondary/10 border border-m3-secondary/30 flex items-center justify-center text-m3-secondary">
              <Power className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-m3-on-surface font-display">
                System & Startup
              </h2>
              <p className="text-[11px] text-m3-outline">
                Configure auto-launch on PC startup and background system tray behavior.
              </p>
            </div>
          </div>

          <div className="divide-y divide-m3-outline-subtle rounded-2xl bg-m3-surface-container-lowest border border-m3-outline-subtle overflow-hidden">
            {/* Start on Boot */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-semibold text-m3-on-surface">
                  Start with Windows
                </div>
                <div className="text-[11px] text-m3-outline">
                  Automatically launches Recon on Windows login in the background.
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleAutostart}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  autostart ? 'bg-m3-primary' : 'bg-m3-surface-container-high'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    autostart ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Start Minimized */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-semibold text-m3-on-surface">
                  Start Minimized to Tray
                </div>
                <div className="text-[11px] text-m3-outline">
                  Silently boot directly into the Windows taskbar tray without showing the main window.
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleStartMinimized}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  startMinimized ? 'bg-m3-primary' : 'bg-m3-surface-container-high'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    startMinimized ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Close to Tray */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-semibold text-m3-on-surface">
                  Minimize to Tray on Close (X)
                </div>
                <div className="text-[11px] text-m3-outline">
                  Keep hotkeys and in-game HUD running in the background when closing window.
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleCloseToTray}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  closeToTray ? 'bg-m3-primary' : 'bg-m3-surface-container-high'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    closeToTray ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: In-Game Preferences */}
        <div className="rounded-3xl bg-m3-surface-container border border-m3-outline-subtle p-5 sm:p-6 shadow-m3-1 flex flex-col space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-m3-tertiary/10 border border-m3-tertiary/30 flex items-center justify-center text-m3-tertiary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-m3-on-surface font-display">
                Overlay & Notifications
              </h2>
              <p className="text-[11px] text-m3-outline">
                In-game HUD behavior, toasts, and hardware integration.
              </p>
            </div>
          </div>

          <div className="divide-y divide-m3-outline-subtle rounded-2xl bg-m3-surface-container-lowest border border-m3-outline-subtle overflow-hidden">
            {/* In-Game Notifications */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-semibold text-m3-on-surface">
                  Resolution Switch Notifications
                </div>
                <div className="text-[11px] text-m3-outline">
                  Show toast popups upon hotkey toggling between stretched and native.
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleToasts}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  inGameToasts ? 'bg-m3-primary' : 'bg-m3-surface-container-high'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    inGameToasts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Hardware Status */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-semibold text-m3-on-surface">
                  Hardware Acceleration
                </div>
                <div className="text-[11px] text-m3-outline">
                  Native Win32 GDI & DirectComposition GPU pipeline enabled.
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: In-Game Overlay Monitor */}
        <div className="rounded-3xl bg-m3-surface-container border border-m3-outline-subtle p-5 sm:p-6 shadow-m3-1 flex flex-col space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-m3-primary/10 border border-m3-primary/30 flex items-center justify-center text-m3-primary">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-m3-on-surface font-display">
                In-Game Overlay Screen
              </h2>
              <p className="text-[11px] text-m3-outline">
                Choose which monitor the HUD appears on. Auto sticks it to the Valorant window.
              </p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-m3-surface-container-lowest border border-m3-outline-subtle flex flex-col gap-2">
            <label
              htmlFor="overlay-monitor-select"
              className="text-xs sm:text-sm font-semibold text-m3-on-surface"
            >
              Overlay monitor
            </label>
            <select
              id="overlay-monitor-select"
              value={overlayMonitor}
              onChange={(e) => void handleOverlayMonitorChange(e.target.value)}
              className="h-9 px-3 rounded-xl bg-m3-surface-container-high border border-m3-outline-subtle text-m3-on-surface text-xs font-medium cursor-pointer focus:outline-none focus:border-m3-primary"
            >
              <option value="auto">Auto — stick to Valorant window</option>
              {monitors.map((m) => (
                <option key={m.device_name} value={m.device_name}>
                  {m.monitor_name || m.device_name} — {m.width}×{m.height}@{m.refresh_rate}Hz
                  {m.is_primary ? ' (Primary)' : ''}
                </option>
              ))}
            </select>
            {monitorStatus && (
              <p className="text-[11px] text-m3-primary font-medium">{monitorStatus}</p>
            )}
          </div>
        </div>

        {/* Section 5: About & Repository */}
        <div className="rounded-3xl bg-m3-surface-container-low border border-m3-outline-subtle p-5 sm:p-6 flex flex-col space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-m3-on-surface">
              <Info className="w-4 h-4 text-m3-primary" />
              <span>Recon Competitive Esports Suite</span>
            </div>
            <span className="text-[10px] font-mono text-m3-outline">
              Version {currentVersion} • Rust / Win32 / Tauri v2
            </span>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => openExternalUrl('https://github.com/youssefvdel/Recon')}
              className="h-8 px-3 rounded-xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>GitHub Repository</span>
            </button>
            <button
              onClick={() => openExternalUrl('https://github.com/youssefvdel/Recon/releases')}
              className="h-8 px-3 rounded-xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Releases & Changelog</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
