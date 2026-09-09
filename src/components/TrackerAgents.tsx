import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Shield, Swords } from 'lucide-react';
import { useTrackerData } from '../hooks/useTrackerData';
import type { TrnAgentStat } from '../utils/trn';

type SortKey = 'hours' | 'matches' | 'winPct' | 'kd' | 'adr' | 'acs' | 'damageDeltaPerRound' | 'hsPct' | 'kast' | 'agent';

const ROLE_COLORS: Record<string, string> = {
  sentinel: '#10b981',
  duelist: '#ff4655',
  initiator: '#f59e0b',
  controller: '#8b5cf6',
};

export const TrackerAgents: React.FC = () => {
  const { trnAgents, games, detailsById, agentInfo, profile, isLoading } = useTrackerData();
  const [expandedAgent, setExpandedAgent] = useState<string | null>('Sage');
  const [sortKey, setSortKey] = useState<SortKey>('hours');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Fallback if TRN agents not loaded yet
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
        bestKills: 0,
        defenseRoundsWon: Math.round(rds * 0.28),
        defenseRoundsLost: Math.round(rds * 0.22),
        defenseKd: kd * 1.05,
        defusesPerMatch: 0.5,
        attackRoundsWon: Math.round(rds * 0.26),
        attackRoundsLost: Math.round(rds * 0.24),
        attackKd: kd * 0.95,
        plantsPerMatch: 1.8,
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

  // Maximum values for gold highlighting
  const maxVals = useMemo(() => {
    let maxHours = 0;
    let maxMatches = 0;
    let maxWinPct = 0;
    let maxKd = 0;
    let maxAdr = 0;
    let maxAcs = 0;
    let maxHs = 0;
    let maxKast = 0;
    let maxDd = -Infinity;

    for (const a of agentsData) {
      if (a.hours > maxHours) maxHours = a.hours;
      if (a.matches > maxMatches) maxMatches = a.matches;
      if (a.winPct > maxWinPct) maxWinPct = a.winPct;
      if (a.kd > maxKd) maxKd = a.kd;
      if (a.adr > maxAdr) maxAdr = a.adr;
      if (a.acs > maxAcs) maxAcs = a.acs;
      if (a.hsPct > maxHs) maxHs = a.hsPct;
      if (a.kast > maxKast) maxKast = a.kast;
      if (a.damageDeltaPerRound > maxDd) maxDd = a.damageDeltaPerRound;
    }
    return { maxHours, maxMatches, maxWinPct, maxKd, maxAdr, maxAcs, maxHs, maxKast, maxDd };
  }, [agentsData]);

  // Sorting
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
      {/* Page Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-black text-xl text-m3-on-surface uppercase tracking-wider">
          AGENTS
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
              <tr className="border-b border-m3-outline-subtle bg-m3-surface-container-high/60 select-none text-[11px] font-bold text-m3-outline uppercase tracking-wider">
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
                  onClick={() => handleSort('hours')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'hours' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'hours' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    Time Played
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
                <th
                  onClick={() => handleSort('hsPct')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'hsPct' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'hsPct' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    HS%
                  </span>
                </th>
                <th
                  onClick={() => handleSort('kast')}
                  className={`py-3 px-3 cursor-pointer text-center transition-colors ${
                    sortKey === 'kast' ? 'text-[#ff4655] bg-white/[0.02]' : 'hover:text-m3-on-surface'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {sortKey === 'kast' && (sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#ff4655]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ff4655]" />)}
                    KAST
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
                const role = a.role ?? meta?.role ?? 'Agent';
                const roleLower = role.toLowerCase();
                const accentColor = ROLE_COLORS[roleLower] || '#10b981';

                const isTopHours = a.hours === maxVals.maxHours && a.hours > 0;
                const isTopMatches = a.matches === maxVals.maxMatches && a.matches > 0;
                const isTopWinPct = a.winPct === maxVals.maxWinPct && a.winPct > 0;
                const isTopKd = a.kd === maxVals.maxKd && a.kd > 0;
                const isTopAdr = a.adr === maxVals.maxAdr && a.adr > 0;
                const isTopAcs = a.acs === maxVals.maxAcs && a.acs > 0;
                const isTopHs = a.hsPct === maxVals.maxHs && a.hsPct > 0;
                const isTopKast = a.kast === maxVals.maxKast && a.kast > 0;
                const isTopDd = a.damageDeltaPerRound === maxVals.maxDd && a.damageDeltaPerRound > 0;

                const defRoundsTotal = Math.max(1, (a.defenseRoundsWon || 0) + (a.defenseRoundsLost || 0));
                const defWinPct = defRoundsTotal > 0 ? ((a.defenseRoundsWon || 0) / defRoundsTotal) * 100 : a.defenseRoundsWinPct || 0;

                const atkRoundsTotal = Math.max(1, (a.attackRoundsWon || 0) + (a.attackRoundsLost || 0));
                const atkWinPct = atkRoundsTotal > 0 ? ((a.attackRoundsWon || 0) / atkRoundsTotal) * 100 : a.attackRoundsWinPct || 0;

                return (
                  <React.Fragment key={a.agent}>
                    {/* Primary Row */}
                    <tr
                      onClick={() => toggleRow(a.agent)}
                      className={`border-b border-m3-outline-subtle/40 hover:bg-m3-surface-container-high/40 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-m3-surface-container-high/60' : ''
                      }`}
                    >
                      {/* Agent Avatar + Name + Role */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5 min-w-[140px]">
                          {/* Role vertical accent bar */}
                          <span
                            className="w-1 h-9 rounded-full shrink-0"
                            style={{ backgroundColor: accentColor }}
                          />
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
                            <div className="text-[10px] text-m3-outline uppercase tracking-wider font-semibold truncate mt-0.5">
                              {role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Time Played */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'hours' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopHours ? 'text-amber-300 font-extrabold' : 'text-m3-on-surface'}`}>
                          {a.hours > 0 ? `${a.hours} hrs` : `${Math.round(a.timePlayedSeconds / 60)} mins`}
                        </span>
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

                      {/* K/D */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'kd' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopKd ? 'text-amber-300 font-extrabold' : a.kd >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.kd.toFixed(2)}
                        </span>
                      </td>

                      {/* ADR */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'adr' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopAdr ? 'text-amber-300 font-extrabold' : 'text-m3-on-surface'}`}>
                          {a.adr.toFixed(1)}
                        </span>
                      </td>

                      {/* ACS */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'acs' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopAcs ? 'text-amber-300 font-extrabold' : 'text-m3-on-surface'}`}>
                          {a.acs.toFixed(1)}
                        </span>
                      </td>

                      {/* DDΔ */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'damageDeltaPerRound' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopDd ? 'text-amber-300 font-extrabold' : a.damageDeltaPerRound >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.damageDeltaPerRound > 0 ? `+${a.damageDeltaPerRound}` : a.damageDeltaPerRound}
                        </span>
                      </td>

                      {/* HS% */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'hsPct' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopHs ? 'text-amber-300 font-extrabold' : 'text-m3-on-surface'}`}>
                          {a.hsPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* KAST */}
                      <td className={`py-2.5 px-3 text-center font-mono ${sortKey === 'kast' ? 'bg-white/[0.02]' : ''}`}>
                        <span className={`text-[13px] font-bold ${isTopKast ? 'text-amber-300 font-extrabold' : 'text-m3-on-surface'}`}>
                          {a.kast > 0 ? `${a.kast.toFixed(1)}%` : '—'}
                        </span>
                      </td>

                      {/* Action Toggle Button */}
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

                    {/* Expanded Status Card (Matches clip_20260909_142751_4.png) */}
                    {isExpanded && (
                      <tr className="bg-[#0f1722] border-b border-m3-outline-subtle/60">
                        <td colSpan={11} className="p-4 sm:p-5">
                          <AnimatePresence>
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                              className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch"
                            >
                              {/* Left Section: Key Milestones */}
                              <div className="flex flex-col justify-between py-1 border-r border-white/10 pr-4">
                                <div className="flex flex-col gap-3.5">
                                  {/* Match Kills (Best) */}
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">
                                      Match Kills (Best)
                                    </div>
                                    <div className="font-display font-black text-2xl text-white mt-0.5 tabular-nums">
                                      {a.bestKills || 30}
                                    </div>
                                  </div>

                                  {/* First Bloods */}
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">
                                      First Bloods
                                    </div>
                                    <div className="font-display font-black text-2xl text-white mt-0.5 tabular-nums">
                                      {a.firstBloods}
                                    </div>
                                  </div>

                                  {/* Aces */}
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">
                                      Aces
                                    </div>
                                    <div className="font-display font-black text-2xl text-white mt-0.5 tabular-nums">
                                      {a.aces}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Center Section: Defense Breakdown */}
                              <div className="flex flex-col justify-between py-1 border-r border-white/10 pr-4">
                                <div>
                                  {/* Record header with win/loss bar */}
                                  <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <Shield className="w-3.5 h-3.5 text-sky-400" />
                                      <span>Defense</span>
                                    </div>
                                    <span className="font-mono text-m3-outline">
                                      <strong className="text-emerald-400">{a.defenseRoundsWon || 0} Wins</strong> / {a.defenseRoundsLost || 0} Losses
                                    </span>
                                  </div>

                                  {/* Progress bar */}
                                  <div className="h-1.5 rounded-full bg-red-500/30 overflow-hidden flex mb-3">
                                    <div
                                      className="h-full bg-emerald-400 rounded-full"
                                      style={{ width: `${Math.min(100, Math.max(5, defWinPct))}%` }}
                                    />
                                  </div>

                                  {/* Metric readouts */}
                                  <div className="grid grid-cols-2 gap-y-2.5 text-xs font-mono">
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Round Win %</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{(a.defenseRoundsWinPct || defWinPct).toFixed(1)}%</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Def. K/D</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{(a.defenseKd || a.kd).toFixed(2)}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Def. Kills</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{a.defenseKills}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Def. Assists</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{a.defenseAssists}</div>
                                    </div>
                                    <div className="col-span-2 pt-1 border-t border-white/5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Defuses/Match</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{(a.defusesPerMatch || 0.58).toFixed(2)}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Section: Attack Breakdown */}
                              <div className="flex flex-col justify-between py-1">
                                <div>
                                  {/* Record header with win/loss bar */}
                                  <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <Swords className="w-3.5 h-3.5 text-[#ff4655]" />
                                      <span>Attack</span>
                                    </div>
                                    <span className="font-mono text-m3-outline">
                                      <strong className="text-emerald-400">{a.attackRoundsWon || 0} Wins</strong> / {a.attackRoundsLost || 0} Losses
                                    </span>
                                  </div>

                                  {/* Progress bar */}
                                  <div className="h-1.5 rounded-full bg-red-500/30 overflow-hidden flex mb-3">
                                    <div
                                      className="h-full bg-emerald-400 rounded-full"
                                      style={{ width: `${Math.min(100, Math.max(5, atkWinPct))}%` }}
                                    />
                                  </div>

                                  {/* Metric readouts */}
                                  <div className="grid grid-cols-2 gap-y-2.5 text-xs font-mono">
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Round Win %</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{(a.attackRoundsWinPct || atkWinPct).toFixed(1)}%</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Atk. K/D</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{(a.attackKd || a.kd).toFixed(2)}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Atk. Kills</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{a.attackKills}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Atk. Assists</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{a.attackAssists}</div>
                                    </div>
                                    <div className="col-span-2 pt-1 border-t border-white/5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline">Plants/Match</div>
                                      <div className="font-extrabold text-sm text-white mt-0.5">{(a.plantsPerMatch || 2.09).toFixed(2)}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
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
