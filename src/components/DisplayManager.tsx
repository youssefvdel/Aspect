import React, { useState, useEffect } from 'react';
import {
  Monitor,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Crown,
  LayoutGrid,
  ShieldCheck,
  Power,
  RotateCw,
} from 'lucide-react';
import type { MonitorDevice } from '../types';
import {
  fetchAllMonitors,
  setMonitorAttached,
  setMonitorPrimary,
} from '../utils/ipc';

interface DisplayManagerProps {
  onRefreshTelemetry?: () => void;
}

export const DisplayManager: React.FC<DisplayManagerProps> = ({
  onRefreshTelemetry,
}) => {
  const [monitors, setMonitors] = useState<MonitorDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);

  const loadMonitors = async () => {
    setLoading(true);
    try {
      const data = await fetchAllMonitors();
      setMonitors(data);
    } catch (err) {
      console.error('Failed to load monitors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitors();
  }, []);

  const showToast = (
    text: string,
    type: 'success' | 'warning' | 'info' = 'success'
  ) => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleToggleAttached = async (mon: MonitorDevice) => {
    if (mon.is_primary && mon.is_attached) {
      showToast(
        'Primary display cannot be disabled. Set another monitor as Primary first.',
        'warning'
      );
      return;
    }

    const nextState = !mon.is_attached;
    setActionInProgress(mon.device_name);

    // Optimistic UI update
    setMonitors((prev) =>
      prev.map((m) =>
        m.device_name === mon.device_name
          ? { ...m, is_attached: nextState }
          : m
      )
    );

    try {
      const updated = await setMonitorAttached(mon.device_name, nextState);
      setMonitors(updated);
      showToast(
        `${mon.monitor_name || mon.device_name} ${
          nextState ? 'Enabled & Attached' : 'Disabled & Detached'
        } successfully.`,
        'success'
      );
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err) {
      showToast(`Failed to toggle display: ${err}`, 'warning');
      loadMonitors();
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMakePrimary = async (mon: MonitorDevice) => {
    if (mon.is_primary) return;
    setActionInProgress(mon.device_name);

    // Optimistic UI update
    setMonitors((prev) =>
      prev.map((m) => ({
        ...m,
        is_primary: m.device_name === mon.device_name,
      }))
    );

    try {
      const updated = await setMonitorPrimary(mon.device_name);
      setMonitors(updated);
      showToast(
        `${mon.monitor_name || mon.device_name} is now the Primary Display.`,
        'success'
      );
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err) {
      showToast(`Failed to set primary display: ${err}`, 'warning');
      loadMonitors();
    } finally {
      setActionInProgress(null);
    }
  };

  // Esports Mode: Disables all secondary displays
  const handleEsportsSingleMonitorMode = async () => {
    const secondaries = monitors.filter((m) => !m.is_primary && m.is_attached);
    if (secondaries.length === 0) {
      showToast('Esports Mode already active (Single monitor running).', 'info');
      return;
    }

    setActionInProgress('esports');
    try {
      for (const s of secondaries) {
        await setMonitorAttached(s.device_name, false);
      }
      const updated = await fetchAllMonitors();
      setMonitors(updated);
      showToast(
        'Esports Mode Active: Disabled all secondary displays. DWM scanout lag eliminated!',
        'success'
      );
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err) {
      showToast(`Error configuring Esports Mode: ${err}`, 'warning');
    } finally {
      setActionInProgress(null);
    }
  };

  // Restore All Displays
  const handleRestoreAllMonitors = async () => {
    const detached = monitors.filter((m) => !m.is_attached);
    if (detached.length === 0) {
      showToast('All detected monitors are already enabled.', 'info');
      return;
    }

    setActionInProgress('restore');
    try {
      for (const d of detached) {
        await setMonitorAttached(d.device_name, true);
      }
      const updated = await fetchAllMonitors();
      setMonitors(updated);
      showToast('Restored all attached displays into desktop topology.', 'success');
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err) {
      showToast(`Error restoring displays: ${err}`, 'warning');
    } finally {
      setActionInProgress(null);
    }
  };

  const attachedCount = monitors.filter((m) => m.is_attached).length;
  const primaryMonitor = monitors.find((m) => m.is_primary);

  return (
    <div className="flex-1 h-full flex flex-col justify-between p-4 overflow-hidden select-none bg-m3-surface text-m3-on-surface">
      {/* Top Header Card */}
      <div className="shrink-0 p-4 rounded-3xl bg-m3-surface-container border border-m3-outline-subtle shadow-m3-1 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-m3-primary-container border border-m3-primary/30 flex items-center justify-center text-m3-primary shadow-m3-1 shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-display font-extrabold text-m3-on-surface tracking-tight">
                  Display Manager
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-m3-primary/15 text-m3-primary border border-m3-primary/30">
                  {attachedCount} Active / {monitors.length} Total
                </span>
                {primaryMonitor && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono text-m3-secondary bg-m3-surface-container-high border border-m3-outline-subtle">
                    Primary: {primaryMonitor.device_name} ({primaryMonitor.width}×
                    {primaryMonitor.height} @ {primaryMonitor.refresh_rate}Hz)
                  </span>
                )}
              </div>
              <p className="text-xs text-m3-on-surface-variant font-medium mt-0.5">
                Enable or disable auxiliary monitors on demand • Isolate DWM GPU
                pipeline for competitive zero-latency gaming
              </p>
            </div>
          </div>

          {/* Top Action Bar */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEsportsSingleMonitorMode}
              disabled={actionInProgress !== null}
              className="px-3 py-1.5 rounded-full bg-m3-tertiary-container hover:bg-m3-tertiary text-m3-on-tertiary-container hover:text-m3-on-tertiary border border-m3-tertiary/40 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              title="Disable all secondary displays for pure competitive gaming focus and 0 mixed-Hz stutter"
            >
              <Zap className="w-3.5 h-3.5 text-m3-tertiary" />
              <span>Esports Mode (Single Mon)</span>
            </button>

            <button
              onClick={handleRestoreAllMonitors}
              disabled={actionInProgress !== null}
              className="px-3 py-1.5 rounded-full bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle font-medium text-xs transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
            >
              <RotateCw className="w-3.5 h-3.5 text-m3-primary" />
              <span>Enable All</span>
            </button>

            <button
              onClick={loadMonitors}
              disabled={loading}
              className="p-2 rounded-full bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Display Topology"
            >
              <RefreshCw
                className={`w-4 h-4 text-m3-primary ${
                  loading ? 'animate-spin' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div
            className={`mt-2.5 px-3 py-2 rounded-2xl flex items-center justify-between text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200 border ${
              toastMessage.type === 'warning'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : toastMessage.type === 'info'
                ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
                : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {toastMessage.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 ml-4 font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area: Visual Monitor Cards Grid */}
      <div className="flex-1 flex flex-col justify-between min-h-0 space-y-3">
        {/* Monitors List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {monitors.map((mon, index) => {
            const isPrimary = mon.is_primary;
            const isAttached = mon.is_attached;
            const isProcessing = actionInProgress === mon.device_name;

            return (
              <div
                key={mon.device_name}
                className={`rounded-3xl p-4 border flex flex-col justify-between transition-all duration-200 shadow-m3-1 relative overflow-hidden ${
                  isPrimary
                    ? 'bg-m3-surface-container-high/90 border-m3-primary/40 ring-1 ring-m3-primary/20'
                    : isAttached
                    ? 'bg-m3-surface-container border-m3-outline-subtle'
                    : 'bg-m3-surface-container-lowest/60 border-m3-outline-subtle/50 opacity-75'
                }`}
              >
                {/* Primary Corner Ribbon */}
                {isPrimary && (
                  <div className="absolute top-0 right-0 px-3 py-0.5 bg-m3-primary text-m3-on-primary text-[10px] font-mono font-bold rounded-bl-xl shadow-xs flex items-center space-x-1">
                    <Crown className="w-3 h-3" />
                    <span>PRIMARY</span>
                  </div>
                )}

                {/* Top Section: Monitor Title & Status */}
                <div>
                  <div className="flex items-start justify-between pr-14">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${
                          isAttached
                            ? 'bg-m3-primary-container text-m3-primary border-m3-primary/30'
                            : 'bg-m3-surface-container-lowest text-m3-outline border-m3-outline-subtle'
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-display font-bold text-sm text-m3-on-surface truncate">
                            Display {index + 1}
                          </span>
                          <span className="font-mono text-[10px] text-m3-on-surface-variant">
                            {mon.device_name}
                          </span>
                        </div>
                        <p className="text-[11px] text-m3-on-surface-variant truncate font-medium">
                          {mon.monitor_name || 'Generic PnP Monitor'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Screen Ratio Preview Box */}
                  <div className="mt-3.5 mb-3 p-3 rounded-2xl bg-m3-surface-container-lowest/90 border border-m3-outline-subtle/70 flex flex-col items-center justify-center">
                    <div
                      className={`rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                        mon.orientation.includes('Portrait')
                          ? 'w-16 h-24'
                          : 'w-28 h-18'
                      } ${
                        isAttached
                          ? isPrimary
                            ? 'border-m3-primary bg-m3-primary/10 shadow-[0_0_12px_rgba(208,188,255,0.2)]'
                            : 'border-m3-secondary bg-m3-secondary/10'
                          : 'border-m3-outline/40 bg-transparent border-dashed'
                      }`}
                    >
                      {isAttached ? (
                        <>
                          <span className="font-display font-bold text-xs text-m3-on-surface tabular-nums">
                            {mon.width}×{mon.height}
                          </span>
                          <span className="font-mono text-[10px] text-m3-primary font-semibold tabular-nums mt-0.5">
                            {mon.refresh_rate} Hz
                          </span>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-m3-outline space-y-0.5">
                          <Power className="w-3.5 h-3.5 opacity-60" />
                          <span className="text-[9px] font-mono uppercase font-semibold">
                            Disabled
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between w-full mt-2.5 text-[11px] text-m3-on-surface-variant font-medium px-1">
                      <span className="flex items-center space-x-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isAttached
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                              : 'bg-m3-outline'
                          }`}
                        />
                        <span>{isAttached ? 'Active' : 'Disconnected'}</span>
                      </span>
                      <span className="font-mono text-[10px]">
                        Pos: ({mon.position_x}, {mon.position_y})
                      </span>
                      <span className="font-mono text-[10px] text-m3-secondary">
                        {mon.orientation.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Interactive Controls */}
                <div className="pt-2.5 border-t border-m3-outline-subtle flex items-center justify-between">
                  {/* Enable / Disable Toggle Switch */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={isPrimary || isProcessing}
                      onClick={() => handleToggleAttached(mon)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:cursor-not-allowed ${
                        isAttached ? 'bg-m3-primary' : 'bg-m3-surface-container-highest'
                      } ${isPrimary ? 'opacity-60' : ''}`}
                      title={
                        isPrimary
                          ? 'Primary monitor is protected and cannot be disabled'
                          : isAttached
                          ? 'Click to Disable Display'
                          : 'Click to Enable Display'
                      }
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isAttached
                            ? 'translate-x-5 bg-m3-on-primary'
                            : 'translate-x-0 bg-m3-outline'
                        }`}
                      />
                    </button>

                    <span className="text-xs font-medium text-m3-on-surface">
                      {isPrimary ? (
                        <span className="flex items-center space-x-1 text-m3-primary text-[11px] font-semibold">
                          <Lock className="w-3 h-3" />
                          <span>Protected</span>
                        </span>
                      ) : isAttached ? (
                        'Enabled'
                      ) : (
                        <span className="text-m3-outline">Disabled</span>
                      )}
                    </span>
                  </div>

                  {/* Make Primary Button (if not already primary) */}
                  {!isPrimary && (
                    <button
                      onClick={() => handleMakePrimary(mon)}
                      disabled={!isAttached || isProcessing}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-m3-primary hover:text-m3-on-primary bg-m3-primary/10 hover:bg-m3-primary border border-m3-primary/30 transition-all flex items-center space-x-1 disabled:opacity-40 active:scale-95"
                      title="Set this display as the Windows Primary Desktop Display"
                    >
                      <Crown className="w-3 h-3" />
                      <span>Make Primary</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Hardware Info Bar (Esports Guidance & Safety Guarantee) */}
        <div className="p-3.5 rounded-3xl bg-m3-surface-container-low border border-m3-outline-subtle flex items-center justify-between text-xs text-m3-on-surface-variant shadow-m3-1">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-m3-surface-container flex items-center justify-center text-m3-primary shrink-0 border border-m3-outline-subtle">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-m3-on-surface text-xs">
                Zero Mixed-Hz Input Latency Architecture
              </p>
              <p className="text-[11px] text-m3-on-surface-variant leading-tight">
                Running high refresh rate panels (260Hz) alongside 60Hz secondary monitors causes Windows DWM compositor frame drops. Disabling secondary displays during tournaments guarantees maximum 1% low FPS.
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-2 shrink-0">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-semibold bg-m3-surface-container-high border border-m3-outline-subtle text-m3-on-surface">
              Primary Screen Guard Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
