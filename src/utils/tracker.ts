import { invoke } from '@tauri-apps/api/core';
import type { LiveMatchPlayer, LiveMatchState, LocalRiotAccount, TrackerDuel, TrackerMatchDetail, TrackerMmrPoint, TrackerPlayer, TrackerProfile } from '../types';
import { isTauri } from './ipc';
import { getDevMockMatch, isDevNoClient } from './devTools';

/* Keyless tracker: everything comes straight from Riot using the local
   client's own session. No API keys, no third party. Needs Riot Client open.
   Proven live shapes (2026-09-08/09), same endpoints TRN/Blitz call locally:
   - mmr: { LatestCompetitiveUpdate: {...}, QueueSkills: { competitive: { SeasonalInfoBySeasonID } } }
   - competitiveupdates: { Matches: [{ MatchID, MapID, MatchStartTime, TierAfterUpdate, RankedRatingAfterUpdate, RankedRatingEarned }] }
   - history: { Total, History: [{ MatchID, GameStartTime, QueueID }] }
   - match-details/v1/matches/{id}: { matchInfo, players[] (subject/teamId/characterId/stats/roundDamage), teams[], roundResults[] } */

/** Fast check (<0.1ms) if the local Riot Client lockfile exists. */
export async function isRiotClientRunning(): Promise<boolean> {
  if (isDevNoClient()) return false;
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>('is_riot_client_running');
  } catch {
    return false;
  }
}

/** Get the currently logged-in account, or the cached account if Riot Client is closed.
    Never throws — returns null if there has never been any logged-in user. */
export async function getEffectiveAccount(): Promise<LocalRiotAccount | null> {
  const running = await isRiotClientRunning();
  if (!running) {
    return readCachedAccount();
  }
  try {
    return await detectLocalAccount();
  } catch {
    return readCachedAccount();
  }
}

/** Logged-in Riot account from the local client. Throws when the client is closed. */
export async function detectLocalAccount(): Promise<LocalRiotAccount> {
  const live = await detectLocalAccountLive();
  writeCachedAccount(live);
  return live;
}

async function detectLocalAccountLive(): Promise<LocalRiotAccount> {
  if (isDevNoClient()) throw new Error('Auto-detect failed — is the Riot Client open?');
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

/* ---- Account identity cache ------------------------------------------------
   The logged-in user almost never changes between launches, so the last known
   account paints the sidebar + tracker instantly and the live read only
   corrects it. Everything is keyed by PUUID: when the user switches accounts
   the PUUID differs, so the stale snapshot is dropped instead of showing the
   previous player's rank and matches under the new name. */

const ACCOUNT_KEY = 'recon_account_v1';

export function readCachedAccount(): LocalRiotAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as LocalRiotAccount;
    return a?.game_name ? a : null;
  } catch {
    return null;
  }
}

export function writeCachedAccount(acc: LocalRiotAccount): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
  } catch {
    /* cache is best-effort only */
  }
}

/** True when the live account is a different player than the cached one. */
export function accountSwitched(cached: LocalRiotAccount | null, live: LocalRiotAccount): boolean {
  if (!cached) return false;
  const a = (cached.puuid || '').toLowerCase();
  const b = (live.puuid || '').toLowerCase();
  if (a && b) return a !== b;
  // No PUUID available: fall back to name#tag comparison.
  return `${cached.game_name}#${cached.tagline}`.toLowerCase() !==
    `${live.game_name}#${live.tagline}`.toLowerCase();
}

/** Drop the snapshot for a specific account (used when the user switches). */
export function clearAccountSnapshot(puuid: string): void {
  try {
    const k = `recon_tracker_snapshot_v1:${(puuid || 'anon').toLowerCase()}`;
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Shape shared with useTrackerData's snapshot store. Only the fields the
    sidebar card needs are declared — extra keys are ignored. */
export interface CachedTrackerSnapshot {
  savedAt: number;
  puuid: string;
  profile: TrackerProfile | null;
}

/** Last persisted tracker snapshot for the cached account, if still fresh. */
export function readCachedTrackerSnapshot(): CachedTrackerSnapshot | null {
  try {
    const acc = readCachedAccount();
    if (!acc?.puuid) return null;
    const raw = localStorage.getItem(`recon_tracker_snapshot_v1:${acc.puuid.toLowerCase()}`);
    if (!raw) return null;
    const s = JSON.parse(raw) as CachedTrackerSnapshot;
    if (!s?.savedAt || !s?.profile) return null;
    if (Date.now() - s.savedAt > 24 * 3600 * 1000) return null;
    return s;
  } catch {
    return null;
  }
}


export interface CachedSidebarMini {
  name: string;
  tag: string;
  rank: string;
  rr: number;
  peak: string;
  icon: string;
  peakIcon: string;
  avatarUrl: string;
  bannerUrl: string;
  countryCode: string;
  level: number;
  puuid?: string;
  savedAt?: number;
}

const SIDEBAR_MINI_PREFIX = 'recon_sidebar_mini_v1';

export function readCachedSidebarMini(puuid?: string): CachedSidebarMini | null {
  try {
    const p = puuid || readCachedAccount()?.puuid;
    if (p) {
      const raw = localStorage.getItem(`${SIDEBAR_MINI_PREFIX}:${p.toLowerCase()}`);
      if (raw) return JSON.parse(raw);
    }
    const legacy = localStorage.getItem(SIDEBAR_MINI_PREFIX);
    return legacy ? JSON.parse(legacy) : null;
  } catch {
    return null;
  }
}

export function writeCachedSidebarMini(mini: CachedSidebarMini, puuid?: string): void {
  try {
    const toStore = { ...mini, savedAt: Date.now() };
    const p = puuid || mini.puuid || readCachedAccount()?.puuid;
    if (p) {
      localStorage.setItem(`${SIDEBAR_MINI_PREFIX}:${p.toLowerCase()}`, JSON.stringify(toStore));
    }
    localStorage.setItem(SIDEBAR_MINI_PREFIX, JSON.stringify(toStore));
  } catch {}
}

/** Tier id → name fallback when only the number arrives. */
export const tierName = (id: number): string => {
  if (!Number.isFinite(id)) return '—';
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

let gameDataMem: { agents: Record<string, string>; maps: Record<string, string>; seasons: Record<string, string>; seasonOrder: string[]; tierIcons: Record<number, string>; agentInfo: Record<string, { name: string; icon: string; role: string; roleIcon: string }>; weapons: Record<string, string> } | null = null;

const GAME_DATA_KEY = 'aspect_game_data_v3';

/** Static Riot metadata via public valorant-api.com, cached 30 days. */
export async function gameData(): Promise<{ agents: Record<string, string>; maps: Record<string, string>; seasons: Record<string, string>; seasonOrder: string[]; tierIcons: Record<number, string>; agentInfo: Record<string, { name: string; icon: string; role: string; roleIcon: string }>; weapons: Record<string, string> }> {
  if (gameDataMem) return gameDataMem;
  try {
    const raw = localStorage.getItem(GAME_DATA_KEY);
    if (raw) {
      const { savedAt, data } = JSON.parse(raw);
      if (Date.now() - savedAt < 30 * 24 * 3600 * 1000 && data?.agents && data?.tierIcons && data?.agentInfo) {
        gameDataMem = { agents: data.agents, maps: data.maps ?? {}, seasons: data.seasons ?? {}, seasonOrder: data.seasonOrder ?? [], tierIcons: data.tierIcons, agentInfo: data.agentInfo ?? {}, weapons: data.weapons ?? {} };
        return gameDataMem;
      }
    }
  } catch {}
  const agents: Record<string, string> = {};
  const maps: Record<string, string> = {};
  const seasons: Record<string, string> = {};
  let seasonOrder: string[] = [];
  const tierIcons: Record<number, string> = {};
  const agentInfo: Record<string, { name: string; icon: string; role: string; roleIcon: string }> = {};
  const weapons: Record<string, string> = {};
  try {
    const [aj, mj, cs, sn, ct, wj] = await Promise.all([
      fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/maps').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/seasons/competitive').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/seasons').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/competitivetiers').then((r) => r.json()),
      fetch('https://valorant-api.com/v1/weapons').then((r) => r.json()),
    ]);
    for (const a of aj?.data ?? []) {
      if (a?.uuid && a?.displayName) {
        const id = String(a.uuid).toLowerCase();
        agents[id] = a.displayName;
        agentInfo[id] = {
          name: a.displayName,
          icon: String(a.displayIcon ?? ''),
          role: String(a.role?.displayName ?? ''),
          roleIcon: String(a.role?.displayIcon ?? ''),
        };
      }
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
    for (const w of wj?.data ?? []) {
      if (w?.uuid && w?.displayName) weapons[String(w.uuid).toLowerCase()] = w.displayName;
    }
    localStorage.setItem(GAME_DATA_KEY, JSON.stringify({ savedAt: Date.now(), data: { agents, maps, seasons, seasonOrder, tierIcons, agentInfo, weapons } }));
  } catch {}
  gameDataMem = { agents, maps, seasons, seasonOrder, tierIcons, agentInfo, weapons };
  return gameDataMem;
}

/** Last path segment of a /Game/Maps/X/X id, for maps valorant-api.com doesn't know yet. */
export const shortMapName = (mapId: string, maps: Record<string, string>): string =>
  maps[mapId.toLowerCase()] ?? (mapId.split('/').pop() || '?');

/** Calculate the true all-time peak tier from Riot's SeasonalInfoBySeasonID payload */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractPeakTier(seasonsObj: Record<string, any>): number {
  let peak = 0;
  for (const s of Object.values(seasonsObj || {})) {
    const endTier = Number(s?.CompetitiveTier ?? 0);
    const actRank = Number(s?.Rank ?? 0);
    let winTier = 0;
    if (s?.WinsByTier && typeof s.WinsByTier === 'object') {
      for (const tk of Object.keys(s.WinsByTier)) {
        const num = Number(tk);
        if (!isNaN(num) && Number(s.WinsByTier[tk]) > 0) {
          winTier = Math.max(winTier, num);
        }
      }
    }
    peak = Math.max(peak, endTier, actRank, winTier);
  }
  return peak;
}

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
    const endTier = Number(s?.CompetitiveTier ?? 0);
    const actRank = Number(s?.Rank ?? 0);
    let winTier = 0;
    if (s?.WinsByTier && typeof s.WinsByTier === 'object') {
      for (const tk of Object.keys(s.WinsByTier)) {
        const num = Number(tk);
        if (!isNaN(num) && Number(s.WinsByTier[tk]) > 0) {
          winTier = Math.max(winTier, num);
        }
      }
    }
    const t = Math.max(endTier, actRank, winTier);
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

export interface PlayerIdentity {
  cardId: string;
  titleId: string;
  level: number;
}

let identityCache: { at: number; id: PlayerIdentity } | null = null;

/** Equipped player card / title / account level, straight from Riot via the
    local client's own session (same creds as MMR — no key, no TRN).
    Cached 30 min. Throws when unusable; callers MUST fall back. */
export async function fetchIdentityDirect(region: string): Promise<PlayerIdentity> {
  if (identityCache && Date.now() - identityCache.at < 30 * 60 * 1000) return identityCache.id;
  const ent = await getEntitlements();
  const j = await riotGet(shardFor(region), `/personalization/v2/players/${ent.puuid}/playerloadout`);
  const ident = j?.Identity ?? {};
  const id: PlayerIdentity = {
    cardId: String(ident?.PlayerCardID ?? ''),
    titleId: String(ident?.PlayerTitleID ?? ''),
    level: Number(ident?.AccountLevel ?? 0),
  };
  if (!id.cardId) throw new Error('No player card equipped.');
  identityCache = { at: Date.now(), id };
  return id;
}

/** Player card art (banner + avatar) from the public data API. Cached forever per card. */
export async function fetchCardArt(cardId: string): Promise<{ wide: string; small: string }> {
  const fallback = { wide: '', small: '' };
  if (!cardId) return fallback;
  const cacheKey = `aspect_cardart_v1_${cardId}`;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw) as { wide: string; small: string };
  } catch {}
  try {
    const j = await fetch(`https://valorant-api.com/v1/playercards/${cardId}`).then((r) => r.json());
    const out = {
      wide: String(j?.data?.wideArt ?? ''),
      small: String(j?.data?.smallArt ?? j?.data?.displayIcon ?? ''),
    };
    try {
      localStorage.setItem(cacheKey, JSON.stringify(out));
    } catch {}
    return out;
  } catch {
    return fallback;
  }
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
    const ent = await getEntitlements();
    if (ent.access_token) {
      const part = ent.access_token.split('.')[1];
      if (part) {
        const decoded = JSON.parse(atob(part));
        const reg = decoded?.pp?.c || decoded?.c;
        if (reg && typeof reg === 'string') return reg.toLowerCase();
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem('aspect_tracker_shard');
    if (raw) {
      const { savedAt, region } = JSON.parse(raw);
      if (Date.now() - savedAt < 7 * 24 * 3600 * 1000 && region) return region;
    }
  } catch {}
  return 'eu';
}

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
  if (s === 'custom') return 'Custom';
  return s ? s[0].toUpperCase() + s.slice(1) : '—';
};

const normTeam = (t: unknown): string => {
  const s = String(t ?? '').toLowerCase();
  if (s === 'blue') return 'Blue';
  if (s === 'red') return 'Red';
  return String(t ?? '');
};

/**
 * Resolve a list of PUUIDs into real GameName and TagLine via Riot Name-Service.
 * Results are cached in localStorage to prevent repeated network calls.
 */
export async function resolvePlayerNames(
  puuids: string[],
  shard = 'eu'
): Promise<Record<string, { name: string; tag: string }>> {
  if (puuids.length === 0) return {};
  const cacheKey = 'aspect_names_cache_v1';
  let cache: Record<string, { name: string; tag: string }> = {};
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cache = JSON.parse(raw);
  } catch {}

  const missing = puuids.filter((p) => !cache[p] || !cache[p].name);
  if (missing.length === 0) return cache;

  try {
    const res = await invoke<string>('riot_resolve_names', {
      shard,
      puuids: missing,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(res) as any[];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const sub = String(item?.Subject ?? item?.subject ?? '');
        const gn = String(item?.GameName ?? item?.gameName ?? '');
        const tl = String(item?.TagLine ?? item?.tagLine ?? '');
        if (sub && gn) {
          cache[sub] = { name: gn, tag: tl };
        }
      }
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cache));
      } catch {}
    }
  } catch (e) {
    console.warn('Failed to resolve player names:', e);
  }

  return cache;
}

/**
 * Full match straight from Riot via the SAME endpoint TRN/Blitz call locally
 * (match-details/v1 — the singular /match/v1 path 503s for client creds).
 * Immutable → cached forever. Throws when unusable.
 */
export async function fetchMatchDetailDirect(region: string, matchId: string): Promise<TrackerMatchDetail> {
  const cacheKey = `aspect_match_v5_${matchId}`;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw) as TrackerMatchDetail;
  } catch {}
  const shard = shardFor(region);
  const j = await riotGet(shard, `/match-details/v1/matches/${matchId}`);
  const { agents: amap } = await gameData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players: TrackerPlayer[] = ((Array.isArray(j?.players) ? j.players : []) as any[]).map((p) => {
    const st = p?.stats ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dmg = (Array.isArray(p?.roundDamage) ? p.roundDamage : []).reduce((n: number, r: any) => n + Number(r?.damage ?? 0), 0);
    return {
      puuid: String(p?.subject ?? ''),
      name: String(p?.gameName ?? ''),
      tag: String(p?.tagLine ?? ''),
      team: normTeam(p?.teamId),
      agent: amap[String(p?.characterId ?? '').toLowerCase()] ?? 'Agent',
      kills: Number(st.kills ?? 0),
      deaths: Number(st.deaths ?? 0),
      assists: Number(st.assists ?? 0),
      damage: dmg,
      damageTaken: 0,
      score: Number(st.score ?? 0),
      rounds: Number(st.roundsPlayed ?? 0),
      playtimeMs: Number(st.playtimeMillis ?? 0),
      headshots: 0,
      bodyshots: 0,
      legshots: 0,
      accountLevel: Number(p?.accountLevel ?? 0),
      tier: Number(p?.competitiveTier ?? 0),
    };
  });
  if (players.length === 0) throw new Error('Empty scoreboard.');

  // Resolve real player names from PUUIDs using Riot name-service
  try {
    const puuids = players.map((p) => p.puuid).filter(Boolean);
    const nameMap = await resolvePlayerNames(puuids, region);
    for (const p of players) {
      if (nameMap[p.puuid]?.name) {
        p.name = nameMap[p.puuid].name;
        p.tag = nameMap[p.puuid].tag;
      }
    }
  } catch {}
  const teamOf = (puuid: string): string => players.find((p) => p.puuid === puuid)?.team ?? '';
  // Damage taken: every player's roundDamage lists who they hit — invert it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPlayers: any[] = Array.isArray(j?.players) ? j.players : [];
  const taken = new Map<string, number>();
  for (const rp of rawPlayers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (Array.isArray(rp?.roundDamage) ? rp.roundDamage : []) as any[]) {
      const recv = String(r?.receiver ?? '');
      if (recv) taken.set(recv, (taken.get(recv) ?? 0) + Number(r?.damage ?? 0));
    }
  }
  for (const p of players) p.damageTaken = taken.get(p.puuid) ?? 0;
  // Team scores come straight from the payload — no round counting needed.
  const teamScore: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (Array.isArray(j?.teams) ? j.teams : []) as any[]) {
    teamScore[normTeam(t?.teamId)] = Number(t?.roundsWon ?? 0);
  }
  const roundsSrc: unknown[] = Array.isArray(j?.roundResults) ? j.roundResults : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rounds = (roundsSrc as any[]).map((r) => ({
    winningTeam: normTeam(r?.winningTeam),
    roundResult: String(r?.roundResult ?? 'Elimination'),
    ceremony: String(r?.roundCeremony ?? ''),
  }));
  const kills: TrackerDuel[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (roundsSrc as any[]).forEach((r) => {
    const num = Number(r?.roundNum ?? 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pstats: any[] = Array.isArray(r?.playerStats) ? r.playerStats : [];
    for (const ps of pstats) {
      const sub = String(ps?.subject ?? '');
      const p = players.find((x) => x.puuid === sub);
      if (p) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const d of (Array.isArray(ps?.damage) ? ps.damage : []) as any[]) {
          p.headshots += Number(d?.headshots ?? 0);
          p.bodyshots += Number(d?.bodyshots ?? 0);
          p.legshots += Number(d?.legshots ?? 0);
        }
      }
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          weapon: String((k as any)?.finishingDamage?.damageItem ?? ''),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          assists: Array.isArray((k as any)?.assistants) ? (k as any).assistants.map((a: unknown) => String(a)) : [],
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
    durationMs: Number(mi.gameLengthMillis ?? 0),
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
  flawless: number;
  clutches: number;
  aces: number;
  firstKills: number;
  firstDeaths: number;
  topAgent: { name: string; matches: number; hours: number };
}

/** Round-level heroics + identity, derived purely from a cached scoreboard. */
export function deriveHeroics(
  detail: TrackerMatchDetail,
  puuid: string
): { flawless: number; clutch: boolean; ace: boolean; firstKill: boolean; firstDeath: boolean; agent: string; playtimeMs: number } {
  const me = detail.players.find((p) => p.puuid === puuid);
  const myTeam = me?.team ?? '';
  const byRound = new Map<number, TrackerDuel[]>();
  for (const k of detail.kills) {
    const l = byRound.get(k.round) ?? [];
    l.push(k);
    byRound.set(k.round, l);
  }
  let flawless = 0;
  let clutch = false;
  let ace = false;
  for (const [num, kl] of byRound) {
    const round = detail.rounds[num];
    const won = round?.winningTeam === myTeam;
    const myDeaths = kl.filter((k) => k.victimTeam === myTeam).length;
    const mateDeaths = kl.filter((k) => k.victimTeam === myTeam && k.victimPuuid !== puuid).length;
    const iDied = kl.some((k) => k.victimPuuid === puuid);
    const myKills = kl.filter((k) => k.killerPuuid === puuid).length;
    if (won && myTeam && myDeaths === 0) flawless++;
    // Real clutch: I survived with a kill while 2+ mates were already dead (>=3 = 3vX or worse).
    if (won && !iDied && myKills > 0 && mateDeaths >= 3) clutch = true;
    if (myKills >= 5) ace = true;
  }
  const flat = [...detail.kills].sort((a, b) => a.round - b.round || a.timeInRound - b.timeInRound);
  return {
    flawless,
    clutch,
    ace,
    firstKill: flat.length > 0 && flat[0].killerPuuid === puuid,
    firstDeath: flat.length > 0 && flat[0].victimPuuid === puuid,
    agent: me?.agent ?? 'Agent',
    playtimeMs: Number((me as TrackerPlayer & { playtimeMs?: number })?.playtimeMs ?? 0),
  };
}

export interface MatchCard {
  kills3: number;
  kills4: number;
  aces: number;
  kastPct: number;
  dmgTaken: number;
  ddDelta: number;
  clutchWon: boolean;
  clutchLost: boolean;
  weaponKills: Record<string, number>;
}

/** Per-match Blitz-style card: multikills, KAST, damage delta, clutch flags, weapons. */
export function matchCard(detail: TrackerMatchDetail, puuid: string): MatchCard {
  const byRound = new Map<number, TrackerDuel[]>();
  for (const k of detail.kills) {
    const l = byRound.get(k.round) ?? [];
    l.push(k);
    byRound.set(k.round, l);
  }
  let kills3 = 0;
  let kills4 = 0;
  let aces = 0;
  let kastRounds = 0;
  let clutchWon = false;
  let clutchLost = false;
  const weaponKills: Record<string, number> = {};
  const me = detail.players.find((p) => p.puuid === puuid);
  const myTeam = me?.team ?? '';
  const rounds = byRound.size || detail.rounds.length || 1;
  for (const [num, kl] of byRound) {
    const won = detail.rounds[num]?.winningTeam === myTeam;
    const myK = kl.filter((k) => k.killerPuuid === puuid);
    const iDied = kl.some((k) => k.victimPuuid === puuid);
    const iAssisted = kl.some((k) => k.assists?.includes(puuid));
    if (myK.length === 3) kills3++;
    if (myK.length === 4) kills4++;
    if (myK.length >= 5) aces++;
    if (myK.length > 0 || iAssisted || !iDied) kastRounds++;
    const mateDeaths = kl.filter((k) => k.victimTeam === myTeam && k.victimPuuid !== puuid).length;
    // Won clutch: alive at the end with 2+ mates down. Lost clutch: fought
    // alone to the end (last alive) but the round slipped away.
    if (myK.length > 0 && mateDeaths >= 3) {
      if (won && !iDied) clutchWon = true;
      if (!won && mateDeaths >= 4) clutchLost = true;
    }
    for (const k of myK) {
      const w = (k.weapon || '').toLowerCase();
      if (w) weaponKills[w] = (weaponKills[w] ?? 0) + 1;
    }
  }
  let dmgTaken = 0;
  let ddDelta = 0;
  {
    const d = detail.players.find((p) => p.puuid === puuid);
    if (d) {
      dmgTaken = d.damageTaken;
      ddDelta = d.damage - d.damageTaken;
    }
  }
  return { kills3, kills4, aces, kastPct: Math.round((kastRounds / rounds) * 100), dmgTaken, ddDelta, clutchWon, clutchLost, weaponKills };
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
  let flawless = 0;
  let clutches = 0;
  let aces = 0;
  let firstKills = 0;
  let firstDeaths = 0;
  const agentUse = new Map<string, { matches: number; ms: number }>();
  for (const id of matchIds) {
    const d = byId[id];
    const me = d?.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    matches++;
    kills += me.kills;
    deaths += me.deaths;
    assists += me.assists;
    damage += me.damage;
    rounds += me.rounds;
    const h = deriveHeroics(d, puuid);
    flawless += h.flawless;
    if (h.clutch) clutches++;
    if (h.ace) aces++;
    if (h.firstKill) firstKills++;
    if (h.firstDeath) firstDeaths++;
    const a = agentUse.get(h.agent) ?? { matches: 0, ms: 0 };
    a.matches++;
    a.ms += h.playtimeMs;
    agentUse.set(h.agent, a);
  }
  let topAgent = { name: '—', matches: 0, hours: 0 };
  for (const [name, a] of agentUse) {
    if (a.matches > topAgent.matches) {
      topAgent = { name, matches: a.matches, hours: Math.round((a.ms / 3600000) * 10) / 10 };
    }
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
      flawless,
      clutches,
      aces,
      firstKills,
      firstDeaths,
      topAgent,
    },
    byId,
  };
}

export const glzHostFor = (region: string): string => {
  const r = region.toLowerCase();
  const map: Record<string, string> = {
    eu: 'glz-eu-1.eu.a.pvp.net',
    na: 'glz-na-1.na.a.pvp.net',
    ap: 'glz-ap-1.ap.a.pvp.net',
    kr: 'glz-kr-1.kr.a.pvp.net',
    latam: 'glz-latam-1.latam.a.pvp.net',
    br: 'glz-br-1.br.a.pvp.net',
  };
  return map[r] ?? 'glz-eu-1.eu.a.pvp.net';
};

const liveMmrCache = new Map<
  string,
  {
    tier: number;
    rr: number;
    peakTier: number;
    actWins?: number;
    actGames?: number;
    leaderboardRank?: number;
    isRankHidden?: boolean;
    fetchedAt: number;
  }
>();

/* ------------------------------------------------------------------ *
 * LAST-24H WIN/LOSS TRACKER
 * Riot's local match-history endpoint resolves for ANY puuid (not just
 * the signed-in account), and every entry carries GameStartTime. We keep
 * a compact per-match result table (matchId → { puuid: 1|0 }) instead of
 * full match details, so hundreds of matches cost only a few KB.
 * ------------------------------------------------------------------ */
const MATCH_RESULTS_KEY = 'recon_match_results_v1';

let matchResultTable: Record<string, Record<string, 1 | 0>> | null = null;

function loadResultTable(): Record<string, Record<string, 1 | 0>> {
  if (matchResultTable) return matchResultTable;
  try {
    const raw = localStorage.getItem(MATCH_RESULTS_KEY);
    matchResultTable = raw ? (JSON.parse(raw) as Record<string, Record<string, 1 | 0>>) : {};
  } catch {
    matchResultTable = {};
  }
  return matchResultTable;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistResultTable(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const table = loadResultTable();
      const ids = Object.keys(table);
      // Bound growth: keep the 400 most recently touched matches.
      if (ids.length > 400) {
        for (const id of ids.slice(0, ids.length - 400)) delete table[id];
      }
      localStorage.setItem(MATCH_RESULTS_KEY, JSON.stringify(table));
    } catch {}
  }, 1500);
}

/** Global gate: Riot's local API dislikes bursts, and match-details is heavy. */
const DETAIL_CONCURRENCY = 6;
let detailActive = 0;
const detailQueue: Array<() => void> = [];
async function withDetailSlot<R>(fn: () => Promise<R>): Promise<R> {
  if (detailActive >= DETAIL_CONCURRENCY) {
    await new Promise<void>((resolve) => detailQueue.push(resolve));
  }
  detailActive++;
  try {
    return await fn();
  } finally {
    detailActive--;
    const next = detailQueue.shift();
    if (next) next();
  }
}

/** Compact W/L lookup for one match+player. Returns 1 win, 0 loss, null unknown. */
async function fetchLiteMatchResult(
  region: string,
  matchId: string,
  puuid: string
): Promise<1 | 0 | null> {
  const table = loadResultTable();
  const known = table[matchId]?.[puuid];
  if (known !== undefined) return known;
  return withDetailSlot(async () => {
    // Re-check inside the slot: another caller may have filled it while we queued.
    const fresh = loadResultTable()[matchId]?.[puuid];
    if (fresh !== undefined) return fresh;
    try {
      const j = await riotGet(shardFor(region), `/match-details/v1/matches/${matchId}`);
      const scores: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of (Array.isArray(j?.teams) ? j.teams : []) as any[]) {
        scores[normTeam(t?.teamId)] = Number(t?.roundsWon ?? 0);
      }
      const row: Record<string, 1 | 0> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (Array.isArray(j?.players) ? j.players : []) as any[]) {
        const sub = String(p?.subject ?? '');
        if (!sub) continue;
        const tm = normTeam(p?.teamId);
        const opp = Object.keys(scores).find((k) => k !== tm);
        const mine = scores[tm] ?? 0;
        const theirs = opp ? scores[opp] ?? 0 : 0;
        row[sub] = mine > theirs ? 1 : 0;
      }
      if (Object.keys(row).length === 0) return null;
      loadResultTable()[matchId] = row;
      persistResultTable();
      return row[puuid] ?? null;
    } catch {
      return null;
    }
  });
}

/** Run an async mapper over items with a hard concurrency cap. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export interface Recent24hRecord {
  won: number;
  lost: number;
  /** Most recent results, newest first — used for the streak badge. */
  streak: number;
  streakIsWin: boolean;
  fetchedAt: number;
}

const recent24hCache = new Map<string, Recent24hRecord>();
const recent24hInflight = new Map<string, Promise<Recent24hRecord>>();

/**
 * Real win/loss record for a player over the last 24 hours, newest match first.
 * Only matches actually started within the window are counted.
 */
export async function fetchPlayer24hRecord(
  puuid: string,
  region: string
): Promise<Recent24hRecord> {
  const empty: Recent24hRecord = { won: 0, lost: 0, streak: 0, streakIsWin: false, fetchedAt: Date.now() };
  if (!puuid) return empty;
  const cached = recent24hCache.get(puuid);
  if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) return cached;
  // The overlay polls every few seconds — never stack duplicate work per player.
  const running = recent24hInflight.get(puuid);
  if (running) return running;

  const task = (async (): Promise<Recent24hRecord> => {
    try {
      const cutoff = Date.now() - 24 * 3600 * 1000;
      // Riot caps this endpoint at ~25 rows per request, so page through until
      // the oldest row falls outside the 24h window (heavy grinders).
      const entries: { id: string; at: number }[] = [];
      for (let page = 0; page < 3; page++) {
        const start = page * 20;
        const j = await riotGet(
          shardFor(region),
          `/match-history/v1/history/${puuid}?startIndex=${start}&endIndex=${start + 20}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = ((Array.isArray(j?.History) ? j.History : []) as any[]).map((h) => ({
          id: String(h?.MatchID ?? ''),
          at: Number(h?.GameStartTime ?? 0),
        }));
        if (rows.length === 0) break;
        entries.push(...rows);
        const oldest = rows[rows.length - 1]?.at ?? 0;
        if (oldest < cutoff) break;
      }

      const recent = entries
        .filter((h) => h.id && h.at >= cutoff)
        .sort((a, b) => b.at - a.at);

      if (recent.length === 0) {
        recent24hCache.set(puuid, empty);
        return empty;
      }

      const results = await mapLimit(recent, 4, (m) => fetchLiteMatchResult(region, m.id, puuid));
      let won = 0;
      let lost = 0;
      // results[] follows `recent` order = newest first
      const played = results.filter((r): r is 1 | 0 => r === 0 || r === 1);
      for (const r of played) {
        if (r === 1) won++;
        else lost++;
      }
      let streak = 0;
      const streakIsWin = played.length > 0 && played[0] === 1;
      for (const r of played) {
        const isWin = r === 1;
        if (isWin === streakIsWin) streak++;
        else break;
      }
      const record: Recent24hRecord = { won, lost, streak, streakIsWin, fetchedAt: Date.now() };
      recent24hCache.set(puuid, record);
      return record;
    } catch {
      recent24hCache.set(puuid, empty);
      return empty;
    } finally {
      recent24hInflight.delete(puuid);
    }
  })();

  recent24hInflight.set(puuid, task);
  return task;
}

const livePlayerStatsCache = new Map<
  string,
  {
    kd?: number;
    winPct?: number;
    hsPct?: number;
    recentWon?: number;
    recentLost?: number;
    streak?: number;
    streakIsWin?: boolean;
    country?: string;
    fetchedAt: number;
  }
>();

export async function fetchLiveMatchState(regionOverride?: string): Promise<LiveMatchState> {
  // Dev dashboard simulator: canned match without Riot open (dev builds only).
  const devMock = getDevMockMatch();
  if (devMock) return devMock;

  const idleState: LiveMatchState = {
    phase: 'idle',
    matchId: '',
    mapId: '',
    mapName: 'No Match Active',
    mode: '',
    isDeathmatch: false,
    blueTeam: [],
    redTeam: [],
    updatedAt: Date.now(),
  };

  if (!isTauri()) return idleState;

  try {
    const ent = await getEntitlements();
    if (!ent.puuid) return idleState;

    const region = regionOverride || (await detectRegion());
    const glz = glzHostFor(region);
    const shard = shardFor(region);
    const data = await gameData();

    let phase: 'idle' | 'pregame' | 'coregame' = 'idle';
    let matchId = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchData: any = null;

    // 1. Check Coregame (in-match)
    try {
      const corePlayer = await riotGet(glz, `/core-game/v1/players/${ent.puuid}`).catch(() =>
        riotGet(glz, `/coregame/v1/players/${ent.puuid}`)
      );
      if (corePlayer?.MatchID) {
        matchId = corePlayer.MatchID;
        matchData = await riotGet(glz, `/core-game/v1/matches/${matchId}`).catch(() =>
          riotGet(glz, `/coregame/v1/matches/${matchId}`)
        );
        if (matchData && !matchData.httpStatus) {
          phase = 'coregame';
        }
      }
    } catch {}

    // 2. Check Pregame (agent select) if not in coregame
    if (phase === 'idle') {
      try {
        const prePlayer = await riotGet(glz, `/pregame/v1/players/${ent.puuid}`);
        if (prePlayer?.MatchID) {
          matchId = prePlayer.MatchID;
          matchData = await riotGet(glz, `/pregame/v1/matches/${matchId}`);
          if (matchData && !matchData.httpStatus) {
            phase = 'pregame';
          }
        }
      } catch {}
    }

    if (phase === 'idle' || !matchData) {
      return idleState;
    }

    interface RawPlayer {
      puuid: string;
      team: 'Blue' | 'Red';
      characterId: string;
      accountLevel: number;
      cardId: string;
      selectionState?: string;
      isIncognito?: boolean;
    }

    const rawPlayers: RawPlayer[] = [];

    if (phase === 'coregame' && Array.isArray(matchData.Players)) {
      for (const p of matchData.Players) {
        rawPlayers.push({
          puuid: p.Subject,
          team: p.TeamID === 'Red' ? 'Red' : 'Blue',
          characterId: p.CharacterID || '',
          accountLevel: p.PlayerIdentity?.AccountLevel || 0,
          cardId: p.PlayerIdentity?.PlayerCardID || '',
          isIncognito: !!(p.PlayerIdentity?.Incognito),
        });
      }
    } else if (phase === 'pregame') {
      if (Array.isArray(matchData.Teams)) {
        for (const t of matchData.Teams) {
          const tId = (t.TeamID === 'Red' || t.TeamID === 'TeamTwo') ? 'Red' : 'Blue';
          for (const p of t.Players || []) {
            rawPlayers.push({
              puuid: p.Subject,
              team: tId,
              characterId: p.CharacterID || '',
              accountLevel: p.PlayerIdentity?.AccountLevel || 0,
              cardId: p.PlayerIdentity?.PlayerCardID || '',
              selectionState: p.CharacterSelectionState || '',
              isIncognito: !!(p.PlayerIdentity?.Incognito),
            });
          }
        }
      }
      // Pregame AllyTeam
      if (Array.isArray(matchData.AllyTeam?.Players)) {
        const allyTeamId = (matchData.AllyTeam.TeamID === 'Red' || matchData.AllyTeam.TeamID === 'TeamTwo') ? 'Red' : 'Blue';
        for (const p of matchData.AllyTeam.Players) {
          if (!rawPlayers.some((rp) => rp.puuid === p.Subject)) {
            rawPlayers.push({
              puuid: p.Subject,
              team: allyTeamId,
              characterId: p.CharacterID || '',
              accountLevel: p.PlayerIdentity?.AccountLevel || 0,
              cardId: p.PlayerIdentity?.PlayerCardID || '',
              selectionState: p.CharacterSelectionState || '',
              isIncognito: !!(p.PlayerIdentity?.Incognito),
            });
          }
        }
      }
      // Pregame EnemyTeam (populated in custom games!)
      if (Array.isArray(matchData.EnemyTeam?.Players)) {
        const enemyTeamId = (matchData.EnemyTeam.TeamID === 'Red' || matchData.EnemyTeam.TeamID === 'TeamTwo') ? 'Red' : 'Blue';
        for (const p of matchData.EnemyTeam.Players) {
          if (!rawPlayers.some((rp) => rp.puuid === p.Subject)) {
            rawPlayers.push({
              puuid: p.Subject,
              team: enemyTeamId,
              characterId: p.CharacterID || '',
              accountLevel: p.PlayerIdentity?.AccountLevel || 0,
              cardId: p.PlayerIdentity?.PlayerCardID || '',
              selectionState: p.CharacterSelectionState || '',
              isIncognito: !!(p.PlayerIdentity?.Incognito),
            });
          }
        }
      }
    }

    const puuids = rawPlayers.map((p) => p.puuid).filter(Boolean);
    const nameMap = await resolvePlayerNames(puuids, region);

    // Fetch MMRs only for players not already cached within the last 15 minutes
    const mmrMap = new Map<
      string,
      {
        tier: number;
        rr: number;
        peakTier: number;
        actWins?: number;
        actGames?: number;
        leaderboardRank?: number;
        isRankHidden?: boolean;
      }
    >();
    const missingMmr = puuids.filter((p) => {
      const cached = liveMmrCache.get(p);
      if (cached && Date.now() - cached.fetchedAt < 15 * 60 * 1000) {
        mmrMap.set(p, cached);
        return false;
      }
      return true;
    });

    if (missingMmr.length > 0) {
      // Chunk in groups of 4 to avoid spawning 12 curl processes at the exact same instant
      for (let i = 0; i < missingMmr.length; i += 4) {
        const batch = missingMmr.slice(i, i + 4);
        await Promise.all(
          batch.map(async (p) => {
            try {
              const j = await riotGet(shard, `/mmr/v1/players/${p}`);
              const latest = j?.LatestCompetitiveUpdate ?? {};
              const tierId = Number(latest?.TierAfterUpdate ?? 0);
              const seasons = j?.QueueSkills?.competitive?.SeasonalInfoBySeasonID ?? {};
              // Current-act row carries the LIVE RR; LatestCompetitiveUpdate only
              // holds the value as of the last ranked game.
              const curSeasonId = String(latest?.SeasonID ?? '').toLowerCase();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cur = (Object.entries(seasons) as [string, any][]).find(
                ([id]) => id.toLowerCase() === curSeasonId
              )?.[1];
              const rr =
                cur?.RankedRating != null
                  ? Number(cur.RankedRating)
                  : Number(latest?.RankedRatingAfterUpdate ?? 0);
              const peak = Math.max(tierId, extractPeakTier(seasons));
              const val = {
                tier: tierId,
                rr,
                peakTier: peak,
                actWins: Number(cur?.NumberOfWins ?? 0),
                actGames: Number(cur?.NumberOfGames ?? 0),
                leaderboardRank: Number(cur?.LeaderboardRank ?? 0),
                isRankHidden: !!j?.IsActRankBadgeHidden,
                fetchedAt: Date.now(),
              };
              liveMmrCache.set(p, val);
              mmrMap.set(p, val);
            } catch {
              const val = { tier: 0, rr: 0, peakTier: 0, fetchedAt: Date.now() };
              liveMmrCache.set(p, val);
              mmrMap.set(p, val);
            }
          })
        );
      }
    }

    const rawMapId = String(matchData.MapID || '').toLowerCase();
    const mapDict: Record<string, string> = {
      '/game/maps/duality/duality': 'Bind',
      '/game/maps/bonsai/bonsai': 'Split',
      '/game/maps/ascent/ascent': 'Ascent',
      '/game/maps/triad/triad': 'Haven',
      '/game/maps/port/port': 'Icebox',
      '/game/maps/foxtrot/foxtrot': 'Breeze',
      '/game/maps/canyon/canyon': 'Fracture',
      '/game/maps/pitt/pitt': 'Pearl',
      '/game/maps/jam/jam': 'Lotus',
      '/game/maps/juliett/juliett': 'Sunset',
      '/game/maps/plummet/plummet': 'Abyss',
    };
    const mapName = mapDict[rawMapId] || data.maps[rawMapId] || shortMapName(rawMapId, data.maps);

    const rawModeId = String(matchData.ModeID || matchData.Mode || '');
    const isDeathmatch = rawModeId.toLowerCase().includes('deathmatch');
    const modeName = isDeathmatch
      ? 'Deathmatch'
      : rawModeId.toLowerCase().includes('hurry')
      ? 'Swiftplay'
      : rawModeId.toLowerCase().includes('onefa')
      ? 'Spike Rush'
      : 'Competitive / Unrated';

    const blueTeam: LiveMatchPlayer[] = [];
    const redTeam: LiveMatchPlayer[] = [];

    // In Deathmatch / FFA, keep all players in one unified list (blueTeam) without grouping into teams
    rawPlayers.forEach((p, idx) => {
      const resolved = nameMap[p.puuid];
      const name = resolved?.name || (p.puuid === ent.puuid ? 'You' : `Player ${idx + 1}`);
      const tag = resolved?.tag || '';
      const mmr = mmrMap.get(p.puuid) || { tier: 0, rr: 0, peakTier: 0 };
      const agentRawName = data.agents[p.characterId.toLowerCase()] || '';
      const agentMeta = Object.values(data.agentInfo).find(
        (a) => a.name.toLowerCase() === agentRawName.toLowerCase()
      );

      // Asynchronously fetch TRN stats (KD & country) if not cached
      const statsCached = livePlayerStatsCache.get(p.puuid);
      if (!statsCached && resolved?.name && resolved?.tag) {
        import('./trn')
          .then(({ fetchTrnActStats }) => {
            fetchTrnActStats(resolved.name, resolved.tag)
              .then((res) => {
                const realCountry =
                  res?.countryCode &&
                  res.countryCode.length === 2 &&
                  !['EU', 'NA', 'AP', 'KR'].includes(res.countryCode.toUpperCase())
                    ? res.countryCode.toUpperCase()
                    : undefined;

                const prev = livePlayerStatsCache.get(p.puuid);
                livePlayerStatsCache.set(p.puuid, {
                  ...prev,
                  kd: res?.stats?.kd ? Number(res.stats.kd.toFixed(2)) : undefined,
                  winPct: res?.stats?.winPct != null ? Math.round(res.stats.winPct) : undefined,
                  hsPct: res?.stats?.hsPct != null ? Math.round(res.stats.hsPct) : undefined,
                  country: realCountry,
                  fetchedAt: Date.now(),
                });
              })
              .catch(() => {
                livePlayerStatsCache.set(p.puuid, {
                  ...livePlayerStatsCache.get(p.puuid),
                  fetchedAt: Date.now(),
                });
              });
          })
          .catch(() => {});
      }

      // Last-24h record — Riot local history works for ANY puuid, so every
      // player in the lobby gets a real 24-hour win/loss line.
      const cached24h = livePlayerStatsCache.get(p.puuid);
      if (Date.now() - (cached24h?.fetchedAt ?? 0) > 10 * 60 * 1000) {
        fetchPlayer24hRecord(p.puuid, region)
          .then((rec) => {
            livePlayerStatsCache.set(p.puuid, {
              ...livePlayerStatsCache.get(p.puuid),
              recentWon: rec.won,
              recentLost: rec.lost,
              streak: rec.streak,
              streakIsWin: rec.streakIsWin,
              fetchedAt: Date.now(),
            });
          })
          .catch(() => {});
      }

      const targetTeam = isDeathmatch ? 'Blue' : p.team;

      const playerObj: LiveMatchPlayer = {
        puuid: p.puuid,
        name,
        tag,
        team: targetTeam,
        agentId: p.characterId,
        agentName: agentRawName || 'Selecting…',
        agentIcon: agentMeta?.icon || '',
        agentRole: agentMeta?.role || '',
        tier: mmr.tier,
        rank: tierName(mmr.tier),
        rr: mmr.rr,
        peakTier: mmr.peakTier,
        peakRank: mmr.peakTier > 0 ? tierName(mmr.peakTier) : '—',
        actWins: mmr.actWins,
        actGames: mmr.actGames,
        leaderboardRank: mmr.leaderboardRank,
        isRankHidden: mmr.isRankHidden,
        accountLevel: p.accountLevel,
        cardId: p.cardId,
        isMe: p.puuid === ent.puuid,
        selectionState: p.selectionState,
        region: region.toUpperCase(),
        country: statsCached?.country,
        kd: statsCached?.kd,
        winPct: statsCached?.winPct,
        hsPct: statsCached?.hsPct,
        recentWon: statsCached?.recentWon,
        recentLost: statsCached?.recentLost,
        streak: statsCached?.streak,
        streakIsWin: statsCached?.streakIsWin,
        isIncognito: p.isIncognito ?? false,
      };

      if (targetTeam === 'Blue') {
        blueTeam.push(playerObj);
      } else {
        redTeam.push(playerObj);
      }
    });

    const startingSide = matchData.AllyTeam?.TeamID === 'Red'
      ? 'Attack'
      : matchData.AllyTeam?.TeamID === 'Blue'
      ? 'Defense'
      : undefined;

    return {
      phase,
      matchId,
      mapId: rawMapId,
      mapName,
      mode: modeName,
      isDeathmatch,
      startingSide,
      blueTeam,
      redTeam,
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      ...idleState,
      error: String(err),
    };
  }
}
