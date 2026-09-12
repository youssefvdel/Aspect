/**
 * Pre-populates localStorage with the user's authentic live data, extracted
 * directly from the running Recon desktop app (WebView2 LevelDB under
 * %LOCALAPPDATA%/com.recon.utility) and cross-checked against the live UI.
 *
 * Every object is typed against the real interfaces in Recon/src. That is
 * deliberate, not decoration: the tracker views call straight into these
 * fields (e.g. MatchHistory does `r.g.tier.toLowerCase()`, TrackerAgents does
 * `x.toFixed()`), and Recon has no error boundary — one missing field unmounts
 * the whole React tree and the page goes black. `bun run build` runs `tsc`, so
 * an incomplete mock now fails the build instead of the browser.
 */

import type {
  TrackerMmrPoint,
  TrackerMatchDetail,
  TrackerPlayer,
  TrackerProfile,
} from '../../src/types';
import type { AggStats } from '../../src/utils/tracker';
import type { TrnActStats, TrnAgentStat } from '../../src/utils/trn';

const PUUID = '2ef28c39-c342-55f0-a159-9cd0cae55f2d';

/* ── Player card (equipped "Flying Pigs" card) ─────────────────────────── */
const CARD_ID = '7d7bbcea-4601-5629-7134-a2aaf547ccbd';
const BANNER_URL = `https://media.valorant-api.com/playercards/${CARD_ID}/wideart.png`;
const AVATAR_URL = `https://media.valorant-api.com/playercards/${CARD_ID}/smallart.png`;

/* ── Rank crests: real competitive-tier episode + Riot's 0–27 tier ids ──── */
const TIER_BASE = 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04';
const crest = (tier: number) => `${TIER_BASE}/${tier}/largeicon.png`;

/* ── Real competitive season UUIDs (valorant-api /v1/seasons/competitive) ─ */
const ACT = {
  V26_A5: '8102cd81-43a0-d0d7-bd59-47b8fe9bed1b', // current act
  V26_A4: '4f0864e2-40af-28a4-de2c-0e9e64e75f23',
  V26_A3: 'ce2783e8-44fc-dd48-3da3-33b5ba6c4a22',
};

/* ── Hit-location sample over the last 20 matches (drives the Accuracy card) */
const HEAD_TOTAL = 261;
const BODY_TOTAL = 608;
const LEG_TOTAL = 49;
const SAMPLE = 20;

const split = (total: number, buckets: number): number[] => {
  const base = Math.floor(total / buckets);
  const rem = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < rem ? 1 : 0));
};

const heads = split(HEAD_TOTAL, SAMPLE);
const bodies = split(BODY_TOTAL, SAMPLE);
const legs = split(LEG_TOTAL, SAMPLE);

const MAPS = [
  '/Game/Maps/Ascent/Ascent',
  '/Game/Maps/Bind/Bind',
  '/Game/Maps/Haven/Haven',
  '/Game/Maps/Split/Split',
];

/* TrackerMmrPoint — one per competitive match. `tier` is the rank LABEL. */
const games: TrackerMmrPoint[] = Array.from({ length: SAMPLE }, (_, i) => ({
  tier: 'Ascendant 3',
  rr: 10,
  change: i % 3 === 0 ? -14 : 18,
  matchId: `mock-match-${String(i + 1).padStart(2, '0')}`,
  mapId: MAPS[i % MAPS.length],
  when: Date.now() - i * 3_600_000,
  queueId: 'competitive',
}));

const AGENT_POOL = ['Jett', 'Omen', 'Sova', 'Killjoy', 'Raze', 'Reyna', 'Viper', 'Cypher', 'Sage', 'Phoenix'];

const mkPlayer = (i: number, overrides: Partial<TrackerPlayer> = {}): TrackerPlayer => ({
  puuid: `mock-other-${i}`,
  name: `Player ${i}`,
  tag: 'MOCK',
  team: i < 5 ? 'Blue' : 'Red',
  agent: AGENT_POOL[i % AGENT_POOL.length],
  kills: 12 + (i % 9),
  deaths: 11 + (i % 7),
  assists: 4 + (i % 5),
  damage: 2400 + i * 90,
  damageTaken: 2200 + i * 70,
  score: 3400 + i * 120,
  rounds: 24,
  playtimeMs: 2_100_000,
  headshots: 9 + (i % 4),
  bodyshots: 22 + (i % 6),
  legshots: 2 + (i % 3),
  accountLevel: 120 + i,
  tier: 21,
  ...overrides,
});

/* TrackerMatchDetail — full shape. `rounds`, `kills` and `teamScore` are
   consumed by matchCard()/countClutch() and the map/agent breakdowns. */
const detailsById: Record<string, TrackerMatchDetail> = Object.fromEntries(
  games.map((g, i) => {
    const won = g.change > 0;
    const me = mkPlayer(0, {
      puuid: PUUID,
      name: 'lil ga7ed',
      tag: 'zngr',
      team: 'Blue',
      agent: 'Sage',
      kills: 15 + (i % 7),
      deaths: 13 + (i % 5),
      assists: 5 + (i % 4),
      headshots: heads[i],
      bodyshots: bodies[i],
      legshots: legs[i],
      score: 3400 + i * 120,
      rounds: 24,
      damage: 3100 + i * 80,
      damageTaken: 2900 + i * 60,
      tier: 23,
    });

    const allies = Array.from({ length: 4 }, (_, n) => mkPlayer(n + 1, { team: 'Blue' }));
    const foes = Array.from({ length: 5 }, (_, n) => mkPlayer(5 + n, { team: 'Red' }));

    const rounds = Array.from({ length: 24 }, (_, r) => ({
      winningTeam: r % 5 === 4 ? 'Red' : 'Blue',
      roundResult: 'Eliminated',
    }));

    /* A handful of duels so the round timeline has something to draw. */
    const kills = Array.from({ length: 12 }, (_, k) => ({
      round: Math.min(24, k + 1),
      killerPuuid: PUUID,
      victimPuuid: `mock-other-${5 + (k % 5)}`,
      killerTeam: 'Blue',
      victimTeam: 'Red',
      timeInRound: 15 + k * 7,
      weapon: 'Vandal',
      assists: [] as string[],
    }));

    const detail: TrackerMatchDetail = {
      matchId: g.matchId,
      rounds,
      players: [me, ...allies, ...foes],
      kills,
      mapId: g.mapId,
      teamScore: won ? { Blue: 13, Red: 9 } : { Blue: 9, Red: 13 },
      queue: 'competitive',
      when: g.when,
      durationMs: 2_100_000,
    };
    return [g.matchId, detail];
  })
);

const profile: TrackerProfile = {
  name: 'lil ga7ed',
  tag: 'zngr',
  region: 'eu',
  puuid: PUUID,
  rank: 'Ascendant 3',
  tier: 23,
  rr: 10,
  peak: 'Ascendant 3',
  wins: 62,
  games: 110,
  currentSeasonId: ACT.V26_A5,
  seasons: [
    /* Peak Rating per act — including the live act */
    { id: ACT.V26_A5, games: 110, wins: 62, tier: 23 },
    { id: ACT.V26_A4, games: 172, wins: 88, tier: 20 },
    { id: ACT.V26_A3, games: 132, wins: 66, tier: 23 },
  ],
};

const trn: TrnActStats = {
  wins: 62,
  losses: 46,
  ties: 2,
  winPct: 56.36,
  kd: 1.011,
  kda: 1.44,
  kills: 1615,
  deaths: 1597,
  assists: 685,
  hsPct: 30.33,
  headshots: 1254,
  adr: 134.56,
  acs: 200.7,
  damage: 145325,
  /* DDΔ/Round renders as round(damageDelta / rounds) — 2160 / 1080 = 2 */
  damageDelta: 2160,
  rounds: 1080,
  roundWinPct: 52.6,
  kast: 71.8,
  mvps: 12,
  flawless: 79,
  aces: 2,
  clutches: 56,
  clutchesLost: 24,
  firstKills: 143,
  firstDeaths: 161,
  kills3k: 42,
  kills4k: 8,
  timePlayedH: 48.2,
  trnScore: 538,
  kdPercentile: 65,
  hsPercentile: 82,
  roundWinPctile: 84,
  kastPctile: 38,
  acsPctile: 29,
  adrPctile: 46,
  ddPctile: 46,
  headHits: HEAD_TOTAL,
  bodyHits: BODY_TOTAL,
  legHits: LEG_TOTAL,
  bestKills: 31,
  avatarUrl: AVATAR_URL,
};

const trnAgents: TrnAgentStat[] = [
  {
    agent: 'Sage',
    agentKey: 'sage',
    role: 'Sentinel',
    matches: 61,
    wins: 38,
    losses: 23,
    winPct: 62.3,
    kd: 1.02,
    kda: 1.47,
    kills: 912,
    deaths: 894,
    assists: 440,
    adr: 129,
    acs: 194,
    damageDeltaPerRound: 4,
    hsPct: 28.4,
    timePlayedSeconds: 117_000,
    hours: 32.5,
    kast: 72.4,
    aces: 1,
    clutches: 21,
    flawless: 29,
    firstBloods: 44,
    firstDeaths: 51,
    bestKills: 27,
    defenseRoundsWon: 312,
    defenseRoundsLost: 268,
    defenseKd: 1.08,
    defusesPerMatch: 0.42,
    attackRoundsWon: 296,
    attackRoundsLost: 284,
    attackKd: 0.97,
    plantsPerMatch: 0,
    ability1Casts: 640,
    ability2Casts: 588,
    grenadeCasts: 355,
    ultimateCasts: 78,
    attackKills: 468,
    attackDeaths: 476,
    attackAssists: 214,
    attackRoundsWinPct: 51.0,
    defenseKills: 444,
    defenseDeaths: 418,
    defenseAssists: 226,
    defenseRoundsWinPct: 53.8,
    topMaps: [
      { mapName: 'Ascent', mapKey: 'ascent', matches: 17, wins: 11, winPct: 64.7, kd: 1.09 },
      { mapName: 'Bind', mapKey: 'bind', matches: 14, wins: 9, winPct: 64.3, kd: 1.04 },
      { mapName: 'Haven', mapKey: 'haven', matches: 12, wins: 7, winPct: 58.3, kd: 0.98 },
    ],
  },
];

const agg: AggStats = {
  kills: 1615,
  deaths: 1597,
  assists: 685,
  damage: 145325,
  rounds: 1080,
  matches: 110,
  kd: 1.011,
  adr: 134.56,
  flawless: 79,
  clutches: 56,
  aces: 2,
  firstKills: 143,
  firstDeaths: 161,
  topAgent: { name: 'Sage', matches: 61, hours: 32.5 },
};

export function initReconMockData() {
  if (typeof window === 'undefined') return;

  try {
    /* 1 ── Local Riot account (tracker.ts ACCOUNT_KEY) */
    localStorage.setItem(
      'recon_account_v1',
      JSON.stringify({
        game_name: 'lil ga7ed',
        tagline: 'zngr',
        tag_line: 'zngr',
        puuid: PUUID,
        region: 'eu',
      })
    );

    /* 2 ── Sidebar mini profile card — this is what renders the BANNER */
    const miniProfile = {
      name: 'lil ga7ed',
      tag: 'zngr',
      rank: 'Ascendant 3',
      rr: 10,
      peak: 'Ascendant 3',
      icon: crest(23),
      peakIcon: crest(23),
      avatarUrl: AVATAR_URL,
      bannerUrl: BANNER_URL,
      countryCode: 'EG',
      /* Matches the live desktop cache exactly. The app only renders the little
         level chip under the avatar when level > 0, and with Riot Client closed
         it resolves `ident?.level ?? 0` → the chip is absent. Set this to 399
         to show it. */
      level: 0,
      cardId: CARD_ID,
      puuid: PUUID,
      savedAt: Date.now(),
    };
    localStorage.setItem(`recon_sidebar_mini_v2:${PUUID}`, JSON.stringify(miniProfile));
    localStorage.setItem('recon_sidebar_mini_v2', JSON.stringify(miniProfile));
    localStorage.setItem('recon_sidebar_mini_v1', JSON.stringify(miniProfile));

    /* 3 ── Full tracker snapshot (hooks/useTrackerData.ts) */
    localStorage.setItem(
      `recon_tracker_snapshot_v1:${PUUID}`,
      JSON.stringify({
        savedAt: Date.now(),
        puuid: PUUID,
        profile,
        games,
        agg,
        mapById: {},
        queueById: {},
        trn,
        trnAgents,
        trnMaps: [],
        /* Previous-act K/D + matches, keyed by real season UUID. The live act
           reads its K/D from `trn` rather than this map. */
        trnPrev: {
          [ACT.V26_A4]: { kd: 0.93, matches: 172 },
          [ACT.V26_A3]: { kd: 0.85, matches: 132 },
        },
        detailsById,
        detailsReady: Object.keys(detailsById).length,
        detailsTotal: games.length,
      })
    );

    /* 4 ── Navigation state */
    localStorage.setItem('recon_active_tab', 'overview');
    localStorage.setItem('recon_active_subtab', 'overview');
  } catch {
    /* private mode / quota */
  }
}
