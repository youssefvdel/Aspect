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
                  layoutId="utility-active-subtab"
                  className="absolute -bottom-px left-2 right-2 h-[2.5px] bg-m3-primary rounded-full shadow-xs"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Content Area */}
      <div className="flex-1 min-h-0 pt-2.5 overflow-hidden">
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
