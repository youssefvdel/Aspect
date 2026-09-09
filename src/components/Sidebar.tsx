import {
  Cpu,
  Sliders,
  Eye,
  Settings,
  Keyboard,
  Sparkles,
  FileCode2,
  LayoutDashboard,
  History,
} from 'lucide-react';
import type { DisplayInfo, GpuInfo, TabType } from '../types';
import { TrackerMini } from './TrackerMini';

interface SidebarTab {
  id: TabType;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TabGroup {
  title: string;
  tabs: SidebarTab[];
}

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  displayInfo: DisplayInfo | null;
  gpuInfo: GpuInfo | null;
  hasUpdate?: boolean;
  onOpenUpdates?: () => void;
}

const UTILITY_TABS: SidebarTab[] = [
  {
    id: 'switcher',
    label: 'Resolution Switch',
    shortcut: '1',
    icon: Sliders,
  },
  {
    id: 'visualizer',
    label: 'Stretch Preview',
    shortcut: '2',
    icon: Eye,
  },
];

/* Tracker group — keyless Riot data, zero signup. */
const TRACKER_TABS: SidebarTab[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortcut: '6',
    icon: LayoutDashboard,
  },
  {
    id: 'matches',
    label: 'Match History',
    shortcut: '7',
    icon: History,
  },
];

/* Settings group — setup + custom builder merged in one tab, GPU stands alone. */
const SETTINGS_TABS: SidebarTab[] = [
  {
    id: 'settings',
    label: 'Stretch Setup',
    shortcut: '3',
    icon: Settings,
  },
  {
    id: 'valorant',
    label: 'Valorant Config',
    shortcut: '5',
    icon: FileCode2,
  },
  {
    id: 'gpu',
    label: 'GPU Scaling',
    shortcut: '4',
    icon: Cpu,
  },
];


export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  displayInfo,
  gpuInfo,
  hasUpdate,
  onOpenUpdates,
}) => {
  const isStretched = displayInfo?.active_profile === 'stretched';

  const renderGroup = (group: TabGroup, isFirst: boolean) => (
    <div key={group.title}>
      <div className={`flex items-center gap-2 px-3 pb-1.5 ${isFirst ? 'pt-1' : 'pt-3'}`} aria-hidden="true">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-m3-outline">
          {group.title}
        </span>
        <div className="flex-1 h-px bg-m3-outline-subtle" />
      </div>
      <nav className="space-y-1">
        {group.tabs.map((tab) => {
          const Icon = tab.icon;
          // Legacy compat: 'borderless' tab aliases to merged switcher grid
          const isActive = currentTab === tab.id || (currentTab === 'borderless' && tab.id === 'switcher');
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
                <div
                  className={`text-xs font-semibold leading-tight truncate ${
                    isActive ? 'text-m3-on-primary-container font-display' : 'text-m3-on-surface-variant'
                  }`}
                >
                  {tab.label}
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
  );

  return (
    <aside className="w-68 h-full bg-m3-surface-container-low border-r border-m3-outline-subtle flex flex-col justify-between select-none shrink-0 z-30">
      {/* Brand & Top Section */}
      <div className="flex flex-col">
        {/* App Identity */}
        <div className="p-4 sm:p-5 border-b border-m3-outline-subtle flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/icon.png"
              alt="Aspect"
              className="w-10 h-10 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(208,188,255,0.25)]"
            />
            <div>
              <div className="flex items-center space-x-1">
                <span className="font-display font-black text-xl tracking-tight text-m3-on-surface">
                  Aspect
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenUpdates}
            title={hasUpdate ? "New update available — click to view" : "Check for updates"}
            className="group/ver relative px-2 py-0.5 text-[10px] font-mono font-semibold text-m3-primary bg-m3-primary-container/50 hover:bg-m3-primary/20 border border-m3-primary/40 rounded-full flex items-center gap-1 transition-all cursor-pointer"
          >
            {hasUpdate && (
              <span className="w-1.5 h-1.5 rounded-full bg-m3-primary animate-pulse" />
            )}
            <span>v0.1.1</span>
          </button>
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
                  ? 'bg-m3-tertiary text-m3-on-tertiary shadow-sm'
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
          {renderGroup({ title: 'Utility', tabs: UTILITY_TABS }, true)}
          {renderGroup({ title: 'Tracker', tabs: TRACKER_TABS }, false)}
          {renderGroup({ title: 'Settings', tabs: SETTINGS_TABS }, false)}
        </div>
      </div>

      {/* Sidebar Footer: player chip, updates & keyboard hint */}
      <div className="flex flex-col">
        <TrackerMini />
        <div className="p-3 border-t border-m3-outline-subtle bg-m3-surface-container-lowest/50 flex flex-col gap-2">
        {onOpenUpdates && (
          <button
            type="button"
            onClick={onOpenUpdates}
            className={`w-full h-7 px-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-between border transition-all cursor-pointer ${
              hasUpdate
                ? 'bg-m3-primary/15 border-m3-primary text-m3-primary hover:bg-m3-primary/25'
                : 'bg-transparent border-transparent text-m3-outline hover:text-m3-on-surface hover:bg-m3-surface-container-high'
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3 h-3 text-m3-primary shrink-0" />
              <span>{hasUpdate ? 'Update Available' : 'Check for Updates'}</span>
            </span>
            {hasUpdate && (
              <span className="w-1.5 h-1.5 rounded-full bg-m3-primary animate-ping shrink-0" />
            )}
          </button>
        )}

        <div className="flex items-center justify-between text-[11px] text-m3-on-surface-variant px-1">
          <span className="flex items-center space-x-1.5">
            <Keyboard className="w-3.5 h-3.5 text-m3-outline" />
            <span>Switch Tabs</span>
          </span>
          <span className="font-mono text-[10px] text-m3-secondary bg-m3-surface-container-high px-2 py-0.5 rounded-full border border-m3-outline-subtle">
            Keys 1 - 7
          </span>
        </div>
        </div>
      </div>
    </aside>
  );
};
