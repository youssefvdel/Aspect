import { invoke } from '@tauri-apps/api/core';
import type { LocalRiotAccount, TrackerDuel, TrackerMatchDetail, TrackerMmrPoint, TrackerPlayer, TrackerProfile } from '../types';
import { isTauri } from './ipc';

/* Keyless tracker: everything comes straight from Riot using the local
   client's own session. No API keys, no third party. Needs Riot Client open.
   Proven live shapes (2026-09-08/09), same endpoints TRN/Blitz call locally:
   - mmr: { LatestCompetitiveUpdate: {...}, QueueSkills: { competitive: { SeasonalInfoBySeasonID } } }
   - competitiveupdates: { Matches: [{ MatchID, MapID, MatchStartTime, TierAfterUpdate, RankedRatingAfterUpdate, RankedRatingEarned }] }
   - history: { Total, History: [{ MatchID, GameStartTime, QueueID }] }
   - match-details/v1/matches/{id}: { matchInfo, players[] (subject/teamId/characterId/stats/roundDamage), teams[], roundResults[] } */

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
export const tierName = (id: number): string => {
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

let cachedVersion: string | null = null;

/** Client version Riot demands in headers. Log scrape first, public API fallback
    (log only exists after the game itself has launched once). */
async function resolveVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  try {
    const v = await invoke<string>('local_client_version');
    if (v && v.includes('shipping')) {
      cachedVersion = v;
      return v;
    }
  } catch {}
  try {
    const j = await fetch('https://valorant-api.com/v1/version').then((r) => r.json());
    const v = String(j?.data?.riotClientVersion ?? '');
    if (v) {
      cachedVersion = v;
      return v;
    }
  } catch {}
  return '';
}

/** Authed Riot GET from Rust (browser origins are blocked). Refetches entitlements once on expiry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function riotGet(host: string, path: string): Promise<any> {
  const call = async (e: DirectEnt): Promise<string> => {
    const version = await resolveVersion();
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

let gameDataMem: { agents: Record<string, string>; maps: Record<string, string>; seasons: Record<string, string>; seasonOrder: string[]; tierIcons: Record<number, string> } | null = null;

const GAME_DATA_KEY = 'aspect_game_data_v3';

/** Static Riot metadata via public valorant-api.com, cached 30 days. */
export async function gameData(): Promise<{ agents: Record<string, string>; maps: Record<string, string>; seasons: Record<string, string>; seasonOrder: string[]; tierIcons: Record<number, string> }> {
  if (gameDataMem) return gameDataMem;
  try {
    const raw = localStorage.getItem(GAME_DATA_KEY);
    if (raw) {
      const { savedAt, data } = JSON.parse(raw);
      if (Date.now() - savedAt < 30 * 24 * 3600 * 1000 && data?.agents && data?.tierIcons) {
        gameDataMem = { agents: data.agents, maps: data.maps ?? {}, seasons: data.seasons ?? {}, seasonOrder: data.seasonOrder ?? [], tierIcons: data.tierIcons };
        return gameDataMem;
      }
    }
  } catch {}
  const agents: Record<string, string> = {};
  const maps: Record<string, string> = {};
  const seasons: Record<string, string> = {};
  let seasonOrder: string[] = [];
  const tierIcons: Record<number, string> = {};
  try {
    const [aj, mj, cs, sn, ct] = await Promise.all([
      fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/maps').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/seasons/competitive').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/seasons').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/competitivetiers').then((r) => r.json()),
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
    // competitive uuid → "V26 · ACT V": episode from asset path, act from season name.
    const names: Record<string, string> = {};
    for (const s of sn?.data ?? []) {
      if (s?.uuid && s?.displayName) names[String(s.uuid).toLowerCase()] = s.displayName;
    }
    const compList = Array.isArray(cs?.data) ? cs.data : [];
    for (const c of compList) {
      const cuuid = String(c?.uuid ?? '').toLowerCase();
      const suuid = String(c?.seasonUuid ?? '').toLowerCase();
      if (!cuuid && !suuid) continue;
      const act = names[suuid] ?? '';
      const ep = /Episode(V\d+)/i.exec(String(c?.assetPath ?? ''))?.[1] ?? '';
      const label = [ep, act].filter(Boolean).join(' · ') || 'Season';
      // Riot keys player seasons by the SEASON uuid (SeasonID), not the
      // competitive uuid — index both so lookups always hit.
      if (cuuid) seasons[cuuid] = label;
      if (suuid) seasons[suuid] = label;
    }
    seasonOrder = compList
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .slice().sort((a: any, b: any) => String(b?.endTime ?? '').localeCompare(String(a?.endTime ?? '')))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => String(c?.seasonUuid ?? c?.uuid ?? '').toLowerCase()).filter(Boolean);
    // newest tier set wins; tier id matches Riot's numbering 0–27.
    const sets = Array.isArray(ct?.data) ? ct.data : [];
    const tiers = sets.length > 0 ? sets[sets.length - 1]?.tiers ?? [] : [];
    for (const t of tiers) {
      const id = Number(t?.tier);
      if (Number.isInteger(id) && t?.largeIcon) tierIcons[id] = String(t.largeIcon);
    }
    localStorage.setItem(GAME_DATA_KEY, JSON.stringify({ savedAt: Date.now(), data: { agents, maps, seasons, seasonOrder, tierIcons } }));
  } catch {}
  gameDataMem = { agents, maps, seasons, seasonOrder, tierIcons };
  return gameDataMem;
}

/** Last path segment of a /Game/Maps/X/X id, for maps valorant-api.com doesn't know yet. */
export const shortMapName = (mapId: string, maps: Record<string, string>): string =>
  maps[mapId.toLowerCase()] ?? (mapId.split('/').pop() || '?');

/** Rank + RR + peak + per-season peaks straight from Riot. */
export async function fetchMmrDirect(region: string, name: string, tag: string): Promise<TrackerProfile> {
  const ent = await getEntitlements();
  const j = await riotGet(shardFor(region), `/mmr/v1/players/${ent.puuid}`);
  const latest = j?.LatestCompetitiveUpdate ?? {};
  const currentSeasonId = String(latest?.SeasonID ?? '').toLowerCase();
  const seasons = j?.QueueSkills?.competitive?.SeasonalInfoBySeasonID ?? {};
  let wins = 0;
  let games = 0;
  let peakTier = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const per: { id: string; games: number; wins: number; tier: number }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [id, s] of Object.entries(seasons) as [string, any][]) {
    const g = Number(s?.NumberOfGames ?? 0);
    const t = Number(s?.CompetitiveTier ?? 0);
    per.push({ id, games: g, wins: Number(s?.NumberOfWins ?? 0), tier: t });
    if (g >= games) {
      games = g;
      wins = Number(s?.NumberOfWins ?? 0);
    }
    peakTier = Math.max(peakTier, t);
  }
  const tierId = Number(latest?.TierAfterUpdate ?? 0);
  // Wins/games belong to the CURRENT act (Riot tells us which). Fall back to busiest.
  if (currentSeasonId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (Object.entries(seasons) as [string, any][]).find(([id]) => String(id).toLowerCase() === currentSeasonId)?.[1];
    if (cur && Number(cur?.NumberOfGames ?? 0) > 0) {
      games = Number(cur.NumberOfGames);
      wins = Number(cur?.NumberOfWins ?? 0);
    }
  }
  return {
    name,
    tag,
    region,
    puuid: ent.puuid,
    rank: tierName(tierId),
    tier: tierId,
    rr: Number(latest?.RankedRatingAfterUpdate ?? 0),
    peak: peakTier > 0 ? tierName(peakTier) : '—',
    wins,
    games,
    currentSeasonId,
    seasons: per.filter((s) => s.games > 0).sort((a, b) => b.games - a.games),
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

const normTeam = (t: unknown): string => {
  const s = String(t ?? '').toLowerCase();
  if (s === 'blue') return 'Blue';
  if (s === 'red') return 'Red';
  return String(t ?? '');
};

/**
 * Full match straight from Riot via the SAME endpoint TRN/Blitz call locally
 * (match-details/v1 — the singular /match/v1 path 503s for client creds).
 * Immutable → cached forever. Throws when unusable.
 * Proven shape: { matchInfo{mapId,queueID,gameStartMillis}, players[{subject,teamId,
 * characterId,stats{kills,deaths,assists,score,roundsPlayed},roundDamage[{damage}]}],
 * teams[{teamId,roundsWon}], roundResults[{roundNum,winningTeam,playerStats[{subject,kills[{killer,victim,roundTime}]}]}] }
 * NOTE: gameName/tagLine are empty (privacy) and kills carry no headshot flag —
 * names show as agent, HS% stays live-only.
 */
export async function fetchMatchDetailDirect(region: string, matchId: string): Promise<TrackerMatchDetail> {
  const cacheKey = `aspect_match_v1_${matchId}`;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw) as TrackerMatchDetail;
  } catch {}
  const j = await riotGet(shardFor(region), `/match-details/v1/matches/${matchId}`);
  const { agents: amap } = await gameData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players: TrackerPlayer[] = ((Array.isArray(j?.players) ? j.players : []) as any[]).map((p) => {
    const st = p?.stats ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dmg = (Array.isArray(p?.roundDamage) ? p.roundDamage : []).reduce((n: number, r: any) => n + Number(r?.damage ?? 0), 0);
    return {
      puuid: String(p?.subject ?? ''),
      name: '',
      tag: '',
      team: normTeam(p?.teamId),
      agent: amap[String(p?.characterId ?? '').toLowerCase()] ?? 'Agent',
      kills: Number(st.kills ?? 0),
      deaths: Number(st.deaths ?? 0),
      assists: Number(st.assists ?? 0),
      damage: dmg,
      score: Number(st.score ?? 0),
      rounds: Number(st.roundsPlayed ?? 0),
      headshots: 0,
      bodyshots: 0,
      legshots: 0,
    };
  });
  if (players.length === 0) throw new Error('Empty scoreboard.');
  const teamOf = (puuid: string): string => players.find((p) => p.puuid === puuid)?.team ?? '';
  // Team scores come straight from the payload — no round counting needed.
  const teamScore: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (Array.isArray(j?.teams) ? j.teams : []) as any[]) {
    teamScore[normTeam(t?.teamId)] = Number(t?.roundsWon ?? 0);
  }
  const roundsSrc: unknown[] = Array.isArray(j?.roundResults) ? j.roundResults : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rounds = (roundsSrc as any[]).map((r) => ({ winningTeam: normTeam(r?.winningTeam) }));
  const kills: TrackerDuel[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (roundsSrc as any[]).forEach((r) => {
    const num = Number(r?.roundNum ?? 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pstats: any[] = Array.isArray(r?.playerStats) ? r.playerStats : [];
    for (const ps of pstats) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kl: any[] = Array.isArray(ps?.kills) ? ps.kills : [];
      for (const k of kl) {
        const kp = String(k?.killer ?? ps?.subject ?? '');
        const vp = String(k?.victim ?? '');
        kills.push({
          round: num,
          killerPuuid: kp,
          victimPuuid: vp,
          killerTeam: teamOf(kp),
          victimTeam: teamOf(vp),
          timeInRound: Number(k?.roundTime ?? 0),
        });
      }
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mi: any = (j as any)?.matchInfo ?? {};
  const out: TrackerMatchDetail = {
    rounds,
    players,
    kills,
    mapId: String(mi.mapId ?? ''),
    teamScore,
    queue: String(mi.queueID ?? ''),
    when: Number(mi.gameStartMillis ?? 0),
  };
  try {
    localStorage.setItem(cacheKey, JSON.stringify(out));
  } catch {}
  return out;
}

export interface AggStats {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  rounds: number;
  matches: number;
  kd: number;
  adr: number;
}

/** Aggregate K/D/ADR over a set of matches (details cached forever, repeats are free). */
export async function aggregateDetails(
  region: string,
  matchIds: string[],
  puuid: string
): Promise<{ agg: AggStats; byId: Record<string, TrackerMatchDetail> }> {
  const byId: Record<string, TrackerMatchDetail> = {};
  await Promise.all(
    matchIds.map(async (id) => {
      try {
        byId[id] = await fetchMatchDetailDirect(region, id);
      } catch {}
    })
  );
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let damage = 0;
  let rounds = 0;
  let matches = 0;
  for (const id of matchIds) {
    const me = byId[id]?.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    matches++;
    kills += me.kills;
    deaths += me.deaths;
    assists += me.assists;
    damage += me.damage;
    rounds += me.rounds;
  }
  return {
    agg: {
      kills,
      deaths,
      assists,
      damage,
      rounds,
      matches,
      kd: deaths > 0 ? kills / deaths : kills,
      adr: rounds > 0 ? damage / rounds : 0,
    },
    byId,
  };
}
