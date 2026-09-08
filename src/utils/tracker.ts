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
  const out = { rounds, players, kills };
  writeCache(cacheKey, out);
  return out;
}
