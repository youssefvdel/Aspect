import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UnifiedStretch } from './UnifiedStretch';
import { ResolutionVisualizer } from './ResolutionVisualizer';
import type { DisplayInfo, ShortcutBinding } from '../types';

export type UtilitySubTab = 'switcher' | 'visualizer';

interface UtilityViewProps {
  initialSubTab?: UtilitySubTab;
  displayInfo: DisplayInfo | null;
  shortcut?: ShortcutBinding | null;
  preferredStretched?: [number, number];
  onToggle: () => Promise<void>;
  onApplyResolution: (w: number, h: number, hz: number) => Promise<void>;
  onSaveShortcut: (binding: ShortcutBinding) => Promise<void>;
  isLoading: boolean;
}

const SUBTABS: { id: UtilitySubTab; label: string }[] = [
  { id: 'switcher', label: 'Resolution Switch' },
  { id: 'visualizer', label: 'Stretch Preview' },
];

export const UtilityView: React.FC<UtilityViewProps> = ({
  initialSubTab = 'switcher',
  displayInfo,
  shortcut,
  preferredStretched,
  onToggle,
  onApplyResolution,
  onSaveShortcut,
  isLoading,
}) => {
  const [subTab, setSubTab] = useState<UtilitySubTab>(initialSubTab);

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
                  layoutId="utility-active-subtab"
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
          {subTab === 'switcher' && (
            <motion.div key="switcher" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <UnifiedStretch
                displayInfo={displayInfo}
                shortcut={shortcut ?? null}
                preferredStretched={preferredStretched}
                onToggle={onToggle}
                onApplyResolution={onApplyResolution}
                onSaveShortcut={onSaveShortcut}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {subTab === 'visualizer' && (
            <motion.div key="visualizer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <ResolutionVisualizer
                displayInfo={displayInfo}
                onApplyResolution={onApplyResolution}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
