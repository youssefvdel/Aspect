import { Sliders, Eye, Cpu, Layout, Settings, Wand2, Crosshair, FileCode2, LayoutDashboard, FlaskConical } from 'lucide-react';
import type { DisplayInfo, GpuInfo, TabType } from '../types';

interface TopBarProps {
  currentTab: TabType;
  displayInfo: DisplayInfo | null;
  gpuInfo: GpuInfo | null;
  shortcut?: import('../types').ShortcutBinding | null;
  onToggleProfile?: () => void;
  isLoading?: boolean;
  hasUpdate?: boolean;
  onOpenUpdates?: () => void;
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
    title: 'Resolution Switch + Borderless',
    description: 'Toggle stretched / native and make game borderless — single grid',
    icon: Sliders,
  },
  visualizer: {
    title: 'Stretch & Hitbox Preview',
    description: 'Interactive simulator showing enemy model widening (+22.5% hitbox) and FOV',
    icon: Eye,
  },
  sens: {
    title: 'Sensitivity Match',
    description: 'Stretch-compensated sens + eDPI so aim feels identical',
    icon: Crosshair,
  },
  custom_res: {
    title: 'Custom Resolution & Safe Tester',
    description: 'Hardware resolution generator with 15s auto-revert protection and native driver scaling',
    icon: Wand2,
  },
  gpu: {
    title: 'Fix Black Bars (GPU Scaler)',
    description: 'One-click full-screen hardware scaling and letterbox clamp removal',
    icon: Cpu,
  },
  borderless: {
    title: 'Resolution Switch + Borderless',
    description: 'Merged into switcher grid — alias view',
    icon: Layout,
  },
  game_config: {
    title: 'Game Config — Stretch & Valorant Setup',
    description: 'Customize stretch targets, edit Valorant config files, and manage GPU scaling',
    icon: FileCode2,
  },
  settings: {
    title: 'Application Settings',
    description: 'Software updates, Windows startup preferences, and system tray configuration',
    icon: Settings,
  },
  valorant: {
    title: 'Valorant Config — Customize + Verify',
    description: 'Per-profile fullscreen, letterbox, resolution editor with on-disk verification',
    icon: FileCode2,
  },
  overview: {
    title: 'Valorant Tracker',
    description: 'Overview, match history, performance, agents, and maps — live from Riot + TRN',
    icon: LayoutDashboard,
  },
  matches: {
    title: 'Valorant Tracker',
    description: 'Overview, match history, performance, agents, and maps — live from Riot + TRN',
    icon: LayoutDashboard,
  },
  dev: {
    title: 'Dev Dashboard',
    description: 'Dev-builds only — simulators, IPC smoke tests, backend event log',
    icon: FlaskConical,
  },
};


export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  displayInfo,
}) => {
  const meta = TAB_METADATA[currentTab];
  const Icon = meta.icon;
  const isStretched = displayInfo?.active_profile === 'stretched';

  return (
    <header className="h-14 px-4 sm:px-6 border-b border-m3-outline-subtle bg-m3-surface/85 backdrop-blur-md flex items-center justify-between shrink-0 select-none z-20">
      {/* Active Section Info */}
      <div className="flex items-center space-x-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-m3-surface-container-high border border-m3-outline-subtle flex items-center justify-center text-m3-primary shadow-sm shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="truncate">
          <h1 className="font-display font-bold text-sm sm:text-base text-m3-on-surface leading-tight truncate">
            {meta.title}
          </h1>
        </div>
      </div>

      {/* Right Live Indicators (switch action lives on the Resolution Switch page) */}
      <div className="flex items-center space-x-2.5 shrink-0">
        {displayInfo && (
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-m3-surface-container border border-m3-outline-subtle text-xs shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-m3-primary shadow-[0_0_6px_rgba(208,188,255,0.7)]" />
            <span className="font-mono text-m3-on-surface tabular-nums font-semibold">
              {displayInfo.current_width}×{displayInfo.current_height}
            </span>
            <span className="text-m3-outline">@</span>
            <span className="font-mono text-m3-secondary tabular-nums font-medium">
              {displayInfo.current_hz}Hz
            </span>
            <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-m3-primary">
              {isStretched ? '1.45:1 Stretched' : 'Native 16:9'}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
