import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { ScoreBadge, scoreTier } from './ScoreBadge';
import { fetchTrnActStats, type TrnActStats } from '../utils/trn';
import { fetchMmrDirect } from '../utils/tracker';
import type { TrackerProfile } from '../types';

export interface SelectedPlayerInfo {
  puuid: string;
  name: string;
  tag: string;
  agent: string;
  agIcon?: string;
  tier?: number;
  rankName?: string;
  rankIcon?: string;
  team: string;
  isMe?: boolean;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  rounds: number;
  acs: number;
  kd: number;
  adr: number;
  hsPct: number;
  kast: number;
  fk: number;
  fd: number;
  mk: number;
  trs: number;
}

interface Props {
  player: SelectedPlayerInfo | null;
  seasonId?: string;
  onClose: () => void;
  onViewFullProfile?: (name: string, tag: string) => void;
}

export const PlayerOverviewModal: React.FC<Props> = ({
  player,
  seasonId,
  onClose,
  onViewFullProfile,
}) => {
  const [trnStats, setTrnStats] = useState<TrnActStats | null>(null);
  const [mmrProfile, setMmrProfile] = useState<TrackerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!player || !player.name || player.name === player.agent) {
      setTrnStats(null);
      setMmrProfile(null);
      return;
    }

    let active = true;
    setIsLoading(true);

    const name = player.name;
    const tag = player.tag || '';

    Promise.allSettled([
      fetchTrnActStats(name, tag, seasonId),
      fetchMmrDirect('eu', name, tag),
    ]).then(([trnRes, mmrRes]) => {
      if (!active) return;
      if (trnRes.status === 'fulfilled') {
        setTrnStats(trnRes.value.stats);
      } else {
        setTrnStats(null);
      }
      if (mmrRes.status === 'fulfilled') {
        setMmrProfile(mmrRes.value);
      } else {
        setMmrProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [player, seasonId]);

  if (!player) return null;

  const currentRank = mmrProfile?.rank || player.rankName || 'Unranked';
  const currentRr = mmrProfile?.rr ?? 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
        {/* Blurred Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-2xl rounded-3xl bg-m3-surface-container border border-m3-outline-subtle shadow-m3-3 overflow-hidden flex flex-col z-10 max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-m3-outline-subtle bg-m3-surface-container-high/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Agent Avatar */}
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-m3-outline-subtle bg-m3-surface-container-highest shrink-0 shadow-xs">
                {player.agIcon ? (
                  <img src={player.agIcon} alt={player.agent} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-m3-surface-container-highest flex items-center justify-center font-display font-black text-sm text-m3-primary">
                    {player.agent.slice(0, 2)}
                  </div>
                )}
                <span
                  className={`absolute bottom-0 inset-x-0 h-1 ${
                    player.team === 'Blue' ? 'bg-emerald-400' : 'bg-m3-coral'
                  }`}
                />
              </div>

              {/* Name & Tag */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-black text-lg text-m3-on-surface truncate">
                    {player.name}
                  </h3>
                  {player.tag && (
                    <span className="text-xs font-mono font-bold text-m3-outline">
                      #{player.tag}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      player.team === 'Blue'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-red-500/20 text-red-300 border border-red-400/30'
                    }`}
                  >
                    {player.team} Team
                  </span>
                </div>
                <div className="text-xs text-m3-outline mt-0.5 flex items-center gap-2">
                  <span>Played {player.agent}</span>
                  {player.rankIcon && (
                    <span className="flex items-center gap-1 font-medium text-m3-on-surface-variant">
                      • <img src={player.rankIcon} alt="" className="w-3.5 h-3.5 object-contain inline" />
                      {currentRank} {currentRr > 0 ? `(${currentRr} RR)` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {onViewFullProfile && player.name && (
                <button
                  type="button"
                  onClick={() => {
                    onViewFullProfile(player.name, player.tag);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-m3-primary text-m3-on-primary text-xs font-display font-bold flex items-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
                >
                  <span>Open Full Tracker</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-m3-surface-container-highest hover:bg-m3-surface-bright text-m3-outline hover:text-m3-on-surface flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
            {/* Match Performance Snapshot */}
            <div className="rounded-2xl bg-m3-surface-container-low border border-m3-outline-subtle p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline mb-3 flex items-center justify-between">
                <span>Match Scoreboard Snapshot</span>
                <span className="text-m3-primary font-mono font-bold">TRS: {player.trs}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">K / D / A</div>
                  <div className="font-display font-extrabold text-base text-m3-on-surface mt-0.5">
                    {player.kills} / {player.deaths} / {player.assists}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">K/D Ratio</div>
                  <div className={`font-display font-extrabold text-base mt-0.5 ${player.kd >= 1 ? 'text-emerald-400' : 'text-m3-coral'}`}>
                    {player.kd.toFixed(2)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">ACS</div>
                  <div className="font-display font-extrabold text-base text-m3-on-surface mt-0.5">
                    {player.acs}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">HS%</div>
                  <div className="font-display font-extrabold text-base text-m3-on-surface mt-0.5">
                    {player.hsPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Act-Wide TRN Overview */}
            {isLoading ? (
              <div className="p-8 rounded-2xl bg-m3-surface-container-low border border-m3-outline-subtle text-center text-xs text-m3-outline">
                <div className="w-6 h-6 border-2 border-m3-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Fetching act statistics for {player.name}...</span>
              </div>
            ) : trnStats ? (
              <div className="rounded-2xl bg-m3-surface-container-low border border-m3-outline-subtle p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">
                      Act-Wide Competitive Stats
                    </div>
                    <div className="font-display font-black text-base text-m3-on-surface mt-0.5">
                      {trnStats.wins}W - {trnStats.losses}L ({trnStats.winPct.toFixed(1)}% Win Rate)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreBadge tier={scoreTier(trnStats.trnScore).tier} size={36} />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">
                        Tracker Score
                      </div>
                      <div className="font-display font-extrabold text-sm text-m3-on-surface">
                        {trnStats.trnScore} / 1,000
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/40">
                    <div className="text-[10px] text-m3-outline uppercase font-semibold">Damage/Round</div>
                    <div className="font-bold text-sm text-m3-on-surface mt-0.5">{trnStats.adr.toFixed(1)}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/40">
                    <div className="text-[10px] text-m3-outline uppercase font-semibold">K/D Ratio</div>
                    <div className={`font-bold text-sm mt-0.5 ${trnStats.kd >= 1 ? 'text-emerald-400' : 'text-m3-coral'}`}>
                      {trnStats.kd.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/40">
                    <div className="text-[10px] text-m3-outline uppercase font-semibold">Headshot %</div>
                    <div className="font-bold text-sm text-m3-on-surface mt-0.5">{trnStats.hsPct.toFixed(1)}%</div>
                  </div>
                  <div className="p-2 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/40">
                    <div className="text-[10px] text-m3-outline uppercase font-semibold">KAST</div>
                    <div className="font-bold text-sm text-m3-on-surface mt-0.5">{trnStats.kast.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-m3-surface-container-low border border-m3-outline-subtle text-center text-xs text-m3-outline">
                Act profile is private or unavailable on TRN for this player.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
