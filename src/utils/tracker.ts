import { invoke } from '@tauri-apps/api/core';
import type { LocalRiotAccount, TrackerDuel, TrackerMatch, TrackerMatchDetail, TrackerMmrPoint, TrackerPlayer, TrackerProfile } from '../types';
import { isTauri } from './ipc';

const API = 'https://api.henrikdev.xyz';
const CACHE_TTL_MS = 10 * 60 * 1000;

const err = async (res: Response): Promise<never> => {
  if (res.status === 404) throw new Error('Riot ID not found or profile is private.');
  if (res.status === 401) throw new Error('Bad/missing API key — paste a HenrikDev key in settings.');
  if (res.status === 429) throw new Error('Tracker rate-limited — wait a minute and retry.');
  throw new Error(`Tracker error ${res.status}.`);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with one retry on 429. Key goes in the Authorization header. */
async function getJson(url: string, apiKey: string): Promise<unknown> {
  const doFetch = async (): Promise<Response> => {
    try {
      return await fetch(url, { headers: { Authorization: apiKey } });
    } catch {
      throw new Error('Tracker unreachable — check your connection.');
    }
  };
  let res = await doFetch();
  if (res.status === 429) {
    await sleep(Number(res.headers.get('Retry-After') ?? 5) * 1000);
    res = await doFetch();
  }
  if (!res.ok) await err(res);
  return res.json().catch(() => ({}));
}

const readCache = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_TTL_MS) return null;
    return data as T;
  } catch {
    return null;
  }
};

const writeCache = (key: string, data: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {}
};

/** Logged-in Riot account from the local client. Throws when the client is closed. */
export async function detectLocalAccount(): Promise<LocalRiotAccount> {
  if (!isTauri()) throw new Error('Auto-detect needs the desktop app.');
  try {
    return await invoke<LocalRiotAccount>('detect_local_account');
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : 'Auto-detect failed — enter your Riot ID manually.');
  }
}

/** Current rank + RR + peak. Defensive parse — unofficial API drifts. */
export async function fetchMmr(
  region: string,
  name: string,
  tag: string,
  apiKey: string
): Promise<TrackerProfile> {
  const url = `${API}/valorant/v3/mmr/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await getJson(url, apiKey)) as any;
  const d = j?.data ?? {};
  const cur = d.current ?? {};
  const peak = d.peak ?? {};
  const seasonal: { wins?: number; games?: number }[] = Array.isArray(d.seasonal) ? d.seasonal : [];
  return {
    name,
    tag,
    region,
    puuid: String(d.account?.puuid ?? ''),
    rank: String(cur.tier?.name ?? 'Unrated'),
    rr: Number(cur.rr ?? 0),
    peak: String(peak.tier?.name ?? '—'),
    wins: seasonal.reduce((n: number, s) => n + Number(s.wins ?? 0), 0),
    games: seasonal.reduce((n: number, s) => n + Number(s.games ?? 0), 0),
  };
}

/** Last N matches, cached 10 min. ACS = score / rounds played. */
export async function fetchMatchHistory(
  region: string,
  name: string,
  tag: string,
  apiKey: string,
  size = 20
): Promise<TrackerMatch[]> {
  const cacheKey = `aspect_tracker_hist_${region}_${name}_${tag}_${size}`;
  const hit = readCache<TrackerMatch[]>(cacheKey);
  if (hit) return hit;

  const url = `${API}/valorant/v1/stored-matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=${size}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await getJson(url, apiKey)) as any;
  const list: unknown[] = Array.isArray(j?.data) ? j.data : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: TrackerMatch[] = list.map((m: any) => {
    const meta = m?.meta ?? {};
    const st = m?.stats ?? {};
    const teams = m?.teams ?? {};
    const shots = st.shots ?? {};
    const dmg = st.damage ?? {};
    const myTeam: string = st.team ?? '';
    const us = Number(teams[myTeam?.toLowerCase()] ?? 0);
    const them = Number(teams[myTeam?.toLowerCase() === 'blue' ? 'red' : 'blue'] ?? 0);
    const rounds = us + them;
    const head = Number(shots.head ?? 0);
    const body = Number(shots.body ?? 0);
    const leg = Number(shots.leg ?? 0);
    const fired = head + body + leg;
    return {
      id: String(meta.id ?? ''),
      map: String(meta.map?.name ?? '?'),
      mode: String(meta.mode ?? '?'),
      agent: String(st.character?.name ?? '?'),
      result: (us > them ? 'win' : us < them ? 'loss' : 'draw') as TrackerMatch['result'],
      scoreUs: us,
      scoreThem: them,
      kills: Number(st.kills ?? 0),
      deaths: Number(st.deaths ?? 0),
      assists: Number(st.assists ?? 0),
      acs: rounds > 0 ? Math.round(Number(st.score ?? 0) / rounds) : 0,
      hsPct: fired > 0 ? Math.round((head / fired) * 100) : 0,
      startedAt: String(meta.started_at ?? ''),
      damage: Number(dmg.made ?? 0),
    };
  }).filter((m) => m.id);
  writeCache(cacheKey, out);
  return out;
}

/** RR movement per recent game, for the trend chart. Cached 10 min. */
export async function fetchMmrHistory(
  region: string,
  name: string,
  tag: string,
  apiKey: string
): Promise<TrackerMmrPoint[]> {
  const cacheKey = `aspect_tracker_mmrh_${region}_${name}_${tag}`;
  const hit = readCache<TrackerMmrPoint[]>(cacheKey);
  if (hit) return hit;

  const url = `${API}/valorant/v1/mmr-history/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await getJson(url, apiKey)) as any;
  const list: unknown[] = Array.isArray(j?.data) ? j.data : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: TrackerMmrPoint[] = (list as any[]).map((g) => ({
    tier: String(g?.currenttierpatched ?? '?'),
    rr: Number(g?.ranking_in_tier ?? 0),
    change: Number(g?.mmr_change_to_last_game ?? 0),
    matchId: String(g?.match_id ?? ''),
  }));
  writeCache(cacheKey, out);
  return out;
}

/** Full match: rounds, all 10 players, kill feed with timings. Cached 10 min. */
export async function fetchMatchDetail(matchId: string, apiKey: string): Promise<TrackerMatchDetail> {
  const cacheKey = `aspect_tracker_match_${matchId}`;
  const hit = readCache<TrackerMatchDetail>(cacheKey);
  if (hit) return hit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await getJson(`${API}/valorant/v2/match/${matchId}`, apiKey)) as any;
  const d = j?.data ?? {};
  const all = d?.players?.all_players ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players: TrackerPlayer[] = (Array.isArray(all) ? all : []).map((p: any) => ({
    puuid: String(p?.puuid ?? ''),
    name: String(p?.name ?? '?'),
    tag: String(p?.tag ?? ''),
    team: String(p?.team ?? ''),
    agent: String(p?.character ?? '?'),
    kills: Number(p?.stats?.kills ?? 0),
    deaths: Number(p?.stats?.deaths ?? 0),
    assists: Number(p?.stats?.assists ?? 0),
    damage: Number(p?.damage_made ?? 0),
    score: Number(p?.stats?.score ?? 0),
    headshots: Number(p?.stats?.headshots ?? 0),
    bodyshots: Number(p?.stats?.bodyshots ?? 0),
    legshots: Number(p?.stats?.legshots ?? 0),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rounds = (Array.isArray(d?.rounds) ? d.rounds : []).map((r: any) => ({
    winningTeam: String(r?.winning_team ?? ''),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kills: TrackerDuel[] = (Array.isArray(d?.kills) ? d.kills : []).map((k: any) => ({
    round: Number(k?.round ?? 0),
    killerPuuid: String(k?.killer_puuid ?? ''),
    victimPuuid: String(k?.victim_puuid ?? ''),
    killerTeam: String(k?.killer_team ?? ''),
    victimTeam: String(k?.victim_team ?? ''),
    timeInRound: Number(k?.kill_time_in_round ?? 0),
  }));
  const out = { rounds, players, kills, mapId: '' };
  writeCache(cacheKey, out);
  return out;
}

/* ---------------- keyless direct path (local client, no API key) ---------------- */

interface DirectEnt {
  access_token: string;
  entitlements: string;
  puuid: string;
}

let entCache: { at: number; ent: DirectEnt } | null = null;

/** Tier id → name fallback when only the number arrives. */
const tierName = (id: number): string => {
  if (id >= 27) return 'Radiant';
  if (id < 3) return 'Unrated';
  const tiers = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal'];
  return `${tiers[Math.floor((id - 3) / 3)]} ${((id - 3) % 3) + 1}`;
};

const normTeam = (t: unknown): string => {
  const s = String(t ?? '').toLowerCase();
  if (s === 'blue') return 'Blue';
  if (s === 'red') return 'Red';
  return String(t ?? '');
};

const platformBlob = (): string => {
  try {
    return btoa(
      JSON.stringify({
        platformType: 'PC',
        platformOS: 'Windows',
        platformOSVersion: '10.0.19042.1.256.64bit',
        platformChipset: 'Unknown',
      })
    );
  } catch {
    return '';
  }
};

const shardFor = (region: string): string =>
  (
    {
      eu: 'pd.eu.a.pvp.net',
      na: 'pd.na.a.pvp.net',
      ap: 'pd.ap.a.pvp.net',
      br: 'pd.br.a.pvp.net',
      latam: 'pd.latam.a.pvp.net',
      kr: 'pd.kr.a.pvp.net',
    } as Record<string, string>
  )[region] ?? 'pd.eu.a.pvp.net';

export async function getEntitlements(): Promise<DirectEnt> {
  if (entCache && Date.now() - entCache.at < 45 * 60 * 1000) return entCache.ent;
  if (!isTauri()) throw new Error('Direct mode needs the desktop app.');
  const ent = await invoke<DirectEnt>('local_entitlements');
  if (!ent.access_token) throw new Error('No active session — log into the Riot Client first.');
  entCache = { at: Date.now(), ent };
  return ent;
}

export const clearEntitlements = (): void => {
  entCache = null;
};

/** Authed Riot GET from Rust (browser origins are blocked). Refetches entitlements once on expiry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function riotGet(host: string, path: string): Promise<any> {
  const call = async (e: DirectEnt): Promise<string> => {
    let version = '';
    try {
      version = await invoke<string>('local_client_version');
    } catch {}
    return invoke<string>('riot_direct_get', {
      host,
      path,
      accessToken: e.access_token,
      entitlements: e.entitlements,
      clientPlatform: platformBlob(),
      clientVersion: version,
    });
  };
  try {
    return JSON.parse(await call(await getEntitlements()));
  } catch (e) {
    if (String(e).includes('RIOT_EXPIRED')) {
      clearEntitlements();
      return JSON.parse(await call(await getEntitlements()));
    }
    throw e;
  }
}

let agentMapMem: Record<string, string> | null = null;

/** uuid → display name for agents AND maps (public valorant-api.com, cached 30 days). */
export async function gameData(): Promise<{ agents: Record<string, string>; maps: Record<string, string> }> {
  if (agentMapMem && mapMem) return { agents: agentMapMem, maps: mapMem };
  try {
    const raw = localStorage.getItem('aspect_game_data');
    if (raw) {
      const { savedAt, data } = JSON.parse(raw);
      if (Date.now() - savedAt < 30 * 24 * 3600 * 1000 && data?.agents) {
        agentMapMem = data.agents;
        mapMem = data.maps ?? {};
        return { agents: agentMapMem!, maps: mapMem! };
      }
    }
  } catch {}
  const agents = await agentMap();
  let maps: Record<string, string> = {};
  try {
    const j = await fetch('https://valorant-api.com/v1/maps').then((r) => r.json());
    for (const m of j?.data ?? []) {
      if (m?.mapUrl && m?.displayName) {
        maps[String(m.mapUrl).toLowerCase()] = m.displayName;
        if (m?.uuid) maps[String(m.uuid).toLowerCase()] = m.displayName;
      }
    }
    localStorage.setItem(
      'aspect_game_data',
      JSON.stringify({ savedAt: Date.now(), data: { agents, maps } })
    );
  } catch {}
  mapMem = maps;
  return { agents, maps };
}

let mapMem: Record<string, string> | null = null;

/** Convert a direct-API detail into a history row (needs my puuid + queue label). */
export function toHistoryRow(
  detail: TrackerMatchDetail,
  id: string,
  puuid: string,
  queue: string,
  when: number,
  amap: Record<string, string>
): TrackerMatch | null {
  const me = detail.players.find((p) => p.puuid === puuid);
  if (!me) return null;
  const myTeam = me.team;
  const us = detail.rounds.filter((r) => r.winningTeam === myTeam).length;
  const them = detail.rounds.length - us;
  const rounds = detail.rounds.length;
  const fired = me.headshots + me.bodyshots + me.legshots;
  const q = queue.trim().toLowerCase();
  const mode = q === 'competitive' ? 'Competitive' : q === 'unrated' ? 'Unrated' : q ? q[0].toUpperCase() + q.slice(1) : '?';
  return {
    id,
    map: amap[detail.mapId.toLowerCase()] ?? (detail.mapId.split('/').pop() || '?'),
    mode,
    agent: me.agent,
    result: us > them ? 'win' : us < them ? 'loss' : 'draw',
    scoreUs: us,
    scoreThem: them,
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    acs: rounds > 0 ? Math.round(me.score / rounds) : 0,
    hsPct: fired > 0 ? Math.round((me.headshots / fired) * 100) : 0,
    damage: me.damage,
    startedAt: when ? new Date(when).toISOString() : '',
  };
}
/** uuid → display name via public valorant-api.com, cached 30 days. */
export async function agentMap(): Promise<Record<string, string>> {
  if (agentMapMem) return agentMapMem;
  try {
    const raw = localStorage.getItem('aspect_agent_map');
    if (raw) {
      const { savedAt, data } = JSON.parse(raw);
      if (Date.now() - savedAt < 30 * 24 * 3600 * 1000) {
        agentMapMem = data;
        return data;
      }
    }
  } catch {}
  const map: Record<string, string> = {};
  try {
    const j = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true').then((r) => r.json());
    for (const a of j?.data ?? []) {
      if (a?.uuid && a?.displayName) map[String(a.uuid).toLowerCase()] = a.displayName;
    }
    localStorage.setItem('aspect_agent_map', JSON.stringify({ savedAt: Date.now(), data: map }));
  } catch {}
  agentMapMem = map;
  return map;
}

/** Rank + RR straight from Riot. No key, needs the client open. */
export async function fetchMmrDirect(region: string): Promise<TrackerProfile> {
  const ent = await getEntitlements();
  const j = await riotGet(shardFor(region), `/mmr/v1/players/${ent.puuid}`);
  const tierId = Number(j?.currenttier ?? 0);
  return {
    name: '',
    tag: '',
    region,
    puuid: ent.puuid,
    rank: String(j?.currenttierpatched ?? tierName(tierId)),
    rr: Number(j?.ranking_in_tier ?? 0),
    peak: String(j?.highest_rank_patched ?? ''),
    wins: 0,
    games: 0,
  };
}

/** RR trend straight from Riot competitive updates. */
export async function fetchCompetitiveUpdates(region: string, count = 20): Promise<TrackerMmrPoint[]> {
  const ent = await getEntitlements();
  const j = await riotGet(
    shardFor(region),
    `/mmr/v1/players/${ent.puuid}/competitiveupdates?startIndex=0&endIndex=${count}`
  );
  const list = Array.isArray(j?.Matches) ? j.Matches : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return list.map((g: any) => ({
    tier: String(g?.TierPatchedAfterUpdate ?? tierName(Number(g?.TierAfterUpdate ?? 0))),
    rr: Number(g?.RankedRatingAfterUpdate ?? 0),
    change: Number(g?.RankedRatingEarned ?? 0),
    matchId: String(g?.MatchID ?? ''),
  }));
}

/** Recent match IDs (head of history). Details load lazily per match. */
export async function fetchHistoryIds(
  region: string,
  start: number,
  count: number
): Promise<{ total: number; ids: { id: string; when: number; queue: string }[] }> {
  const ent = await getEntitlements();
  const j = await riotGet(
    shardFor(region),
    `/match-history/v1/history/${ent.puuid}?startIndex=${start}&endIndex=${start + count}`
  );
  const h = Array.isArray(j?.History) ? j.History : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    total: Number(j?.Total ?? 0),
    ids: h
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((x: any) => ({
        id: String(x?.MatchID ?? ''),
        when: Number(x?.GameStartTimeMS ?? 0),
        queue: String(x?.QueueID ?? ''),
      }))
      .filter((x: { id: string }) => x.id),
  };
}

/** Full match straight from Riot. Throws when the payload is unusable (caller falls back). */
export async function fetchMatchDetailDirect(region: string, matchId: string): Promise<TrackerMatchDetail> {
  const j = await riotGet(shardFor(region), `/match/v1/matches/${matchId}`);
  const { agents: amap } = await gameData();
  const teamOf = (puuid: string, list: TrackerPlayer[]): string =>
    list.find((p) => p.puuid === puuid)?.team ?? '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players: TrackerPlayer[] = ((Array.isArray(j?.players) ? j.players : []) as any[]).map((p) => {
    const st = p?.stats ?? {};
    return {
      puuid: String(p?.subject ?? p?.puuid ?? ''),
      name: String(p?.gameName ?? p?.name ?? '?'),
      tag: String(p?.tagLine ?? p?.tag ?? ''),
      team: normTeam(p?.teamId ?? p?.team),
      agent: amap[String(p?.characterId ?? p?.character ?? '').toLowerCase()] ?? 'Agent',
      kills: Number(st.kills ?? 0),
      deaths: Number(st.deaths ?? 0),
      assists: Number(st.assists ?? 0),
      damage: Number(p?.damageMade ?? st.damage ?? 0),
      score: Number(st.score ?? 0),
      headshots: Number(st.headshots ?? 0),
      bodyshots: Number(st.bodyshots ?? 0),
      legshots: Number(st.legshots ?? 0),
    };
  });
  if (players.length === 0) throw new Error('Empty scoreboard.');

  const roundsSrc: unknown[] = Array.isArray(j?.roundResults)
    ? j.roundResults
    : Array.isArray(j?.rounds)
      ? j.rounds
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rounds = (roundsSrc as any[]).map((r) => ({
    winningTeam: normTeam(r?.winningTeam ?? r?.winning_team),
  }));

  // Duels: prefer per-round player kill lists (carries round numbers),
  // fall back to a flat kills array when present.
  const kills: TrackerDuel[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (roundsSrc as any[]).forEach((r, i) => {
    const num = Number(r?.roundNum ?? i);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pstats: any[] = Array.isArray(r?.playerStats) ? r.playerStats : [];
    for (const ps of pstats) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kl: any[] = Array.isArray(ps?.kills) ? ps.kills : [];
      for (const k of kl) {
        kills.push({
          round: num,
          killerPuuid: String(ps?.subject ?? k?.killer ?? ''),
          victimPuuid: String(k?.victim ?? k?.victimSubject ?? ''),
          killerTeam: '',
          victimTeam: '',
          timeInRound: Number(k?.roundTimeMillis ?? k?.gameTimeMillis ?? 0),
        });
      }
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flat: any[] = Array.isArray(j?.kills) ? j.kills : [];
  for (const k of flat) {
    kills.push({
      round: Number(k?.round ?? -1),
      killerPuuid: String(k?.killer_puuid ?? k?.killer ?? ''),
      victimPuuid: String(k?.victim_puuid ?? k?.victim ?? ''),
      killerTeam: normTeam(k?.killer_team ?? k?.killerTeam),
      victimTeam: normTeam(k?.victim_team ?? k?.victimTeam),
      timeInRound: Number(k?.kill_time_in_round ?? k?.roundTimeMillis ?? 0),
    });
  }
  for (const k of kills) {
    if (!k.killerTeam) k.killerTeam = teamOf(k.killerPuuid, players);
    if (!k.victimTeam) k.victimTeam = teamOf(k.victimPuuid, players);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mi: any = (j as any)?.matchInfo ?? {};
  const mapId = String(mi.mapId ?? mi.map ?? '');
  return { rounds, players, kills, mapId };
}
