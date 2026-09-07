import React, { useState, useEffect } from 'react';
import {
  Monitor,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Crown,
  LayoutGrid,
  ShieldCheck,
  Power,
  RotateCw,
} from 'lucide-react';
import type { MonitorDevice } from '../types';
import {
  fetchAllMonitors,
  setMonitorDeviceEnabled,
  setMonitorPrimary,
} from '../utils/ipc';

interface DisplayManagerProps {
  onRefreshTelemetry?: () => void;
}

const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  if (x === 0) return y;
  if (y === 0) return x;
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
};

/** "16:9 (1.78)" — safe for 0 / unknown resolutions. Never NaN/Infinity. */
const formatAspectRatio = (width: number, height: number): string => {
  if (!width || !height || width <= 0 || height <= 0) return 'Unknown';
  const d = gcd(width, height);
  const rw = width / d;
  const rh = height / d;
  const dec = (width / height).toFixed(2);
  return `${rw}:${rh} (${dec})`;
};

const hasValidResolution = (mon: MonitorDevice) =>
  !!mon.width && !!mon.height && mon.width > 0 && mon.height > 0;

/** Scaled preview box dims (px) preserving the true aspect ratio. */
const previewBoxDims = (mon: MonitorDevice): { w: number; h: number } | null => {
  if (!hasValidResolution(mon)) return null;
  const maxW = 112;
  const maxH = 72;
  const scale = Math.min(maxW / mon.width, maxH / mon.height);
  const w = Math.max(24, Math.round(mon.width * scale));
  const h = Math.max(18, Math.round(mon.height * scale));
  return { w, h };
};

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

  // Always prefer the PnP instance path (MONITOR\...) over \\.\DISPLAYx.
  const monitorDeviceId = (mon: MonitorDevice) =>
    mon.device_id && mon.device_id.length > 0 ? mon.device_id : mon.device_name;
  const isDeviceDisabled = (mon: MonitorDevice) => !!mon.is_device_disabled;

  const handleToggleDevice = async (mon: MonitorDevice) => {
    const currentlyDisabled = isDeviceDisabled(mon);
    const nextEnabled = currentlyDisabled;
    const id = monitorDeviceId(mon);

    if (!nextEnabled) {
      // Disabling: safety checks.
      const enabledCount = monitors.filter((m) => !isDeviceDisabled(m)).length;
      if (enabledCount <= 1 && !currentlyDisabled) {
        showToast(
          'Refusing to disable the last active monitor device. Re-enable another display first.',
          'warning'
        );
        return;
      }
      if (mon.is_primary) {
        const ok = window.confirm(
          `Disable PRIMARY display device "${mon.monitor_name || mon.device_name}" in Device Manager?\n\n` +
            `This is a true Device Manager disable for Valorant True Stretch. ` +
            `Safety: it will auto re-enable in 15s unless you keep it. Continue?`
        );
        if (!ok) return;
      }
    }

    setActionInProgress(mon.device_name);
    // Optimistic UI update (device state only).
    setMonitors((prev) =>
      prev.map((m) =>
        m.device_name === mon.device_name
          ? { ...m, is_device_disabled: !nextEnabled }
          : m
      )
    );

    try {
      const updated = await setMonitorDeviceEnabled(id, nextEnabled);
      setMonitors(updated);
      showToast(
        `${mon.monitor_name || mon.device_name} ${
          nextEnabled
            ? 'Enable device: re-enabled in Device Manager.'
            : 'Disable device: disabled in Device Manager (hidden from Valorant).'
        }${mon.is_primary && !nextEnabled ? ' Auto re-enable in 15s (safety).' : ''}`,
        nextEnabled ? 'success' : 'warning'
      );
      if (onRefreshTelemetry) onRefreshTelemetry();

      // 15s auto-revert safety when the primary device was disabled.
      if (mon.is_primary && !nextEnabled) {
        setTimeout(async () => {
          try {
            const latest = await fetchAllMonitors();
            const stillDisabled = latest.find(
              (m) => m.device_name === mon.device_name
            );
            if (stillDisabled && !!stillDisabled.is_device_disabled) {
              const reverted = await setMonitorDeviceEnabled(id, true);
              setMonitors(reverted);
              showToast(
                `Safety revert: primary device "${mon.monitor_name || mon.device_name}" auto re-enabled after 15s.`,
                'info'
              );
              if (onRefreshTelemetry) onRefreshTelemetry();
            }
          } catch (e) {
            console.error('Primary auto-revert failed:', e);
          }
        }, 15000);
      }
    } catch (err) {
      const msg = String(err);
      if (msg.toLowerCase().includes('admin')) {
        showToast(
          `Admin required: run TrueStretch as administrator to enable/disable monitor devices. (${msg})`,
          'warning'
        );
      } else {
        showToast(`Device Manager change failed: ${msg}`, 'warning');
      }
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

  // True Stretch Mode: true Device Manager disable for secondaries ONLY.
  // No CCD fallback — surface the admin error clearly instead.
  const handleEsportsSingleMonitorMode = async () => {
    const secondaries = monitors.filter((m) => !m.is_primary && !m.is_device_disabled);
    if (secondaries.length === 0) {
      showToast('True Stretch Mode already active (secondary devices disabled).', 'info');
      return;
    }

    setActionInProgress('esports');
    try {
      let deviceDisabled = 0;
      for (const s of secondaries) {
        await setMonitorDeviceEnabled(monitorDeviceId(s), false);
        deviceDisabled += 1;
      }
      const updated = await fetchAllMonitors();
      setMonitors(updated);
      showToast(
        `True Stretch Mode: Disable device in Device Manager for ${deviceDisabled} secondary display(s). Hidden from Valorant — DWM scanout lag eliminated!`,
        'success'
      );
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err) {
      const msg = String(err);
      if (msg.toLowerCase().includes('admin')) {
        showToast(
          `Admin required: run TrueStretch as administrator to use True Stretch Mode (Device Manager disable). No changes were made. (${msg})`,
          'warning'
        );
      } else {
        showToast(`Error configuring True Stretch Mode: ${msg}`, 'warning');
      }
      loadMonitors();
    } finally {
      setActionInProgress(null);
    }
  };

  // Restore All: re-enable Device Manager devnodes ONLY. No CCD re-attach.
  const handleRestoreAllMonitors = async () => {
    const disabledDevices = monitors.filter((m) => !!m.is_device_disabled);
    if (disabledDevices.length === 0) {
      showToast('All detected monitors are already enabled.', 'info');
      return;
    }

    setActionInProgress('restore');
    try {
      let reEnabled = 0;
      for (const d of disabledDevices) {
        await setMonitorDeviceEnabled(monitorDeviceId(d), true);
        reEnabled += 1;
      }
      const updated = await fetchAllMonitors();
      setMonitors(updated);
      showToast(
        `Restore All: Enable device in Device Manager for ${reEnabled} display(s).`,
        'success'
      );
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err) {
      const msg = String(err);
      if (msg.toLowerCase().includes('admin')) {
        showToast(
          `Admin required: run TrueStretch as administrator to re-enable monitor devices. (${msg})`,
          'warning'
        );
      } else {
        showToast(`Error restoring displays: ${msg}`, 'warning');
      }
      loadMonitors();
    } finally {
      setActionInProgress(null);
    }
  };

  const activeCount = monitors.filter((m) => !isDeviceDisabled(m)).length;
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
                  {activeCount} Active / {monitors.length} Total
                </span>
                {primaryMonitor && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono text-m3-secondary bg-m3-surface-container-high border border-m3-outline-subtle">
                    Primary: {primaryMonitor.device_name} ({primaryMonitor.width}×
                    {primaryMonitor.height} @ {primaryMonitor.refresh_rate}Hz)
                  </span>
                )}
              </div>
              <p className="text-xs text-m3-on-surface-variant font-medium mt-0.5">
                Disable device = true Device Manager disable for Valorant True
                Stretch (admin)
              </p>
            </div>
          </div>

          {/* Top Action Bar */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEsportsSingleMonitorMode}
              disabled={actionInProgress !== null}
              className="px-3 py-1.5 rounded-full bg-m3-tertiary-container hover:bg-m3-tertiary text-m3-on-tertiary-container hover:text-m3-on-tertiary border border-m3-tertiary/40 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              title="True Device Manager disable for all secondary displays (admin)."
            >
              <Zap className="w-3.5 h-3.5 text-m3-tertiary" />
              <span>True Stretch Mode</span>
            </button>

            <button
              onClick={handleRestoreAllMonitors}
              disabled={actionInProgress !== null}
              className="px-3 py-1.5 rounded-full bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle font-medium text-xs transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
              title="Re-enable all monitor devices in Device Manager"
            >
              <RotateCw className="w-3.5 h-3.5 text-m3-primary" />
              <span>Restore All</span>
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
            const deviceDisabled = !!mon.is_device_disabled;
            const isProcessing = actionInProgress === mon.device_name;
            const validRes = hasValidResolution(mon);
            const aspectLabel = formatAspectRatio(mon.width, mon.height);
            const dims = previewBoxDims(mon);
            const statusLabel = deviceDisabled
              ? 'Device Disabled'
              : isAttached
                ? 'Active'
                : 'Inactive';

            return (
              <div
                key={mon.device_id && mon.device_id.length > 0 ? mon.device_id : mon.device_name}
                className={`rounded-3xl p-4 border flex flex-col justify-between transition-all duration-200 shadow-m3-1 relative overflow-hidden ${
                  isPrimary
                    ? 'bg-m3-surface-container-high/90 border-m3-primary/40 ring-1 ring-m3-primary/20'
                    : isAttached && !deviceDisabled
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
                          !deviceDisabled && isAttached
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

                  {/* Visual Screen Ratio Preview Box (true aspect) */}
                  <div className="mt-3.5 mb-3 p-3 rounded-2xl bg-m3-surface-container-lowest/90 border border-m3-outline-subtle/70 flex flex-col items-center justify-center">
                    <div className="min-h-[76px] flex items-center justify-center">
                      <div
                        className={`rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                          deviceDisabled
                            ? 'border-red-500/60 bg-red-950/30 border-dashed'
                            : !deviceDisabled && isAttached
                            ? isPrimary
                              ? 'border-m3-primary bg-m3-primary/10 shadow-[0_0_12px_rgba(208,188,255,0.2)]'
                              : 'border-m3-secondary bg-m3-secondary/10'
                            : 'border-m3-outline/40 bg-transparent border-dashed'
                        }`}
                        style={
                          dims
                            ? { width: dims.w, height: dims.h }
                            : { width: 112, height: 64 }
                        }
                      >
                        {validRes ? (
                          <>
                            <span className="font-display font-bold text-xs text-m3-on-surface tabular-nums">
                              {mon.width}×{mon.height}
                            </span>
                            <span className="font-mono text-[10px] text-m3-primary font-semibold tabular-nums mt-0.5">
                              {mon.refresh_rate} Hz
                            </span>
                            {deviceDisabled && (
                              <span className="flex items-center gap-1 text-[9px] font-mono uppercase font-semibold text-red-300 mt-0.5">
                                <Power className="w-3 h-3 opacity-80" />
                                Device Disabled
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-m3-outline space-y-0.5 px-2 text-center">
                            <Power className="w-3.5 h-3.5 opacity-60" />
                            <span className="text-[9px] font-mono uppercase font-semibold">
                              {deviceDisabled ? 'Device Disabled' : 'Unknown resolution'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full mt-2.5 text-[11px] text-m3-on-surface-variant font-medium px-1">
                      <span className="flex items-center space-x-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            deviceDisabled
                              ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]'
                              : isAttached
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                              : 'bg-amber-400'
                          }`}
                        />
                        <span>{statusLabel}</span>
                      </span>
                      <span className="font-mono text-[10px]">
                        Pos: ({mon.position_x}, {mon.position_y})
                      </span>
                      <span className="font-mono text-[10px] text-m3-secondary">
                        {mon.orientation.split(' ')[0]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between w-full mt-1 px-1 text-[10px] font-mono text-m3-on-surface-variant">
                      <span>
                        {validRes ? `${mon.width}×${mon.height}` : 'Resolution unknown'}
                      </span>
                      <span className="text-m3-secondary">Aspect {aspectLabel}</span>
                    </div>
                    {mon.device_id && (
                      <p className="w-full truncate text-center font-mono text-[9px] text-m3-on-surface-variant/70 mt-1" title={mon.device_id}>
                        {mon.device_id}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Interactive Controls: resolution info + Make Primary */}
                <div className="pt-2.5 border-t border-m3-outline-subtle flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-m3-on-surface truncate">
                      {validRes ? `${mon.width}×${mon.height} @ ${mon.refresh_rate}Hz` : 'Resolution unknown'}
                    </p>
                    <p className="text-[10px] font-mono text-m3-on-surface-variant">
                      Aspect {aspectLabel}
                    </p>
                  </div>

                  {/* Make Primary Button (if not already primary) */}
                  {!isPrimary ? (
                    <button
                      onClick={() => handleMakePrimary(mon)}
                      disabled={!isAttached || isProcessing || deviceDisabled}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-m3-primary hover:text-m3-on-primary bg-m3-primary/10 hover:bg-m3-primary border border-m3-primary/30 transition-all flex items-center space-x-1 disabled:opacity-40 active:scale-95"
                      title="Set this display as the Windows Primary Desktop Display"
                    >
                      <Crown className="w-3 h-3" />
                      <span>Make Primary</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-m3-primary/15 text-m3-primary border border-m3-primary/30">
                      PRIMARY
                    </span>
                  )}
                </div>

                {/* Device Manager row: true disable for Valorant True Stretch */}
                <div className="mt-2 pt-2 border-t border-m3-outline-subtle/70 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-m3-on-surface flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-m3-tertiary shrink-0" />
                      Device Manager
                    </p>
                    <p className="text-[10px] text-m3-on-surface-variant leading-tight">
                      {deviceDisabled ? 'Disabled — hidden from games' : 'Enabled — visible to Valorant'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleDevice(mon)}
                    disabled={isProcessing}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center space-x-1 active:scale-95 disabled:opacity-40 shrink-0 ${
                      deviceDisabled
                        ? 'text-emerald-200 bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-500/40'
                        : 'text-red-200 bg-red-950/40 hover:bg-red-900/50 border-red-500/40'
                    }`}
                    title={
                      deviceDisabled
                        ? 'Re-enable this monitor device in Device Manager (admin)'
                        : 'Disable this monitor device in Device Manager (admin, for True Stretch — hides it from Valorant)'
                    }
                  >
                    <Power className="w-3 h-3" />
                    <span>{deviceDisabled ? 'Enable device' : 'Disable device'}</span>
                  </button>
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
                Running high refresh rate panels (260Hz) alongside 60Hz secondary monitors causes Windows DWM compositor frame drops. True Stretch Mode disables secondary devices in Device Manager (admin) so Valorant can't enumerate them — no letterbox. Re-enable restores devices; a reboot also re-enables PnP devices if needed.
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
