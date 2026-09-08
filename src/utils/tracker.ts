import { invoke } from '@tauri-apps/api/core';
import type { LocalRiotAccount, TrackerProfile } from '../types';
import { isTauri } from './ipc';

const API = 'https://api.henrikdev.xyz';

const err = async (res: Response): Promise<never> => {
  if (res.status === 404) throw new Error('Riot ID not found or profile is private.');
  if (res.status === 401) throw new Error('Bad/missing API key — paste a HenrikDev key in settings.');
  if (res.status === 429) throw new Error('Tracker rate-limited — wait a minute and retry.');
  throw new Error(`Tracker error ${res.status}.`);
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
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: apiKey } });
  } catch {
    throw new Error('Tracker unreachable — check your connection.');
  }
  if (!res.ok) await err(res);
  const j = await res.json().catch(() => ({}));
  const d = j?.data ?? {};
  const cur = d.current ?? {};
  const peak = d.peak ?? {};
  const seasonal = Array.isArray(d.seasonal) ? d.seasonal : [];
  return {
    name,
    tag,
    region,
    rank: String(cur.tier?.name ?? 'Unrated'),
    rr: Number(cur.rr ?? 0),
    peak: String(peak.tier?.name ?? '—'),
    wins: seasonal.reduce((n: number, s: { wins?: number }) => n + Number(s.wins ?? 0), 0),
    games: seasonal.reduce((n: number, s: { games?: number }) => n + Number(s.games ?? 0), 0),
  };
}
