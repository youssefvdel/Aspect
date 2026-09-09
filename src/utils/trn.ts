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
  ddPctile: number;
  headHits: number;
  bodyHits: number;
  legHits: number;
  bestKills: number;
  avatarUrl: string;
}

// In-memory cache for root profiles (10 min TTL)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const profileCache = new Map<string, { at: number; data: any }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRootProfile(name: string, tag: string): Promise<any> {
  const key = `${name.toLowerCase()}#${tag.toLowerCase()}`;
  const hit = profileCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j: any = await trnGet(riotId(name, tag));
  profileCache.set(key, { at: Date.now(), data: j });
  return j;
}

/** Current-season overview segment straight from TRN (act-wide, ties included). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickSeasonSegment(j: any, seasonId: string): any | null {
  const segs = Array.isArray(j?.data?.segments) ? j.data.segments : [];
  if (seasonId) {
    const sid = seasonId.toLowerCase();
    return (
      segs.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => s?.type === 'season' && String(s?.attributes?.seasonId ?? '').toLowerCase() === sid
      ) ?? null
    );
  }
  return (
    segs.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s?.type === 'season'
    ) ?? null
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stat(seg: any, key: string): number {
  return num(seg?.stats?.[key]?.value);
}

// In-memory cache for season segments (10 min TTL)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seasonSegCache = new Map<string, { at: number; data: any }>();

/** Raw season segment for any playlist/season (drives stats + agents parsing). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSeasonSeg(name: string, tag: string, playlist: string, seasonId: string): Promise<any> {
  const sid = seasonId.toLowerCase();
  const cacheKey = `${name.toLowerCase()}#${tag.toLowerCase()}_${playlist}_${sid}`;
  const hit = seasonSegCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j: any = await trnGet(
    `${riotId(name, tag)}/segments/season?playlist=${encodeURIComponent(playlist)}${seasonId ? `&seasonId=${encodeURIComponent(seasonId)}` : ''}&source=web`
  );
  const segs = Array.isArray(j?.data) ? j.data : [];
  const targetSeg = seasonId
    ? segs.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => s?.type === 'season' && String(s?.attributes?.seasonId ?? '').toLowerCase() === sid
      )
    : segs.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => s?.type === 'season'
      );
  if (!targetSeg) throw new Error('TRN no season segment.');
  const result = { seg: targetSeg, data: j?.data };
  seasonSegCache.set(cacheKey, { at: Date.now(), data: result });
  return result;
}

/** Act stats for a Riot ID. seasonId/playlist optional (defaults = current competitive). */
export async function fetchTrnActStats(
  name: string,
  tag: string,
  seasonId = '',
  playlist = 'competitive'
): Promise<{ stats: TrnActStats; defaultSeason: string; countryCode: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seg: any = null;
  // Always fetch/pull root profile so avatarUrl and countryCode are never missing
  const root = await getRootProfile(name, tag).catch(() => null);
  const avatarUrl = String(root?.data?.platformInfo?.avatarUrl ?? '');
  const defaultSeason = String(root?.data?.metadata?.defaultSeason ?? '');
  const countryCode = String(root?.data?.userInfo?.countryCode ?? '');

  if (playlist === 'competitive') {
    seg = pickSeasonSegment(root, seasonId);
  }
  if (!seg) {
    const r = await fetchSeasonSeg(name, tag, playlist, seasonId);
    seg = r.seg;
  }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ddPctile: num((seg?.stats?.damageDeltaPerRound as any)?.percentile),
      headHits: stat(seg, 'dealtHeadshots'),
      bodyHits: stat(seg, 'dealtBodyshots'),
      legHits: stat(seg, 'dealtLegshots'),
      bestKills: stat(seg, 'mostKillsInMatch'),
      avatarUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kdPercentile: num((seg?.stats?.kills as any)?.percentile),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hsPercentile: num((seg?.stats?.headshotsPercentage as any)?.percentile),
    },
    defaultSeason,
    countryCode,
  };
}

export interface TrnAgentTopMap {
  mapName: string;
  mapKey: string;
  matches: number;
  wins: number;
  winPct: number;
  kd: number;
}

export interface TrnAgentStat {
  agent: string;
  agentKey: string;
  role?: string;
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
  kd: number;
  kda: number;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  acs: number;
  damageDeltaPerRound: number;
  hsPct: number;
  timePlayedSeconds: number;
  hours: number;
  kast: number;
  aces: number;
  clutches: number;
  flawless: number;
  firstBloods: number;
  firstDeaths: number;
  ability1Casts: number;
  ability2Casts: number;
  grenadeCasts: number;
  ultimateCasts: number;
  attackKills: number;
  attackDeaths: number;
  attackAssists: number;
  attackRoundsWinPct: number;
  defenseKills: number;
  defenseDeaths: number;
  defenseAssists: number;
  defenseRoundsWinPct: number;
  topMaps: TrnAgentTopMap[];
}

/** Per-agent season segments (full stats, abilities, attack/defense, maps breakdown). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTrnAgents(name: string, tag: string, seasonId: string, playlist = 'competitive'): Promise<TrnAgentStat[]> {
  const r = await fetchSeasonSeg(name, tag, playlist, seasonId);
  const segs = Array.isArray(r?.data) ? r.data : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentSegs = segs.filter((s: any) => s?.type === 'agent');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentTopMapSegs = segs.filter((s: any) => s?.type === 'agent-top-map');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapTopAgentSegs = segs.filter((s: any) => s?.type === 'map-top-agent');

  const mapNameMap: Record<string, string> = {
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

  return agentSegs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any): TrnAgentStat => {
      const k = num(s?.stats?.kills?.value);
      const d = num(s?.stats?.deaths?.value);
      const a = num(s?.stats?.assists?.value);
      const m = num(s?.stats?.matchesPlayed?.value);
      const w = num(s?.stats?.matchesWon?.value);
      const l = num(s?.stats?.matchesLost?.value);
      const agentName = String(s?.metadata?.name ?? s?.attributes?.agent ?? '?');
      const key = String(s?.attributes?.key ?? agentName).toLowerCase();

      // Merge maps from both agent-top-map and map-top-agent
      const agentMapEntries = new Map<string, TrnAgentTopMap>();

      for (const tm of agentTopMapSegs) {
        const matchName = String(tm?.metadata?.name ?? '').toLowerCase();
        if (matchName === agentName.toLowerCase()) {
          const mk = String(tm?.attributes?.mapKey ?? '').toLowerCase();
          const cleanName = mapNameMap[mk] || (mk ? mk.charAt(0).toUpperCase() + mk.slice(1) : 'Map');
          agentMapEntries.set(mk, {
            mapName: cleanName,
            mapKey: mk,
            matches: num(tm?.stats?.matchesPlayed?.value),
            wins: num(tm?.stats?.matchesWon?.value),
            winPct: num(tm?.stats?.matchesWinPct?.value),
            kd: num(tm?.stats?.kDRatio?.value),
          });
        }
      }

      for (const ma of mapTopAgentSegs) {
        const matchName = String(ma?.metadata?.name ?? '').toLowerCase();
        if (matchName === agentName.toLowerCase()) {
          const mk = String(ma?.attributes?.mapKey ?? '').toLowerCase();
          if (!agentMapEntries.has(mk)) {
            const cleanName = mapNameMap[mk] || (mk ? mk.charAt(0).toUpperCase() + mk.slice(1) : 'Map');
            agentMapEntries.set(mk, {
              mapName: cleanName,
              mapKey: mk,
              matches: num(ma?.stats?.matchesPlayed?.value),
              wins: num(ma?.stats?.matchesWon?.value),
              winPct: num(ma?.stats?.matchesWinPct?.value),
              kd: num(ma?.stats?.kDRatio?.value),
            });
          }
        }
      }

      const topMaps = Array.from(agentMapEntries.values())
        .filter((tm) => tm.matches > 0)
        .sort((x, y) => y.matches - x.matches);

      return {
        agent: agentName,
        agentKey: key,
        role: s?.metadata?.role ? String(s.metadata.role) : undefined,
        matches: m,
        wins: w,
        losses: l,
        winPct: m > 0 ? (w / m) * 100 : 0,
        kd: d > 0 ? k / d : k,
        kda: d > 0 ? (k + a) / d : k + a,
        kills: k,
        deaths: d,
        assists: a,
        adr: num(s?.stats?.damagePerRound?.value),
        acs: num(s?.stats?.scorePerRound?.value),
        damageDeltaPerRound: Math.round(num(s?.stats?.damageDeltaPerRound?.value)),
        hsPct: num(s?.stats?.headshotsPercentage?.value),
        timePlayedSeconds: num(s?.stats?.timePlayed?.value),
        hours: Math.round((num(s?.stats?.timePlayed?.value) / 3600) * 10) / 10,
        kast: num(s?.stats?.kAST?.value),
        aces: num(s?.stats?.aces?.value),
        clutches: num(s?.stats?.clutches?.value),
        flawless: num(s?.stats?.flawless?.value),
        firstBloods: num(s?.stats?.firstBloods?.value),
        firstDeaths: num(s?.stats?.firstDeaths?.value),
        ability1Casts: num(s?.stats?.ability1Casts?.value),
        ability2Casts: num(s?.stats?.ability2Casts?.value),
        grenadeCasts: num(s?.stats?.grenadeCasts?.value),
        ultimateCasts: num(s?.stats?.ultimateCasts?.value),
        attackKills: num(s?.stats?.attackKills?.value),
        attackDeaths: num(s?.stats?.attackDeaths?.value),
        attackAssists: num(s?.stats?.attackAssists?.value),
        attackRoundsWinPct: num(s?.stats?.attackRoundsWinPct?.value),
        defenseKills: num(s?.stats?.defenseKills?.value),
        defenseDeaths: num(s?.stats?.defenseDeaths?.value),
        defenseAssists: num(s?.stats?.defenseAssists?.value),
        defenseRoundsWinPct: num(s?.stats?.defenseRoundsWinPct?.value),
        topMaps,
      };
    })
    .filter((a: TrnAgentStat) => a.matches > 0)
    .sort((a: TrnAgentStat, b: TrnAgentStat) => b.matches - a.matches);
}

export interface TrnMapAgent {
  name: string;
  icon: string;
  matches: number;
  winPct: number;
}

export interface TrnMapStat {
  key: string;
  name: string;
  imageUrl: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winPct: number;
  kd: number;
  adr: number;
  acs: number;
  damageDeltaPerRound: number;

  kills: number;
  deaths: number;
  assists: number;
  headshotsPct: number;
  timePlayedSeconds: number;

  aces: number;
  clutches: number;
  thrifty: number;
  flawless: number;
  plants: number;
  defuses: number;

  attackKills: number;
  attackDeaths: number;
  attackAssists: number;
  attackRoundsWinPct: number;

  defenseKills: number;
  defenseDeaths: number;
  defenseAssists: number;
  defenseRoundsWinPct: number;

  topAgents: TrnMapAgent[];
}

/** Per-map season segments (full stats, top agents, attack/defense split). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTrnMaps(name: string, tag: string, seasonId: string, playlist = 'competitive'): Promise<TrnMapStat[]> {
  const r = await fetchSeasonSeg(name, tag, playlist, seasonId);
  const segs = Array.isArray(r?.data) ? r.data : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapSegs = segs.filter((s: any) => s?.type === 'map');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapTopAgentSegs = segs.filter((s: any) => s?.type === 'map-top-agent');

  return mapSegs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any): TrnMapStat => {
      const key = String(s?.attributes?.key ?? '');
      const topAgents: TrnMapAgent[] = mapTopAgentSegs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) => String(a?.attributes?.mapKey ?? '').toLowerCase() === key.toLowerCase())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => ({
          name: String(a?.metadata?.name ?? a?.attributes?.agentKey ?? '?'),
          icon: String(a?.metadata?.imageUrl ?? ''),
          matches: num(a?.stats?.matchesPlayed?.value),
          winPct: num(a?.stats?.matchesWinPct?.value),
        }))
        .sort((x: TrnMapAgent, y: TrnMapAgent) => y.matches - x.matches)
        .slice(0, 3);

      return {
        key,
        name: String(s?.metadata?.name ?? key ?? 'Map'),
        imageUrl: String(s?.metadata?.imageUrl ?? ''),
        matchesPlayed: num(s?.stats?.matchesPlayed?.value),
        matchesWon: num(s?.stats?.matchesWon?.value),
        matchesLost: num(s?.stats?.matchesLost?.value),
        winPct: num(s?.stats?.matchesWinPct?.value),
        kd: num(s?.stats?.kDRatio?.value),
        adr: num(s?.stats?.damagePerRound?.value),
        acs: num(s?.stats?.scorePerRound?.value),
        damageDeltaPerRound: Math.round(num(s?.stats?.damageDeltaPerRound?.value)),

        kills: num(s?.stats?.kills?.value),
        deaths: num(s?.stats?.deaths?.value),
        assists: num(s?.stats?.assists?.value),
        headshotsPct: num(s?.stats?.headshotsPercentage?.value),
        timePlayedSeconds: num(s?.stats?.timePlayed?.value),

        aces: num(s?.stats?.aces?.value),
        clutches: num(s?.stats?.clutches?.value),
        thrifty: num(s?.stats?.thrifty?.value),
        flawless: num(s?.stats?.flawless?.value),
        plants: num(s?.stats?.plants?.value),
        defuses: num(s?.stats?.defuses?.value),

        attackKills: num(s?.stats?.attackKills?.value),
        attackDeaths: num(s?.stats?.attackDeaths?.value),
        attackAssists: num(s?.stats?.attackAssists?.value),
        attackRoundsWinPct: num(s?.stats?.attackRoundsWinPct?.value),

        defenseKills: num(s?.stats?.defenseKills?.value),
        defenseDeaths: num(s?.stats?.defenseDeaths?.value),
        defenseAssists: num(s?.stats?.defenseAssists?.value),
        defenseRoundsWinPct: num(s?.stats?.defenseRoundsWinPct?.value),

        topAgents,
      };
    })
    .filter((m: TrnMapStat) => m.matchesPlayed > 0)
    .sort((a: TrnMapStat, b: TrnMapStat) => b.winPct - a.winPct);
}

