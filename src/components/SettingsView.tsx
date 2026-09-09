import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsComponent } from './Settings';
import { ValorantConfig } from './ValorantConfig';
import { HardwareScaling } from './HardwareScaling';
import type { DisplayInfo, GpuInfo } from '../types';

export type SettingsSubTab = 'setup' | 'valorant' | 'gpu';

interface SettingsViewProps {
  initialSubTab?: SettingsSubTab;
  displayInfo: DisplayInfo | null;
  gpuInfo: GpuInfo | null;
  onStretchResChanged: (w: number, h: number) => void;
  onRefreshDisplayInfo: () => void;
  onOpenControlPanel: (vendor: string) => Promise<void>;
}

const SUBTABS: { id: SettingsSubTab; label: string }[] = [
  { id: 'setup', label: 'Stretch Setup' },
  { id: 'valorant', label: 'Valorant Config' },
  { id: 'gpu', label: 'GPU Scaling' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialSubTab = 'setup',
  displayInfo,
  gpuInfo,
  onStretchResChanged,
  onRefreshDisplayInfo,
  onOpenControlPanel,
}) => {
  const [subTab, setSubTab] = useState<SettingsSubTab>(initialSubTab);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Material 3 Tab Row Navigation */}
      <nav className="flex items-center gap-6 px-4 sm:px-6 bg-m3-surface-container-low border-b border-m3-outline-subtle text-xs sm:text-[13px] font-semibold shrink-0 overflow-x-auto custom-scrollbar select-none z-10 shadow-xs">
        {SUBTABS.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`relative py-3 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                active ? 'text-m3-primary font-bold font-display' : 'text-m3-outline hover:text-m3-on-surface'
              }`}
            >
              <span>{t.label}</span>
              {active && (
                <motion.span
                  layoutId="settings-active-subtab"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-m3-primary rounded-t-full shadow-xs"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Content Area */}
      <div className="flex-1 min-h-0 pt-3 overflow-hidden">
        <AnimatePresence mode="wait">
          {subTab === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <SettingsComponent
                displayInfo={displayInfo}
                onStretchResChanged={onStretchResChanged}
                onRefreshDisplayInfo={onRefreshDisplayInfo}
              />
            </motion.div>
          )}

          {subTab === 'valorant' && (
            <motion.div key="valorant" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <ValorantConfig />
            </motion.div>
          )}

          {subTab === 'gpu' && (
            <motion.div key="gpu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <HardwareScaling
                gpuInfo={gpuInfo}
                onOpenControlPanel={onOpenControlPanel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
