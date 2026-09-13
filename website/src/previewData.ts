/**
 * Hardcoded preview data for the website's live-app walkthrough.
 *
 * The desktop app gets its lobby and weapon skins from the local Riot client,
 * which a browser cannot reach. Rather than fake the UI with images, we seed the
 * app's own preview keys (see the `!isTauri()` branches in
 * Recon/src/utils/tracker.ts) with payloads in Riot's exact shapes, so the app
 * runs its real code paths — PlayerTable, party grouping, unmask badges,
 * parseLoadouts, resolveLoadoutForPlayer, LoadoutViewer.
 *
 * EVERYTHING here is static. It is a showcase, so there is no network call, no
 * async seeding and no race: the payloads are correct on the first tick, which
 * is what stops the Live Match view flashing its "Waiting for Valorant Match"
 * empty state. Asset UUIDs were resolved from valorant-api once and baked in
 * below; the media URLs are served by their CDN.
 */

import type { LiveMatchPlayer, LiveMatchState } from '../../src/types';
import { SKIN_SOCKET } from '../../src/utils/loadout';

const LOBBY_KEY = 'recon_preview_live_match';
const LOADOUTS_KEY = 'recon_preview_loadouts';

/* ── Agents: uuid + portrait + role, baked once from valorant-api ───────── */
const AGENTS: Record<string, { uuid: string; icon: string; role: string }> = {
  sage: { uuid: '569fdd95-4d10-43ab-ca70-79becc718b46', icon: 'https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png', role: 'Sentinel' },
  breach: { uuid: '5f8d3a7f-467b-97f3-062c-13acf203c006', icon: 'https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/displayicon.png', role: 'Initiator' },
  reyna: { uuid: 'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc', icon: 'https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/displayicon.png', role: 'Duelist' },
  cypher: { uuid: '117ed9e3-49f3-6512-3ccf-0cada7e3823b', icon: 'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/displayicon.png', role: 'Sentinel' },
  sova: { uuid: '320b2a48-4d9b-a075-30f1-1f93a9b638fa', icon: 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png', role: 'Initiator' },
  jett: { uuid: 'add6443a-41bd-e414-f6ad-e58d267f4e95', icon: 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png', role: 'Duelist' },
  omen: { uuid: '8e253930-4c05-31dd-1b6c-968525494517', icon: 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png', role: 'Controller' },
  raze: { uuid: 'f94c3b30-42be-e959-889c-5aa313dba261', icon: 'https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/displayicon.png', role: 'Duelist' },
  killjoy: { uuid: '1e58de9c-4950-5125-93e9-a0aee9f98746', icon: 'https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/displayicon.png', role: 'Sentinel' },
  chamber: { uuid: '22697a3d-45bf-8dd7-4fec-84a9e28c69d7', icon: 'https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/displayicon.png', role: 'Sentinel' },
};

/* ── Roster: real Riot IDs, taken from the user's own lobby ─────────────── */

interface Seat {
  name: string;
  tag: string;
  puuid: string;
  agent: string;
  team: 'Blue' | 'Red';
  /** Hidden in-game, recovered by Recon → renders the UNMASKED badge. */
  unmasked: boolean;
  me?: boolean;
  rank: string;
  tier: number;
  peakRank: string;
  peakTier: number;
  level: number;
  kd: number;
  winPct: number;
  hsPct: number;
  acs: number;
  trnScore: number;
  /** Renders as a green party line between these rows. */
  party?: number;
}

const ROSTER: Seat[] = [
  // ── Allies ──────────────────────────────────────────────────────────────
  { name: 'lil ga7ed', tag: 'zngr', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55f2d', agent: 'Sage', team: 'Blue', unmasked: true, me: true, rank: 'Ascendant 3', tier: 23, peakRank: 'Ascendant 3', peakTier: 23, level: 0, kd: 1.011, winPct: 56.36, hsPct: 30.33, acs: 200.7, trnScore: 538 },
  { name: 'シLeVi', tag: '2113', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55f3', agent: 'Breach', team: 'Blue', unmasked: true, rank: 'Immortal 1', tier: 24, peakRank: 'Immortal 2', peakTier: 25, level: 412, kd: 1.18, winPct: 58.9, hsPct: 27.1, acs: 241.3, trnScore: 812 },
  { name: '4523461375', tag: '4135', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55f4', agent: 'Reyna', team: 'Blue', unmasked: true, rank: 'Diamond 2', tier: 19, peakRank: 'Ascendant 1', peakTier: 21, level: 288, kd: 1.09, winPct: 52.4, hsPct: 22.8, acs: 218.6, trnScore: 604 },
  { name: 'ben', tag: 'zWace', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55f5', agent: 'Cypher', team: 'Blue', unmasked: false, rank: 'Platinum 3', tier: 16, peakRank: 'Diamond 1', peakTier: 18, level: 190, kd: 0.98, winPct: 49.1, hsPct: 24.6, acs: 176.2, trnScore: 470 },
  { name: 'xSilentxStorm', tag: '4190', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55f6', agent: 'Sova', team: 'Blue', unmasked: false, rank: 'Ascendant 1', tier: 21, peakRank: 'Ascendant 2', peakTier: 22, level: 355, kd: 1.06, winPct: 54.7, hsPct: 26.2, acs: 205.1, trnScore: 559 },
  // ── Enemies ─────────────────────────────────────────────────────────────
  { name: 'Crespo', tag: 'lemon', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55f7', agent: 'Jett', team: 'Red', unmasked: false, rank: 'Immortal 1', tier: 24, peakRank: 'Immortal 3', peakTier: 26, level: 476, kd: 1.31, winPct: 61.2, hsPct: 29.4, acs: 268.9, trnScore: 940 },
  { name: 'deneimaibro', tag: 'soldi', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55f8', agent: 'Omen', team: 'Red', unmasked: false, rank: 'Diamond 3', tier: 20, peakRank: 'Ascendant 2', peakTier: 22, level: 402, kd: 1.04, winPct: 53.8, hsPct: 21.7, acs: 196.4, trnScore: 611 },
  { name: 'Ssen', tag: '0301', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55f9', agent: 'Raze', team: 'Red', unmasked: false, rank: 'Ascendant 2', tier: 22, peakRank: 'Ascendant 3', peakTier: 23, level: 388, kd: 1.13, winPct: 55.6, hsPct: 25.3, acs: 224.7, trnScore: 690 },
  { name: 'BL0O0DLESS', tag: '8028', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55fa', agent: 'Killjoy', team: 'Red', unmasked: false, rank: 'Platinum 1', tier: 14, peakRank: 'Platinum 3', peakTier: 16, level: 244, kd: 0.94, winPct: 47.3, hsPct: 23.1, acs: 168.9, trnScore: 412 },
  { name: 'noopye', tag: 'nupi', puuid: '2ef28c39-c342-55f0-a159-9cd0cae55fb', agent: 'Chamber', team: 'Red', unmasked: false, rank: 'Diamond 1', tier: 18, peakRank: 'Diamond 2', peakTier: 19, level: 331, kd: 1.07, winPct: 51.9, hsPct: 28.0, acs: 209.5, trnScore: 573 },
];

/** Build the seeded lobby. `phase: 'coregame'` is required for loadouts. */
function buildLobby(): LiveMatchState {
  const mk = (s: Seat): LiveMatchPlayer => {
    const meta = AGENTS[s.agent.toLowerCase()];
    return {
      puuid: s.puuid,
      name: s.name,
      tag: s.tag,
      team: s.team,
      agentId: meta?.uuid ?? '',
      agentName: s.agent,
      agentIcon: meta?.icon ?? '',
      agentRole: meta?.role ?? '',
      tier: s.tier,
      rank: s.rank,
      rr: 10 + (s.tier % 7) * 9,
      peakTier: s.peakTier,
      peakRank: s.peakRank,
      peakSeasonId: '8102cd81-43a0-d0d7-bd59-47b8fe9bed1b',
      actWins: 38 + (s.level % 11),
      actGames: 61 + (s.level % 19),
      accountLevel: s.level,
      cardId: '7d7bbcea-4601-5629-7134-a2aaf547ccbd',
      isMe: Boolean(s.me),
      region: 'eu',
      country: 'EG',
      kd: s.kd,
      winPct: s.winPct,
      hsPct: s.hsPct,
      acs: s.acs,
      trnScore: s.trnScore,
      recentWon: 2 + (s.level % 4),
      recentLost: s.level % 3,
      streak: 1 + (s.level % 3),
      streakIsWin: s.level % 2 === 0,
      partyIndex: s.party,
      partyId: s.party ? `preview-party-${s.party}` : undefined,
      /* Hidden in-game; Recon resolved it from the account UUID. */
      isIncognito: s.unmasked,
      nameResolved: true,
    };
  };

  const blue = ROSTER.filter((s) => s.team === 'Blue').map(mk);
  const red = ROSTER.filter((s) => s.team === 'Red').map(mk);
  const withParties = (list: LiveMatchPlayer[]) =>
    list.map((p, i) => {
      const seeded = ROSTER.find((s) => s.puuid === p.puuid);
      return { ...p, partyIndex: seeded?.party ?? i };
    });

  return {
    phase: 'coregame',
    matchId: 'preview-match-lotus',
    mapId: '/Game/Maps/Jam/Jam',
    mapName: 'Lotus',
    mode: 'Competitive',
    queueId: 'competitive',
    isDeathmatch: false,
    startingSide: 'Attack',
    allyScore: 7,
    enemyScore: 5,
    blueTeam: withParties(blue),
    redTeam: withParties(red),
    updatedAt: Date.now(),
  };
}

/* ── Weapon skins ─────────────────────────────────────────────────────── */

/**
 * One entry per weapon slot, resolved from valorant-api once and baked.
 * `skinUuid` is the equipped skin's chroma; `defaultUuid` is the standard
 * weapon, used when a slot has no skin.
 */
const WEAPON_SLOTS: Array<{ weaponUuid: string; skinUuid: string; defaultUuid: string }> = [
  { weaponUuid: '29a0cfab-485b-f5d5-779a-b59f85e204a8', skinUuid: 'e8a35ddb-4ce7-3867-154c-94803ed12a24', defaultUuid: '24aee897-4cdc-b0fd-e596-1ba90fa6d1b2' }, // Classic — Prime Classic
  { weaponUuid: '42da8ccc-40d5-affc-beec-15aa47b42eda', skinUuid: '25e2a599-4564-708a-b80e-afbeb6781372', defaultUuid: '48ad078a-4dae-2b85-a945-f4b6d1efecbb' }, // Shorty — Oni Shorty
  { weaponUuid: '44d4e95c-4157-0037-81b2-17841bf2e8e3', skinUuid: 'f70dc825-4be6-0074-0526-758b3f183152', defaultUuid: 'f06657f3-48b6-6314-7235-a9a2749df5b9' }, // Frenzy — Elderflame Frenzy
  { weaponUuid: '1baa85b4-4c70-1284-64bb-6481dfc3bb4e', skinUuid: 'd5e747da-4d41-28e2-68b2-c5b41584f7cb', defaultUuid: '1c63b43b-43c4-04e4-01c9-7aa1bffa5ac1' }, // Ghost — Sovereign Ghost
  { weaponUuid: 'e336c6b8-418d-9340-d77f-7a9e4cfe0702', skinUuid: 'a47a0d1b-4405-9de7-6011-68a9a4a1f36d', defaultUuid: '1ef6ba68-4dbe-30c7-6bc8-93a6c6f13f04' }, // Sheriff — Reaver Sheriff
  { weaponUuid: 'f7e1b454-4ad4-1063-ec0a-159e56b58941', skinUuid: '66a6a6a1-44c7-beac-0b67-54aaa8243367', defaultUuid: '940fb417-4a9c-3004-41f5-3e8f1f4178b2' }, // Stinger — Spline Stinger
  { weaponUuid: '462080d1-4035-2937-7c09-27aa2a5c27a7', skinUuid: 'fefc628b-4078-c57b-dcc7-3591eca5c4d0', defaultUuid: 'f01d1307-4299-42f5-2c5e-7dab7e69ab19' }, // Spectre — Prime Spectre
  { weaponUuid: '910be174-449b-c412-ab22-d0873436b21b', skinUuid: 'e1fed5e0-4369-7de0-2545-b6ab4c0f7369', defaultUuid: '70c97fb2-4d79-d4bb-5173-a1888cd4bfd9' }, // Bucky — Gaia Bucky
  { weaponUuid: 'ec845bf4-4f79-ddda-a3da-0db3774b2794', skinUuid: 'c60c98e3-41de-ed9c-fb92-aa9c6e0bc7a0', defaultUuid: 'acd26127-48ff-8b9e-7ba6-b989af8a4b24' }, // Judge — Glitchpop Judge
  { weaponUuid: 'ae3de142-4d85-2547-dd26-4e90bed35cf7', skinUuid: '9a107ffd-462d-9fc1-241d-759fbe79c02d', defaultUuid: '724a7f42-4315-eccf-0e76-77bdd3ec2e09' }, // Bulldog — Aerosol Bulldog
  { weaponUuid: '4ade7faa-4cf1-8376-95ef-39884480959b', skinUuid: '4e1b9e7d-4cfc-9a14-4fe1-ea9185cdb6d9', defaultUuid: '3bf1e8e0-47e8-f27a-6054-929575f41a54' }, // Guardian — Reaver Guardian
  { weaponUuid: 'ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a', skinUuid: '9b866c42-4201-9c1c-86b0-5e95b7e4c3cd', defaultUuid: '337cb216-4a6e-d85d-88c2-f29ab317784c' }, // Phantom — Magepunk Phantom
  { weaponUuid: '9c82e19d-4575-0200-1a81-3eacf00cf872', skinUuid: '22821a32-4e04-ad4a-1893-95904c08b264', defaultUuid: '27f21d97-4c4b-bd1c-1f08-31830ab0be84' }, // Vandal — Prime Vandal
  { weaponUuid: 'c4883e50-4494-202c-3ec3-6b8a9284f00b', skinUuid: '50e45282-418c-6658-0a5e-e48db6c9542c', defaultUuid: 'fd44b2d5-49ee-77ab-fa56-588f3ac0c268' }, // Marshal — Kuronami Marshal
  { weaponUuid: 'a03b24d3-4319-996d-0f8c-94bbfba1dfc7', skinUuid: '41ad7696-47bf-cd88-115b-9cb17ad77919', defaultUuid: 'd1f2920f-469a-3431-ad96-96afbd0017f2' }, // Operator — Elderflame Operator
  { weaponUuid: '55d8a0f4-4274-ca67-fe2c-06ab45efdf58', skinUuid: '6b12682c-4813-d34f-322d-67b0211e1e6d', defaultUuid: '5305d9c4-4f46-fbf4-9e9a-dea772c263b5' }, // Ares — Singularity Ares
  { weaponUuid: '63e6c2b6-4a8e-869c-3d4c-e38355226584', skinUuid: '8c95559d-44fb-544d-00d7-8192ed38b17a', defaultUuid: 'f454efd1-49cb-372f-7096-d394df615308' }, // Odin — Glitchpop Odin
  { weaponUuid: '2f59173c-4bed-b6c3-2191-dea9b58be9c7', skinUuid: '84d08ce6-468c-b95b-9bbb-408dcdcee76f', defaultUuid: '12cc9ed2-4430-d2fe-3064-f7a19b1ba7c7' }, // Melee — Prime Karambit
];

/* The wheel reads selections[0..3]: three pre/post-round sprays plus a flex.
   Same keys Riot sends, so parseLoadoutEntry resolves them for real. */
const EXPRESSIONS = [
  '7e2ba2e8-4597-060a-b41e-81acedca414e',
  'fe86a4c5-4e92-324b-4c0d-a7a837d0d548',
  '7e85d0ab-4cc5-d869-5485-798aae7e8656',
  'fc33f376-4a58-687c-6961-bd8a7e529346',
];

/**
 * Build a Riot-shaped loadout payload for every player in the roster.
 *
 * Shape: `[{ CharacterID, Loadout: { Subject, Items: { <weaponUuid>: { Sockets:
 * { [SKIN_SOCKET]: { Item: { ID: <chromaUuid> } } } } } } }]` — exactly what
 * `parseLoadoutEntry` reads.
 */
function buildLoadouts(): unknown[] {
  const items: Record<string, unknown> = {};
  for (const slot of WEAPON_SLOTS) {
    items[slot.weaponUuid] = {
      Sockets: { [SKIN_SOCKET]: { Item: { ID: slot.skinUuid } } },
    };
  }

  return ROSTER.map((s) => ({
    CharacterID: AGENTS[s.agent.toLowerCase()]?.uuid ?? '',
    Loadout: {
      Subject: s.puuid,
      Items: items,
      Expressions: { AESSelections: EXPRESSIONS.map((assetId) => ({ AssetID: assetId })) },
    },
  }));
}

/**
 * Write both preview keys. Synchronous and idempotent — no network, no awaiting,
 * so the app's first render already has everything and never flashes an empty
 * state. Never throws.
 */
export function seedPreviewData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOBBY_KEY, JSON.stringify(buildLobby()));
  } catch {
    /* leave the app on its own idle state */
  }
  try {
    localStorage.setItem(LOADOUTS_KEY, JSON.stringify({ Loadouts: buildLoadouts() }));
  } catch {
    /* loadout viewer will report "no data" like the real app does */
  }
}
