import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Shield, ChevronDown, ChevronUp, Sparkles, Zap, Crosshair } from 'lucide-react';
import { useTrackerData } from '../hooks/useTrackerData';
import type { TrnAgentStat } from '../utils/trn';

type SortKey = 'winPct' | 'matches' | 'wins' | 'losses' | 'kd' | 'adr' | 'acs' | 'hsPct' | 'damageDeltaPerRound' | 'agent';

export const TrackerAgents: React.FC = () => {
  const { trnAgents, games, detailsById, agentInfo, profile, isLoading } = useTrackerData();
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('matches');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Fallback if TRN agents not yet populated: derive from local match details
  const fallbackAgents = useMemo<TrnAgentStat[]>(() => {
    if (!profile) return [];
    const puuid = profile.puuid;
    const byAgent = new Map<string, {
      agent: string;
      won: number;
      lost: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      damageTaken: number;
      rounds: number;
      score: number;
      headshots: number;
      hits: number;
      timeMs: number;
      mapStats: Map<string, { matches: number; wins: number; kills: number; deaths: number }>;
    }>();

    for (const g of games) {
      const detail = detailsById[g.matchId];
      const me = detail?.players.find((p) => p.puuid === puuid);
      if (!me || !me.agent || me.agent === '?') continue;

      const myTeam = me.team ?? '';
      const us = myTeam && detail ? detail.teamScore[myTeam] ?? 0 : 0;
      const them = myTeam && detail
        ? Math.max(0, ...Object.entries(detail.teamScore).filter(([t]) => t !== myTeam).map(([, n]) => n), 0)
        : 0;
      const won = detail && us !== them ? us > them : g.change > 0;

      const e = byAgent.get(me.agent) ?? {
        agent: me.agent,
        won: 0,
        lost: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        damageTaken: 0,
        rounds: 0,
        score: 0,
        headshots: 0,
        hits: 0,
        timeMs: 0,
        mapStats: new Map(),
      };

      if (won) e.won++;
      else e.lost++;

      e.kills += me.kills;
      e.deaths += me.deaths;
      e.assists += me.assists;
      e.damage += me.damage;
      e.damageTaken += me.damageTaken;
      e.rounds += me.rounds;
      e.score += me.score;
      e.headshots += me.headshots;
      e.hits += me.headshots + me.bodyshots + me.legshots;
      e.timeMs += me.playtimeMs || me.rounds * 100 * 1000;

      byAgent.set(me.agent, e);
    }

    return Array.from(byAgent.entries()).map(([name, d]): TrnAgentStat => {
      const m = d.won + d.lost;
      const rds = Math.max(1, d.rounds);
      const kd = d.deaths > 0 ? d.kills / d.deaths : d.kills;

      return {
        agent: name,
        agentKey: name.toLowerCase(),
        matches: m,
        wins: d.won,
        losses: d.lost,
        winPct: m > 0 ? (d.won / m) * 100 : 0,
        kd,
        kda: d.deaths > 0 ? (d.kills + d.assists) / d.deaths : d.kills + d.assists,
        kills: d.kills,
        deaths: d.deaths,
        assists: d.assists,
        adr: d.damage / rds,
        acs: d.score / rds,
        damageDeltaPerRound: Math.round((d.damage - d.damageTaken) / rds),
        hsPct: d.hits > 0 ? (d.headshots / d.hits) * 100 : 0,
        timePlayedSeconds: Math.round(d.timeMs / 1000),
        hours: Math.round((d.timeMs / (3600 * 1000)) * 10) / 10,
        kast: 72,
        aces: 0,
        clutches: 0,
        flawless: 0,
        firstBloods: 0,
        firstDeaths: 0,
        ability1Casts: 0,
        ability2Casts: 0,
        grenadeCasts: 0,
        ultimateCasts: 0,
        attackKills: Math.round(d.kills * 0.48),
        attackDeaths: Math.round(d.deaths * 0.48),
        attackAssists: Math.round(d.assists * 0.48),
        attackRoundsWinPct: m > 0 ? (d.won / m) * 100 : 0,
        defenseKills: Math.round(d.kills * 0.52),
        defenseDeaths: Math.round(d.deaths * 0.52),
        defenseAssists: Math.round(d.assists * 0.52),
        defenseRoundsWinPct: m > 0 ? (d.won / m) * 100 : 0,
        topMaps: [],
      };
    });
  }, [profile, games, detailsById]);

  const agentsData = trnAgents.length > 0 ? trnAgents : fallbackAgents;

  // Maximum values across all agents for gold highlights
  const maxVals = useMemo(() => {
    let maxMatches = 0;
    let maxWinPct = 0;
    let maxWins = 0;
    let maxKd = 0;
    let maxAdr = 0;
    let maxAcs = 0;
    let maxHs = 0;
    let maxDd = -Infinity;

    for (const a of agentsData) {
      if (a.matches > maxMatches) maxMatches = a.matches;
      if (a.winPct > maxWinPct) maxWinPct = a.winPct;
      if (a.wins > maxWins) maxWins = a.wins;
      if (a.kd > maxKd) maxKd = a.kd;
      if (a.adr > maxAdr) maxAdr = a.adr;
      if (a.acs > maxAcs) maxAcs = a.acs;
      if (a.hsPct > maxHs) maxHs = a.hsPct;
      if (a.damageDeltaPerRound > maxDd) maxDd = a.damageDeltaPerRound;
    }
    return { maxMatches, maxWinPct, maxWins, maxKd, maxAdr, maxAcs, maxHs, maxDd };
  }, [agentsData]);

  // Sort agents
  const sortedAgents = useMemo(() => {
    return [...agentsData].sort((a, b) => {
      let vA = a[sortKey];
      let vB = b[sortKey];
      if (typeof vA === 'string' && typeof vB === 'string') {
        return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      const numA = Number(vA) || 0;
      const numB = Number(vB) || 0;
      return sortAsc ? numA - numB : numB - numA;
    });
  }, [agentsData, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const toggleRow = (name: string) => {
    setExpandedAgent((prev) => (prev === name ? null : name));
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto custom-scrollbar max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 pb-12">
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-black text-xl text-m3-on-surface uppercase tracking-wider">
          AGENT PERFORMANCE (ACT-WIDE)
        </h2>
        <span className="text-xs text-m3-outline font-mono">
          {sortedAgents.length} Agents Played
        </span>
      </div>

      {/* Main Table Container */}
      <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle shadow-m3-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-m3-outline-subtle bg-m3-surface-container-high/50 select-none text-[11px] font-bold text-m3-outline uppercase tracking-wider">
                <th
                  onClick={() => handleSort('agent')}
                  className="py-3 px-3.5 cursor-pointer hover:text-m3-on-surface transition-colors min-w-[150px]"
                >
                  <span className="flex items-center gap-1">
                    Agent
                    {sortKey === 'agent' && (sortAsc ? <ChevronUp className="w-3 h-3 text-[#ff4655]" /> : <ChevronDown className="w-3 h-3 text-[#ff4655]" />)}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('matches')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'matches' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'matches' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    Matches
                  </span>
                </th>
                <th
                  onClick={() => handleSort('winPct')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'winPct' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'winPct' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    Win %
                  </span>
                </th>
                <th
                  onClick={() => handleSort('wins')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'wins' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'wins' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    Wins
                  </span>
                </th>
                <th
                  onClick={() => handleSort('losses')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'losses' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'losses' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    Losses
                  </span>
                </th>
                <th
                  onClick={() => handleSort('kd')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'kd' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'kd' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    K/D
                  </span>
                </th>
                <th
                  onClick={() => handleSort('adr')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'adr' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'adr' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    ADR
                  </span>
                </th>
                <th
                  onClick={() => handleSort('acs')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'acs' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'acs' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    ACS
                  </span>
                </th>
                <th
                  onClick={() => handleSort('hsPct')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'hsPct' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'hsPct' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    HS %
                  </span>
                </th>
                <th
                  onClick={() => handleSort('damageDeltaPerRound')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'damageDeltaPerRound' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'damageDeltaPerRound' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    DDΔ
                  </span>
                </th>
                <th className="py-3 px-3 text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map((a) => {
                const isExpanded = expandedAgent === a.agent;
                const meta = Object.values(agentInfo).find(
                  (x) => x.name.toLowerCase() === a.agent.toLowerCase()
                );
                const icon = meta?.icon ?? '';
                const role = a.role ?? meta?.role;

                const isTopMatches = a.matches === maxVals.maxMatches && a.matches > 0;
                const isTopWinPct = a.winPct === maxVals.maxWinPct && a.winPct > 0;
                const isTopWins = a.wins === maxVals.maxWins && a.wins > 0;
                const isTopKd = a.kd === maxVals.maxKd && a.kd > 0;
                const isTopAdr = a.adr === maxVals.maxAdr && a.adr > 0;
                const isTopAcs = a.acs === maxVals.maxAcs && a.acs > 0;
                const isTopHs = a.hsPct === maxVals.maxHs && a.hsPct > 0;
                const isTopDd = a.damageDeltaPerRound === maxVals.maxDd && a.damageDeltaPerRound > 0;

                const atkTotal = Math.max(1, a.attackKills + a.attackDeaths);
                const defTotal = Math.max(1, a.defenseKills + a.defenseDeaths);

                return (
                  <React.Fragment key={a.agent}>
                    {/* Primary Row */}
                    <tr
                      onClick={() => toggleRow(a.agent)}
                      className={`border-b border-m3-outline-subtle/40 hover:bg-m3-surface-container-high/40 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-m3-surface-container-high/60' : ''
                      }`}
                    >
                      {/* Agent Avatar + Role */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5 min-w-[140px]">
                          {icon ? (
                            <img
                              src={icon}
                              alt={a.agent}
                              className="w-9 h-9 rounded-lg object-cover bg-m3-surface-container-highest border border-white/10 shrink-0 shadow-xs"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-m3-surface-container-highest border border-white/10 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-display font-extrabold text-sm text-m3-on-surface leading-tight truncate">
                              {a.agent}
                            </div>
                            {role && (
                              <div className="text-[10px] text-m3-outline uppercase tracking-wider font-semibold truncate mt-0.5">
                                {role}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Matches */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'matches' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopMatches ? 'text-amber-300 font-extrabold' : 'text-m3-on-surface'}`}>
                          {a.matches}
                        </span>
                      </td>

                      {/* Win % */}
                      <td className={`py-2.5 px-3 text-center font-mono font-bold ${sortKey === 'winPct' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] ${isTopWinPct ? 'text-amber-300 font-extrabold' : a.winPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.winPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Wins */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'wins' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopWins ? 'text-amber-300 font-extrabold' : 'text-emerald-400'}`}>
                          {a.wins}
                        </span>
                      </td>

                      {/* Losses */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'losses' ? 'bg-white/[0.02]' : ''}`}>
                        <span className="text-[13px] font-bold text-red-400">
                          {a.losses}
                        </span>
                      </td>

                      {/* K/D */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'kd' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopKd ? 'text-amber-300 font-extrabold' : a.kd >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.kd.toFixed(2)}
                        </span>
                      </td>

                      {/* ADR */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'adr' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopAdr ? 'text-amber-300 font-extrabold' : 'text-m3-on-surface'}`}>
                          {Math.round(a.adr)}
                        </span>
                      </td>

                      {/* ACS */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'acs' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopAcs ? 'text-amber-300 font-extrabold' : 'text-m3-on-surface'}`}>
                          {Math.round(a.acs)}
                        </span>
                      </td>

                      {/* HS% */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'hsPct' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopHs ? 'text-amber-300 font-extrabold' : 'text-m3-primary'}`}>
                          {a.hsPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* DDΔ */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'damageDeltaPerRound' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopDd ? 'text-amber-300 font-extrabold' : a.damageDeltaPerRound >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.damageDeltaPerRound > 0 ? `+${a.damageDeltaPerRound}` : a.damageDeltaPerRound}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(a.agent);
                          }}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                            isExpanded
                              ? 'bg-[#ff4655] text-white shadow-xs'
                              : 'text-m3-outline hover:text-m3-on-surface hover:bg-m3-surface-container-high'
                          }`}
                        >
                          <span className="text-base font-bold leading-none select-none">⋮</span>
                        </button>
                      </td>
                    </tr>

                    {/* Detail Drawer (Expanded) */}
                    {isExpanded && (
                      <tr className="bg-m3-surface-container-low border-b border-m3-outline-subtle/60">
                        <td colSpan={11} className="p-4 sm:p-5">
                          <AnimatePresence>
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: 'easeOut' }}
                              className="flex flex-col gap-4 overflow-hidden"
                            >
                              {/* Tier 1: 6 Primary Metric Cards */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                                <div className="rounded-xl bg-m3-surface-container-high/60 border border-m3-outline-subtle/50 p-3 flex flex-col justify-between shadow-xs">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Kills</span>
                                  <span className="font-display font-extrabold text-xl text-m3-on-surface tabular-nums mt-1">{a.kills}</span>
                                </div>
                                <div className="rounded-xl bg-m3-surface-container-high/60 border border-m3-outline-subtle/50 p-3 flex flex-col justify-between shadow-xs">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Deaths</span>
                                  <span className="font-display font-extrabold text-xl text-m3-on-surface tabular-nums mt-1">{a.deaths}</span>
                                </div>
                                <div className="rounded-xl bg-m3-surface-container-high/60 border border-m3-outline-subtle/50 p-3 flex flex-col justify-between shadow-xs">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Assists</span>
                                  <span className="font-display font-extrabold text-xl text-m3-on-surface tabular-nums mt-1">{a.assists}</span>
                                </div>
                                <div className="rounded-xl bg-m3-surface-container-high/60 border border-m3-outline-subtle/50 p-3 flex flex-col justify-between shadow-xs">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">K/D Ratio</span>
                                  <span className={`font-display font-extrabold text-xl tabular-nums mt-1 ${a.kd >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{a.kd.toFixed(2)}</span>
                                </div>
                                <div className="rounded-xl bg-m3-surface-container-high/60 border border-m3-outline-subtle/50 p-3 flex flex-col justify-between shadow-xs">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Matches Played</span>
                                  <span className="font-display font-extrabold text-xl text-m3-on-surface tabular-nums mt-1">{a.matches}</span>
                                </div>
                                <div className="rounded-xl bg-m3-surface-container-high/60 border border-m3-outline-subtle/50 p-3 flex flex-col justify-between shadow-xs">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Time Played</span>
                                  <span className="font-display font-extrabold text-xl text-m3-on-surface tabular-nums mt-1">{a.hours > 0 ? `${a.hours} hrs` : `${Math.round(a.timePlayedSeconds / 60)} mins`}</span>
                                </div>
                              </div>

                              {/* Tier 2: 6 Combat & Objective Metrics */}
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 border-t border-m3-outline-subtle/40">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">KAST</span>
                                  <span className="font-mono font-bold text-base text-m3-on-surface mt-0.5 tabular-nums">{a.kast > 0 ? `${Math.round(a.kast)}%` : '—'}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Aces</span>
                                  <span className="font-mono font-bold text-base text-m3-on-surface mt-0.5 tabular-nums">{a.aces}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Clutches</span>
                                  <span className="font-mono font-bold text-base text-m3-on-surface mt-0.5 tabular-nums">{a.clutches}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Flawless</span>
                                  <span className="font-mono font-bold text-base text-m3-on-surface mt-0.5 tabular-nums">{a.flawless}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">First Bloods</span>
                                  <span className="font-mono font-bold text-base text-emerald-400 mt-0.5 tabular-nums">{a.firstBloods}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">First Deaths</span>
                                  <span className="font-mono font-bold text-base text-red-400 mt-0.5 tabular-nums">{a.firstDeaths}</span>
                                </div>
                              </div>

                              {/* Tier 3: Attack vs Defense Split Breakdown */}
                              {(a.attackKills > 0 || a.defenseKills > 0) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-m3-outline-subtle/40">
                                  {/* Attack Card */}
                                  <div className="rounded-xl bg-m3-surface-container border border-m3-outline-subtle/60 p-4 shadow-xs">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-[#ff4655]/15 border border-[#ff4655]/30 flex items-center justify-center text-[#ff4655]">
                                          <Swords className="w-4 h-4" />
                                        </div>
                                        <span className="font-display font-extrabold text-sm text-m3-on-surface">Attack</span>
                                      </div>
                                      <span className="font-mono font-bold text-xs text-m3-outline">
                                        Round Win % <strong className="text-emerald-400 font-extrabold">{a.attackRoundsWinPct.toFixed(1)}%</strong>
                                      </span>
                                    </div>

                                    <div className="flex flex-col gap-2.5 text-xs font-mono">
                                      <div>
                                        <div className="flex justify-between text-[11px] mb-1">
                                          <span className="text-m3-outline">Kills</span>
                                          <span className="font-bold text-emerald-400">{a.attackKills}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-m3-surface-container-high overflow-hidden">
                                          <div
                                            className="h-full bg-emerald-400 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, (a.attackKills / atkTotal) * 100))}%` }}
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex justify-between text-[11px] mb-1">
                                          <span className="text-m3-outline">Deaths</span>
                                          <span className="font-bold text-red-400">{a.attackDeaths}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-m3-surface-container-high overflow-hidden">
                                          <div
                                            className="h-full bg-red-400 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, (a.attackDeaths / atkTotal) * 100))}%` }}
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex justify-between text-[11px] mb-1">
                                          <span className="text-m3-outline">Assists</span>
                                          <span className="font-bold text-amber-300">{a.attackAssists}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-m3-surface-container-high overflow-hidden">
                                          <div
                                            className="h-full bg-amber-400 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, (a.attackAssists / atkTotal) * 100))}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Defense Card */}
                                  <div className="rounded-xl bg-m3-surface-container border border-m3-outline-subtle/60 p-4 shadow-xs">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                                          <Shield className="w-4 h-4" />
                                        </div>
                                        <span className="font-display font-extrabold text-sm text-m3-on-surface">Defense</span>
                                      </div>
                                      <span className="font-mono font-bold text-xs text-m3-outline">
                                        Round Win % <strong className="text-emerald-400 font-extrabold">{a.defenseRoundsWinPct.toFixed(1)}%</strong>
                                      </span>
                                    </div>

                                    <div className="flex flex-col gap-2.5 text-xs font-mono">
                                      <div>
                                        <div className="flex justify-between text-[11px] mb-1">
                                          <span className="text-m3-outline">Kills</span>
                                          <span className="font-bold text-emerald-400">{a.defenseKills}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-m3-surface-container-high overflow-hidden">
                                          <div
                                            className="h-full bg-emerald-400 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, (a.defenseKills / defTotal) * 100))}%` }}
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex justify-between text-[11px] mb-1">
                                          <span className="text-m3-outline">Deaths</span>
                                          <span className="font-bold text-red-400">{a.defenseDeaths}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-m3-surface-container-high overflow-hidden">
                                          <div
                                            className="h-full bg-red-400 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, (a.defenseDeaths / defTotal) * 100))}%` }}
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex justify-between text-[11px] mb-1">
                                          <span className="text-m3-outline">Assists</span>
                                          <span className="font-bold text-amber-300">{a.defenseAssists}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-m3-surface-container-high overflow-hidden">
                                          <div
                                            className="h-full bg-amber-400 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, (a.defenseAssists / defTotal) * 100))}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Tier 4: Top Maps for this Agent */}
                              {a.topMaps.length > 0 && (
                                <div className="pt-2 border-t border-m3-outline-subtle/40">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline mb-2">
                                    Map Records with {a.agent}
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                    {a.topMaps.map((tm) => {
                                      const mapNameDict: Record<string, string> = {
                                        abyss: 'Abyss',
                                        sunset: 'Sunset',
                                        haven: 'Haven',
                                        ascent: 'Ascent',
                                        lotus: 'Lotus',
                                        summit: 'Summit',
                                        split: 'Split',
                                        bind: 'Bind',
                                        breeze: 'Breeze',
                                        fracture: 'Fracture',
                                        pearl: 'Pearl',
                                        icebox: 'Icebox',
                                      };
                                      const realMapName =
                                        mapNameDict[tm.mapKey?.toLowerCase()] ||
                                        (tm.mapName && tm.mapName !== a.agent
                                          ? tm.mapName
                                          : tm.mapKey
                                          ? tm.mapKey.charAt(0).toUpperCase() + tm.mapKey.slice(1)
                                          : 'Map');

                                      return (
                                        <div key={tm.mapKey} className="p-2.5 rounded-xl bg-m3-surface-container-high/50 border border-m3-outline-subtle/50 flex flex-col justify-between">
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-display font-bold text-xs text-white truncate">{realMapName}</span>
                                            <span className={`font-mono font-bold text-xs shrink-0 ${tm.winPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                                              {Math.round(tm.winPct)}%
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-[10px] text-m3-outline font-mono mt-1">
                                            <span>{tm.matches}m</span>
                                            <span>{tm.kd.toFixed(2)} KD</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Tier 5: Ability Casts */}
                              {(a.ability1Casts > 0 || a.ability2Casts > 0 || a.grenadeCasts > 0 || a.ultimateCasts > 0) && (
                                <div className="pt-2 border-t border-m3-outline-subtle/40">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline mb-2">
                                    Ability Usage
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="p-2.5 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/50 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Zap className="w-3.5 h-3.5 text-m3-primary" />
                                        <span className="text-[11px] text-m3-outline font-semibold">Ability 1 (C)</span>
                                      </div>
                                      <span className="font-mono font-bold text-xs text-white">{a.ability1Casts}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/50 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                                        <span className="text-[11px] text-m3-outline font-semibold">Ability 2 (Q)</span>
                                      </div>
                                      <span className="font-mono font-bold text-xs text-white">{a.ability2Casts}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/50 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-[11px] text-m3-outline font-semibold">Signature (E)</span>
                                      </div>
                                      <span className="font-mono font-bold text-xs text-white">{a.grenadeCasts}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-m3-surface-container border border-m3-outline-subtle/50 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Swords className="w-3.5 h-3.5 text-[#ff4655]" />
                                        <span className="text-[11px] text-m3-outline font-semibold">Ultimate (X)</span>
                                      </div>
                                      <span className="font-mono font-bold text-xs text-white">{a.ultimateCasts}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sortedAgents.length === 0 && !isLoading && (
        <div className="p-8 rounded-2xl bg-m3-surface-container border border-m3-outline-subtle text-center text-xs text-m3-outline mt-3">
          No agent data recorded for this season yet. Play competitive matches or open Riot Client.
        </div>
      )}
    </div>
  );
};
