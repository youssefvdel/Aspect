import type { LiveMatchPlayer, LiveMatchState } from '../types';

/**
 * Dev-dashboard flag. Direct static access is REQUIRED — Vite replaces
 * `import.meta.env.DEV` at compile time; any indirection (aliases, casts
 * through another variable) survives to runtime where `.env` is undefined.
 */
export const IS_DEV: boolean = import.meta.env.DEV === true;

export type DevMockPhase = 'off' | 'pregame' | 'coregame' | 'deathmatch';
export const DEV_MOCK_KEY = 'aspect_dev_mock_match';
export const DEV_TAB_KEY = 'aspect_dev_tab_held';
export const DEV_NO_CLIENT_KEY = 'aspect_dev_no_client';

const readFlag = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getDevMockPhase = (): DevMockPhase => {
  if (!IS_DEV) return 'off';
  const v = readFlag(DEV_MOCK_KEY);
  return v === 'pregame' || v === 'coregame' || v === 'deathmatch' ? v : 'off';
};

/** Physical-Tab override for testing the in-match scoreboard peek hands-free. */
export const isDevTabHeld = (): boolean => {
  if (!IS_DEV) return false;
  try {
    return localStorage.getItem(DEV_TAB_KEY) === '1';
  } catch {
    return false;
  }
};

/** Pretend the Riot Client is closed to exercise empty states. */
export const isDevNoClient = (): boolean => {
  if (!IS_DEV) return false;
  try {
    return localStorage.getItem(DEV_NO_CLIENT_KEY) === '1';
  } catch {
    return false;
  }
};

let mockIdx = 0;
const mk = (
  name: string,
  team: 'Blue' | 'Red',
  tier: number,
  rank: string,
  extra?: Partial<LiveMatchPlayer>
): LiveMatchPlayer => {
  const i = mockIdx++;
  return {
    puuid: `dev-puuid-${team}-${i}`,
    name,
    tag: `DEV${i}`,
    team,
    agentId: '',
    agentName: 'Selecting…',
    agentIcon: '',
    agentRole: '',
    tier,
    rank,
    rr: 40 + i,
    peakTier: tier + 3,
    peakRank: rank,
    accountLevel: 100 + i,
    cardId: '',
    isMe: false,
    selectionState: '',
    region: 'EU',
    country: 'DE',
    kd: 1.1,
    ...extra,
  };
};

const FIVE = ['You', 'Shadow', 'ViperX', 'Clutch', 'Phantom'];
const FOE = ['ReynaMain', 'Silent', 'Headshot', 'EcoFrag', 'Smurf'];

function mockPregame(): LiveMatchState {
  mockIdx = 0;
  const blueTeam = FIVE.map((n, i) => mk(n, 'Blue', 21 - (i % 2), i % 2 ? 'Diamond 2' : 'Diamond 1', i === 0 ? { isMe: true } : undefined));
  const redTeam = FOE.map((n, i) => mk(n, 'Red', 20 + (i % 3), 'Platinum 3'));
  return {
    phase: 'pregame',
    matchId: 'dev-match-pregame',
    mapId: '/game/maps/ascent/ascent',
    mapName: 'Ascent',
    mode: 'Competitive / Unrated',
    isDeathmatch: false,
    blueTeam,
    redTeam,
    updatedAt: Date.now(),
  };
}

function mockCoregame(): LiveMatchState {
  const s = mockPregame();
  const agents = ['Jett', 'Omen', 'Sova', 'Killjoy', 'Raze'];
  const foes = ['Reyna', 'Viper', 'Cypher', 'Sage', 'Phoenix'];
  return {
    ...s,
    phase: 'coregame',
    matchId: 'dev-match-coregame',
    blueTeam: s.blueTeam.map((p, i) => ({ ...p, agentName: agents[i] })),
    redTeam: s.redTeam.map((p, i) => ({ ...p, agentName: foes[i] })),
    updatedAt: Date.now(),
  };
}

function mockDeathmatch(): LiveMatchState {
  mockIdx = 0;
  const mkDm = (n: number, team: 'Blue' | 'Red'): LiveMatchPlayer =>
    mk(`Fragger${n}`, team, 18 + (n % 5), 'Gold 3', n === 1 ? { isMe: true, name: 'You' } : undefined);
  return {
    phase: 'coregame',
    matchId: 'dev-match-deathmatch',
    mapId: '/game/maps/bonsai/bonsai',
    mapName: 'Split',
    mode: 'Deathmatch',
    isDeathmatch: true,
    blueTeam: [1, 2, 3, 4, 5, 6].map((n) => mkDm(n, 'Blue')),
    redTeam: [7, 8, 9, 10, 11, 12].map((n) => mkDm(n, 'Red')),
    updatedAt: Date.now(),
  };
}

/** Canned match state for testing overlay + live views with Riot closed. */
export function getDevMockMatch(): LiveMatchState | null {
  switch (getDevMockPhase()) {
    case 'pregame':
      return mockPregame();
    case 'coregame':
      return mockCoregame();
    case 'deathmatch':
      return mockDeathmatch();
    default:
      return null;
  }
}
