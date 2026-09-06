import React, { useState, useEffect, useRef } from 'react';
import {
  Wand2,
  Sliders,
  Shield,
  RotateCcw,
  Check,
  AlertTriangle,
  Play,
  FileCode2,
  Cpu,
  RefreshCw,
  ExternalLink,
  Zap,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type { DisplayInfo } from '../types';
import {
  applyResolution,
  savePreferredStretchedRes,
  applyCustomResToAllConfigs,
  launchCru,
  restartGraphicsDriver,
  resetAllCruOverrides,
} from '../utils/ipc';

interface CustomResolutionProps {
  displayInfo: DisplayInfo | null;
  onRefreshDisplayInfo?: () => void;
}

interface AspectRatioPreset {
  label: string;
  ratioLabel: string;
  calcWidth: (nativeH: number) => number;
  description: string;
  hitboxGain: string;
}

const PRESETS: AspectRatioPreset[] = [
  {
    label: '1.45:1 Golden Ratio',
    ratioLabel: '1.45:1 True Stretch',
    calcWidth: (h) => {
      const calc = Math.round(h * 1.45) + 2;
      return calc % 2 === 0 ? calc : calc + 1;
    },
    description: 'Esports gold standard: 32% wider hitboxes with native vertical FOV.',
    hitboxGain: '+32.4%',
  },
  {
    label: '4:3 Competitive',
    ratioLabel: '4:3 Classic',
    calcWidth: (h) => {
      const calc = Math.round((h * 4) / 3);
      return calc % 2 === 0 ? calc : calc + 1;
    },
    description: 'CS / Quake legacy: Maximum horizontal stretch and target width.',
    hitboxGain: '+33.3%',
  },
  {
    label: '16:10 Extended',
    ratioLabel: '16:10 Balanced',
    calcWidth: (h) => {
      const calc = Math.round((h * 16) / 10);
      return calc % 2 === 0 ? calc : calc + 1;
    },
    description: 'Subtle stretch: Smooth pixel density with 10% wider models.',
    hitboxGain: '+10.0%',
  },
  {
    label: '5:4 Ultra Wide',
    ratioLabel: '5:4 Extreme',
    calcWidth: (h) => {
      const calc = Math.round((h * 5) / 4);
      return calc % 2 === 0 ? calc : calc + 1;
    },
    description: 'Aggressive stretch: Giant player models for ultra-close angles.',
    hitboxGain: '+44.0%',
  },
];

export const CustomResolution: React.FC<CustomResolutionProps> = ({
  displayInfo,
  onRefreshDisplayInfo,
}) => {
  const nativeW = displayInfo?.native_width || 2560;
  const nativeH = displayInfo?.native_height || 1440;
  const defaultHz = displayInfo?.current_hz || 260;

  const [width, setWidth] = useState<number>(() => {
    const calc = Math.round(nativeH * 1.45) + 2;
    return calc % 2 === 0 ? calc : calc + 1;
  });
  const [height, setHeight] = useState<number>(nativeH);
  const [hz, setHz] = useState<number>(defaultHz);
  const [lockReadonly, setLockReadonly] = useState<boolean>(true);

  // Safe Test Mode State
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(15);
  const [safeMode, setSafeMode] = useState<{
    width: number;
    height: number;
    hz: number;
  } | null>(null);

  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [cruLoading, setCruLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (
    text: string,
    type: 'success' | 'warning' | 'info' = 'success'
  ) => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Real-time calculation metrics
  const ratio = (width / height).toFixed(2);
  const pixelCount = width * height;
  const nativePixelCount = nativeW * nativeH;
  const fillRateDelta = Math.round(
    ((nativePixelCount - pixelCount) / nativePixelCount) * 100
  );
  const hitboxMultiplier = ((16 / 9) / (width / height) - 1) * 100;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Safe Test Watchdog Countdown
  useEffect(() => {
    if (!isTesting) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setCountdown(15);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time expired! Screen might have gone black or user walked away. Revert automatically!
          revertSafeMode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTesting]);

  // Global Escape key handler to revert during test
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTesting) {
        revertSafeMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTesting, safeMode]);

  // Start Safe Test Mode
  const startSafeTest = async () => {
    if (width <= 0 || height <= 0 || hz <= 0) {
      showToast('Please enter valid resolution dimensions and refresh rate.', 'warning');
      return;
    }

    // Save previous safe mode
    const currentSafe = {
      width: displayInfo?.current_width || nativeW,
      height: displayInfo?.current_height || nativeH,
      hz: displayInfo?.current_hz || defaultHz,
    };
    setSafeMode(currentSafe);
    setIsTesting(true);

    try {
      await applyResolution(width, height, hz);
      if (onRefreshDisplayInfo) onRefreshDisplayInfo();
    } catch (err) {
      showToast(`Failed to switch resolution: ${err}`, 'warning');
      setIsTesting(false);
    }
  };

  // Revert back to original safe resolution
  const revertSafeMode = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTesting(false);

    if (safeMode) {
      try {
        await applyResolution(safeMode.width, safeMode.height, safeMode.hz);
        showToast(
          `Reverted back to safe resolution (${safeMode.width}×${safeMode.height} @ ${safeMode.hz}Hz).`,
          'info'
        );
        if (onRefreshDisplayInfo) onRefreshDisplayInfo();
      } catch (err) {
        showToast(`Error reverting resolution: ${err}`, 'warning');
      }
    }
    setSafeMode(null);
  };

  // Keep Changes: permanently saves custom resolution
  const keepChanges = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTesting(false);
    setSafeMode(null);

    try {
      await savePreferredStretchedRes(width, height);
      showToast(
        `Success! Resolution ${width}×${height} @ ${hz}Hz confirmed and saved as default stretched preset.`,
        'success'
      );
      if (onRefreshDisplayInfo) onRefreshDisplayInfo();
    } catch (err) {
      showToast(`Saved resolution mode: ${err}`, 'info');
    }
  };

  // Direct Apply & Sync to Game Configs
  const handleApplyToGameConfigs = async () => {
    setIsApplying(true);
    try {
      const msg = await applyCustomResToAllConfigs(width, height, lockReadonly);
      await savePreferredStretchedRes(width, height);
      showToast(msg, 'success');
      if (onRefreshDisplayInfo) onRefreshDisplayInfo();
    } catch (err) {
      showToast(`Failed to sync config: ${err}`, 'warning');
    } finally {
      setIsApplying(false);
    }
  };

  // Launch CRU (Custom Resolution Utility)
  const handleLaunchCru = async () => {
    setCruLoading('cru');
    try {
      await launchCru();
      showToast('Custom Resolution Utility (CRU by ToastyX) launched.', 'info');
    } catch (err) {
      showToast(`Failed to launch CRU: ${err}`, 'warning');
    } finally {
      setCruLoading(null);
    }
  };

  // Restart Graphics Driver
  const handleRestartDriver = async () => {
    setCruLoading('restart');
    try {
      const res = await restartGraphicsDriver();
      showToast(res, 'success');
      if (onRefreshDisplayInfo) onRefreshDisplayInfo();
    } catch (err) {
      showToast(`Driver restart note: ${err}`, 'info');
    } finally {
      setCruLoading(null);
    }
  };

  // Reset All EDID Overrides
  const handleResetAllOverrides = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset all custom EDID overrides to monitor factory defaults?'
      )
    ) {
      return;
    }
    setCruLoading('reset');
    try {
      const res = await resetAllCruOverrides();
      showToast(res, 'success');
      if (onRefreshDisplayInfo) onRefreshDisplayInfo();
    } catch (err) {
      showToast(`Reset note: ${err}`, 'info');
    } finally {
      setCruLoading(null);
    }
  };

  const supportedRates =
    displayInfo?.supported_refresh_rates &&
    displayInfo.supported_refresh_rates.length > 0
      ? displayInfo.supported_refresh_rates
      : [260, 240, 165, 144, 120, 60];

  return (
    <div className="flex-1 h-full flex flex-col justify-between p-4 overflow-hidden select-none bg-m3-surface text-m3-on-surface relative">
      {/* SAFE TEST COUNTDOWN OVERLAY MODAL */}
      {isTesting && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-m3-surface-container-high border border-m3-primary/50 shadow-2xl flex flex-col items-center text-center space-y-4">
            {/* Animated Countdown Ring */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-m3-outline-subtle" />
              <div
                className="absolute inset-0 rounded-full border-4 border-m3-primary border-t-transparent animate-spin"
                style={{ animationDuration: '2s' }}
              />
              <span className="font-display font-extrabold text-2xl text-m3-primary tabular-nums">
                {countdown}s
              </span>
            </div>

            <div>
              <h3 className="font-display font-extrabold text-lg text-m3-on-surface">
                Testing Custom Resolution
              </h3>
              <p className="text-sm font-semibold text-m3-primary mt-0.5">
                {width} × {height} @ {hz} Hz
              </p>
              <p className="text-xs text-m3-on-surface-variant mt-2 max-w-xs leading-relaxed">
                Does your display look clear? If anything went wrong (black screen or out-of-range signal), do nothing—your monitor will automatically revert in {countdown} seconds.
              </p>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center space-x-3 w-full pt-2">
              <button
                onClick={keepChanges}
                className="flex-1 py-2.5 px-4 rounded-full bg-m3-primary text-m3-on-primary font-bold text-xs shadow-m3-1 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Keep Changes</span>
              </button>

              <button
                onClick={revertSafeMode}
                className="flex-1 py-2.5 px-4 rounded-full bg-m3-surface-container text-m3-on-surface hover:bg-m3-surface-container-highest border border-m3-outline font-semibold text-xs active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-4 h-4 text-m3-secondary" />
                <span>Revert Now (Esc)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="shrink-0 p-4 rounded-3xl bg-m3-surface-container border border-m3-outline-subtle shadow-m3-1 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-m3-primary-container border border-m3-primary/30 flex items-center justify-center text-m3-primary shadow-m3-1 shrink-0">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-display font-extrabold text-m3-on-surface tracking-tight">
                  Custom Resolution & Safe Tester
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-m3-primary/15 text-m3-primary border border-m3-primary/30">
                  Fail-Safe Watchdog Active
                </span>
              </div>
              <p className="text-xs text-m3-on-surface-variant font-medium mt-0.5">
                Build custom stretched display modes with instant 15s auto-revert protection & CRU EDID override integration
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold bg-m3-surface-container-high border border-m3-outline-subtle text-m3-on-surface">
              Active: {displayInfo?.current_width || nativeW}×
              {displayInfo?.current_height || nativeH} @ {displayInfo?.current_hz || defaultHz}Hz
            </span>
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

      {/* Main Grid: Left Builder & Right CRU Suite */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Left Column: Custom Resolution Generator & Safe Test (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between p-4 rounded-3xl bg-m3-surface-container border border-m3-outline-subtle shadow-m3-1 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-m3-outline flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-m3-primary" />
                <span>Resolution Inputs</span>
              </span>
              <span className="text-[11px] font-mono text-m3-primary font-semibold">
                Aspect: {ratio}:1 ({hitboxMultiplier > 0 ? `+${hitboxMultiplier.toFixed(1)}% hitbox` : '16:9 standard'})
              </span>
            </div>

            {/* Inputs Row (Width, Height, Hz) */}
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {/* Width Input */}
              <div className="p-2.5 rounded-2xl bg-m3-surface-container-high border border-m3-outline-subtle flex flex-col">
                <label className="text-[10px] font-mono uppercase text-m3-on-surface-variant font-semibold">
                  Width (px)
                </label>
                <input
                  type="number"
                  step="2"
                  min="640"
                  max="7680"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="bg-transparent text-m3-on-surface font-display font-extrabold text-base mt-1 focus:outline-hidden tabular-nums"
                />
              </div>

              {/* Height Input */}
              <div className="p-2.5 rounded-2xl bg-m3-surface-container-high border border-m3-outline-subtle flex flex-col">
                <label className="text-[10px] font-mono uppercase text-m3-on-surface-variant font-semibold">
                  Height (px)
                </label>
                <input
                  type="number"
                  step="2"
                  min="480"
                  max="4320"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="bg-transparent text-m3-on-surface font-display font-extrabold text-base mt-1 focus:outline-hidden tabular-nums"
                />
              </div>

              {/* Refresh Rate Dropdown */}
              <div className="p-2.5 rounded-2xl bg-m3-surface-container-high border border-m3-outline-subtle flex flex-col">
                <label className="text-[10px] font-mono uppercase text-m3-on-surface-variant font-semibold">
                  Refresh Rate
                </label>
                <select
                  value={hz}
                  onChange={(e) => setHz(Number(e.target.value))}
                  className="bg-transparent text-m3-primary font-display font-extrabold text-base mt-1 focus:outline-hidden cursor-pointer"
                >
                  {supportedRates.map((r) => (
                    <option key={r} value={r} className="bg-m3-surface-container text-m3-on-surface">
                      {r} Hz {r === defaultHz ? '(Native)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Presets Buttons Grid */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-m3-outline uppercase font-semibold">
                Quick Aspect Ratio Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => {
                  const targetW = preset.calcWidth(height);
                  const isCurrent = width === targetW;

                  return (
                    <button
                      key={preset.label}
                      onClick={() => setWidth(targetW)}
                      className={`p-2 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-m3-primary-container border-m3-primary text-m3-on-primary-container ring-1 ring-m3-primary/30'
                          : 'bg-m3-surface-container-high hover:bg-m3-surface-container-highest border-m3-outline-subtle text-m3-on-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold font-display">
                          {preset.label}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                            isCurrent
                              ? 'bg-m3-primary text-m3-on-primary'
                              : 'bg-m3-surface-container text-m3-secondary border border-m3-outline-subtle'
                          }`}
                        >
                          {targetW}×{height}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px] opacity-85">
                        <span className="truncate">{preset.description}</span>
                        <span className="font-mono text-m3-primary font-bold shrink-0 ml-1">
                          {preset.hitboxGain}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Test & Apply Action Bar */}
          <div className="pt-2 border-t border-m3-outline-subtle space-y-2">
            <div className="flex items-center justify-between text-xs text-m3-on-surface-variant font-medium">
              <span className="flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-m3-primary" />
                <span>15s Revert Watchdog protects against black screens</span>
              </span>
              {fillRateDelta > 0 && (
                <span className="font-mono text-emerald-400 font-semibold">
                  +{fillRateDelta}% GPU Fillrate Headroom
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2.5">
              {/* The Safe Test Button */}
              <button
                onClick={startSafeTest}
                className="flex-1 py-2.5 px-4 rounded-full bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary font-display font-extrabold text-xs shadow-m3-1 transition-all flex items-center justify-center space-x-2 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Test Resolution (15s Auto-Revert)</span>
              </button>

              {/* Sync to Game Configs */}
              <button
                onClick={handleApplyToGameConfigs}
                disabled={isApplying}
                className="py-2.5 px-4 rounded-full bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle font-semibold text-xs transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
                title="Sync this custom resolution directly to VALORANT GameUserSettings.ini"
              >
                <FileCode2 className="w-4 h-4 text-m3-secondary" />
                <span>Sync Game Files</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: CRU (Custom Resolution Utility) & Driver Suite (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-3xl bg-m3-surface-container border border-m3-outline-subtle shadow-m3-1 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-m3-tertiary-container text-m3-tertiary flex items-center justify-center shrink-0 border border-m3-tertiary/30">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xs text-m3-on-surface">
                    Hardware EDID & CRU Suite
                  </h3>
                  <p className="text-[10px] text-m3-on-surface-variant font-medium">
                    Powered by ToastyX CRU v1.5.3
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono text-m3-primary bg-m3-primary/15 border border-m3-primary/30">
                Driver Hook
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-m3-surface-container-high border border-m3-outline-subtle text-xs space-y-2 mb-3">
              <p className="text-[11px] text-m3-on-surface font-medium leading-snug">
                Custom Resolution Utility (CRU) creates software-based EDID overrides directly in the Windows Registry, bypassing GPU driver restrictions for arbitrary refresh rates.
              </p>
              <div className="pt-2 border-t border-m3-outline-subtle/60 flex items-center justify-between text-[10px] text-m3-on-surface-variant font-mono">
                <span>Registry: HKLM\SYSTEM\DISPLAY</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </div>
            </div>

            {/* CRU Action Controls */}
            <div className="space-y-2">
              {/* Launch CRU Button */}
              <button
                onClick={handleLaunchCru}
                disabled={cruLoading !== null}
                className="w-full p-2.5 rounded-2xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle text-xs font-semibold transition-all flex items-center justify-between active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center space-x-2.5">
                  <Layers className="w-4 h-4 text-m3-primary" />
                  <div className="text-left">
                    <span className="block font-bold">Open CRU Editor</span>
                    <span className="text-[10px] text-m3-on-surface-variant block font-normal">
                      Detailed timing descriptors & FreeSync
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-m3-outline" />
              </button>

              {/* Restart Graphics Driver Button */}
              <button
                onClick={handleRestartDriver}
                disabled={cruLoading !== null}
                className="w-full p-2.5 rounded-2xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle text-xs font-semibold transition-all flex items-center justify-between active:scale-95 disabled:opacity-50"
                title="Restarts graphics driver stack to apply newly added resolutions without rebooting"
              >
                <div className="flex items-center space-x-2.5">
                  <RefreshCw
                    className={`w-4 h-4 text-m3-tertiary ${
                      cruLoading === 'restart' ? 'animate-spin' : ''
                    }`}
                  />
                  <div className="text-left">
                    <span className="block font-bold">Restart Graphics Driver</span>
                    <span className="text-[10px] text-m3-on-surface-variant block font-normal">
                      Instant driver reload via restart64 (No reboot)
                    </span>
                  </div>
                </div>
                <Zap className="w-3.5 h-3.5 text-m3-tertiary" />
              </button>

              {/* Emergency Reset Button */}
              <button
                onClick={handleResetAllOverrides}
                disabled={cruLoading !== null}
                className="w-full p-2.5 rounded-2xl bg-m3-surface-container-lowest hover:bg-red-950/40 text-m3-on-surface border border-m3-outline-subtle/80 hover:border-red-500/50 text-xs font-semibold transition-all flex items-center justify-between active:scale-95 disabled:opacity-50"
                title="Emergency reset for all EDID overrides back to monitor factory default"
              >
                <div className="flex items-center space-x-2.5">
                  <RotateCcw className="w-4 h-4 text-red-400" />
                  <div className="text-left">
                    <span className="block font-bold text-red-300">
                      Emergency Reset Overrides
                    </span>
                    <span className="text-[10px] text-m3-on-surface-variant block font-normal">
                      Runs reset-all.exe if screen behaves erratically
                    </span>
                  </div>
                </div>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </div>

          {/* Config lock toggle */}
          <div className="pt-2 border-t border-m3-outline-subtle flex items-center justify-between text-xs">
            <span className="text-[11px] text-m3-on-surface-variant font-medium">
              Write-Protect (Read-Only) Game Configs
            </span>
            <button
              type="button"
              onClick={() => setLockReadonly(!lockReadonly)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                lockReadonly ? 'bg-m3-primary' : 'bg-m3-surface-container-highest'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                  lockReadonly
                    ? 'translate-x-4 bg-m3-on-primary'
                    : 'translate-x-0 bg-m3-outline'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
