import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  RefreshCw,
  Crosshair,
  FileCode2,
  Lock,
  Unlock,
  Zap,
  Shield,
  X,
  RotateCcw,
} from 'lucide-react';
import type { ConfigFileInfo, DisplayInfo, DisplayMode } from '../types';
import { CustomResolution } from './CustomResolution';
import {
  fetchValorantConfigs,
  applyCustomResToAllConfigs,
  fetchPreferredStretchedRes,
  savePreferredStretchedRes,
  updateValorantConfig,
  listSupportedModes,
} from '../utils/ipc';

interface SettingsProps {
  displayInfo: DisplayInfo | null;
  onStretchResChanged?: (w: number, h: number) => void;
  onRefreshDisplayInfo?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  displayInfo,
  onStretchResChanged,
  onRefreshDisplayInfo,
}) => {
  const nativeW = displayInfo?.native_width || 2560;
  const nativeH = displayInfo?.native_height || 1440;

  // Stretched resolution target state
  const [stretchedW, setStretchedW] = useState<number>(2090);
  const [stretchedH, setStretchedH] = useState<number>(nativeH);
  const [customInputW, setCustomInputW] = useState<string>('2090');
  const [customInputH, setCustomInputH] = useState<string>(nativeH.toString());

  // Available display modes on PC
  const [supportedModes, setSupportedModes] = useState<DisplayMode[]>([]);

  // Game config files state
  const [configs, setConfigs] = useState<ConfigFileInfo[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [lockReadOnly, setLockReadOnly] = useState(true);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Signal to pre-fill Display Mode Lab when a target is chosen
  const [buildSignal, setBuildSignal] = useState<{ w: number; h: number; nonce: number } | null>(null);

  // Hidden / removed resolutions persisted in localStorage
  const [removedResolutions, setRemovedResolutions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('truestretch_removed_resolutions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleRemoveResolution = (w: number, h: number) => {
    const key = `${w}x${h}`;
    const next = [...removedResolutions, key];
    setRemovedResolutions(next);
    try {
      localStorage.setItem('truestretch_removed_resolutions', JSON.stringify(next));
    } catch (_) {}

    if (stretchedW === w && stretchedH === h) {
      handleSelectPreset(nativeW, nativeH);
    }
    setStatusBanner(`Removed ${w}×${h} from list. Click "Restore (${next.length} hidden)" to unhide.`);
  };

  const handleRestoreRemoved = () => {
    setRemovedResolutions([]);
    try {
      localStorage.removeItem('truestretch_removed_resolutions');
    } catch (_) {}
    setStatusBanner('Restored all hidden resolutions.');
  };

  const loadData = async () => {
    setIsLoadingConfigs(true);
    try {
      const [res, cfgs, modes] = await Promise.all([
        fetchPreferredStretchedRes(),
        fetchValorantConfigs(),
        listSupportedModes(),
      ]);
      setStretchedW(res[0]);
      setStretchedH(res[1]);
      setCustomInputW(res[0].toString());
      setCustomInputH(res[1].toString());
      setConfigs(cfgs);
      setSupportedModes(modes);
    } catch (e) {
      console.error('Failed to load settings data', e);
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefreshAll = async () => {
    await loadData();
    if (onRefreshDisplayInfo) {
      onRefreshDisplayInfo();
    }
  };

  // Helper for aspect ratio badges
  const getAspectBadge = (w: number, h: number) => {
    const r = w / h;
    if (Math.abs(r - 1.451) < 0.025 || (w === 2090 && h === 1440) || (w === 1568 && h === 1080)) {
      return { tag: '1.45:1', sub: 'Optimal', color: 'border-m3-tertiary/40 bg-m3-tertiary/15 text-m3-tertiary' };
    }
    if (Math.abs(r - 4 / 3) < 0.02) {
      return { tag: '4:3', sub: 'Classic', color: 'border-m3-primary/30 bg-m3-primary/10 text-m3-primary' };
    }
    if (Math.abs(r - 16 / 10) < 0.02) {
      return { tag: '16:10', sub: 'Balanced', color: 'border-m3-outline-subtle bg-m3-surface-container text-m3-secondary' };
    }
    if (Math.abs(r - 5 / 4) < 0.02) {
      return { tag: '5:4', sub: 'Ultra', color: 'border-m3-outline-subtle bg-m3-surface-container text-m3-on-surface-variant' };
    }
    if (Math.abs(r - 16 / 9) < 0.02) {
      return { tag: '16:9', sub: 'Native', color: 'border-m3-outline-subtle bg-m3-surface-container text-m3-outline' };
    }
    return { tag: `${r.toFixed(2)}:1`, sub: 'Custom', color: 'border-m3-outline-subtle bg-m3-surface-container text-m3-outline' };
  };

  // Unique available modes on user's PC, filtered to relevant stretched & native resolutions
  const availableModes = useMemo(() => {
    const modeMap = new Map<string, { width: number; height: number; maxHz: number }>();

    for (const m of supportedModes) {
      if (m.width > nativeW || m.height > nativeH) continue;
      const key = `${m.width}x${m.height}`;
      const isNativeMatch = m.width === nativeW && m.height === nativeH;
      if (!isNativeMatch && removedResolutions.includes(key)) continue;

      const prev = modeMap.get(key);
      if (!prev || m.refresh_rate > prev.maxHz) {
        modeMap.set(key, { width: m.width, height: m.height, maxHz: m.refresh_rate });
      }
    }

    // Ensure active target is in the list
    if (stretchedW && stretchedH && !removedResolutions.includes(`${stretchedW}x${stretchedH}`)) {
      const activeKey = `${stretchedW}x${stretchedH}`;
      if (!modeMap.has(activeKey)) {
        modeMap.set(activeKey, {
          width: stretchedW,
          height: stretchedH,
          maxHz: displayInfo?.current_hz || 260,
        });
      }
    }

    // Filter to stretched aspect ratios (< 1.775) and common gaming resolutions
    const list = Array.from(modeMap.values()).filter((m) => {
      const r = m.width / m.height;
      const isNativeMatch = m.width === nativeW && m.height === nativeH;
      return (r < 1.775 || isNativeMatch) && m.width >= 1024 && m.height >= 720;
    });

    // Sort descending by width, then height
    return list.sort((a, b) => b.width - a.width || b.height - a.height);
  }, [supportedModes, nativeW, nativeH, stretchedW, stretchedH, displayInfo, removedResolutions]);

  const handleSelectPreset = async (w: number, h: number) => {
    try {
      const updated = await savePreferredStretchedRes(w, h);
      setStretchedW(updated[0]);
      setStretchedH(updated[1]);
      setCustomInputW(updated[0].toString());
      setCustomInputH(updated[1].toString());
      setBuildSignal({ w: updated[0], h: updated[1], nonce: Date.now() });
      if (onStretchResChanged) {
        onStretchResChanged(updated[0], updated[1]);
      }
      setStatusBanner(`Active stretch resolution set to ${w}×${h}`);
    } catch (e) {
      setStatusBanner(`Error: ${String(e)}`);
    }
  };

  const handleSaveCustom = async () => {
    const w = parseInt(customInputW, 10);
    const h = parseInt(customInputH, 10);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      setStatusBanner('Please enter valid resolution dimensions.');
      return;
    }
    try {
      const updated = await savePreferredStretchedRes(w, h);
      setStretchedW(updated[0]);
      setStretchedH(updated[1]);
      setBuildSignal({ w: updated[0], h: updated[1], nonce: Date.now() });
      if (onStretchResChanged) {
        onStretchResChanged(updated[0], updated[1]);
      }
      setStatusBanner(`Custom stretch resolution set to ${w}×${h}`);
    } catch (e) {
      setStatusBanner(`Error: ${String(e)}`);
    }
  };

  const handleApplyToAll = async () => {
    setIsApplyingAll(true);
    try {
      const msg = await applyCustomResToAllConfigs(stretchedW, stretchedH, lockReadOnly);
      setStatusBanner(msg);
      const cfgs = await fetchValorantConfigs();
      setConfigs(cfgs);
    } catch (e) {
      setStatusBanner(`Error applying to files: ${String(e)}`);
    } finally {
      setIsApplyingAll(false);
    }
  };

  const handleToggleLockSingle = async (cfg: ConfigFileInfo) => {
    try {
      const newLockState = !cfg.is_read_only;
      await updateValorantConfig(
        cfg.path,
        true,
        cfg.res_x && cfg.res_y ? [cfg.res_x, cfg.res_y] : [stretchedW, stretchedH],
        newLockState
      );
      const updated = await fetchValorantConfigs();
      setConfigs(updated);
    } catch (e) {
      setStatusBanner(`Error toggling file lock: ${String(e)}`);
    }
  };

  const handleApplySingle = async (cfg: ConfigFileInfo) => {
    try {
      await updateValorantConfig(
        cfg.path,
        true,
        [stretchedW, stretchedH],
        lockReadOnly
      );
      setStatusBanner(`Applied ${stretchedW}×${stretchedH} to ${cfg.display_name}`);
      const updated = await fetchValorantConfigs();
      setConfigs(updated);
    } catch (e) {
      setStatusBanner(`Error writing config: ${String(e)}`);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-2.5 max-w-6xl mx-auto w-full overflow-hidden [@media(max-height:720px)]:overflow-y-auto">
      {/* Notification Banner */}
      {statusBanner && (
        <div className="p-2.5 rounded-xl bg-m3-primary-container/40 border border-m3-primary/40 text-m3-on-primary-container text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <Check className="w-3.5 h-3.5 text-m3-primary shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-m3-primary hover:underline text-xs ml-3 cursor-pointer font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2-COLUMN GRID: Stretched Target (Left) & Game Config Sync (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-stretch flex-1 min-h-0">
        {/* COLUMN 1: SELECT STRETCHED TARGET (AVAILABLE MODES ON PC) */}
        <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-3 shadow-m3-1 flex flex-col gap-2 h-full min-h-0">
          <div className="flex items-center justify-between h-6 pb-2 border-b border-m3-outline-subtle shrink-0">
            <div className="flex items-center space-x-2">
              <Crosshair className="w-4 h-4 text-m3-primary" />
              <h3 className="font-display font-bold text-xs text-m3-on-surface uppercase tracking-wider">
                1. Stretched Resolution Target
              </h3>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-m3-outline">Active:</span>
              <span className="font-mono text-[11px] text-m3-primary font-bold tabular-nums">
                {stretchedW}×{stretchedH}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-m3-on-surface-variant font-medium shrink-0">
            <span>Available on your PC ({availableModes.length} modes):</span>
            {removedResolutions.length > 0 ? (
              <button
                type="button"
                onClick={handleRestoreRemoved}
                className="text-[10px] font-mono text-m3-primary hover:underline flex items-center gap-1 cursor-pointer"
                title="Restore all hidden resolutions"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Restore ({removedResolutions.length} hidden)</span>
              </button>
            ) : (
              <span className="text-[10px] text-m3-outline">Click to set target</span>
            )}
          </div>

          {/* Grid of resolutions supported by the PC */}
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1.5 pb-1 content-start">
            {availableModes.map((mode) => {
              const isCurrent = stretchedW === mode.width && stretchedH === mode.height;
              const isNativeRes = mode.width === nativeW && mode.height === nativeH;
              const badge = getAspectBadge(mode.width, mode.height);
              return (
                <button
                  type="button"
                  key={`${mode.width}x${mode.height}`}
                  onClick={() => handleSelectPreset(mode.width, mode.height)}
                  className={`min-h-[52px] p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group/card ${
                    isNativeRes ? 'col-span-2' : ''
                  } ${
                    isCurrent
                      ? 'bg-m3-primary-container/30 border-m3-primary text-m3-on-primary-container shadow-xs ring-1 ring-m3-primary/30'
                      : 'bg-m3-surface-container-high/60 border-m3-outline-subtle hover:bg-m3-surface-container-high'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-xs tabular-nums text-m3-on-surface">
                      {mode.width} × {mode.height}
                    </span>
                    <div className="flex items-center gap-1">
                      {isCurrent ? (
                        <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-m3-tertiary text-m3-on-tertiary flex items-center space-x-0.5 shadow-xs shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>ACTIVE</span>
                        </span>
                      ) : (
                        <span className={`px-1.5 py-0.5 text-[8px] font-mono font-semibold rounded-full border ${badge.color}`}>
                          {badge.tag}
                        </span>
                      )}
                      {!isNativeRes && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveResolution(mode.width, mode.height);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              handleRemoveResolution(mode.width, mode.height);
                            }
                          }}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-m3-outline hover:text-red-400 hover:bg-red-400/15 transition-colors cursor-pointer shrink-0 opacity-40 group-hover/card:opacity-100"
                          title={`Remove ${mode.width}×${mode.height} from list`}
                        >
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-m3-outline mt-1">
                    <span>{isNativeRes ? '16:9 Baseline (Native)' : badge.sub}</span>
                    <span>{mode.maxHz} Hz</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Input Compact Box */}
          <div className="rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle p-2 flex items-center justify-between gap-2 mt-auto">
            <span className="text-[11px] font-bold text-m3-on-surface truncate">
              Custom Target
            </span>

            <div className="flex items-center space-x-1.5 shrink-0">
              <div className="flex items-center space-x-1 bg-m3-surface-container px-2 py-1 rounded-lg border border-m3-outline-subtle">
                <input
                  type="number"
                  value={customInputW}
                  onChange={(e) => setCustomInputW(e.target.value)}
                  placeholder="W"
                  className="w-14 bg-transparent text-m3-on-surface font-mono text-xs focus:outline-none text-center font-bold"
                />
                <span className="text-m3-outline font-mono text-xs">×</span>
                <input
                  type="number"
                  value={customInputH}
                  onChange={(e) => setCustomInputH(e.target.value)}
                  placeholder="H"
                  className="w-14 bg-transparent text-m3-on-surface font-mono text-xs focus:outline-none text-center font-bold"
                />
              </div>

              <button
                onClick={handleSaveCustom}
                className="h-7 px-3 rounded-full bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary text-[11px] font-bold shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
              >
                Set Target
              </button>
            </div>
          </div>
        </section>

        {/* COLUMN 2: SYNC GAME CONFIG FILES */}
        <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-3 shadow-m3-1 flex flex-col gap-2 h-full min-h-0">
          <div className="flex items-center justify-between h-6 pb-2 border-b border-m3-outline-subtle shrink-0">
            <div className="flex items-center space-x-2">
              <FileCode2 className="w-4 h-4 text-m3-primary" />
              <h3 className="font-display font-bold text-xs text-m3-on-surface uppercase tracking-wider">
                2. Sync Game Config Files
              </h3>
            </div>

            <button
              onClick={handleRefreshAll}
              disabled={isLoadingConfigs}
              className="h-7 px-3 rounded-full bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle text-[11px] font-semibold transition-colors cursor-pointer flex items-center space-x-1 shrink-0"
              title="Rescan game config files"
            >
              <RefreshCw className={`w-2.5 h-2.5 text-m3-primary ${isLoadingConfigs ? 'animate-spin' : ''}`} />
              <span>Rescan</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-m3-on-surface-variant font-medium shrink-0">
            <span>Detected game user configs ({configs.length}):</span>
            <span className="text-[10px] text-m3-outline">Writes {stretchedW}×{stretchedH}</span>
          </div>

          {/* Config Files List */}
          <div className="flex-1 min-h-0 flex flex-col justify-start gap-1.5 overflow-y-auto custom-scrollbar pr-1.5 pb-1">
            {configs.length === 0 ? (
              <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-[11px] text-m3-on-surface-variant">
                No VALORANT configs detected in %LOCALAPPDATA%\VALORANT.
              </div>
            ) : (
              configs.map((cfg, idx) => (
                <div
                  key={idx}
                  className="min-h-[52px] p-2 pl-2.5 rounded-xl bg-m3-surface-container-high/60 border border-m3-outline-subtle flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-[11px] text-m3-on-surface">
                        {cfg.display_name}
                      </span>
                      {cfg.is_read_only ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded-full bg-m3-primary-container text-m3-primary border border-m3-primary/30 flex items-center space-x-0.5 font-bold shrink-0">
                          <Lock className="w-2 h-2 text-m3-primary" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded-full bg-m3-surface-container text-m3-outline border border-m3-outline-subtle flex items-center space-x-0.5 shrink-0">
                          <Unlock className="w-2 h-2 text-m3-outline" />
                          <span>Open</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-m3-outline flex items-center space-x-2 mt-0.5">
                      <span>Res: <strong className="text-m3-primary font-mono">{cfg.res_x && cfg.res_y ? `${cfg.res_x}×${cfg.res_y}` : 'Default'}</strong></span>
                      <span>•</span>
                      <span>Letterbox: <strong className={cfg.should_letterbox === false ? 'text-m3-primary' : 'text-m3-coral'}>{cfg.should_letterbox === false ? 'Off' : 'On'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleLockSingle(cfg)}
                      className="w-7 h-7 rounded-full bg-m3-surface-container hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle transition-all cursor-pointer shadow-xs active:scale-90 flex items-center justify-center shrink-0"
                      title={cfg.is_read_only ? 'Unlock File for Manual Edits' : 'Lock File as Read-Only'}
                    >
                      {cfg.is_read_only ? (
                        <Unlock className="w-3 h-3 text-m3-primary" />
                      ) : (
                        <Lock className="w-3 h-3 text-m3-outline" />
                      )}
                    </button>

                    <button
                      onClick={() => handleApplySingle(cfg)}
                      className="h-7 px-3 rounded-full bg-m3-primary/20 hover:bg-m3-primary/30 text-m3-primary text-[11px] font-bold border border-m3-primary/30 transition-all cursor-pointer shrink-0"
                    >
                      Write
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Config File Enforcement Info Callout */}
          <div className="p-2.5 rounded-xl bg-m3-surface-container-lowest/80 border border-m3-outline-subtle/80 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-m3-on-surface flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-m3-primary" />
                <span>Config Enforcement</span>
              </span>
              <span className="text-[10px] font-mono text-m3-primary font-semibold">
                {configs.filter((c) => c.is_read_only).length}/{configs.length} Files Read-Only
              </span>
            </div>
            <p className="text-[10px] text-m3-on-surface-variant leading-relaxed">
              Applying writes {stretchedW}×{stretchedH} and disables letterboxing. Locking files read-only prevents VALORANT from resetting your resolution back to 16:9 on exit.
            </p>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle text-xs mt-auto">
            <label className="flex items-center space-x-1.5 text-[11px] text-m3-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lockReadOnly}
                onChange={(e) => setLockReadOnly(e.target.checked)}
                className="rounded border-m3-outline bg-m3-surface-container text-m3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-m3-primary"
              />
              <span>Lock Read-Only</span>
            </label>

            <button
              onClick={handleApplyToAll}
              disabled={isApplyingAll || configs.length === 0}
              className="h-7 px-3 rounded-full bg-m3-primary hover:bg-m3-primary/90 active:scale-[0.98] text-m3-on-primary font-bold text-[11px] transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center space-x-1.5 shrink-0"
            >
              {isApplyingAll ? (
                <RefreshCw className="w-3 h-3 animate-spin text-m3-on-primary" />
              ) : (
                <Zap className="w-3 h-3 text-m3-on-primary" />
              )}
              <span>
                {isApplyingAll ? 'Syncing...' : `Sync All (${configs.length})`}
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* Display Mode Lab — safely adds new resolutions to the available list */}
      <section aria-label="Display mode lab" className="shrink-0">
        <CustomResolution
          displayInfo={displayInfo}
          onRefreshDisplayInfo={handleRefreshAll}
          externalDims={buildSignal}
          defaultW={stretchedW}
          defaultH={stretchedH}
        />
      </section>
    </div>
  );
};
