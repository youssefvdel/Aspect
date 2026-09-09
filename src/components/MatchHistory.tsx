import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lightbulb } from 'lucide-react';
import type { TrackerMatchDetail, TrackerMmrPoint } from '../types';
import { queueLabel, shortMapName } from '../utils/tracker';
import { useTrackerData } from '../hooks/useTrackerData';
import { buildTips } from '../utils/trackerTips';
import { TrackerSkeletons } from './TrackerSkeletons';

const fmtDate = (ms: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
};

const GameRow: React.FC<{
  g: TrackerMmrPoint;
  queue: string;
  map: string;
  index: number;
  detail?: TrackerMatchDetail;
  puuid: string;
}> = ({ g, queue, map, index, detail, puuid }) => {
  const [open, setOpen] = useState(false);
  const me = detail?.players.find((p) => p.puuid === puuid);
  const myTeam = me?.team ?? '';
  const us = myTeam ? (detail?.teamScore[myTeam] ?? 0) : 0;
  const them = myTeam
    ? Math.max(0, ...Object.entries(detail?.teamScore ?? {}).filter(([t]) => t !== myTeam).map(([, n]) => n), 0)
    : 0;
  const won = detail && us !== them ? us > them : g.change > 0;
  const acs = me && me.rounds > 0 ? Math.round(me.score / me.rounds) : 0;

  const teams = useMemo(() => {
    if (!detail) return [];
    return ['Blue', 'Red']
      .map((t) => ({
        team: t,
        score: detail.teamScore[t] ?? 0,
        players: [...detail.players]
          .filter((p) => p.team === t)
          .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths),
      }))
      .filter((x) => x.players.length > 0);
  }, [detail]);
  const tips = useMemo(() => (detail && puuid ? buildTips(detail, puuid) : []), [detail, puuid]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.3, ease: 'easeOut' }}
      className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 overflow-hidden">
      <button onClick={() => detail && setOpen((o) => !o)}
        className={`w-full px-2.5 py-2 flex items-center gap-2.5 text-left transition-colors ${detail ? 'cursor-pointer hover:bg-m3-surface-container-high/40' : ''}`}>
        <span className={`w-1 self-stretch rounded-full shrink-0 ${won ? 'bg-m3-tertiary' : 'bg-red-500/70'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-m3-on-surface">{map}</span>
            <span className="text-[10px] text-m3-outline">{queue}</span>
            {me && detail && (
              <span className={`text-[11px] font-mono font-bold ${won ? 'text-m3-tertiary' : 'text-red-400'}`}>
                {us}–{them}
              </span>
            )}
            <span className={`text-[11px] font-mono font-bold ${g.change >= 0 ? 'text-m3-tertiary' : 'text-red-400'}`}>
              {g.change > 0 ? `+${g.change}` : g.change} RR
            </span>
          </div>
          <div className="text-[10px] font-mono text-m3-outline mt-0.5">
            {me ? (
              <>{me.agent} • {me.kills}/{me.deaths}/{me.assists} • ACS {acs} • {g.tier}</>
            ) : (
              <>{g.tier} • {g.rr} RR • {fmtDate(g.when)}</>
            )}
          </div>
        </div>
        {detail && <span className="text-[10px] text-m3-outline shrink-0">{open ? '▾' : '▸'}</span>}
      </button>
      {open && detail && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-m3-outline-subtle/50">
          {teams.map((t) => (
            <div key={t.team} className="mt-1.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-m3-outline mb-1">
                Team {t.team} • {t.score}
              </div>
              {t.players.map((p) => {
                const isMe = p.puuid === puuid;
                const pacs = p.rounds > 0 ? Math.round(p.score / p.rounds) : 0;
                return (
                  <div key={p.puuid || `${p.agent}-${p.kills}`}
                    className={`flex items-center justify-between gap-2 py-1 px-1.5 rounded-lg text-[11px] ${isMe ? 'bg-m3-primary/10 border border-m3-primary/30' : ''}`}>
                    <span className="truncate text-m3-on-surface">
                      <span className="font-semibold">{isMe ? 'You' : p.agent}</span>
                      {!isMe && <span className="text-m3-outline"> • {p.agent}</span>}
                      {isMe && <span className="text-m3-outline"> • {p.agent}</span>}
                    </span>
                    <span className="font-mono text-m3-on-surface-variant shrink-0 tabular-nums">
                      {p.kills}/{p.deaths}/{p.assists} • {pacs}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {tips.length > 0 && (
            <div className="mt-2 rounded-lg bg-amber-400/10 border border-amber-400/30 p-2 space-y-1">
              {tips.map((t, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-200/90 leading-snug">
                  <Lightbulb className="w-3 h-3 shrink-0 mt-px" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export const MatchHistory: React.FC = () => {
  const { profile, games, queueById, mapById, detailsById, detailsReady, detailsTotal, isLoading, banner, setBanner } =
    useTrackerData();
  const maxAbs = Math.max(10, ...games.map((p) => Math.abs(p.change)));
  const puuid = profile?.puuid ?? '';

  if (isLoading && games.length === 0) {
    return (
      <div className="h-full min-h-0 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
        <TrackerSkeletons />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-2.5 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
      {banner && (
        <div className="p-2.5 rounded-xl bg-m3-primary-container/40 border border-m3-primary/40 text-m3-on-primary-container text-xs font-semibold flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Check className="w-3.5 h-3.5 text-m3-primary shrink-0" />
            <span>{banner}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-m3-primary hover:underline text-xs ml-3 cursor-pointer font-bold shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {detailsTotal > 0 && detailsReady < detailsTotal && (
        <div className="text-[10px] font-mono text-m3-outline shrink-0 px-1">
          Scoreboards {detailsReady}/{detailsTotal}…
        </div>
      )}

      {/* RR trend */}
      {games.length > 0 && (
        <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 shrink-0">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-primary mb-2">RR trend</h4>
          <div className="flex items-end gap-1 h-16">
            {[...games].slice(0, 20).reverse().map((p, i) => {
              const h = Math.max(8, Math.round((Math.abs(p.change) / maxAbs) * 100));
              return (
                <motion.div key={p.matchId || p.when}
                  title={`${p.tier}: ${p.change > 0 ? '+' : ''}${p.change} RR`}
                  initial={{ height: '8%' }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.03, type: 'spring', stiffness: 200, damping: 20 }}
                  className={`flex-1 rounded-sm ${p.change >= 0 ? 'bg-m3-tertiary' : 'bg-red-500/70'}`} />
              );
            })}
          </div>
        </section>
      )}

      {/* Games */}
      {games.length > 0 && (
        <div className="flex flex-col gap-1.5 shrink-0">
          {games.map((g, i) => (
            <GameRow key={g.matchId || g.when} g={g} index={i}
              queue={queueLabel(queueById[g.matchId] ?? '')}
              map={mapById[g.matchId] ?? shortMapName(g.mapId, {})}
              detail={detailsById[g.matchId]}
              puuid={puuid} />
          ))}
        </div>
      )}

      {!profile && !isLoading && (
        <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-[11px] text-m3-on-surface-variant shrink-0">
          Open the Riot Client and this tab fills itself — last 20 games with map, mode, and RR earned.
        </div>
      )}
    </div>
  );
};
