import React, { useState } from 'react';
import { Overview } from './Overview';
import { MatchHistory } from './MatchHistory';
import { useTrackerData } from '../hooks/useTrackerData';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Crosshair, Shield, Target, Swords } from 'lucide-react';

export type TrackerSubTab =
  | 'overview'
  | 'matches'
  | 'performance'
  | 'agents'
  | 'maps'
  | 'weapons'
  | 'encounters'
  | 'customs'
  | 'crosshairs'
  | 'lineups';

interface SubTabItem {
  id: TrackerSubTab;
  label: string;
  badge?: string;
}

const TABS: SubTabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'matches', label: 'Matches' },
  { id: 'performance', label: 'Performance' },
  { id: 'agents', label: 'Agents' },
  { id: 'maps', label: 'Maps' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'encounters', label: 'Encounters', badge: 'NEW' },
  { id: 'customs', label: 'Customs' },
  { id: 'crosshairs', label: 'Crosshairs' },
  { id: 'lineups', label: 'Lineups' },
];

export const TrackerView: React.FC<{ initialSubTab?: TrackerSubTab }> = ({ initialSubTab = 'overview' }) => {
  const [subTab, setSubTab] = useState<TrackerSubTab>(initialSubTab);
  const { trn, trnAgents, agentInfo, games, mapById, agg } = useTrackerData();

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* TRN-style Sub-Navigation Top Bar */}
      <nav className="flex items-center gap-6 px-4 sm:px-6 bg-[#18222d] border-b border-m3-outline-subtle/40 text-[13px] sm:text-sm font-bold shrink-0 overflow-x-auto custom-scrollbar select-none z-10 shadow-sm">
        {TABS.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`relative py-3 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                active ? 'text-white' : 'text-[#8c97a4] hover:text-[#d1d8e0]'
              }`}
            >
              <span>{t.label}</span>
              {t.badge && (
                <span className="text-[9px] font-black text-[#ff4655] border border-[#ff4655] rounded px-1 py-px leading-tight">
                  {t.badge}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId="tracker-active-subtab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff4655]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab Content Body */}
      <div className="flex-1 min-h-0 pt-3 overflow-hidden">
        <AnimatePresence mode="wait">
          {subTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <Overview />
            </motion.div>
          )}

          {subTab === 'matches' && (
            <motion.div key="matches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <MatchHistory />
            </motion.div>
          )}

          {subTab === 'performance' && (
            <motion.div key="perf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto custom-scrollbar max-w-6xl mx-auto w-full p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4">
                  <h4 className="font-display font-bold text-sm text-m3-on-surface mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-m3-primary" />
                    <span>Duel Performance Breakdown</span>
                  </h4>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-m3-outline-subtle/50">
                      <span className="text-m3-outline">First Duels Taken</span>
                      <span className="font-mono font-bold text-m3-on-surface">{(agg?.firstKills ?? 0) + (agg?.firstDeaths ?? 0)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-m3-outline-subtle/50">
                      <span className="text-m3-outline">First Duel Win Rate</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {agg && (agg.firstKills + agg.firstDeaths > 0)
                          ? ((agg.firstKills / (agg.firstKills + agg.firstDeaths)) * 100).toFixed(1) + '%'
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-m3-outline-subtle/50">
                      <span className="text-m3-outline">Clutch Conversion</span>
                      <span className="font-mono font-bold text-m3-on-surface">{agg?.clutches ?? 0} clutches won</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-m3-outline">Multi-Kill Rounds (3k / 4k / Ace)</span>
                      <span className="font-mono font-bold text-m3-on-surface">
                        {trn ? `${trn.kills3k} / ${trn.kills4k} / ${trn.aces}` : agg ? `— / — / ${agg.aces}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4">
                  <h4 className="font-display font-bold text-sm text-m3-on-surface mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Combat Rating & Economy</span>
                  </h4>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-m3-outline-subtle/50">
                      <span className="text-m3-outline">Average Damage / Round</span>
                      <span className="font-mono font-bold text-m3-on-surface">{agg?.adr.toFixed(1) ?? trn?.adr.toFixed(1) ?? '—'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-m3-outline-subtle/50">
                      <span className="text-m3-outline">Damage Delta / Round</span>
                      <span className={`font-mono font-bold ${trn && trn.damageDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trn ? (trn.damageDelta > 0 ? `+${trn.damageDelta}` : String(trn.damageDelta)) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-m3-outline-subtle/50">
                      <span className="text-m3-outline">K/D Ratio</span>
                      <span className={`font-mono font-bold ${agg && agg.kd >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {agg?.kd.toFixed(2) ?? '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-m3-outline">Average Combat Score</span>
                      <span className="font-mono font-bold text-m3-on-surface">{trn ? Math.round(trn.acs) : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {subTab === 'agents' && (
            <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto custom-scrollbar max-w-6xl mx-auto w-full p-2">
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4">
                <h4 className="font-display font-bold text-sm text-m3-on-surface mb-3">Agent Performance (Act-Wide)</h4>
                {trnAgents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-m3-outline-subtle/60 text-m3-outline font-semibold">
                          <th className="py-2 px-2">Agent</th>
                          <th className="py-2 px-2">Matches</th>
                          <th className="py-2 px-2">Win %</th>
                          <th className="py-2 px-2">K/D</th>
                          <th className="py-2 px-2">ADR</th>
                          <th className="py-2 px-2">ACS</th>
                          <th className="py-2 px-2">HS %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trnAgents.map((a) => {
                          const icon = Object.values(agentInfo).find(
                            (x) => x.name.toLowerCase() === a.agent.toLowerCase()
                          )?.icon;
                          return (
                            <tr key={a.agent} className="border-b border-m3-outline-subtle/30 hover:bg-m3-surface-container-high/40">
                              <td className="py-2.5 px-2 font-bold text-m3-on-surface flex items-center gap-2">
                                {icon && <img src={icon} alt={a.agent} className="w-7 h-7 rounded-md object-cover bg-m3-surface-container-high" />}
                                <span>{a.agent}</span>
                              </td>
                              <td className="py-2.5 px-2 font-mono">{a.matches}</td>
                              <td className={`py-2.5 px-2 font-mono font-bold ${a.winPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {a.winPct.toFixed(1)}%
                              </td>
                              <td className={`py-2.5 px-2 font-mono font-bold ${a.kd >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {a.kd.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-2 font-mono">{Math.round(a.adr)}</td>
                              <td className="py-2.5 px-2 font-mono">{Math.round(a.acs)}</td>
                              <td className="py-2.5 px-2 font-mono text-m3-primary">{a.hsPct.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-m3-outline py-4 text-center">Loading agent breakdown…</div>
                )}
              </div>
            </motion.div>
          )}

          {subTab === 'maps' && (
            <motion.div key="maps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto custom-scrollbar max-w-6xl mx-auto w-full p-2">
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4">
                <h4 className="font-display font-bold text-sm text-m3-on-surface mb-3">Map Records (Recent Games)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Array.from(new Set(games.map((g) => mapById[g.matchId]).filter(Boolean))).map((mapName) => {
                    const mapGames = games.filter((g) => mapById[g.matchId] === mapName);
                    const wins = mapGames.filter((g) => g.change > 0).length;
                    const wr = mapGames.length > 0 ? (wins / mapGames.length) * 100 : 0;
                    return (
                      <div key={mapName} className="rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle/50 p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-display font-bold text-sm text-m3-on-surface">{mapName}</span>
                          <span className={`text-xs font-mono font-bold ${wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {wr.toFixed(0)}% WR
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-m3-outline">
                          {wins}W – {mapGames.length - wins}L • {mapGames.length} played
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {subTab === 'weapons' && (
            <motion.div key="weapons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto custom-scrollbar max-w-6xl mx-auto w-full p-2">
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4">
                <h4 className="font-display font-bold text-sm text-m3-on-surface mb-3">Weapon Accuracy & Kills</h4>
                <div className="rounded-xl bg-m3-surface-container-high/30 border border-m3-outline-subtle/50 p-4 text-xs text-m3-outline flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-m3-primary shrink-0" />
                  <span>Individual weapon kill distribution and headshot rates update dynamically during match history analysis.</span>
                </div>
              </div>
            </motion.div>
          )}

          {subTab === 'encounters' && (
            <motion.div key="encounters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto custom-scrollbar max-w-6xl mx-auto w-full p-2">
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-display font-bold text-sm text-m3-on-surface flex items-center gap-2">
                    <Swords className="w-4 h-4 text-[#ff4655]" />
                    <span>Player Encounters</span>
                  </h4>
                  <span className="text-[9px] font-extrabold text-[#ff4655] border border-[#ff4655] rounded px-1.5 py-0.5 leading-none">
                    NEW FEATURE
                  </span>
                </div>
                <p className="text-xs text-m3-outline leading-relaxed mb-4">
                  Track rivals and frequent teammates across your competitive games. See your head-to-head K/D against specific players when you encounter them again.
                </p>
                <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-xs text-m3-outline">
                  Live encounter scouting actives automatically when playing matches in current act.
                </div>
              </div>
            </motion.div>
          )}

          {(subTab === 'customs' || subTab === 'crosshairs' || subTab === 'lineups') && (
            <motion.div key="other" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto custom-scrollbar max-w-6xl mx-auto w-full p-2">
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-m3-surface-container-high flex items-center justify-center text-m3-primary mx-auto mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="font-display font-bold text-base text-m3-on-surface capitalize mb-1">{subTab}</h4>
                <p className="text-xs text-m3-outline max-w-md mx-auto">
                  {subTab === 'customs' && 'Custom game lobby history and tournament statistics.'}
                  {subTab === 'crosshairs' && 'Save, generate, and test crosshair profiles directly in Aspect.'}
                  {subTab === 'lineups' && 'Interactive map lineups and ability trajectory guides for your agent pool.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
