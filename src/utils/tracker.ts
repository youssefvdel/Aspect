import { invoke } from '@tauri-apps/api/core';
import type { LocalRiotAccount, TrackerMmrPoint, TrackerProfile } from '../types';
import { isTauri } from './ipc';

/* Keyless tracker: everything comes straight from Riot using the local
   client's own session. No API keys, no third party. Needs Riot Client open.
   Proven live shapes (2026-09-08):
   - mmr: { LatestCompetitiveUpdate: {TierAfterUpdate, RankedRatingAfterUpdate, ...},
             QueueSkills: { competitive: { SeasonalInfoBySeasonID: { id: {NumberOfWins, NumberOfGames, CompetitiveTier} } } } }
   - competitiveupdates: { Matches: [{ MatchID, MapID, QueueID?, MatchStartTime, TierAfterUpdate, RankedRatingAfterUpdate, RankedRatingEarned }] }
   - history: { Total, History: [{ MatchID, GameStartTime, QueueID }] }
   NOTE: /match/v1/matches/{id} 503s for client creds on every host —
   past-match scoreboards are unreachable without a server key. */

/** Logged-in Riot account from the local client. Throws when the client is closed. */
export async function detectLocalAccount(): Promise<LocalRiotAccount> {
  if (!isTauri()) throw new Error('Auto-detect needs the desktop app.');
  try {
    const acc = await invoke<LocalRiotAccount>('detect_local_account');
    let name = acc.game_name ?? '';
    let tag = acc.tagline ?? '';
    if (!tag && name.includes('#')) {
      const i = name.lastIndexOf('#');
      tag = name.slice(i + 1);
      name = name.slice(0, i);
    }
    return { ...acc, game_name: name, tagline: tag };
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : 'Auto-detect failed — is the Riot Client open?');
  }
}

/** Tier id → name fallback when only the number arrives. */
const tierName = (id: number): string => {
  if (id >= 27) return 'Radiant';
  if (id < 3) return 'Unrated';
  const tiers = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal'];
  return `${tiers[Math.floor((id - 3) / 3)]} ${((id - 3) % 3) + 1}`;
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

interface DirectEnt {
  access_token: string;
  entitlements: string;
  puuid: string;
}

let entCache: { at: number; ent: DirectEnt } | null = null;

export async function getEntitlements(): Promise<DirectEnt> {
  if (entCache && Date.now() - entCache.at < 45 * 60 * 1000) return entCache.ent;
  if (!isTauri()) throw new Error('Tracker needs the desktop app.');
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

let gameDataMem: { agents: Record<string, string>; maps: Record<string, string> } | null = null;

/** Map/agent display names via public valorant-api.com, cached 30 days. */
export async function gameData(): Promise<{ agents: Record<string, string>; maps: Record<string, string> }> {
  if (gameDataMem) return gameDataMem;
  try {
    const raw = localStorage.getItem('aspect_game_data');
    if (raw) {
      const { savedAt, data } = JSON.parse(raw);
      if (Date.now() - savedAt < 30 * 24 * 3600 * 1000 && data?.agents) {
        gameDataMem = { agents: data.agents, maps: data.maps ?? {} };
        return gameDataMem;
      }
    }
  } catch {}
  const agents: Record<string, string> = {};
  const maps: Record<string, string> = {};
  try {
    const [aj, mj] = await Promise.all([
      fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/maps').then((r) => r.json()),
    ]);
    for (const a of aj?.data ?? []) {
      if (a?.uuid && a?.displayName) agents[String(a.uuid).toLowerCase()] = a.displayName;
    }
    for (const m of mj?.data ?? []) {
      if (m?.mapUrl && m?.displayName) {
        maps[String(m.mapUrl).toLowerCase()] = m.displayName;
        if (m?.uuid) maps[String(m.uuid).toLowerCase()] = m.displayName;
      }
    }
    localStorage.setItem('aspect_game_data', JSON.stringify({ savedAt: Date.now(), data: { agents, maps } }));
  } catch {}
  gameDataMem = { agents, maps };
  return gameDataMem;
}

/** Last path segment of a /Game/Maps/X/X id, for maps valorant-api.com doesn't know yet. */
export const shortMapName = (mapId: string, maps: Record<string, string>): string =>
  maps[mapId.toLowerCase()] ?? (mapId.split('/').pop() || '?');

/** Rank + RR + peak + wins/games straight from Riot. */
export async function fetchMmrDirect(region: string, name: string, tag: string): Promise<TrackerProfile> {
  const ent = await getEntitlements();
  const j = await riotGet(shardFor(region), `/mmr/v1/players/${ent.puuid}`);
  const latest = j?.LatestCompetitiveUpdate ?? {};
  const seasons = j?.QueueSkills?.competitive?.SeasonalInfoBySeasonID ?? {};
  let wins = 0;
  let games = 0;
  let peakTier = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of Object.values(seasons) as any[]) {
    const g = Number(s?.NumberOfGames ?? 0);
    if (g >= games) {
      games = g;
      wins = Number(s?.NumberOfWins ?? 0);
    }
    peakTier = Math.max(peakTier, Number(s?.CompetitiveTier ?? 0));
  }
  const tierId = Number(latest?.TierAfterUpdate ?? 0);
  return {
    name,
    tag,
    region,
    puuid: ent.puuid,
    rank: tierName(tierId),
    rr: Number(latest?.RankedRatingAfterUpdate ?? 0),
    peak: peakTier > 0 ? tierName(peakTier) : '—',
    wins,
    games,
  };
}

/** Last N competitive games with map, time, and RR earned — feeds rows AND trend. */
export async function fetchCompetitiveUpdates(region: string, count = 20): Promise<TrackerMmrPoint[]> {
  const ent = await getEntitlements();
  const j = await riotGet(
    shardFor(region),
    `/mmr/v1/players/${ent.puuid}/competitiveupdates?startIndex=0&endIndex=${count}`
  );
  const list = Array.isArray(j?.Matches) ? j.Matches : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return list.map((g: any) => ({
    tier: tierName(Number(g?.TierAfterUpdate ?? 0)),
    rr: Number(g?.RankedRatingAfterUpdate ?? 0),
    change: Number(g?.RankedRatingEarned ?? 0),
    matchId: String(g?.MatchID ?? ''),
    mapId: String(g?.MapID ?? ''),
    when: Number(g?.MatchStartTime ?? 0),
  }));
}

/** Find the account's shard: cached 7 days, else first shard that answers. */
export async function detectRegion(): Promise<string> {
  try {
    const raw = localStorage.getItem('aspect_tracker_shard');
    if (raw) {
      const { savedAt, region } = JSON.parse(raw);
      if (Date.now() - savedAt < 7 * 24 * 3600 * 1000 && region) return region;
    }
  } catch {}
  const ent = await getEntitlements();
  for (const r of ['eu', 'na', 'ap', 'br', 'latam', 'kr']) {
    try {
      const j = await riotGet(shardFor(r), `/mmr/v1/players/${ent.puuid}`);
      if (j?.LatestCompetitiveUpdate) {
        try {
          localStorage.setItem('aspect_tracker_shard', JSON.stringify({ savedAt: Date.now(), region: r }));
        } catch {}
        return r;
      }
    } catch {}
  }
  return 'eu';
}

/** Queue label + total match count (history entries are ID-only). */
export async function fetchHistoryMeta(
  region: string,
  start: number,
  count: number
): Promise<{ total: number; queueById: Record<string, string> }> {
  const ent = await getEntitlements();
  const j = await riotGet(
    shardFor(region),
    `/match-history/v1/history/${ent.puuid}?startIndex=${start}&endIndex=${start + count}`
  );
  const queueById: Record<string, string> = {};
  const h = Array.isArray(j?.History) ? j.History : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const x of h as any[]) {
    const id = String(x?.MatchID ?? '');
    if (id) queueById[id] = String(x?.QueueID ?? '');
  }
  return { total: Number(j?.Total ?? 0), queueById };
}

export const queueLabel = (q: string): string => {
  const s = q.trim().toLowerCase();
  if (s === 'competitive') return 'Competitive';
  if (s === 'unrated') return 'Unrated';
  if (s === 'deathmatch') return 'Deathmatch';
  if (s === 'spikerush') return 'Spike Rush';
  if (s === 'swiftplay') return 'Swiftplay';
  return s ? s[0].toUpperCase() + s.slice(1) : 'Custom';
};
