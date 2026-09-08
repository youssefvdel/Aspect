import type { TrackerProfile } from '../types';

const API = 'https://api.henrikdev.xyz';

const err = async (res: Response): Promise<never> => {
  if (res.status === 404) throw new Error('Riot ID not found or profile is private.');
  if (res.status === 429) throw new Error('Tracker rate-limited — wait a minute and retry.');
  throw new Error(`Tracker error ${res.status}.`);
};

/** Current rank + RR + peak. Defensive parse — unofficial API drifts. */
export async function fetchMmr(
  region: string,
  name: string,
  tag: string
): Promise<TrackerProfile> {
  const url = `${API}/valorant/v3/mmr/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Tracker unreachable — check your connection.');
  }
  if (!res.ok) await err(res);
  const j = await res.json().catch(() => ({}));
  const d = j?.data ?? {};
  const cur = d.current_data ?? {};
  const peak = d.highest_rank ?? {};
  return {
    name,
    tag,
    region,
    rank: String(cur.currenttierpatched ?? cur.tier ?? 'Unrated'),
    rr: Number(cur.ranking_in_tier ?? 0),
    peak: String(peak.patched ?? peak.tier ?? '—'),
    wins: 0, // aggregated client-side from history (Task 3)
    games: 0,
  };
}
