import React, { useState } from 'react';
import { Overview } from './Overview';
import { MatchHistory } from './MatchHistory';
import { TrackerMaps } from './TrackerMaps';
import { TrackerAgents } from './TrackerAgents';
import { LiveMatchView } from './LiveMatchView';
import { motion, AnimatePresence } from 'framer-motion';

export type TrackerSubTab = 'overview' | 'live' | 'matches' | 'agents' | 'maps';

interface SubTabItem {
  id: TrackerSubTab;
  label: string;
}

const TABS: SubTabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'live', label: 'Live Match' },
  { id: 'matches', label: 'Matches' },
  { id: 'agents', label: 'Agents' },
  { id: 'maps', label: 'Maps' },
];

export const TrackerView: React.FC<{ initialSubTab?: TrackerSubTab }> = ({ initialSubTab = 'overview' }) => {
  const [subTab, setSubTab] = useState<TrackerSubTab>(initialSubTab);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-m3-surface">
      {/* Material 3 Tab Row Navigation */}
      <nav className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 bg-m3-surface-container-low border-b border-m3-outline-subtle h-11 shrink-0 select-none z-10">
        {TABS.map((t) => {
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
                  layoutId="tracker-active-subtab"
                  className="absolute -bottom-px left-2 right-2 h-[2.5px] bg-m3-primary rounded-full shadow-xs"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab Content Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {subTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <Overview />
            </motion.div>
          )}

          {subTab === 'live' && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <LiveMatchView />
            </motion.div>
          )}

          {subTab === 'matches' && (
            <motion.div key="matches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <MatchHistory />
            </motion.div>
          )}

          {subTab === 'agents' && (
            <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <TrackerAgents />
            </motion.div>
          )}

          {subTab === 'maps' && (
            <motion.div key="maps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <TrackerMaps />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
