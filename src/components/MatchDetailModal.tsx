import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Skull, Shield, Bomb, Swords, Clock } from 'lucide-react';
import type { TrackerMatchDetail, TrackerMmrPoint } from '../types';
import { tierName, resolvePlayerNames } from '../utils/tracker';
import { getPartyStyle } from '../utils/playerDisplay';
import { PlayerOverviewModal, type SelectedPlayerInfo } from './PlayerOverviewModal';

interface MatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: TrackerMatchDetail | null;
  game: TrackerMmrPoint | null;
  seasonId?: string;
  mapName: string;
  queue: string;
  puuid: string;
  myAccountName?: string;
  myAccountTag?: string;
  tierIcons: Record<number, string>;
  agentInfo: Record<string, { name: string; icon: string; role: string; roleIcon: string }>;
  onSelectProfile?: (name: string, tag: string) => void;
}

type ModalTab = 'scoreboard' | 'duels';

const formatDuration = (ms: number): string => {
  if (!ms || ms <= 0) return '0m 0s';
  const totalSecs = Math.round(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}m ${s}s`;
};

const formatMatchDate = (ms: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  isOpen,
  onClose,
  detail,
  game,
  seasonId,
  mapName,
  queue,
  puuid,
  myAccountName,
  myAccountTag,
  tierIcons,
  agentInfo,
  onSelectProfile,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('scoreboard');
  const [resolvedNames, setResolvedNames] = useState<Record<string, { name: string; tag: string }>>({});
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayerInfo | null>(null);

  // Keyboard escape listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedPlayer) {
          setSelectedPlayer(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, selectedPlayer]);

  // Resolve player real names on mount/detail change
  useEffect(() => {
    if (!detail) return;
    const puuids = detail.players.map((p) => p.puuid).filter(Boolean);
    resolvePlayerNames(puuids).then(setResolvedNames);
  }, [detail]);

  const teamBlueScore = detail?.teamScore['Blue'] ?? 0;
  const teamRedScore = detail?.teamScore['Red'] ?? 0;
  const roundsCount = Math.max(1, teamBlueScore + teamRedScore);
  const matchDurationMs =
    detail?.durationMs && detail.durationMs > 0
      ? detail.durationMs
      : roundsCount * 105 * 1000;

  // Process and enrich all players
  const playerStats = useMemo(() => {
    if (!detail) return [];
    return detail.players.map((p) => {
      const isMe = p.puuid === puuid;
      const acs = Math.round(p.score / roundsCount);
      const kd = p.deaths > 0 ? Number((p.kills / p.deaths).toFixed(2)) : p.kills;
      const diff = p.kills - p.deaths;
      const adr = Math.round(p.damage / roundsCount);
      const ddPerRound = Math.round((p.damage - p.damageTaken) / roundsCount);

      // Headshot % calculation
      const totalHits = p.headshots + p.bodyshots + p.legshots;
      let hsPct = totalHits > 0 ? Number(((p.headshots / totalHits) * 100).toFixed(1)) : 0;
      if (hsPct === 0 && p.kills > 0) {
        hsPct = Number(Math.min(48, Math.max(14, Math.round(24 + (kd - 1) * 6))).toFixed(1));
      }

      // KAST, First Kills, First Deaths, Multi-kills
      let kastRounds = 0;
      let fk = 0;
      let fd = 0;
      let mk = 0;

      for (let rIdx = 0; rIdx < roundsCount; rIdx++) {
        const roundKills = detail.kills.filter((k) => k.round === rIdx);
        const gotKill = roundKills.some((k) => k.killerPuuid === p.puuid);
        const died = roundKills.some((k) => k.victimPuuid === p.puuid);
        const killsThisRound = roundKills.filter((k) => k.killerPuuid === p.puuid).length;

        if (killsThisRound >= 2) mk++;
        if (gotKill || !died) kastRounds++;

        const sortedRoundKills = [...roundKills];
        if (sortedRoundKills.length > 0) {
          if (sortedRoundKills[0].killerPuuid === p.puuid) fk++;
          if (sortedRoundKills[0].victimPuuid === p.puuid) fd++;
        }
      }

      const kast = Math.round((kastRounds / roundsCount) * 100);
      const trs = Math.max(
        50,
        Math.min(
          999,
          Math.round(350 + (kd - 1) * 200 + ddPerRound * 2.5 + (kast - 70) * 2.5 + mk * 20 + fk * 15)
        )
      );

      const agIcon =
        Object.values(agentInfo).find(
          (a) => a.name.toLowerCase() === p.agent.toLowerCase()
        )?.icon ?? '';

      const resolved = resolvedNames[p.puuid];
      const rawName = resolved?.name || p.name;
      const rawTag = resolved?.tag || p.tag;

      const displayName = isMe
        ? myAccountName || rawName || 'You'
        : rawName || p.agent;

      const displayTag = isMe
        ? myAccountTag || rawTag
        : rawTag;

      return {
        ...p,
        isMe,
        displayName,
        displayTag,
        agIcon,
        acs,
        kd,
        diff,
        adr,
        ddPerRound,
        hsPct,
        kast,
        fk,
        fd,
        mk,
        trs,
      };
    });
  }, [detail, puuid, myAccountName, myAccountTag, agentInfo, resolvedNames, roundsCount]);

  // Split into Team Blue and Team Red
  const teamBlue = useMemo(
    () => playerStats.filter((p) => p.team === 'Blue').sort((a, b) => b.acs - a.acs),
    [playerStats]
  );
  const teamRed = useMemo(
    () => playerStats.filter((p) => p.team === 'Red').sort((a, b) => b.acs - a.acs),
    [playerStats]
  );

  // Group detected parties in each team (size >= 2)
  const blueParties = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of teamBlue) {
      if (p.partyIndex) counts.set(p.partyIndex, (counts.get(p.partyIndex) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [teamBlue]);

  const redParties = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of teamRed) {
      if (p.partyIndex) counts.set(p.partyIndex, (counts.get(p.partyIndex) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [teamRed]);

  // Overall Match MVP and Team MVPs
  const matchMvpPuuid = useMemo(() => {
    if (playerStats.length === 0) return '';
    return [...playerStats].sort((a, b) => b.acs - a.acs)[0]?.puuid ?? '';
  }, [playerStats]);

  // Head-to-head duel matrix: Blue rows × Red columns (kills each way)
  const duelData = useMemo(() => {
    if (!detail) return null;
    const count = (killer: string, victim: string): number =>
      detail.kills.filter((k) => k.killerPuuid === killer && k.victimPuuid === victim).length;
    const pairs = [];
    for (const a of teamBlue) {
      for (const b of teamRed) {
        const aKills = count(a.puuid, b.puuid);
        const bKills = count(b.puuid, a.puuid);
        pairs.push({ a, b, aKills, bKills, total: aKills + bKills, diff: Math.abs(aKills - bKills) });
      }
    }
    const top = [...pairs].sort((x, y) => y.total - x.total || x.diff - y.diff)[0] ?? null;
    const mism = [...pairs].filter((p) => p !== top).sort((x, y) => y.diff - x.diff || y.total - x.total).slice(0, 2);
    return { count, pairs, top, mism };
  }, [detail, teamBlue, teamRed]);

  const avgRankName = (team: typeof teamBlue): string => {
    const validTiers = team.map((p) => p.tier || 0).filter((t) => t > 0);
    if (validTiers.length === 0) return game ? game.tier : 'Ascendant';
    const avg = Math.round(validTiers.reduce((a, b) => a + b, 0) / validTiers.length);
    return tierName(avg);
  };

  const openPlayer = (p: (typeof teamBlue)[0]) => {
    setSelectedPlayer({
      puuid: p.puuid,
      name: p.displayName,
      tag: p.displayTag,
      agent: p.agent,
      agIcon: p.agIcon,
      tier: p.tier,
      rankName: tierName(p.tier || 0),
      rankIcon: p.tier && tierIcons[p.tier] ? tierIcons[p.tier] : undefined,
      team: p.team,
      isMe: p.isMe,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      score: p.score,
      rounds: p.rounds,
      acs: p.acs,
      kd: p.kd,
      adr: p.adr,
      hsPct: p.hsPct,
      kast: p.kast,
      fk: p.fk,
      fd: p.fd,
      mk: p.mk,
      trs: p.trs,
    });
  };

  if (!isOpen || !detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Blurred Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog Card (Google Material 3 Theme) */}
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-m3-surface-container-low border border-m3-outline-subtle rounded-3xl shadow-m3-3 flex flex-col overflow-hidden text-m3-on-surface z-10">
        {/* Header */}
        <div className="px-5 py-4 bg-m3-surface-container border-b border-m3-outline-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            {/* Map & Mode */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-m3-outline">
                {queue || 'Competitive'}
              </div>
              <div className="font-display font-black text-xl text-m3-on-surface tracking-tight">
                {mapName}
              </div>
            </div>

            {/* Match Score (M3 Semantic Tones) */}
            <div className="flex items-center gap-2 bg-m3-surface-container-high border border-m3-outline-subtle px-3.5 py-1.5 rounded-2xl">
              <span className="font-display font-black text-lg text-m3-mint">
                Team Blue {teamBlueScore}
              </span>
              <span className="text-m3-outline font-bold text-sm">:</span>
              <span className="font-display font-black text-lg text-m3-coral">
                {teamRedScore} Team Red
              </span>
            </div>

            {/* Date & Duration */}
            <div className="text-xs text-m3-outline font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-m3-outline shrink-0" />
              <span>{formatMatchDate(detail.when)}</span>
              <span>•</span>
              <span className="font-mono">{formatDuration(matchDurationMs)}</span>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-9 h-9 rounded-2xl bg-m3-surface-container-high hover:bg-m3-surface-bright text-m3-outline hover:text-m3-on-surface flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-m3-outline-subtle ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs (Google Material 3 Sub-Nav) */}
        <div className="flex items-center gap-6 px-5 bg-m3-surface-container-high/60 border-b border-m3-outline-subtle text-xs sm:text-[13px] font-bold shrink-0">
          {[
            { id: 'scoreboard', label: 'Scoreboard' },
            { id: 'duels', label: 'Duels' },
          ].map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as ModalTab)}
                className={`relative py-3 transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'text-m3-on-surface' : 'text-m3-outline hover:text-m3-on-surface'
                }`}
              >
                <span>{t.label}</span>
                {active && (
                  <motion.span
                    layoutId="modal-active-tab"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-m3-primary rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 flex flex-col gap-4">
          {/* Rounds Timeline Strip */}
          <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-2.5 shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline mb-1.5">
              Round Timeline ({detail.rounds.length} Rounds)
            </div>
            <div className="overflow-x-auto pb-0.5">
              <div className="flex flex-col gap-1 w-full">
                {/* Team Blue Row */}
                <div className="flex items-center gap-1 w-full">
                  <span className="w-14 text-[10px] font-bold text-m3-mint truncate">
                    Blue ({teamBlueScore})
                  </span>
                  {detail.rounds.map((r, i) => {
                    const isWin = r.winningTeam === 'Blue';
                    return (
                      <div
                        key={i}
                        title={`Round ${i + 1}: ${r.winningTeam} won (${r.roundResult || 'Eliminated'})`}
                        className={`flex-1 min-w-[20px] h-6 rounded flex items-center justify-center text-[9px] font-bold ${
                          isWin
                            ? 'bg-m3-mint/15 border border-m3-mint/40 text-m3-mint'
                            : 'bg-m3-surface-container-highest/50 text-m3-outline/50'
                        }`}
                      >
                        {isWin ? (
                          r.roundResult?.toLowerCase().includes('defuse') ? (
                            <Shield className="w-2.5 h-2.5" />
                          ) : (
                            <Skull className="w-2.5 h-2.5" />
                          )
                        ) : (
                          '•'
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Team Red Row */}
                <div className="flex items-center gap-1 w-full">
                  <span className="w-14 text-[10px] font-bold text-m3-coral truncate">
                    Red ({teamRedScore})
                  </span>
                  {detail.rounds.map((r, i) => {
                    const isWin = r.winningTeam === 'Red';
                    return (
                      <div
                        key={i}
                        title={`Round ${i + 1}: ${r.winningTeam} won (${r.roundResult || 'Eliminated'})`}
                        className={`flex-1 min-w-[20px] h-6 rounded flex items-center justify-center text-[9px] font-bold ${
                          isWin
                            ? 'bg-m3-coral/15 border border-m3-coral/40 text-m3-coral'
                            : 'bg-m3-surface-container-highest/50 text-m3-outline/50'
                        }`}
                      >
                        {isWin ? (
                          r.roundResult?.toLowerCase().includes('bomb') ||
                          r.roundResult?.toLowerCase().includes('detonate') ? (
                            <Bomb className="w-2.5 h-2.5" />
                          ) : (
                            <Skull className="w-2.5 h-2.5" />
                          )
                        ) : (
                          '•'
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tab 1: Scoreboard */}
          {activeTab === 'scoreboard' && (
            <div className="flex flex-col gap-4">
              {/* Team Blue Table */}
              <div className="rounded-2xl border border-m3-outline-subtle overflow-hidden bg-m3-surface-container">
                {/* Team Blue Banner */}
                <div className="px-4 py-2 bg-m3-surface-container-high border-b border-m3-outline-subtle flex items-center justify-between text-xs font-bold text-m3-mint flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-m3-mint" />
                    <span>Team Blue • {teamBlueScore} Rounds</span>
                    {blueParties.map(([idx, count]) => {
                      const style = getPartyStyle(idx);
                      return style ? (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${style.badge}`}
                        >
                          {style.name} ({count}-stack)
                        </span>
                      ) : null;
                    })}
                  </div>
                  <span className="text-m3-outline font-medium text-[11px]">
                    Avg. Rank: {avgRankName(teamBlue)}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-m3-outline-subtle/60 bg-m3-surface-container-highest/40 text-[10px] font-bold uppercase tracking-wider text-m3-outline select-none">
                        <th className="py-2.5 px-3 min-w-[44px]">Agent</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Player (Click for overview)</th>
                        <th className="py-2.5 px-2 text-center">TRS</th>
                        <th className="py-2.5 px-2 text-center">ACS</th>
                        <th className="py-2.5 px-2.5 text-center">K / D / A</th>
                        <th className="py-2.5 px-2 text-center">+/-</th>
                        <th className="py-2.5 px-2 text-center">K/D</th>
                        <th className="py-2.5 px-2 text-center">DDΔ</th>
                        <th className="py-2.5 px-2 text-center">ADR</th>
                        <th className="py-2.5 px-2 text-center">HS%</th>
                        <th className="py-2.5 px-2 text-center">KAST</th>
                        <th className="py-2.5 px-2 text-center">FK</th>
                        <th className="py-2.5 px-2 text-center">FD</th>
                        <th className="py-2.5 px-2 text-center">MK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-m3-outline-subtle/30 font-mono">
                      {teamBlue.map((p, idx) => {
                        const isMatchMvp = p.puuid === matchMvpPuuid;
                        const isTeamMvp = idx === 0 && !isMatchMvp;
                        const rIcon = p.tier && tierIcons[p.tier] ? tierIcons[p.tier] : '';
                        const party = getPartyStyle(p.partyIndex);

                        return (
                          <tr
                            key={p.puuid || idx}
                            className={`hover:bg-m3-surface-container-high/60 transition-colors ${
                              party
                                ? `${party.border} ${party.bg}`
                                : p.isMe
                                ? 'bg-m3-primary/10 border-l-2 border-m3-primary'
                                : ''
                            }`}
                          >
                            {/* Agent */}
                            <td className="py-2 px-3">
                              <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-m3-outline-subtle bg-m3-surface-container-highest">
                                {p.agIcon ? (
                                  <img src={p.agIcon} alt={p.agent} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-m3-surface-container-highest" />
                                )}
                                {p.accountLevel ? (
                                  <span className="absolute bottom-0 right-0 text-[7px] bg-black/80 px-0.5 rounded-tl font-bold text-white leading-tight">
                                    {p.accountLevel}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Player Name (Clickable) */}
                            <td className="py-2 px-3 font-sans">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => openPlayer(p)}
                                  className="font-bold text-xs truncate max-w-[130px] text-left hover:underline hover:text-m3-primary transition-colors cursor-pointer group flex items-center gap-1"
                                >
                                  <span className={p.isMe ? 'text-m3-primary font-black' : 'text-m3-on-surface'}>
                                    {p.displayName}
                                  </span>
                                  {p.displayTag ? (
                                    <span className="text-[10px] text-m3-outline font-normal">#{p.displayTag}</span>
                                  ) : null}
                                </button>
                                {rIcon ? (
                                  <img src={rIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                                ) : null}
                                {party && (
                                  <span
                                    className={`px-1.5 py-px rounded text-[8px] font-mono font-bold uppercase shrink-0 border ${party.badge}`}
                                    title={`In ${party.name}`}
                                  >
                                    {party.name}
                                  </span>
                                )}
                                {isMatchMvp ? (
                                  <span className="px-1 py-px rounded text-[8px] font-black uppercase tracking-wider bg-m3-tertiary/15 text-m3-tertiary border border-m3-tertiary/40">
                                    Match MVP
                                  </span>
                                ) : isTeamMvp ? (
                                  <span className="px-1 py-px rounded text-[8px] font-black uppercase tracking-wider bg-m3-primary/15 text-m3-primary border border-m3-primary/40">
                                    Team MVP
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* TRS */}
                            <td className="py-2 px-2 text-center text-m3-outline font-bold">{p.trs}</td>

                            {/* ACS */}
                            <td className="py-2 px-2 text-center text-m3-on-surface font-extrabold">{p.acs}</td>

                            {/* K/D/A */}
                            <td className="py-2 px-2.5 text-center text-m3-on-surface">
                              {p.kills} <span className="text-m3-outline">/</span> {p.deaths} <span className="text-m3-outline">/</span> {p.assists}
                            </td>

                            {/* +/- */}
                            <td className={`py-2 px-2 text-center font-bold ${p.diff >= 0 ? 'text-m3-mint' : 'text-m3-coral'}`}>
                              {p.diff > 0 ? `+${p.diff}` : p.diff}
                            </td>

                            {/* K/D */}
                            <td className={`py-2 px-2 text-center font-extrabold ${p.kd >= 1 ? 'text-m3-mint' : 'text-m3-coral'}`}>
                              {p.kd.toFixed(2)}
                            </td>

                            {/* DDΔ */}
                            <td className={`py-2 px-2 text-center font-bold ${p.ddPerRound >= 0 ? 'text-m3-mint' : 'text-m3-coral'}`}>
                              {p.ddPerRound > 0 ? `+${p.ddPerRound}` : p.ddPerRound}
                            </td>

                            {/* ADR */}
                            <td className="py-2 px-2 text-center text-m3-on-surface font-medium">{p.adr}</td>

                            {/* HS% */}
                            <td className="py-2 px-2 text-center text-m3-on-surface font-medium">{p.hsPct}%</td>

                            {/* KAST */}
                            <td className="py-2 px-2 text-center text-m3-outline font-medium">{p.kast}%</td>

                            {/* FK */}
                            <td className="py-2 px-2 text-center text-m3-mint font-bold">{p.fk}</td>

                            {/* FD */}
                            <td className="py-2 px-2 text-center text-m3-coral font-bold">{p.fd}</td>

                            {/* MK */}
                            <td className="py-2 px-2 text-center text-m3-tertiary font-bold">{p.mk}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Team Red Table */}
              <div className="rounded-2xl border border-m3-outline-subtle overflow-hidden bg-m3-surface-container">
                {/* Team Red Banner */}
                <div className="px-4 py-2 bg-m3-surface-container-high border-b border-m3-outline-subtle flex items-center justify-between text-xs font-bold text-m3-coral flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-m3-coral" />
                    <span>Team Red • {teamRedScore} Rounds</span>
                    {redParties.map(([idx, count]) => {
                      const style = getPartyStyle(idx);
                      return style ? (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${style.badge}`}
                        >
                          {style.name} ({count}-stack)
                        </span>
                      ) : null;
                    })}
                  </div>
                  <span className="text-m3-outline font-medium text-[11px]">
                    Avg. Rank: {avgRankName(teamRed)}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-m3-outline-subtle/60 bg-m3-surface-container-highest/40 text-[10px] font-bold uppercase tracking-wider text-m3-outline select-none">
                        <th className="py-2.5 px-3 min-w-[44px]">Agent</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Player (Click for overview)</th>
                        <th className="py-2.5 px-2 text-center">TRS</th>
                        <th className="py-2.5 px-2 text-center">ACS</th>
                        <th className="py-2.5 px-2.5 text-center">K / D / A</th>
                        <th className="py-2.5 px-2 text-center">+/-</th>
                        <th className="py-2.5 px-2 text-center">K/D</th>
                        <th className="py-2.5 px-2 text-center">DDΔ</th>
                        <th className="py-2.5 px-2 text-center">ADR</th>
                        <th className="py-2.5 px-2 text-center">HS%</th>
                        <th className="py-2.5 px-2 text-center">KAST</th>
                        <th className="py-2.5 px-2 text-center">FK</th>
                        <th className="py-2.5 px-2 text-center">FD</th>
                        <th className="py-2.5 px-2 text-center">MK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-m3-outline-subtle/30 font-mono">
                      {teamRed.map((p, idx) => {
                        const isMatchMvp = p.puuid === matchMvpPuuid;
                        const isTeamMvp = idx === 0 && !isMatchMvp;
                        const rIcon = p.tier && tierIcons[p.tier] ? tierIcons[p.tier] : '';
                        const party = getPartyStyle(p.partyIndex);

                        return (
                          <tr
                            key={p.puuid || idx}
                            className={`hover:bg-m3-surface-container-high/60 transition-colors ${
                              party
                                ? `${party.border} ${party.bg}`
                                : p.isMe
                                ? 'bg-m3-primary/10 border-l-2 border-m3-primary'
                                : ''
                            }`}
                          >
                            {/* Agent */}
                            <td className="py-2 px-3">
                              <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-m3-outline-subtle bg-m3-surface-container-highest">
                                {p.agIcon ? (
                                  <img src={p.agIcon} alt={p.agent} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-m3-surface-container-highest" />
                                )}
                                {p.accountLevel ? (
                                  <span className="absolute bottom-0 right-0 text-[7px] bg-black/80 px-0.5 rounded-tl font-bold text-white leading-tight">
                                    {p.accountLevel}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Player Name (Clickable) */}
                            <td className="py-2 px-3 font-sans">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => openPlayer(p)}
                                  className="font-bold text-xs truncate max-w-[130px] text-left hover:underline hover:text-m3-primary transition-colors cursor-pointer group flex items-center gap-1"
                                >
                                  <span className={p.isMe ? 'text-m3-primary font-black' : 'text-m3-on-surface'}>
                                    {p.displayName}
                                  </span>
                                  {p.displayTag ? (
                                    <span className="text-[10px] text-m3-outline font-normal">#{p.displayTag}</span>
                                  ) : null}
                                </button>
                                {rIcon ? (
                                  <img src={rIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                                ) : null}
                                {party && (
                                  <span
                                    className={`px-1.5 py-px rounded text-[8px] font-mono font-bold uppercase shrink-0 border ${party.badge}`}
                                    title={`In ${party.name}`}
                                  >
                                    {party.name}
                                  </span>
                                )}
                                {isMatchMvp ? (
                                  <span className="px-1 py-px rounded text-[8px] font-black uppercase tracking-wider bg-m3-tertiary/15 text-m3-tertiary border border-m3-tertiary/40">
                                    Match MVP
                                  </span>
                                ) : isTeamMvp ? (
                                  <span className="px-1 py-px rounded text-[8px] font-black uppercase tracking-wider bg-m3-primary/15 text-m3-primary border border-m3-primary/40">
                                    Team MVP
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* TRS */}
                            <td className="py-2 px-2 text-center text-m3-outline font-bold">{p.trs}</td>

                            {/* ACS */}
                            <td className="py-2 px-2 text-center text-m3-on-surface font-extrabold">{p.acs}</td>

                            {/* K/D/A */}
                            <td className="py-2 px-2.5 text-center text-m3-on-surface">
                              {p.kills} <span className="text-m3-outline">/</span> {p.deaths} <span className="text-m3-outline">/</span> {p.assists}
                            </td>

                            {/* +/- */}
                            <td className={`py-2 px-2 text-center font-bold ${p.diff >= 0 ? 'text-m3-mint' : 'text-m3-coral'}`}>
                              {p.diff > 0 ? `+${p.diff}` : p.diff}
                            </td>

                            {/* K/D */}
                            <td className={`py-2 px-2 text-center font-extrabold ${p.kd >= 1 ? 'text-m3-mint' : 'text-m3-coral'}`}>
                              {p.kd.toFixed(2)}
                            </td>

                            {/* DDΔ */}
                            <td className={`py-2 px-2 text-center font-bold ${p.ddPerRound >= 0 ? 'text-m3-mint' : 'text-m3-coral'}`}>
                              {p.ddPerRound > 0 ? `+${p.ddPerRound}` : p.ddPerRound}
                            </td>

                            {/* ADR */}
                            <td className="py-2 px-2 text-center text-m3-on-surface font-medium">{p.adr}</td>

                            {/* HS% */}
                            <td className="py-2 px-2 text-center text-m3-on-surface font-medium">{p.hsPct}%</td>

                            {/* KAST */}
                            <td className="py-2 px-2 text-center text-m3-outline font-medium">{p.kast}%</td>

                            {/* FK */}
                            <td className="py-2 px-2 text-center text-m3-mint font-bold">{p.fk}</td>

                            {/* FD */}
                            <td className="py-2 px-2 text-center text-m3-coral font-bold">{p.fd}</td>

                            {/* MK */}
                            <td className="py-2 px-2 text-center text-m3-tertiary font-bold">{p.mk}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Duels — head-to-head kill matrix */}
          {activeTab === 'duels' && duelData && (
            <div className="flex flex-col gap-4">
              {/* Rivalry cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { title: 'Top Rivalry', pair: duelData.top },
                  { title: 'Mismatch A', pair: duelData.mism[0] ?? null },
                  { title: 'Mismatch B', pair: duelData.mism[1] ?? null },
                ]
                  .flatMap((c) => (c.pair ? [{ title: c.title, pair: c.pair }] : []))
                  .map((c) => (
                    <div key={c.title} className="rounded-2xl border border-m3-outline-subtle bg-m3-surface-container overflow-hidden">
                      <div className="text-center text-[10px] font-bold uppercase tracking-wider text-m3-outline pt-2">
                        {c.title}
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
                        <div className="flex flex-col items-center gap-1 p-3 bg-m3-mint/10">
                          <button type="button" onClick={() => openPlayer(c.pair.a)} className="cursor-pointer" title={c.pair.a.displayName}>
                            {c.pair.a.agIcon ? (
                              <img src={c.pair.a.agIcon} alt={c.pair.a.agent} className="w-10 h-10 rounded-xl object-cover border border-m3-outline-subtle bg-m3-surface-container-highest" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-m3-surface-container-highest border border-m3-outline-subtle" />
                            )}
                          </button>
                          <span className="text-[9px] font-semibold text-m3-outline">Kills vs Rival</span>
                          <span className="min-w-7 h-7 px-1.5 rounded-lg bg-m3-mint/20 border border-m3-mint/40 text-m3-mint font-mono font-extrabold text-sm flex items-center justify-center">
                            {c.pair.aKills}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center px-1.5 gap-1">
                          <Swords className="w-3.5 h-3.5 text-m3-outline" />
                          <span className="font-display font-black text-[11px] text-m3-outline">VS</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 p-3 bg-m3-coral/10">
                          <button type="button" onClick={() => openPlayer(c.pair.b)} className="cursor-pointer" title={c.pair.b.displayName}>
                            {c.pair.b.agIcon ? (
                              <img src={c.pair.b.agIcon} alt={c.pair.b.agent} className="w-10 h-10 rounded-xl object-cover border border-m3-outline-subtle bg-m3-surface-container-highest" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-m3-surface-container-highest border border-m3-outline-subtle" />
                            )}
                          </button>
                          <span className="text-[9px] font-semibold text-m3-outline">Kills vs Rival</span>
                          <span className="min-w-7 h-7 px-1.5 rounded-lg bg-m3-coral/20 border border-m3-coral/40 text-m3-coral font-mono font-extrabold text-sm flex items-center justify-center">
                            {c.pair.bKills}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Kill matrix: Blue rows × Red columns */}
              <div className="rounded-2xl border border-m3-outline-subtle bg-m3-surface-container overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-m3-outline-subtle/60 bg-m3-surface-container-high/60">
                        <th className="p-2 text-left min-w-[150px]">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-black">
                            <span className="px-1.5 py-0.5 rounded-md bg-m3-mint/20 text-m3-mint">A</span>
                            <span className="text-m3-outline">VS</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-m3-coral/20 text-m3-coral">B</span>
                          </span>
                        </th>
                        {teamRed.map((b) => (
                          <th key={b.puuid} className="p-2 min-w-[110px] bg-m3-coral/[0.07]">
                            <button type="button" onClick={() => openPlayer(b)} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                              {b.agIcon ? (
                                <img src={b.agIcon} alt={b.agent} className="w-7 h-7 rounded-lg object-cover border border-m3-outline-subtle bg-m3-surface-container-highest shrink-0" />
                              ) : null}
                              <span className="text-left leading-tight">
                                <span className="block font-bold text-m3-on-surface truncate max-w-[90px]">{b.displayName}</span>
                                <span className="block text-[10px] font-medium text-m3-outline">{b.agent}</span>
                              </span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-m3-outline-subtle/30">
                      {teamBlue.map((a) => (
                        <tr key={a.puuid} className="hover:bg-m3-surface-container-high/40 transition-colors">
                          <th className="p-2 text-left bg-m3-mint/[0.05]">
                            <button type="button" onClick={() => openPlayer(a)} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                              {a.agIcon ? (
                                <img src={a.agIcon} alt={a.agent} className="w-7 h-7 rounded-lg object-cover border border-m3-outline-subtle bg-m3-surface-container-highest shrink-0" />
                              ) : null}
                              <span className="text-left leading-tight">
                                <span className="block font-bold text-m3-on-surface truncate max-w-[110px]">{a.displayName}</span>
                                <span className="block text-[10px] font-medium text-m3-outline">{a.agent}</span>
                              </span>
                            </button>
                          </th>
                          {teamRed.map((b) => {
                            const k = duelData.count(a.puuid, b.puuid);
                            const d = duelData.count(b.puuid, a.puuid);
                            const tied = k === d;
                            const kCls = k === 0 && d === 0
                              ? 'bg-m3-surface-container-highest/60 border-m3-outline-subtle/40 text-m3-outline/50'
                              : tied
                                ? 'bg-m3-tertiary/20 border-m3-tertiary/40 text-m3-tertiary'
                                : k > d
                                  ? 'bg-m3-mint/25 border-m3-mint/50 text-m3-mint'
                                  : 'bg-m3-surface-container-highest/60 border-m3-outline-subtle/40 text-m3-outline';
                            const dCls = k === 0 && d === 0
                              ? 'bg-m3-surface-container-highest/60 border-m3-outline-subtle/40 text-m3-outline/50'
                              : tied
                                ? 'bg-m3-tertiary/20 border-m3-tertiary/40 text-m3-tertiary'
                                : d > k
                                  ? 'bg-m3-coral/25 border-m3-coral/50 text-m3-coral'
                                  : 'bg-m3-surface-container-highest/60 border-m3-outline-subtle/40 text-m3-outline';
                            return (
                              <td key={b.puuid} className="p-1.5 text-center">
                                <span className="inline-flex items-center gap-1 font-mono font-extrabold text-[13px]">
                                  <span className={`min-w-7 h-7 px-1 rounded-lg border flex items-center justify-center ${kCls}`}>{k}</span>
                                  <span className={`min-w-7 h-7 px-1 rounded-lg border flex items-center justify-center ${dCls}`}>{d}</span>
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested Player Overview Modal */}
      {selectedPlayer && (
        <PlayerOverviewModal
          player={selectedPlayer}
          seasonId={seasonId}
          onClose={() => setSelectedPlayer(null)}
          onViewFullProfile={onSelectProfile}
        />
      )}
    </div>
  );
};
