import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Check,
  RefreshCw,
  FileCode2,
  Lock,
  Unlock,
  Zap,
} from 'lucide-react';
import type { ConfigFileInfo, DisplayInfo } from '../types';
import {
  fetchValorantConfigs,
  applyCustomResToAllConfigs,
  fetchPreferredStretchedRes,
  savePreferredStretchedRes,
  updateValorantConfig,
} from '../utils/ipc';

interface SettingsProps {
  displayInfo: DisplayInfo | null;
  onStretchResChanged?: (w: number, h: number) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  displayInfo,
  onStretchResChanged,
}) => {
  const nativeW = displayInfo?.native_width || 2560;
  const nativeH = displayInfo?.native_height || 1440;

  // Stretched resolution state
  const [stretchedW, setStretchedW] = useState<number>(2090);
  const [stretchedH, setStretchedH] = useState<number>(nativeH);
  const [customInputW, setCustomInputW] = useState<string>('2090');
  const [customInputH, setCustomInputH] = useState<string>(nativeH.toString());

  // Game config files state
  const [configs, setConfigs] = useState<ConfigFileInfo[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [lockReadOnly, setLockReadOnly] = useState(true);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Calculate standard presets based on current native height
  const goldenW = Math.round(nativeH * 1.451) + (Math.round(nativeH * 1.451) % 2 !== 0 ? 1 : 0);
  const fourThreeW = Math.round(nativeH * (4 / 3)) + (Math.round(nativeH * (4 / 3)) % 2 !== 0 ? 1 : 0);
  const sixteenTenW = Math.round(nativeH * (16 / 10)) + (Math.round(nativeH * (16 / 10)) % 2 !== 0 ? 1 : 0);
  const fiveFourW = Math.round(nativeH * (5 / 4)) + (Math.round(nativeH * (5 / 4)) % 2 !== 0 ? 1 : 0);

  const PRESETS = [
    {
      id: 'golden',
      label: '1.45:1 Golden Stretch',
      width: goldenW,
      height: nativeH,
      badge: 'VALORANT Optimal',
      desc: '0 black bars, +22.5% hitbox width expansion without letterbox clamp.',
    },
    {
      id: 'four-three',
      label: '4:3 Classic Stretch',
      width: fourThreeW,
      height: nativeH,
      badge: 'CS Classic',
      desc: 'Counter-Strike standard ratio with aggressive target expansion (+33%).',
    },
    {
      id: 'sixteen-ten',
      label: '16:10 Balanced',
      width: sixteenTenW,
      height: nativeH,
      badge: 'Balanced FOV',
      desc: 'Moderate +11% horizontal stretch while preserving peripheral vision.',
    },
    {
      id: 'five-four',
      label: '5:4 Ultra Wide',
      width: fiveFourW,
      height: nativeH,
      badge: 'Maximum Width',
      desc: 'Heaviest +42% hitbox widening for maximum target acquisition.',
    },
  ];

  const loadData = async () => {
    setIsLoadingConfigs(true);
    try {
      const [res, cfgs] = await Promise.all([
        fetchPreferredStretchedRes(),
        fetchValorantConfigs(),
      ]);
      setStretchedW(res[0]);
      setStretchedH(res[1]);
      setCustomInputW(res[0].toString());
      setCustomInputH(res[1].toString());
      setConfigs(cfgs);
    } catch (e) {
      console.error('Failed to load settings data', e);
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPreset = async (w: number, h: number) => {
    try {
      const updated = await savePreferredStretchedRes(w, h);
      setStretchedW(updated[0]);
      setStretchedH(updated[1]);
      setCustomInputW(updated[0].toString());
      setCustomInputH(updated[1].toString());
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
      // Refresh configs list
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
    <div className="space-y-3 max-w-6xl mx-auto">
      {/* Section Header */}
      <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-m3-1">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-m3-primary-container border border-m3-primary/30 flex items-center justify-center text-m3-primary shadow-xs shrink-0">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-lg text-m3-on-surface tracking-tight leading-tight">
              Stretch Resolution &amp; Game Settings
            </h2>
            <p className="text-[11px] text-m3-on-surface-variant leading-tight">
              Configure primary stretch target and sync across all local game files with letterbox bypass
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-xs shrink-0 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-m3-tertiary shadow-[0_0_8px_rgba(255,180,169,0.7)]" />
          <span className="text-m3-on-surface-variant font-medium text-[11px]">Active Target:</span>
          <span className="font-mono text-m3-primary font-bold tabular-nums text-xs">
            {stretchedW} × {stretchedH}
          </span>
        </div>
      </section>

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

      {/* 2-COLUMN COMPACT GRID: Presets (Left) & Game Config Sync (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {/* COLUMN 1: SELECT STRETCHED TARGET */}
        <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-3.5 space-y-2.5 shadow-m3-1">
          <div className="flex items-center justify-between border-b border-m3-outline-subtle pb-2">
            <div>
              <h3 className="font-display font-bold text-xs text-m3-on-surface uppercase tracking-wider">
                1. Stretched Resolution Target
              </h3>
              <p className="text-[10px] text-m3-on-surface-variant">
                Used by hotkey <kbd className="px-1 py-0.2 rounded bg-m3-surface-container-high border border-m3-outline-subtle font-mono text-[10px] text-m3-primary">F4</kbd> to toggle with Native ({nativeW}×{nativeH})
              </p>
            </div>
            <span className="text-[10px] font-mono text-m3-secondary font-bold">
              {stretchedW}×{stretchedH}
            </span>
          </div>

          {/* Presets in 2x2 Compact Grid */}
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => {
              const isCurrent = stretchedW === preset.width && stretchedH === preset.height;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.width, preset.height)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-m3-primary-container/30 border-2 border-m3-primary shadow-xs ring-1 ring-m3-primary/30'
                      : 'bg-m3-surface-container-high/60 border-m3-outline-subtle hover:bg-m3-surface-container-high'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-xs text-m3-on-surface truncate">
                      {preset.label}
                    </span>
                    {isCurrent ? (
                      <span className="px-1.5 py-0.2 text-[8px] font-bold rounded-full bg-m3-tertiary text-m3-on-tertiary flex items-center space-x-0.5 shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>ACTIVE</span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-m3-outline">Select</span>
                    )}
                  </div>

                  <div className="text-xs font-mono tabular-nums text-m3-primary font-bold">
                    {preset.width} × {preset.height}
                  </div>

                  <p className="text-[10px] text-m3-on-surface-variant mt-0.5 leading-tight line-clamp-2">
                    {preset.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Custom Input Compact Box */}
          <div className="p-2.5 rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle flex items-center justify-between gap-2">
            <div className="truncate">
              <span className="text-[11px] font-bold text-m3-on-surface block">
                Custom Dimensions
              </span>
              <span className="text-[10px] text-m3-on-surface-variant">
                e.g. 1920×1080, 1440×1080
              </span>
            </div>

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
                className="px-3 py-1 rounded-full bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary text-[11px] font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Set Target
              </button>
            </div>
          </div>
        </section>

        {/* COLUMN 2: SYNC GAME CONFIG FILES */}
        <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-3.5 space-y-2.5 shadow-m3-1">
          <div className="flex items-center justify-between border-b border-m3-outline-subtle pb-2">
            <div className="flex items-center space-x-2">
              <FileCode2 className="w-4 h-4 text-m3-primary" />
              <div>
                <h3 className="font-display font-bold text-xs text-m3-on-surface uppercase tracking-wider">
                  2. Sync Game Config Files
                </h3>
                <p className="text-[10px] text-m3-on-surface-variant">
                  Writes <span className="font-mono text-m3-primary font-bold">{stretchedW}×{stretchedH}</span> &amp; <span className="font-mono text-m3-primary font-bold">bShouldLetterbox=False</span>
                </p>
              </div>
            </div>

            <button
              onClick={loadData}
              disabled={isLoadingConfigs}
              className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle text-[10px] font-medium transition-colors cursor-pointer"
              title="Rescan game config files"
            >
              <RefreshCw className={`w-2.5 h-2.5 text-m3-primary ${isLoadingConfigs ? 'animate-spin' : ''}`} />
              <span>Rescan</span>
            </button>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle text-xs">
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
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-m3-primary hover:bg-m3-primary/90 active:scale-[0.98] text-m3-on-primary font-bold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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

          {/* Config Files List Container - max height with clean scrollbar */}
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            {configs.length === 0 ? (
              <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-[11px] text-m3-on-surface-variant">
                No VALORANT configs detected in %LOCALAPPDATA%\VALORANT.
              </div>
            ) : (
              configs.map((cfg, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-m3-surface-container-high/70 border border-m3-outline-subtle flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 truncate">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-[11px] text-m3-on-surface truncate">
                        {cfg.display_name}
                      </span>
                      {cfg.is_read_only ? (
                        <span className="px-1.5 py-0.2 text-[8px] font-mono rounded-full bg-m3-primary-container text-m3-primary border border-m3-primary/30 flex items-center space-x-0.5 font-bold">
                          <Lock className="w-2 h-2 text-m3-primary" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 text-[8px] font-mono rounded-full bg-m3-surface-container text-m3-outline border border-m3-outline-subtle flex items-center space-x-0.5">
                          <Unlock className="w-2 h-2 text-m3-outline" />
                          <span>Open</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-m3-outline flex items-center space-x-2">
                      <span>Res: <strong className="text-m3-primary font-mono">{cfg.res_x && cfg.res_y ? `${cfg.res_x}×${cfg.res_y}` : 'Default'}</strong></span>
                      <span>•</span>
                      <span>Letterbox: <strong className={cfg.should_letterbox === false ? 'text-m3-primary' : 'text-m3-coral'}>{cfg.should_letterbox === false ? 'Off' : 'On'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleLockSingle(cfg)}
                      className="p-1 rounded-full bg-m3-surface-container hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle transition-all cursor-pointer shadow-xs active:scale-90"
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
                      className="px-2 py-0.5 rounded-full bg-m3-primary/20 hover:bg-m3-primary/30 text-m3-primary text-[10px] font-bold border border-m3-primary/30 transition-all cursor-pointer"
                    >
                      Write
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
