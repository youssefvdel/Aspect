import React, { useState, useEffect } from 'react';
import { Layout, RefreshCw, CheckCircle2, Maximize2 } from 'lucide-react';
import type { WindowInfo } from '../types';
import { fetchWindows, makeWindowBorderless, restoreWindow } from '../utils/ipc';

export const BorderlessStudio: React.FC = () => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [selectedHwnd, setSelectedHwnd] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadWindows = async () => {
    setIsLoading(true);
    try {
      const list = await fetchWindows();
      setWindows(list);
      if (list.length > 0 && !selectedHwnd) {
        // Auto select game if found
        const game = list.find(w =>
          w.title.toLowerCase().includes('valorant') ||
          w.title.toLowerCase().includes('counter-strike') ||
          w.title.toLowerCase().includes('aimlabs')
        );
        if (game) {
          setSelectedHwnd(game.hwnd);
        } else {
          setSelectedHwnd(list[0].hwnd);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWindows();
  }, []);

  const handleApplyBorderless = async () => {
    if (!selectedHwnd) return;
    setIsLoading(true);
    try {
      const msg = await makeWindowBorderless(selectedHwnd);
      setStatusMessage(msg);
    } catch (e) {
      setStatusMessage(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreFramed = async () => {
    if (!selectedHwnd) return;
    setIsLoading(true);
    try {
      const msg = await restoreWindow(selectedHwnd);
      setStatusMessage(msg);
    } catch (e) {
      setStatusMessage(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3.5 max-w-6xl mx-auto">
      {/* Top Header (M3 Expressive Surface) */}
      <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-m3-1">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-m3-primary-container border border-m3-primary/30 flex items-center justify-center text-m3-primary shadow-xs shrink-0">
            <Layout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-lg text-m3-on-surface tracking-tight leading-tight">
              Borderless Window Tool
            </h2>
            <p className="text-[11px] text-m3-on-surface-variant leading-tight max-w-xl">
              Strips standard Windows borders and locks game viewport to borderless fullscreen for zero-latency Alt-Tabbing.
            </p>
          </div>
        </div>

        <button
          onClick={loadWindows}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface border border-m3-outline-subtle text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 shadow-xs active:scale-[0.98]"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-m3-primary ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Windows</span>
        </button>
      </section>

      {/* Main Studio Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left 7 Cols: Window Selector & Action Buttons */}
        <div className="lg:col-span-7 bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-4 space-y-3.5 shadow-m3-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-m3-on-surface flex items-center justify-between">
              <span>Target Game Window</span>
              <span className="text-[10px] text-m3-primary font-mono tabular-nums px-2 py-0.2 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle">
                {windows.length} Detected
              </span>
            </label>

            <select
              value={selectedHwnd || ''}
              onChange={(e) => setSelectedHwnd(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle text-m3-on-surface text-xs font-medium focus:border-m3-primary focus:outline-none cursor-pointer shadow-inner"
            >
              {windows.map((w) => (
                <option key={w.hwnd} value={w.hwnd} className="bg-m3-surface-container text-m3-on-surface">
                  {w.title} (HWND: {w.hwnd})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Target Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-m3-on-surface-variant uppercase tracking-wider">
              Quick Select Games
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['VALORANT', 'Counter-Strike 2', 'Aimlabs'].map((gameName) => {
                const found = windows.find((w) =>
                  w.title.toLowerCase().includes(gameName.toLowerCase())
                );
                return (
                  <button
                    key={gameName}
                    onClick={() => found && setSelectedHwnd(found.hwnd)}
                    disabled={!found}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center space-x-1.5 transition-all cursor-pointer ${
                      found
                        ? 'bg-m3-surface-container-high hover:bg-m3-surface-container-highest border-m3-outline text-m3-on-surface shadow-xs active:scale-95'
                        : 'bg-m3-surface-container-lowest/50 border-m3-outline-subtle/50 text-m3-outline/50 cursor-not-allowed'
                    }`}
                  >
                    <span>{gameName}</span>
                    {found && <span className="w-1.5 h-1.5 rounded-full bg-m3-coral shadow-[0_0_6px_rgba(255,138,122,0.6)]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2.5 border-t border-m3-outline-subtle grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={handleApplyBorderless}
              disabled={!selectedHwnd || isLoading}
              className="py-2.5 px-4 rounded-full bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary text-xs font-semibold shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              <Layout className="w-3.5 h-3.5 text-m3-on-primary" />
              <span>Make Borderless Fullscreen</span>
            </button>

            <button
              onClick={handleRestoreFramed}
              disabled={!selectedHwnd || isLoading}
              className="py-2.5 px-4 rounded-full bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold border border-m3-outline-subtle shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-m3-outline" />
              <span>Restore Window Frame</span>
            </button>
          </div>

          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-m3-primary-container/40 border border-m3-primary/40 text-xs text-m3-on-primary-container flex items-center space-x-2 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-m3-primary shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Borderless Benefits Guide */}
        <div className="lg:col-span-5 space-y-2.5">
          <section className="p-4 rounded-2xl bg-m3-surface-container border border-m3-outline-subtle space-y-2.5 shadow-m3-1">
            <div className="flex items-center space-x-1.5 text-m3-primary font-semibold text-xs">
              <Maximize2 className="w-3.5 h-3.5 text-m3-primary" />
              <span className="font-display font-bold text-xs text-m3-on-surface">Borderless Architecture</span>
            </div>
            <p className="text-xs text-m3-on-surface-variant leading-snug">
              When pairing stretched resolutions with borderless fullscreen:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-m3-on-surface-variant pl-1">
              <li>
                <strong className="text-m3-primary font-semibold">Instant Alt-Tab:</strong> No monitor signal resyncing or black screen flashes.
              </li>
              <li>
                <strong className="text-m3-primary font-semibold">Hardware Scanout:</strong> Game content fills 100% of display panel.
              </li>
              <li>
                <strong className="text-m3-primary font-semibold">Overlay Compatibility:</strong> Discord, OBS, and Steam overlays composite cleanly.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

