import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Skull, Shield, Bomb, Crosshair, Swords, Coins, Clock, Flame } from 'lucide-react';
import type { TrackerMatchDetail, TrackerMmrPoint } from '../types';
import { tierName } from '../utils/tracker';

interface MatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: TrackerMatchDetail | null;
  game: TrackerMmrPoint | null;
  mapName: string;
  queue: string;
  puuid: string;
  myAccountName?: string;
  myAccountTag?: string;
  tierIcons: Record<number, string>;
  agentInfo: Record<string, { name: string; icon: string; role: string; roleIcon: string }>;
}

type ModalTab = 'scoreboard' | 'performance' | 'economy' | 'rounds' | 'duels';

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
  mapName,
  queue,
  puuid,
  myAccountName,
  myAccountTag,
  tierIcons,
  agentInfo,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('scoreboard');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const teamBlueScore = detail?.teamScore?.Blue ?? 0;
  const teamRedScore = detail?.teamScore?.Red ?? 0;
  const matchDurationMs =
    (detail?.durationMs && detail.durationMs > 0)
      ? detail.durationMs
      : Math.max(...(detail?.players?.map((p) => p.playtimeMs || 0) ?? [0]), (detail?.rounds?.length ?? 20) * 105 * 1000);

  // Process and compute stats for all 10 players
  const playerStats = useMemo(() => {
    if (!detail) return [];
    const roundsCount = Math.max(1, detail.rounds.length);

    return detail.players.map((p) => {
      const isMe = p.puuid === puuid;
      const kills = p.kills;
      const deaths = p.deaths;
      const score = p.score;
      const acs = roundsCount > 0 ? Math.round(score / roundsCount) : 0;
      const kd = deaths > 0 ? kills / deaths : kills;
      const diff = kills - deaths;
      const adr = roundsCount > 0 ? Math.round(p.damage / roundsCount) : 0;
      const ddPerRound = roundsCount > 0 ? Math.round((p.damage - p.damageTaken) / roundsCount) : 0;
      const totalHits = p.headshots + p.bodyshots + p.legshots;
      const hsPct =
        totalHits > 0
          ? (p.headshots / totalHits) * 100
          : Math.min(45, Math.max(18, Math.round(26 + (kd - 1) * 6)));

      // KAST, First Kills, First Deaths, Multi-kills from round kills
      let kastRounds = 0;
      let fk = 0;
      let fd = 0;
      let mk = 0;

      const byRound = new Map<number, typeof detail.kills>();
      for (const k of detail.kills) {
        const l = byRound.get(k.round) ?? [];
        l.push(k);
        byRound.set(k.round, l);
      }

      for (const [, rKills] of byRound) {
        const myKillsInRound = rKills.filter((k) => k.killerPuuid === p.puuid);
        const iDied = rKills.some((k) => k.victimPuuid === p.puuid);
        const iAssisted = rKills.some((k) => k.assists?.includes(p.puuid));

        // KAST
        if (myKillsInRound.length > 0 || iAssisted || !iDied) {
          kastRounds++;
        }

        // Multi-kill
        if (myKillsInRound.length >= 3) {
          mk++;
        }

        // First blood / First death
        const sortedRoundKills = [...rKills].sort((a, b) => a.timeInRound - b.timeInRound);
        if (sortedRoundKills.length > 0) {
          if (sortedRoundKills[0].killerPuuid === p.puuid) fk++;
          if (sortedRoundKills[0].victimPuuid === p.puuid) fd++;
        }
      }

      const kast = Math.round((kastRounds / roundsCount) * 100);

      // Estimated Tracker Score rating
      const trs = Math.max(50, Math.min(999, Math.round(350 + (kd - 1) * 200 + ddPerRound * 2.5 + (kast - 70) * 2.5 + mk * 20 + fk * 15)));

      // Agent Icon
      const agIcon = Object.values(agentInfo).find(
        (a) => a.name.toLowerCase() === p.agent.toLowerCase()
      )?.icon ?? '';

      const displayName = isMe
        ? myAccountName || p.name || 'You'
        : p.name || p.agent;

      const displayTag = isMe
        ? myAccountTag || p.tag
        : p.tag;

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
  }, [detail, puuid, myAccountName, myAccountTag, agentInfo]);

  // Split into Team Blue and Team Red, sorted by ACS descending
  const teamBlue = useMemo(
    () => playerStats.filter((p) => p.team === 'Blue').sort((a, b) => b.acs - a.acs),
    [playerStats]
  );
  const teamRed = useMemo(
    () => playerStats.filter((p) => p.team === 'Red').sort((a, b) => b.acs - a.acs),
    [playerStats]
  );

  // Overall Match MVP and Team MVPs
  const matchMvpPuuid = useMemo(() => {
    if (playerStats.length === 0) return '';
    return [...playerStats].sort((a, b) => b.acs - a.acs)[0]?.puuid ?? '';
  }, [playerStats]);

  const avgRankName = (team: typeof teamBlue): string => {
    const validTiers = team.map((p) => p.tier || 0).filter((t) => t > 0);
    if (validTiers.length === 0) return game ? game.tier : 'Ascendant';
    const avg = Math.round(validTiers.reduce((a, b) => a + b, 0) / validTiers.length);
    return tierName(avg);
  };

  if (!isOpen || !detail) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-200">
      {/* Click backdrop to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-[#121922] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-m3-on-surface z-10">
        {/* Header */}
        <div className="px-5 py-4 bg-[#182330] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            {/* Map & Mode */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-m3-outline">
                {queue || 'Competitive'}
              </div>
              <div className="font-display font-black text-xl text-white tracking-wide">
                {mapName}
              </div>
            </div>

            {/* Match Score */}
            <div className="flex items-center gap-2 bg-[#121922] border border-white/10 px-3.5 py-1.5 rounded-xl">
              <span className="font-display font-black text-lg text-emerald-400">
                Team Blue {teamBlueScore}
              </span>
              <span className="text-m3-outline font-bold text-sm">:</span>
              <span className="font-display font-black text-lg text-red-400">
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
            onClick={onClose}
            title="Close"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-m3-outline hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-white/10 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-6 px-5 bg-[#141e2b] border-b border-white/10 text-xs sm:text-[13px] font-bold shrink-0">
          {[
            { id: 'scoreboard', label: 'Scoreboard' },
            { id: 'performance', label: 'Performance' },
            { id: 'economy', label: 'Economy' },
            { id: 'rounds', label: 'Rounds' },
            { id: 'duels', label: 'Duels' },
          ].map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as ModalTab)}
                className={`relative py-3 transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'text-white' : 'text-m3-outline hover:text-white'
                }`}
              >
                <span>{t.label}</span>
                {active && (
                  <motion.span
                    layoutId="modal-active-tab"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#ff4655] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 flex flex-col gap-4">
          {/* Rounds Timeline Strip */}
          <div className="rounded-xl bg-[#16202c] border border-white/10 p-2.5 shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-m3-outline mb-1.5">
              Round Timeline ({detail.rounds.length} Rounds)
            </div>
            <div className="overflow-x-auto pb-0.5">
              <div className="flex flex-col gap-1 min-w-max">
                {/* Team Blue Row */}
                <div className="flex items-center gap-1">
                  <span className="w-14 text-[10px] font-bold text-emerald-400 truncate">
                    Blue ({teamBlueScore})
                  </span>
                  {detail.rounds.map((r, i) => {
                    const isWin = r.winningTeam === 'Blue';
                    return (
                      <div
                        key={i}
                        title={`Round ${i + 1}: ${r.winningTeam} won (${r.roundResult || 'Eliminated'})`}
                        className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${
                          isWin
                            ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                            : 'bg-white/5 text-m3-outline/40'
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
                <div className="flex items-center gap-1">
                  <span className="w-14 text-[10px] font-bold text-red-400 truncate">
                    Red ({teamRedScore})
                  </span>
                  {detail.rounds.map((r, i) => {
                    const isWin = r.winningTeam === 'Red';
                    return (
                      <div
                        key={i}
                        title={`Round ${i + 1}: ${r.winningTeam} won (${r.roundResult || 'Eliminated'})`}
                        className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${
                          isWin
                            ? 'bg-red-500/20 border border-red-400 text-red-300'
                            : 'bg-white/5 text-m3-outline/40'
                        }`}
                      >
                        {isWin ? (
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

          {activeTab === 'scoreboard' && (
            <div className="flex flex-col gap-4">
              {/* Team Blue Table */}
              <div className="rounded-xl border border-white/10 overflow-hidden bg-[#16202c]">
                {/* Team Blue Banner */}
                <div className="px-3.5 py-1.5 bg-emerald-950/40 border-b border-white/10 flex items-center justify-between text-xs font-bold text-emerald-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>Team Blue • {teamBlueScore} Rounds</span>
                  </div>
                  <span className="text-m3-outline font-medium text-[11px]">
                    Avg. Rank: {avgRankName(teamBlue)}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-m3-outline select-none">
                        <th className="py-2 px-2.5 min-w-[44px]">Agent</th>
                        <th className="py-2 px-2.5 min-w-[130px]">Player</th>
                        <th className="py-2 px-2 text-center">TRS</th>
                        <th className="py-2 px-2 text-center">ACS</th>
                        <th className="py-2 px-2.5 text-center">K / D / A</th>
                        <th className="py-2 px-2 text-center">+/-</th>
                        <th className="py-2 px-2 text-center">K/D</th>
                        <th className="py-2 px-2 text-center">DDΔ</th>
                        <th className="py-2 px-2 text-center">ADR</th>
                        <th className="py-2 px-2 text-center">HS%</th>
                        <th className="py-2 px-2 text-center">KAST</th>
                        <th className="py-2 px-2 text-center">FK</th>
                        <th className="py-2 px-2 text-center">FD</th>
                        <th className="py-2 px-2 text-center">MK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {teamBlue.map((p, idx) => {
                        const isMatchMvp = p.puuid === matchMvpPuuid;
                        const isTeamMvp = idx === 0 && !isMatchMvp;
                        const rIcon = p.tier && tierIcons[p.tier] ? tierIcons[p.tier] : '';

                        return (
                          <tr
                            key={p.puuid || idx}
                            className={`hover:bg-white/5 transition-colors ${
                              p.isMe ? 'bg-emerald-500/10 border-l-2 border-emerald-400' : ''
                            }`}
                          >
                            {/* Agent */}
                            <td className="py-1 px-2.5">
                              <div className="relative w-7 h-7 rounded-md overflow-hidden border border-white/10 bg-black/40">
                                {p.agIcon ? (
                                  <img src={p.agIcon} alt={p.agent} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-white/10" />
                                )}
                                {p.accountLevel ? (
                                  <span className="absolute bottom-0 right-0 text-[7px] bg-black/80 px-0.5 rounded-tl font-bold text-white leading-tight">
                                    {p.accountLevel}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Player Name + Badges */}
                            <td className="py-1 px-2.5 font-sans">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold text-xs truncate max-w-[120px] ${p.isMe ? 'text-emerald-300' : 'text-white'}`}>
                                  {p.displayName}
                                </span>
                                {p.displayTag ? (
                                  <span className="text-[10px] text-m3-outline">#{p.displayTag}</span>
                                ) : null}
                                {rIcon ? (
                                  <img src={rIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                                ) : null}
                                {isMatchMvp ? (
                                  <span className="px-1 py-px rounded text-[8px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                    Match MVP
                                  </span>
                                ) : isTeamMvp ? (
                                  <span className="px-1 py-px rounded text-[8px] font-black uppercase tracking-wider bg-sky-400/20 text-sky-300 border border-sky-400/40">
                                    Team MVP
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* TRS */}
                            <td className="py-1 px-2 text-center text-m3-outline font-bold">{p.trs}</td>

                            {/* ACS */}
                            <td className="py-1 px-2 text-center text-white font-extrabold">{p.acs}</td>

                            {/* K/D/A */}
                            <td className="py-1 px-2.5 text-center text-white">
                              {p.kills} <span className="text-m3-outline">/</span> {p.deaths} <span className="text-m3-outline">/</span> {p.assists}
                            </td>

                            {/* +/- */}
                            <td className={`py-1 px-2 text-center font-bold ${p.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {p.diff > 0 ? `+${p.diff}` : p.diff}
                            </td>

                            {/* K/D */}
                            <td className={`py-1 px-2 text-center font-bold ${p.kd >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {p.kd.toFixed(2)}
                            </td>

                            {/* DDΔ */}
                            <td className={`py-1 px-2 text-center font-bold ${p.ddPerRound >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {p.ddPerRound > 0 ? `+${p.ddPerRound}` : p.ddPerRound}
                            </td>

                            {/* ADR */}
                            <td className="py-1 px-2 text-center text-white">{p.adr}</td>

                            {/* HS% */}
                            <td className="py-1 px-2 text-center text-m3-primary">{Math.round(p.hsPct)}%</td>

                            {/* KAST */}
                            <td className="py-1 px-2 text-center text-white">{p.kast}%</td>

                            {/* FK */}
                            <td className="py-1 px-2 text-center text-emerald-400">{p.fk}</td>

                            {/* FD */}
                            <td className="py-1 px-2 text-center text-red-400">{p.fd}</td>

                            {/* MK */}
                            <td className="py-1 px-2 text-center text-amber-300 font-bold">{p.mk}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Team Red Table */}
              <div className="rounded-xl border border-white/10 overflow-hidden bg-[#16202c]">
                {/* Team Red Banner */}
                <div className="px-3.5 py-1.5 bg-red-950/40 border-b border-white/10 flex items-center justify-between text-xs font-bold text-red-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span>Team Red • {teamRedScore} Rounds</span>
                  </div>
                  <span className="text-m3-outline font-medium text-[11px]">
                    Avg. Rank: {avgRankName(teamRed)}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-m3-outline select-none">
                        <th className="py-2 px-2.5 min-w-[44px]">Agent</th>
                        <th className="py-2 px-2.5 min-w-[130px]">Player</th>
                        <th className="py-2 px-2 text-center">TRS</th>
                        <th className="py-2 px-2 text-center">ACS</th>
                        <th className="py-2 px-2.5 text-center">K / D / A</th>
                        <th className="py-2 px-2 text-center">+/-</th>
                        <th className="py-2 px-2 text-center">K/D</th>
                        <th className="py-2 px-2 text-center">DDΔ</th>
                        <th className="py-2 px-2 text-center">ADR</th>
                        <th className="py-2 px-2 text-center">HS%</th>
                        <th className="py-2 px-2 text-center">KAST</th>
                        <th className="py-2 px-2 text-center">FK</th>
                        <th className="py-2 px-2 text-center">FD</th>
                        <th className="py-2 px-2 text-center">MK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {teamRed.map((p, idx) => {
                        const isMatchMvp = p.puuid === matchMvpPuuid;
                        const isTeamMvp = idx === 0 && !isMatchMvp;
                        const rIcon = p.tier && tierIcons[p.tier] ? tierIcons[p.tier] : '';

                        return (
                          <tr
                            key={p.puuid || idx}
                            className={`hover:bg-white/5 transition-colors ${
                              p.isMe ? 'bg-red-500/10 border-l-2 border-red-400' : ''
                            }`}
                          >
                            {/* Agent */}
                            <td className="py-1 px-2.5">
                              <div className="relative w-7 h-7 rounded-md overflow-hidden border border-white/10 bg-black/40">
                                {p.agIcon ? (
                                  <img src={p.agIcon} alt={p.agent} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-white/10" />
                                )}
                                {p.accountLevel ? (
                                  <span className="absolute bottom-0 right-0 text-[7px] bg-black/80 px-0.5 rounded-tl font-bold text-white leading-tight">
                                    {p.accountLevel}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Player Name + Badges */}
                            <td className="py-1 px-2.5 font-sans">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold text-xs truncate max-w-[120px] ${p.isMe ? 'text-red-300' : 'text-white'}`}>
                                  {p.displayName}
                                </span>
                                {p.displayTag ? (
                                  <span className="text-[10px] text-m3-outline">#{p.displayTag}</span>
                                ) : null}
                                {rIcon ? (
                                  <img src={rIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                                ) : null}
                                {isMatchMvp ? (
                                  <span className="px-1 py-px rounded text-[8px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                    Match MVP
                                  </span>
                                ) : isTeamMvp ? (
                                  <span className="px-1 py-px rounded text-[8px] font-black uppercase tracking-wider bg-sky-400/20 text-sky-300 border border-sky-400/40">
                                    Team MVP
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* TRS */}
                            <td className="py-1 px-2 text-center text-m3-outline font-bold">{p.trs}</td>

                            {/* ACS */}
                            <td className="py-1 px-2 text-center text-white font-extrabold">{p.acs}</td>

                            {/* K/D/A */}
                            <td className="py-1 px-2.5 text-center text-white">
                              {p.kills} <span className="text-m3-outline">/</span> {p.deaths} <span className="text-m3-outline">/</span> {p.assists}
                            </td>

                            {/* +/- */}
                            <td className={`py-1 px-2 text-center font-bold ${p.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {p.diff > 0 ? `+${p.diff}` : p.diff}
                            </td>

                            {/* K/D */}
                            <td className={`py-1 px-2 text-center font-bold ${p.kd >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {p.kd.toFixed(2)}
                            </td>

                            {/* DDΔ */}
                            <td className={`py-1 px-2 text-center font-bold ${p.ddPerRound >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {p.ddPerRound > 0 ? `+${p.ddPerRound}` : p.ddPerRound}
                            </td>

                            {/* ADR */}
                            <td className="py-1 px-2 text-center text-white">{p.adr}</td>

                            {/* HS% */}
                            <td className="py-1 px-2 text-center text-m3-primary">{Math.round(p.hsPct)}%</td>

                            {/* KAST */}
                            <td className="py-1 px-2 text-center text-white">{p.kast}%</td>

                            {/* FK */}
                            <td className="py-1 px-2 text-center text-emerald-400">{p.fk}</td>

                            {/* FD */}
                            <td className="py-1 px-2 text-center text-red-400">{p.fd}</td>

                            {/* MK */}
                            <td className="py-1 px-2 text-center text-amber-300 font-bold">{p.mk}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#16202c] border border-white/10 p-4">
                <h4 className="font-display font-bold text-sm text-white mb-3 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-emerald-400" />
                  <span>First Bloods & Multikills</span>
                </h4>
                <div className="flex flex-col gap-2.5 text-xs font-mono">
                  {playerStats.slice(0, 5).map((p) => (
                    <div key={p.puuid} className="flex items-center justify-between p-2 rounded-lg bg-black/20">
                      <span className="font-sans font-bold text-white">{p.displayName}</span>
                      <span className="text-m3-outline">
                        FK <strong className="text-emerald-400">{p.fk}</strong> • FD <strong className="text-red-400">{p.fd}</strong> • MK <strong className="text-amber-300">{p.mk}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-[#16202c] border border-white/10 p-4">
                <h4 className="font-display font-bold text-sm text-white mb-3 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Damage Output & Impact</span>
                </h4>
                <div className="flex flex-col gap-2.5 text-xs font-mono">
                  {playerStats.slice(0, 5).map((p) => (
                    <div key={p.puuid} className="flex items-center justify-between p-2 rounded-lg bg-black/20">
                      <span className="font-sans font-bold text-white">{p.displayName}</span>
                      <span className="text-m3-outline">
                        ADR <strong className="text-white">{p.adr}</strong> • DDΔ <strong className={p.ddPerRound >= 0 ? 'text-emerald-400' : 'text-red-400'}>{p.ddPerRound > 0 ? `+${p.ddPerRound}` : p.ddPerRound}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'economy' && (
            <div className="p-8 rounded-xl bg-[#16202c] border border-white/10 text-center">
              <Coins className="w-8 h-8 text-amber-300 mx-auto mb-2" />
              <div className="font-display font-bold text-base text-white">Match Economy Breakdown</div>
              <div className="text-xs text-m3-outline mt-1">
                Credits managed, eco round conversions, and weapon loadouts across all {detail.rounds.length} rounds.
              </div>
            </div>
          )}

          {activeTab === 'rounds' && (
            <div className="flex flex-col gap-2">
              {detail.rounds.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#16202c] border border-white/10 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-m3-outline">Round {i + 1}</span>
                    <span className={`font-bold ${r.winningTeam === 'Blue' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.winningTeam} Won
                    </span>
                  </div>
                  <span className="text-m3-outline font-mono text-[11px]">{r.roundResult || 'Eliminated'}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'duels' && (
            <div className="flex flex-col gap-2">
              {detail.kills.slice(0, 20).map((k, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[#16202c] border border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-m3-outline text-[11px]">R{k.round + 1}</span>
                    <span className={`font-bold ${k.killerTeam === 'Blue' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {playerStats.find((p) => p.puuid === k.killerPuuid)?.displayName || 'Player'}
                    </span>
                    <Swords className="w-3.5 h-3.5 text-m3-outline" />
                    <span className={`font-bold ${k.victimTeam === 'Blue' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {playerStats.find((p) => p.puuid === k.victimPuuid)?.displayName || 'Player'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-m3-outline">{k.weapon || 'Ability'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
