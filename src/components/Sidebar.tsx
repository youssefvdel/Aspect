import {
  Monitor,
  Cpu,
  Sliders,
  Eye,
  Layout,
  Settings,
  Keyboard,
  Activity,
  Wand2,
  LayoutGrid,
} from 'lucide-react';
import type { DisplayInfo, GpuInfo, TabType } from '../types';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  displayInfo: DisplayInfo | null;
  gpuInfo: GpuInfo | null;
}

const TABS: {
  id: TabType;
  label: string;
  sublabel: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'switcher',
    label: 'Resolution Switch',
    sublabel: 'Toggle stretched & native (F4)',
    shortcut: '1',
    icon: Sliders,
  },
  {
    id: 'visualizer',
    label: 'Stretch Preview',
    sublabel: 'Simulate hitbox width & FOV',
    shortcut: '2',
    icon: Eye,
  },
  {
    id: 'custom_res',
    label: 'Custom Res & Test',
    sublabel: 'Safe test mode & CRU tools',
    shortcut: '3',
    icon: Wand2,
  },
  {
    id: 'displays',
    label: 'Display Manager',
    sublabel: 'Multi-screen enable / disable',
    shortcut: '4',
    icon: LayoutGrid,
  },
  {
    id: 'gpu',
    label: 'Fix Black Bars',
    sublabel: 'One-click GPU hardware stretch',
    shortcut: '5',
    icon: Cpu,
  },
  {
    id: 'borderless',
    label: 'Window Stretcher',
    sublabel: 'Borderless mode & instant Alt-Tab',
    shortcut: '6',
    icon: Layout,
  },
  {
    id: 'settings',
    label: 'Settings',
    sublabel: 'Hotkeys, configs & memory',
    shortcut: '7',
    icon: Settings,
  },
];


export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  displayInfo,
  gpuInfo,
}) => {
  const isStretched = displayInfo?.active_profile === 'stretched';

  return (
    <aside className="w-68 h-full bg-m3-surface-container-low border-r border-m3-outline-subtle flex flex-col justify-between select-none shrink-0 z-30">
      {/* Brand & Top Section */}
      <div className="flex flex-col">
        {/* App Identity */}
        <div className="p-4 sm:p-5 border-b border-m3-outline-subtle flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-m3-primary-container border border-m3-primary/30 flex items-center justify-center text-m3-primary shadow-m3-1 shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-display font-extrabold text-base tracking-tight text-m3-on-surface">
                  TrueStretch
                </span>
                <span className="font-display font-bold text-base text-m3-primary">
                  Studio
                </span>
              </div>
              <p className="text-[11px] text-m3-on-surface-variant font-medium leading-none mt-0.5">
                Material 3 Display Engine
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold text-m3-primary bg-m3-primary-container/50 border border-m3-primary/40 rounded-full">
            v2.0
          </span>
        </div>

        {/* Live Hardware Telemetry Widget (M3 Expressive Tonal Card) */}
        <div className="p-3.5 mx-3.5 my-3 rounded-3xl bg-m3-surface-container border border-m3-outline-subtle flex flex-col space-y-2.5 shadow-m3-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-m3-on-surface-variant font-medium flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-m3-primary shadow-[0_0_6px_rgba(208,188,255,0.7)]" />
              <span>Active Display</span>
            </span>
            <span
              className={`text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                isStretched
                  ? 'bg-m3-tertiary text-m3-on-tertiary shadow-xs'
                  : 'bg-m3-surface-container-high text-m3-secondary border border-m3-outline-subtle'
              }`}
            >
              {isStretched ? '1.45:1 Stretched' : 'Native 16:9'}
            </span>
          </div>

          {displayInfo && (
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-bold text-m3-on-surface tabular-nums text-sm">
                {displayInfo.current_width}×{displayInfo.current_height}
              </span>
              <span className="font-mono text-m3-primary tabular-nums text-xs font-semibold px-2 py-0.5 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle">
                {displayInfo.current_hz} Hz
              </span>
            </div>
          )}

          {gpuInfo && (
            <div className="flex items-center space-x-1.5 text-[11px] text-m3-on-surface-variant pt-1 border-t border-m3-outline-subtle/60 truncate">
              <Cpu className="w-3.5 h-3.5 text-m3-outline shrink-0" />
              <span className="truncate text-m3-on-surface-variant font-medium">
                {gpuInfo.name.replace('NVIDIA ', '').replace('GeForce ', '').replace('AMD ', '')}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Tabs List (M3 Expressive Navigation Rail with Pill Items) */}
        <div className="px-3 pt-1">
          <div className="px-3 pb-2 text-[10px] font-mono tracking-wider text-m3-outline uppercase font-semibold">
            Navigation Rail
          </div>

          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative w-full group flex items-center justify-between px-3 py-1.5 rounded-full text-left transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-m3-primary-container text-m3-on-primary-container shadow-m3-1'
                      : 'text-m3-on-surface-variant hover:bg-m3-surface-container/60 hover:text-m3-on-surface'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-m3-primary'
                          : 'text-m3-outline group-hover:text-m3-on-surface'
                      }`}
                    />
                    <div className="truncate">
                      <div
                        className={`text-xs font-semibold leading-tight truncate ${
                          isActive ? 'text-m3-on-primary-container font-display' : 'text-m3-on-surface-variant'
                        }`}
                      >
                        {tab.label}
                      </div>
                      <div className="text-[10px] text-m3-outline truncate leading-tight mt-0.5">
                        {tab.sublabel}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`w-5 h-5 rounded-full font-mono text-[10px] font-semibold flex items-center justify-center transition-colors shrink-0 ${
                      isActive
                        ? 'bg-m3-surface-container-highest text-m3-primary'
                        : 'bg-m3-surface-container text-m3-outline group-hover:text-m3-on-surface'
                    }`}
                  >
                    {tab.shortcut}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer & Keyboard Navigation Hint */}
      <div className="p-3.5 border-t border-m3-outline-subtle bg-m3-surface-container-lowest/50 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-m3-on-surface-variant px-1">
          <span className="flex items-center space-x-1.5">
            <Keyboard className="w-3.5 h-3.5 text-m3-outline" />
            <span>Switch Tabs</span>
          </span>
          <span className="font-mono text-[10px] text-m3-secondary bg-m3-surface-container-high px-2 py-0.5 rounded-full border border-m3-outline-subtle">
            Keys 1 - 7
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-m3-outline pt-2 border-t border-m3-outline-subtle/50 px-1">
          <span className="flex items-center space-x-1.5">
            <Activity className="w-3 h-3 text-m3-primary" />
            <span>0.0 ms Scanout</span>
          </span>
          <span className="font-mono">Tauri v2 GDI</span>
        </div>
      </div>
    </aside>
  );
};
