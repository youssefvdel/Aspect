import { Sliders, Eye, Cpu, Layout, Zap, Settings, Wand2, LayoutGrid } from 'lucide-react';
import type { DisplayInfo, GpuInfo, TabType } from '../types';

interface TopBarProps {
  currentTab: TabType;
  displayInfo: DisplayInfo | null;
  gpuInfo: GpuInfo | null;
  shortcut?: import('../types').ShortcutBinding | null;
  onToggleProfile?: () => void;
  isLoading?: boolean;
}

const TAB_METADATA: Record<
  TabType,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  switcher: {
    title: 'Resolution Switcher',
    description: 'Instant hotkey toggle between stretched gaming and native desktop',
    icon: Sliders,
  },
  visualizer: {
    title: 'Stretch & Hitbox Preview',
    description: 'Interactive simulator showing enemy model widening (+22.5% hitbox) and FOV',
    icon: Eye,
  },
  custom_res: {
    title: 'Custom Resolution & Safe Tester',
    description: 'Hardware resolution generator with 15s auto-revert protection and CRU tools',
    icon: Wand2,
  },
  displays: {
    title: 'Display Manager',
    description: 'Dynamic multi-monitor topology control, screen enable/disable, and primary assignment',
    icon: LayoutGrid,
  },
  gpu: {
    title: 'Fix Black Bars (GPU Scaler)',
    description: 'One-click full-screen hardware scaling and letterbox clamp removal',
    icon: Cpu,
  },
  borderless: {
    title: 'Borderless Window Stretcher',
    description: 'Remove window borders and stretch games for instant, zero-delay Alt-Tabbing',
    icon: Layout,
  },
  settings: {
    title: 'Stretch Resolution & Game Config Settings',
    description: 'Customize your primary stretch target and sync custom resolutions across all game files',
    icon: Settings,
  },
};


export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  displayInfo,
  shortcut,
  onToggleProfile,
  isLoading = false,
}) => {
  const meta = TAB_METADATA[currentTab];
  const Icon = meta.icon;
  const isStretched = displayInfo?.active_profile === 'stretched';

  const shortcutLabel = shortcut
    ? (shortcut.ctrl ? 'Ctrl+' : '') +
      (shortcut.shift ? 'Shift+' : '') +
      (shortcut.alt ? 'Alt+' : '') +
      (shortcut.vk === 0x73
        ? 'F4'
        : shortcut.vk === 0x7A
        ? 'F11'
        : shortcut.vk === 0x79
        ? 'F10'
        : shortcut.vk === 0x78
        ? 'F9'
        : shortcut.vk === 0x7B
        ? 'F12'
        : shortcut.vk === 0x77
        ? 'F8'
        : shortcut.vk === 0x2D
        ? 'Insert'
        : `Key(0x${shortcut.vk.toString(16)})`)
    : 'F4';

  return (
    <header className="h-14 px-4 sm:px-6 border-b border-m3-outline-subtle bg-m3-surface/85 backdrop-blur-md flex items-center justify-between shrink-0 select-none z-20">
      {/* Active Section Info */}
      <div className="flex items-center space-x-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-m3-surface-container-high border border-m3-outline-subtle flex items-center justify-center text-m3-primary shadow-xs shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="truncate">
          <h1 className="font-display font-bold text-sm sm:text-base text-m3-on-surface leading-tight truncate">
            {meta.title}
          </h1>
          <p className="text-[11px] text-m3-on-surface-variant leading-tight truncate hidden sm:block">
            {meta.description}
          </p>
        </div>
      </div>

      {/* Right Controls & Live Indicators */}
      <div className="flex items-center space-x-2.5 shrink-0">
        {displayInfo && (
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-m3-surface-container border border-m3-outline-subtle text-xs shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-m3-primary shadow-[0_0_6px_rgba(208,188,255,0.7)]" />
            <span className="font-mono text-m3-on-surface tabular-nums font-semibold">
              {displayInfo.current_width}×{displayInfo.current_height}
            </span>
            <span className="text-m3-outline">@</span>
            <span className="font-mono text-m3-secondary tabular-nums font-medium">
              {displayInfo.current_hz}Hz
            </span>
            <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-m3-primary">
              {isStretched ? '1.45:1 Stretched' : 'Native 16:9'}
            </span>
          </div>
        )}

        {onToggleProfile && (
          <button
            onClick={onToggleProfile}
            disabled={isLoading}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-m3-primary hover:bg-[#dfd1ff] active:bg-[#c4aeff] text-[#140e1b] font-bold text-xs transition-all shadow-m3-1 hover:shadow-m3-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-[#140e1b] fill-[#140e1b]" />
            <span className="font-bold tracking-tight text-[#140e1b]">
              {isStretched ? 'Switch to Native' : 'Switch to Stretched'}
            </span>
            <span className="font-mono text-[10px] font-black text-white bg-[#140e1b] px-2 py-0.5 rounded-full shadow-xs">
              {shortcutLabel}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
