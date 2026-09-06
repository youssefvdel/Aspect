import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight,
  Check,
  RefreshCw,
  SlidersHorizontal,
  Keyboard,
} from 'lucide-react';
import type { DisplayInfo, ShortcutBinding } from '../types';
import { formatShortcut, vkToName } from '../utils/ipc';

interface GlobalSwitcherProps {
  displayInfo: DisplayInfo | null;
  shortcut: ShortcutBinding | null;
  preferredStretched?: [number, number];
  onToggle: () => Promise<void>;
  onApplyResolution: (w: number, h: number, hz: number) => Promise<void>;
  onSaveShortcut: (binding: ShortcutBinding) => Promise<void>;
  isLoading: boolean;
}

const PRESET_HOTKEYS: { label: string; binding: ShortcutBinding }[] = [
  { label: 'F4 (Default)', binding: { ctrl: false, shift: false, alt: false, win: false, vk: 0x73 } },
  { label: 'F11 (Fullscreen)', binding: { ctrl: false, shift: false, alt: false, win: false, vk: 0x7A } },
  { label: 'F10', binding: { ctrl: false, shift: false, alt: false, win: false, vk: 0x79 } },
  { label: 'F9', binding: { ctrl: false, shift: false, alt: false, win: false, vk: 0x78 } },
  { label: 'F12', binding: { ctrl: false, shift: false, alt: false, win: false, vk: 0x7B } },
  { label: 'F8', binding: { ctrl: false, shift: false, alt: false, win: false, vk: 0x77 } },
  { label: 'Insert', binding: { ctrl: false, shift: false, alt: false, win: false, vk: 0x2D } },
  { label: 'Ctrl + Shift + S', binding: { ctrl: true, shift: true, alt: false, win: false, vk: 0x53 } },
  { label: 'Alt + F11', binding: { ctrl: false, shift: false, alt: true, win: false, vk: 0x7A } },
];

export const GlobalSwitcher: React.FC<GlobalSwitcherProps> = ({
  displayInfo,
  shortcut,
  preferredStretched,
  onToggle,
  onApplyResolution,
  onSaveShortcut,
  isLoading,
}) => {
  const [showHotkeyModal, setShowHotkeyModal] = useState(false);
  const [customKeyVk, setCustomKeyVk] = useState<number | null>(null);
  const [ctrlMod, setCtrlMod] = useState(false);
  const [shiftMod, setShiftMod] = useState(false);
  const [altMod, setAltMod] = useState(false);
  const [winMod, setWinMod] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const isNative = displayInfo ? displayInfo.current_width === displayInfo.native_width : true;
  const nativeW = displayInfo?.native_width || 2560;
  const nativeH = displayInfo?.native_height || 1440;
  const stretchedW = preferredStretched ? preferredStretched[0] : (Math.round(nativeH * 1.45) + (Math.round(nativeH * 1.45) % 2 !== 0 ? 3 : 2));
  const stretchedH = preferredStretched ? preferredStretched[1] : nativeH;
  const currentHz = displayInfo?.current_hz || 260;

  const ratio = stretchedW / stretchedH;
  let ratioTitle = 'True Stretch';
  let ratioBadge = `${ratio.toFixed(2)}:1 Stretched`;
  if (Math.abs(ratio - 1.451) < 0.03) {
    ratioTitle = 'True Stretch 1.45:1';
    ratioBadge = '1.45:1 Stretched';
  } else if (Math.abs(ratio - 4 / 3) < 0.03) {
    ratioTitle = '4:3 Classic Stretch';
    ratioBadge = '4:3 Stretched';
  } else if (Math.abs(ratio - 16 / 10) < 0.03) {
    ratioTitle = '16:10 Balanced Stretch';
    ratioBadge = '16:10 Stretched';
  } else if (Math.abs(ratio - 5 / 4) < 0.03) {
    ratioTitle = '5:4 Ultra Wide Stretch';
    ratioBadge = '5:4 Stretched';
  } else {
    ratioTitle = `Custom Stretch (${stretchedW}×${stretchedH})`;
    ratioBadge = `${ratio.toFixed(2)}:1`;
  }
  const expansionPct = Math.max(0, Math.round(((16 / 9) / ratio - 1) * 100));

  const handleKeyDownRecord = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();
    setCtrlMod(e.ctrlKey);
    setShiftMod(e.shiftKey);
    setAltMod(e.altKey);
    setWinMod(e.metaKey);

    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      setCustomKeyVk(e.keyCode);
      setIsRecording(false);
    }
  };

  const handleSaveCustomHotkey = () => {
    if (customKeyVk) {
      onSaveShortcut({
        ctrl: ctrlMod,
        shift: shiftMod,
        alt: altMod,
        win: winMod,
        vk: customKeyVk,
      });
      setShowHotkeyModal(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Primary Switcher Stage (M3 Expressive Elevated Surface) */}
      <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-4 sm:p-5 shadow-m3-1">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 max-w-lg">
            <h2 className="font-display font-extrabold text-xl text-m3-on-surface tracking-tight">
              Instant Aspect Ratio Switcher
            </h2>
            <p className="text-xs text-m3-on-surface-variant leading-relaxed">
              Global keyboard daemon switches your monitor between standard 16:9 and stretched 1.45:1
              in under 12ms with zero display buffer latency. Works inside active fullscreen games.
            </p>

            <div className="pt-1 flex items-center space-x-2.5 text-[11px] text-m3-outline">
              <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-m3-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-m3-primary shadow-[0_0_6px_rgba(208,188,255,0.7)]" />
                <span>Background Daemon Active</span>
              </span>
              <span>•</span>
              <span className="font-medium text-m3-on-surface-variant">Win32 GDI Low-Latency</span>
            </div>
          </div>

          {/* M3 Expressive Hotkey Switcher */}
          <div className="flex flex-col items-center space-y-2 shrink-0">
            <button
              onClick={() => onToggle()}
              disabled={isLoading}
              className="group p-2.5 rounded-2xl bg-m3-surface-container-highest border border-m3-outline-subtle hover:border-m3-primary/50 transition-all cursor-pointer shadow-m3-2 active:scale-95"
            >
              <div className="w-32 h-18 rounded-xl bg-m3-primary-container border border-m3-primary/40 flex flex-col items-center justify-center p-1.5 shadow-m3-1 text-m3-on-primary-container transition-all">
                <span className="font-display font-black text-2xl text-m3-primary tracking-wider">
                  {shortcut ? formatShortcut(shortcut) : 'F4'}
                </span>
                <span className="text-[10px] font-mono text-m3-secondary mt-1 flex items-center space-x-1">
                  <RefreshCw className={`w-2.5 h-2.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Switching...' : 'Press or Click'}</span>
                </span>
              </div>
            </button>

            <button
              onClick={() => setShowHotkeyModal(true)}
              className="px-2.5 py-0.5 rounded-full text-[11px] text-m3-primary hover:bg-m3-surface-container-high transition-colors flex items-center space-x-1 cursor-pointer font-medium"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Change Hotkey</span>
            </button>
          </div>
        </div>
      </section>

      {/* Profiles: Material 3 Expressive Tonal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Profile 1: Native */}
        <section
          className={`rounded-2xl p-4 sm:p-5 border transition-all shadow-m3-1 ${
            isNative
              ? 'bg-m3-surface-container-high border-2 border-m3-primary shadow-m3-2'
              : 'bg-m3-surface-container/60 border-m3-outline-subtle hover:bg-m3-surface-container'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-display font-bold text-base text-m3-on-surface">
                Native Desktop
              </h3>
              <p className="text-[11px] text-m3-on-surface-variant">16:9 Standard Aspect Ratio</p>
            </div>
            {isNative ? (
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-m3-tertiary text-m3-on-tertiary flex items-center space-x-1 shadow-sm tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-m3-on-tertiary" />
                <span>ACTIVE</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-medium text-m3-outline rounded-full bg-m3-surface-container-high border border-m3-outline-subtle">
                16:9 Baseline
              </span>
            )}
          </div>

          <div className="my-1.5">
            <span className="font-display font-black text-2xl sm:text-3xl text-m3-on-surface tabular-nums tracking-tight">
              {nativeW} × {nativeH}
            </span>
          </div>

          <dl className="border-t border-b border-m3-outline-subtle/80 py-2 my-2.5 space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-m3-on-surface-variant">Refresh Rate</dt>
              <dd className={`font-mono tabular-nums font-semibold ${isNative ? 'text-m3-primary' : 'text-m3-secondary'}`}>{currentHz} Hz</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-m3-on-surface-variant">Target Scaling</dt>
              <dd className="text-m3-secondary">1.00× (1:1 Square Pixel)</dd>
            </div>
          </dl>

          <p className="text-[11px] text-m3-on-surface-variant mb-3 leading-snug">
            Standard desktop resolution. Best for productivity, browser work, and video editing.
          </p>

          {isNative ? (
            <div className="w-full py-2 px-4 rounded-full text-xs font-semibold flex items-center justify-center space-x-2 bg-m3-primary-container text-m3-on-primary-container border border-m3-primary/30 select-none shadow-xs">
              <Check className="w-3.5 h-3.5 text-m3-primary" />
              <span>Active on Monitor</span>
            </div>
          ) : (
            <button
              onClick={() => onApplyResolution(nativeW, nativeH, currentHz)}
              disabled={isLoading}
              className="w-full py-2 px-4 rounded-full text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary shadow-m3-1 hover:shadow-m3-2 active:scale-[0.98]"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-m3-on-primary" />
              <span>Switch to Native Desktop</span>
            </button>
          )}
        </section>

        {/* Profile 2: Stretched 1.45:1 */}
        <section
          className={`rounded-2xl p-4 sm:p-5 border transition-all shadow-m3-1 ${
            !isNative
              ? 'bg-m3-surface-container-high border-2 border-m3-primary shadow-m3-2'
              : 'bg-m3-surface-container/60 border-m3-outline-subtle hover:bg-m3-surface-container'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-display font-bold text-base text-m3-on-surface">
                  {ratioTitle}
                </h3>
                <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded-full bg-m3-tertiary text-m3-on-tertiary">
                  +{expansionPct}%
                </span>
              </div>
              <p className="text-[11px] text-m3-on-surface-variant">Unreal Engine Letterbox Bypass</p>
            </div>
            {!isNative ? (
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-m3-tertiary text-m3-on-tertiary flex items-center space-x-1 shadow-sm tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-m3-on-tertiary" />
                <span>ACTIVE</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-medium text-m3-outline rounded-full bg-m3-surface-container-high border border-m3-outline-subtle">
                {ratioBadge}
              </span>
            )}
          </div>

          <div className="my-1.5">
            <span className="font-display font-black text-2xl sm:text-3xl text-m3-on-surface tabular-nums tracking-tight">
              {stretchedW} × {stretchedH}
            </span>
          </div>

          <dl className="border-t border-b border-m3-outline-subtle/80 py-2 my-2.5 space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-m3-on-surface-variant">Refresh Rate</dt>
              <dd className={`font-mono tabular-nums font-semibold ${!isNative ? 'text-m3-primary' : 'text-m3-secondary'}`}>{currentHz} Hz</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-m3-on-surface-variant">Target Scaling</dt>
              <dd className="text-m3-secondary font-medium">
                {(stretchedW / (stretchedH * (16 / 9))).toFixed(3)}× Width
              </dd>
            </div>
          </dl>

          <p className="text-[11px] text-m3-on-surface-variant mb-3 leading-snug">
            Expands enemy models horizontally while keeping native vertical sharpness and 0 black bars.
          </p>

          {!isNative ? (
            <div className="w-full py-2 px-4 rounded-full text-xs font-semibold flex items-center justify-center space-x-2 bg-m3-primary-container text-m3-on-primary-container border border-m3-primary/30 select-none shadow-xs">
              <Check className="w-3.5 h-3.5 text-m3-primary" />
              <span>Active on Monitor</span>
            </div>
          ) : (
            <button
              onClick={() => onApplyResolution(stretchedW, stretchedH, currentHz)}
              disabled={isLoading}
              className="w-full py-2 px-4 rounded-full text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary shadow-m3-1 hover:shadow-m3-2 active:scale-[0.98]"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-m3-on-primary" />
              <span>Switch to {ratioTitle}</span>
            </button>
          )}
        </section>
      </div>

      {/* Hotkey Rebinding Modal (M3 Expressive Dialog) */}
      <AnimatePresence>
        {showHotkeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-m3-surface-container-lowest/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="w-full max-w-md rounded-4xl bg-m3-surface-container-high border border-m3-outline-subtle p-6 space-y-5 shadow-m3-3"
            >
              <div className="flex items-center justify-between border-b border-m3-outline-subtle pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-m3-primary-container flex items-center justify-center text-m3-primary">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-bold text-base text-m3-on-surface">
                    Configure Global Hotkey
                  </h3>
                </div>
                <button
                  onClick={() => setShowHotkeyModal(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-m3-outline hover:bg-m3-surface-container-highest hover:text-m3-on-surface text-sm cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <span className="text-xs text-m3-on-surface-variant font-medium">Quick Presets</span>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_HOTKEYS.map((preset) => {
                    const isSelected =
                      shortcut?.vk === preset.binding.vk &&
                      shortcut?.ctrl === preset.binding.ctrl &&
                      shortcut?.shift === preset.binding.shift &&
                      shortcut?.alt === preset.binding.alt;

                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          onSaveShortcut(preset.binding);
                          setShowHotkeyModal(false);
                        }}
                        className={`p-2.5 text-xs rounded-full border text-center transition-all cursor-pointer font-medium ${
                          isSelected
                            ? 'bg-m3-primary text-m3-on-primary border-m3-primary shadow-xs font-semibold'
                            : 'bg-m3-surface-container hover:bg-m3-surface-container-highest border-m3-outline-subtle text-m3-on-surface'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Recorder */}
              <div className="space-y-2.5 pt-2 border-t border-m3-outline-subtle">
                <span className="text-xs text-m3-on-surface-variant font-medium">Record Keystroke</span>
                <div
                  tabIndex={0}
                  onKeyDown={handleKeyDownRecord}
                  onClick={() => setIsRecording(true)}
                  className={`p-4 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                    isRecording
                      ? 'border-m3-primary bg-m3-primary-container/30 text-m3-primary'
                      : 'border-m3-outline-subtle bg-m3-surface-container-lowest text-m3-on-surface hover:border-m3-outline'
                  }`}
                >
                  {isRecording ? (
                    <span className="font-mono text-xs text-m3-primary font-semibold">
                      Press any key or combination...
                    </span>
                  ) : customKeyVk ? (
                    <span className="font-display text-sm font-extrabold text-m3-primary">
                      {[
                        ctrlMod ? 'CTRL' : null,
                        altMod ? 'ALT' : null,
                        shiftMod ? 'SHIFT' : null,
                        winMod ? 'WIN' : null,
                        vkToName(customKeyVk),
                      ]
                        .filter(Boolean)
                        .join(' + ')}
                    </span>
                  ) : (
                    <span className="text-xs text-m3-outline">
                      Click here to record a custom hotkey
                    </span>
                  )}
                </div>

                {customKeyVk && (
                  <button
                    onClick={handleSaveCustomHotkey}
                    className="w-full py-3 rounded-full bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary text-xs font-semibold transition-all shadow-m3-1 hover:shadow-m3-2 cursor-pointer"
                  >
                    Save Hotkey
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
