import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './ipc';

/* TRN enrichment: tracker.gg's public read API through the bundled trnfetch
   sidecar (Chrome TLS fingerprint — passes their Cloudflare wall with no key,
   no login, no browser). Everything here is a progressive enhancement: every
   caller MUST fall back to Riot-direct data when this throws (TRN_*) because
   TRN can gate or reshape these endpoints at any time. */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function trnGet(path: string): Promise<unknown> {
  if (!isTauri()) throw new Error('TRN needs the desktop app.');
  const raw = await invoke<string>('trn_get', { path });
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('TRN bad JSON.');
  }
}

const riotId = (name: string, tag: string): string =>
  `/api/v2/valorant/standard/profile/riot/${encodeURIComponent(name)}%23${encodeURIComponent(tag)}`;

export interface TrnActStats {
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  kd: number;
  kda: number;
  kills: number;
  deaths: number;
  assists: number;
  hsPct: number;
  headshots: number;
  adr: number;
  acs: number;
  damage: number;
  damageDelta: number;
  rounds: number;
  roundWinPct: number;
  kast: number;
  mvps: number;
  flawless: number;
  aces: number;
  clutches: number;
  clutchesLost: number;
  firstKills: number;
  firstDeaths: number;
  kills3k: number;
  kills4k: number;
  timePlayedH: number;
  trnScore: number;
  kdPercentile: number;
  hsPercentile: number;
  roundWinPctile: number;
  kastPctile: number;
  acsPctile: number;
  adrPctile: number;
  headHits: number;
  bodyHits: number;
  legHits: number;
  bestKills: number;
  avatarUrl: string;
}

/** Current-season overview segment straight from TRN (act-wide, ties included). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickSeasonSegment(j: any, seasonId: string): any | null {
  const segs = Array.isArray(j?.data?.segments) ? j.data.segments : [];
  return (
    segs.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s?.type === 'season' && (!seasonId || s?.attributes?.seasonId === seasonId)
    ) ?? segs.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s?.type === 'season'
    ) ?? null
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stat(seg: any, key: string): number {
  return num(seg?.stats?.[key]?.value);
}

/** Act stats for a Riot ID. seasonId optional (defaults to TRN's default season). */
export async function fetchTrnActStats(
  name: string,
  tag: string,
  seasonId = ''
): Promise<{ stats: TrnActStats; defaultSeason: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j: any = await trnGet(riotId(name, tag));
  const seg = pickSeasonSegment(j, seasonId);
  if (!seg) throw new Error('TRN no season segment.');
  const kills = stat(seg, 'kills');
  const deaths = stat(seg, 'deaths');
  return {
    stats: {
      wins: stat(seg, 'matchesWon'),
      losses: stat(seg, 'matchesLost'),
      ties: stat(seg, 'matchesTied'),
      winPct: stat(seg, 'matchesWinPct'),
      kd: stat(seg, 'kDRatio') || (deaths > 0 ? kills / deaths : kills),
      kda: stat(seg, 'kDARatio'),
      kills,
      deaths,
      assists: stat(seg, 'assists'),
      hsPct: stat(seg, 'headshotsPercentage'),
      headshots: stat(seg, 'headshots'),
      adr: stat(seg, 'damagePerRound'),
      acs: stat(seg, 'scorePerRound'),
      damage: stat(seg, 'damage'),
      damageDelta: stat(seg, 'damageDelta'),
      rounds: stat(seg, 'roundsPlayed'),
      roundWinPct: stat(seg, 'roundsWinPct'),
      kast: stat(seg, 'kAST'),
      mvps: stat(seg, 'mVPs'),
      flawless: stat(seg, 'flawless'),
      aces: stat(seg, 'aces'),
      clutches: stat(seg, 'clutches'),
      clutchesLost: stat(seg, 'clutchesLost'),
      firstKills: stat(seg, 'firstBloods'),
      firstDeaths: stat(seg, 'firstDeaths'),
      kills3k: stat(seg, 'kills3K'),
      kills4k: stat(seg, 'kills4K'),
      timePlayedH: Math.round((stat(seg, 'timePlayed') / 3600) * 10) / 10,
      trnScore: stat(seg, 'trnPerformanceScore'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      roundWinPctile: num((seg?.stats?.roundsWinPct as any)?.percentile),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kastPctile: num((seg?.stats?.kAST as any)?.percentile),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      acsPctile: num((seg?.stats?.scorePerRound as any)?.percentile),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adrPctile: num((seg?.stats?.damagePerRound as any)?.percentile),
      headHits: stat(seg, 'dealtHeadshots'),
      bodyHits: stat(seg, 'dealtBodyshots'),
      legHits: stat(seg, 'dealtLegshots'),
      bestKills: stat(seg, 'mostKillsInMatch'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      avatarUrl: String((j as any)?.data?.platformInfo?.avatarUrl ?? ''),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kdPercentile: num((seg?.stats?.kills as any)?.percentile),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hsPercentile: num((seg?.stats?.headshotsPercentage as any)?.percentile),
    },
    defaultSeason: String(j?.data?.metadata?.defaultSeason ?? ''),
  };
}

export interface TrnAgentStat {
  agent: string;
  matches: number;
  wins: number;
  winPct: number;
  kd: number;
  adr: number;
  acs: number;
  hsPct: number;
  hours: number;
}

/** Per-agent season segments (top agents with real HS%). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTrnAgents(name: string, tag: string, seasonId: string): Promise<TrnAgentStat[]> {
  const j = (await trnGet(
    `${riotId(name, tag)}/segments/season?playlist=competitive&seasonId=${encodeURIComponent(seasonId)}&source=web`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any;
  const segs = Array.isArray(j?.data) ? j.data : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return segs
    .filter((s: any) => s?.type === 'agent')
    .map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any): TrnAgentStat => {
        const k = num(s?.stats?.kills?.value);
        const d = num(s?.stats?.deaths?.value);
        const m = num(s?.stats?.matchesPlayed?.value);
        const w = num(s?.stats?.matchesWon?.value);
        return {
          agent: String(s?.metadata?.name ?? s?.attributes?.agent ?? '?'),
          matches: m,
          wins: w,
          winPct: m > 0 ? (w / m) * 100 : 0,
          kd: d > 0 ? k / d : k,
          adr: num(s?.stats?.damagePerRound?.value),
          acs: num(s?.stats?.scorePerRound?.value),
          hsPct: num(s?.stats?.headshotsPercentage?.value),
          hours: Math.round((num(s?.stats?.timePlayed?.value) / 3600) * 10) / 10,
        };
      }
    )
    .filter((a: TrnAgentStat) => a.matches > 0)
    .sort((a: TrnAgentStat, b: TrnAgentStat) => b.matches - a.matches);
}
