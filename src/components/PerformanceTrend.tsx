import React, { useMemo } from 'react';

/* Performance over time.

   Real data only: each point is one completed competitive match, computed from
   Riot's match-detail payload for the local player —
     ACS = combat score / rounds played
     HS% = headshots / (headshots + bodyshots + legshots)
   Nothing here is inferred or simulated, and it is explicitly NOT live
   in-match data (Riot exposes none — see ROADMAP.md). */

export interface PerformancePoint {
  matchId: string;
  when: number;
  acs: number;
  kd: number;
  hsPct: number;
  win: boolean;
}

export type TrendMetric = 'acs' | 'kd' | 'hs';

const METRICS: Record<TrendMetric, { label: string; unit: string; decimals: number }> = {
  acs: { label: 'ACS', unit: '', decimals: 0 },
  kd: { label: 'K/D', unit: '', decimals: 2 },
  hs: { label: 'HS%', unit: '%', decimals: 0 },
};

/** Queues whose results are comparable enough to plot as one trend.
 *  Deathmatch must never be mixed in: it reports roundsPlayed = 1 (so the
 *  score/rounds ratio explodes to absurd ACS) and its teamScore map is keyed by
 *  PUUID rather than Blue/Red, which also breaks win detection. */
export const TREND_QUEUES = ['competitive'] as const;

/** Minimum rounds for a match to count as a real game rather than a fragment. */
const MIN_ROUNDS = 5;

interface RawDetail {
  when: number;
  queue?: string;
  players: {
    puuid: string;
    team?: string;
    kills: number;
    deaths: number;
    score: number;
    rounds: number;
    headshots: number;
    bodyshots: number;
    legshots: number;
  }[];
  teamScore?: Record<string, number> | null;
}

/** Turn stored match details into an ordered performance series for one player.
 *  Competitive only, real numbers only — anything malformed is skipped rather
 *  than plotted as a fake zero. */
export function buildPerformanceSeries(
  detailsById: Record<string, RawDetail>,
  puuid: string,
  limit = 20
): PerformancePoint[] {
  if (!puuid) return [];
  const out: PerformancePoint[] = [];

  for (const [matchId, d] of Object.entries(detailsById)) {
    if (!d?.players) continue;
    // Only comparable, real matches.
    if (!TREND_QUEUES.includes((d.queue ?? '') as (typeof TREND_QUEUES)[number])) continue;

    const me = d.players.find((p) => p.puuid?.toLowerCase() === puuid.toLowerCase());
    if (!me) continue;

    const rounds = Number(me.rounds ?? 0);
    if (rounds < MIN_ROUNDS) continue;

    // Win/loss straight from the payload's team scores — never assumed.
    const scores = d.teamScore ?? {};
    const mine = me.team ? Number(scores[me.team] ?? 0) : 0;
    const theirs = Object.entries(scores)
      .filter(([team]) => team !== me.team)
      .reduce((best, [, v]) => Math.max(best, Number(v ?? 0)), 0);

    const shots = (me.headshots ?? 0) + (me.bodyshots ?? 0) + (me.legshots ?? 0);

    out.push({
      matchId,
      when: d.when ?? 0,
      acs: Math.round(Number(me.score ?? 0) / rounds),
      kd: me.deaths > 0 ? me.kills / me.deaths : me.kills,
      hsPct: shots > 0 ? Math.round((me.headshots / shots) * 100) : 0,
      win: mine > theirs,
    });
  }

  out.sort((a, b) => a.when - b.when);
  return out.slice(-limit);
}

export const PerformanceTrend: React.FC<{
  points: PerformancePoint[];
  metric?: TrendMetric;
  width?: number;
  height?: number;
  className?: string;
}> = ({ points, metric = 'acs', width = 240, height = 44, className = '' }) => {
  const meta = METRICS[metric];

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => (metric === 'acs' ? p.acs : metric === 'kd' ? p.kd : p.hsPct));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // Flat series would divide by zero — fall back to a 1-unit band.
    const span = max - min || 1;
    const pad = 3;
    const usableH = height - pad * 2;
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;

    const coords = values.map((v, i) => ({
      x: values.length > 1 ? i * stepX : width / 2,
      y: pad + usableH - ((v - min) / span) * usableH,
      v,
    }));

    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const area = `${line} L${width},${height} L0,${height} Z`;
    return { coords, line, area, min, max, avg };
  }, [points, metric, width, height]);

  if (!stats) {
    return (
      <div className={`flex items-center justify-center text-[9px] font-mono text-zinc-600 ${className}`}>
        no recent matches
      </div>
    );
  }

  const last = stats.coords[stats.coords.length - 1];
  const fmt = (v: number) => `${metric === 'hs' ? Math.round(v) : v.toFixed(meta.decimals)}${meta.unit}`;
  const wins = points.filter((p) => p.win).length;

  return (
    <div className={className}>
      <div className="flex items-center justify-between px-0.5 mb-1">
        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">
          {meta.label} · last {points.length} ranked
        </span>
        <span className="text-[9px] font-mono text-zinc-400">
          <span className={wins >= points.length - wins ? 'text-m3-mint font-bold' : 'text-rose-400 font-bold'}>
            {wins}W-{points.length - wins}L
          </span>
          {' · avg '}
          <span className="text-white font-bold">{fmt(stats.avg)}</span>
        </span>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        role="img"
        aria-label={`${meta.label} over the last ${points.length} matches, average ${fmt(stats.avg)}`}
      >
        <defs>
          <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d0bcff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#d0bcff" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={stats.area} fill="url(#perf-fill)" />
        <path
          d={stats.line}
          fill="none"
          stroke="#d0bcff"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Latest point emphasised */}
        <circle cx={last.x} cy={last.y} r="2.5" fill="#ffb4a9" />
      </svg>

      <div className="flex items-center justify-between px-0.5 mt-0.5 text-[8px] font-mono text-zinc-500">
        <span>low {fmt(stats.min)}</span>
        <span className="text-zinc-300 font-bold">now {fmt(last.v)}</span>
        <span>high {fmt(stats.max)}</span>
      </div>
    </div>
  );
};
