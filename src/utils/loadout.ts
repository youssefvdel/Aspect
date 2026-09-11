/**
 * Loadout catalogue + parser.
 *
 * Source of truth for "what is this player holding": the ONLY endpoints that
 * expose equipped skins/sprays are the in-progress loadout routes
 *
 *   GET glz-{region}-1.{shard}.a.pvp.net/core-game/v1/matches/{id}/loadouts
 *   GET glz-{region}-1.{shard}.a.pvp.net/pregame/v1/matches/{id}/loadouts
 *
 * Riot retired the per-player personalization routes
 * (`/personalization/v1|v2/players/{puuid}/playerloadout` — verified 404 both
 * locally and remotely), so there is NO out-of-match equivalent. Loadouts only
 * exist while a match is live, which is why the viewer is gated on that state.
 *
 * ---------------------------------------------------------------------------
 * Verified payload shape (cross-checked against pwall2222/NOWT's C# client,
 * which is the working reference implementation, and ruwiss/valorant-tracker's
 * Rust types). Two things there are easy to get wrong and both are load-bearing:
 *
 *   1. `Loadout.Items` is keyed by WEAPON UUID (Classic = 29a0cfab-…, Vandal =
 *      9c82e19d-…). It is NOT an opaque socket id. All 19 weapon UUIDs were
 *      confirmed against the content API.
 *   2. The equipped skin is NOT `Items[key].ID` — that is the weapon's default
 *      entry. The equipped skin lives one level deeper, in a fixed socket:
 *
 *        Items[weaponUuid].Sockets["3ad1b2b2-acdb-4524-852f-954a76ddae0a"].Item.ID
 *
 *      and that value is a CHROMA uuid, so it must be resolved against a
 *      chroma-indexed catalogue — resolving only skin uuids leaves every
 *      skinned weapon unnamed, which is the failure mode that makes a loadout
 *      viewer look broken.
 *
 * JSON keys are PascalCase, but Riot has shipped both `SpraySelection` and
 * `SpraySelections`, and both `SprayID` and `AssetId`, so every read is
 * tolerant of both spellings.
 * ---------------------------------------------------------------------------
 */

const CATALOG_KEY = 'recon_weapon_catalog_v2';
const WEAPONS_URL = 'https://valorant-api.com/v1/weapons';

/** The socket holding the equipped weapon skin. Fixed across patches so far. */
export const SKIN_SOCKET = '3ad1b2b2-acdb-4524-852f-954a76ddae0a';

/** Category strings Riot ships on `/v1/weapons`, mapped to display headings. */
export const CATEGORY_LABELS: Record<string, string> = {
  'EEquippableCategory::Sidearm': 'Sidearms',
  'EEquippableCategory::SMG': 'SMGs',
  'EEquippableCategory::Shotgun': 'Shotguns',
  'EEquippableCategory::Rifle': 'Rifles',
  'EEquippableCategory::Melee': 'Melee',
  'EEquippableCategory::Sniper': 'Sniper Rifles',
  'EEquippableCategory::Heavy': 'Machine Guns',
};

/**
 * Column composition, transcribed from the in-game collection screen: each
 * outer entry is one vertical column holding one or more sub-sections.
 */
export const LOADOUT_COLUMNS: { category: string; label: string }[][] = [
  [{ category: 'EEquippableCategory::Sidearm', label: 'Sidearms' }],
  [
    { category: 'EEquippableCategory::SMG', label: 'SMGs' },
    { category: 'EEquippableCategory::Shotgun', label: 'Shotguns' },
  ],
  [
    { category: 'EEquippableCategory::Rifle', label: 'Rifles' },
    { category: 'EEquippableCategory::Melee', label: 'Melee' },
  ],
  [
    { category: 'EEquippableCategory::Sniper', label: 'Sniper Rifles' },
    { category: 'EEquippableCategory::Heavy', label: 'Machine Guns' },
  ],
];

/** Canonical top-to-bottom weapon order, matching the collection screen. */
export const WEAPON_ORDER = [
  'Classic', 'Shorty', 'Frenzy', 'Ghost', 'Bandit', 'Sheriff',
  'Stinger', 'Spectre',
  'Bucky', 'Judge',
  'Bulldog', 'Guardian', 'Phantom', 'Vandal',
  'Melee',
  'Marshal', 'Outlaw', 'Operator',
  'Ares', 'Odin',
];

export const orderOf = (weaponName: string): number => {
  const i = WEAPON_ORDER.indexOf(weaponName);
  return i === -1 ? WEAPON_ORDER.length : i;
};

export interface WeaponSkin {
  name: string;
  icon: string;
}

export interface WeaponInfo {
  uuid: string;
  name: string;
  category: string;
  icon: string;
  /** Skin uuid -> art, plus every chroma/level uuid pointing at its parent. */
  skins: Record<string, WeaponSkin>;
}

export interface WeaponCatalog {
  weapons: Record<string, WeaponInfo>;
  /** Any skin/chroma/level UUID -> its parent weapon + skin art. */
  skinIndex: Record<string, { weaponUuid: string; skin: WeaponSkin }>;
}

export interface EquippedWeapon {
  weaponUuid: string;
  weaponName: string;
  category: string;
  skinId: string;
  skinName: string;
  icon: string;
  /** True when the player runs the default (unskinned) weapon art. */
  isDefaultSkin: boolean;
}

export interface EquippedExpression {
  socketId: string;
  assetId: string;
  kind: 'spray' | 'flex';
  icon: string;
}

export interface PlayerLoadout {
  /** PUUID. Present on the payload and the most reliable join key. */
  subject: string;
  characterId: string;
  weapons: EquippedWeapon[];
  expressions: EquippedExpression[];
}

let memCatalog: WeaponCatalog | null = null;

const mediaUrl = (kind: string, uuid: string, file = 'displayicon.png') =>
  `https://media.valorant-api.com/${kind}/${uuid}/${file}`;

export const sprayIcon = (uuid: string) => mediaUrl('sprays', uuid);
export const flexIcon = (uuid: string) => mediaUrl('flex', uuid);
export const playerCardIcon = (uuid: string) => mediaUrl('playercards', uuid);
export const playerCardWide = (uuid: string) => mediaUrl('playercards', uuid, 'wideart.png');
/** Vertical card art — the aspect the collection screen's card slot uses. */
export const playerCardLarge = (uuid: string) => mediaUrl('playercards', uuid, 'largeart.png');

/**
 * Build the weapon/skin index from the public content API.
 *
 * Indexes every skin UUID *and* its chromas and levels, because the equipped
 * value arrives as a chroma UUID — resolving only the base skin UUID is the
 * classic "skins show as blank" bug.
 */
export async function loadWeaponCatalog(): Promise<WeaponCatalog> {
  if (memCatalog) return memCatalog;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const age = Date.now() - (parsed?.savedAt ?? 0);
      // Content patches land every few weeks; a day of staleness is harmless.
      if (parsed?.data?.weapons && age < 24 * 60 * 60 * 1000) {
        memCatalog = parsed.data as WeaponCatalog;
        return memCatalog;
      }
    }
  } catch {}

  const res = await fetch(WEAPONS_URL);
  const json = await res.json();
  const weapons: Record<string, WeaponInfo> = {};
  const skinIndex: Record<string, { weaponUuid: string; skin: WeaponSkin }> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const w of (json?.data ?? []) as any[]) {
    if (!w?.uuid) continue;
    const uuid = String(w.uuid).toLowerCase();
    const skins: Record<string, WeaponSkin> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (w.skins ?? []) as any[]) {
      if (!s?.uuid) continue;
      const skin: WeaponSkin = {
        name: String(s.displayName ?? w.displayName ?? ''),
        icon: s.displayIcon || w.displayIcon || '',
      };
      const sUuid = String(s.uuid).toLowerCase();
      skins[sUuid] = skin;
      skinIndex[sUuid] = { weaponUuid: uuid, skin };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of [...(s.chromas ?? []), ...(s.levels ?? [])] as any[]) {
        if (c?.uuid) skinIndex[String(c.uuid).toLowerCase()] = { weaponUuid: uuid, skin };
      }
    }
    weapons[uuid] = {
      uuid,
      name: String(w.displayName ?? ''),
      category: String(w.category ?? ''),
      icon: String(w.displayIcon ?? ''),
      skins,
    };
  }

  memCatalog = { weapons, skinIndex };
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify({ savedAt: Date.now(), data: memCatalog }));
  } catch {}
  return memCatalog;
}

const str = (v: unknown): string => String(v ?? '').trim();

/** Case-insensitive field read that tolerates Riot's PascalCase drift. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pick = (obj: any, ...names: string[]): string => {
  for (const n of names) {
    const v = obj?.[n];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

/**
 * Parse one loadout into the shape the viewer renders.
 *
 * `entry` may be either the core-game shape (`{ CharacterID, Loadout: {...} }`)
 * or the pregame shape (the loadout object itself) — pregame entries are not
 * nested under a `Loadout` key, and mixing them up yields an empty viewer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLoadoutEntry(entry: any, catalog: WeaponCatalog): PlayerLoadout {
  const characterId = pick(entry, 'CharacterID', 'CharacterId', 'characterId');
  const data = entry?.Loadout ?? entry?.loadout ?? entry ?? {};
  const subject = pick(data, 'Subject', 'subject');
  // Some builds nest a second copy under `Loadout` — accept either.
  const items = data?.Items ?? data?.items ?? entry?.Items ?? {};
  const weapons: EquippedWeapon[] = [];
  const expressions: EquippedExpression[] = [];

  for (const key of Object.keys(items ?? {})) {
    const keyLc = String(key).toLowerCase();
    // `Items` is keyed by weapon UUID (verified against all 19 weapons). Fall
    // back to treating the key as a skin id only if it is not a weapon.
    let weapon = catalog.weapons[keyLc];
    if (!weapon) {
      const viaSkin = catalog.skinIndex[keyLc];
      if (viaSkin) weapon = catalog.weapons[viaSkin.weaponUuid];
    }
    if (!weapon) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slot = (items as any)[key] ?? {};
    const sockets = slot?.Sockets ?? slot?.sockets ?? {};
    // Equipped skin hangs off a fixed socket; `slot.ID` is only the default.
    const socketEntry = sockets?.[SKIN_SOCKET] ?? Object.values(sockets ?? {})[0] ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = socketEntry as any;
    const skinId = str(
      sock?.Item?.ID ?? sock?.Item?.Id ?? sock?.item?.id ?? sock?.Item?.itemId ?? slot?.ID ?? slot?.Id
    ).toLowerCase();

    const skinHit = catalog.skinIndex[skinId];
    const ownSkin = weapon.skins[skinId];
    // A socket that resolved to a real skin beats the weapon's own entry.
    const resolved = skinHit?.skin ?? ownSkin;
    const isDefault = !skinHit && !ownSkin;

    weapons.push({
      weaponUuid: weapon.uuid,
      weaponName: weapon.name,
      category: weapon.category,
      skinId,
      skinName: resolved?.name || weapon.name,
      icon: resolved?.icon || weapon.icon,
      isDefaultSkin: isDefault,
    });
  }

  weapons.sort(
    (a, b) => orderOf(a.weaponName) - orderOf(b.weaponName) || a.weaponName.localeCompare(b.weaponName)
  );

  // Sprays: `Sprays.SpraySelections` (plural on some builds) with `SprayID`,
  // `AssetId` or `LevelID` depending on patch.
  const sprayList =
    data?.Sprays?.SpraySelections ??
    data?.Sprays?.SpraySelection ??
    data?.sprays?.spraySelections ??
    [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (Array.isArray(sprayList) ? sprayList : []) as any[]) {
    const assetId = pick(s, 'SprayID', 'SprayId', 'AssetId', 'AssetID', 'LevelID');
    if (!assetId) continue;
    expressions.push({
      socketId: pick(s, 'SocketID', 'SocketId'),
      assetId,
      kind: 'spray',
      icon: sprayIcon(assetId),
    });
  }

  // Flex / dance emotes share the wheel with sprays.
  const aesList =
    data?.Expressions?.AESSelections ??
    data?.expressions?.aesSelections ??
    data?.Expressions?.AesSelections ??
    [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (Array.isArray(aesList) ? aesList : []) as any[]) {
    const assetId = pick(a, 'AssetID', 'AssetId', 'TypeID');
    if (!assetId) continue;
    expressions.push({
      socketId: pick(a, 'SocketID', 'SocketId'),
      assetId,
      kind: 'flex',
      icon: flexIcon(assetId),
    });
  }

  return { subject, characterId, weapons, expressions };
}

/** Parse the whole `{ Loadouts: [...] }` payload. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLoadouts(raw: any, catalog: WeaponCatalog): PlayerLoadout[] {
  const list = raw?.Loadouts ?? raw?.loadouts ?? raw;
  if (!Array.isArray(list)) return [];
  return list.map((e) => parseLoadoutEntry(e, catalog));
}

/**
 * Pick the loadout belonging to a lobby player.
 *
 * Precedence, strongest first:
 *   1. `Subject` (PUUID) — exact and immune to ordering changes.
 *   2. `CharacterID` — works in Competitive/Unrated where agents are unique,
 *      but Deathmatch and Swiftplay can field duplicates.
 *   3. Array position — the payload's array is parallel to the match's player
 *      list, which is how the working C# client correlates them.
 *
 * `ambiguous` is set when a weaker key had to be used and several entries
 * matched, so the caller can disclose that instead of silently showing a
 * stranger's weapons.
 */
export function resolveLoadoutForPlayer(
  all: PlayerLoadout[],
  opts: { puuid?: string; characterId?: string; index?: number }
): { loadout: PlayerLoadout | null; ambiguous: boolean } {
  const puuid = str(opts.puuid).toLowerCase();
  if (puuid) {
    const hit = all.find((l) => l.subject.toLowerCase() === puuid);
    if (hit) return { loadout: hit, ambiguous: false };
  }

  const cid = str(opts.characterId).toLowerCase();
  if (cid) {
    const hits = all.filter((l) => l.characterId.toLowerCase() === cid);
    if (hits.length === 1) return { loadout: hits[0], ambiguous: false };
    if (hits.length > 1) return { loadout: hits[0], ambiguous: true };
  }

  if (typeof opts.index === 'number' && all[opts.index]) {
    return { loadout: all[opts.index], ambiguous: false };
  }
  return { loadout: null, ambiguous: false };
}

/** Group a player's weapons for the column layout. */
export function groupByCategory(weapons: EquippedWeapon[]): Record<string, EquippedWeapon[]> {
  const out: Record<string, EquippedWeapon[]> = {};
  for (const w of weapons) {
    (out[w.category] ??= []).push(w);
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => orderOf(a.weaponName) - orderOf(b.weaponName));
  }
  return out;
}
