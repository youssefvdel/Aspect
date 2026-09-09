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
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-m3-surface">
      {/* Material 3 Tab Row Navigation */}
      <nav className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 bg-m3-surface-container-low border-b border-m3-outline-subtle h-11 shrink-0 select-none z-10">
        {SUBTABS.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`relative h-full px-3.5 sm:px-4 flex items-center justify-center text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                active ? 'text-m3-primary font-bold font-display' : 'text-m3-outline hover:text-m3-on-surface'
              }`}
            >
              <span>{t.label}</span>
              {active && (
                <motion.span
                  layoutId="settings-active-subtab"
                  className="absolute -bottom-px left-2 right-2 h-[2.5px] bg-m3-primary rounded-full shadow-xs"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-3.5 pb-8">
        <div className="max-w-6xl mx-auto h-full w-full">
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
    </div>
  );
};
