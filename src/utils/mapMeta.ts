import type { TrackerMatchDetail } from '../types';

export interface AgentStatSummary {
  agent: string;
  role?: string;
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
  kd: number;
  hsPct: number;
}

export interface MapMetaAgent {
  agent: string;
  role: string;
  winRate: number;
  pickRate: number;
  tier: 'S+' | 'S' | 'A+';
}

type RankBracket = 'low' | 'mid' | 'high';

function getRankBracket(tier = 21): RankBracket {
  if (tier <= 11) return 'low'; // Iron, Bronze, Silver
  if (tier <= 17) return 'mid'; // Gold, Platinum
  return 'high'; // Diamond, Ascendant, Immortal, Radiant
}

export function getRankTierLabel(tier = 21): string {
  if (tier <= 11) return 'Silver & Below';
  if (tier <= 17) return 'Gold / Plat';
  if (tier <= 23) return 'Diamond / Ascendant';
  return 'Immortal+';
}

// Meta picks keyed by map and rank bracket
const META_BY_MAP: Record<string, Record<RankBracket, MapMetaAgent[]>> = {
  ascent: {
    high: [
      { agent: 'Sova', role: 'Initiator', winRate: 54.2, pickRate: 76.5, tier: 'S+' },
      { agent: 'Omen', role: 'Controller', winRate: 53.1, pickRate: 79.2, tier: 'S' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 52.8, pickRate: 67.4, tier: 'S' },
    ],
    mid: [
      { agent: 'Killjoy', role: 'Sentinel', winRate: 53.2, pickRate: 64.1, tier: 'S+' },
      { agent: 'Sova', role: 'Initiator', winRate: 52.8, pickRate: 69.3, tier: 'S' },
      { agent: 'Omen', role: 'Controller', winRate: 52.5, pickRate: 74.0, tier: 'S' },
    ],
    low: [
      { agent: 'Reyna', role: 'Duelist', winRate: 53.4, pickRate: 81.2, tier: 'S+' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 53.1, pickRate: 59.5, tier: 'S' },
      { agent: 'Clove', role: 'Controller', winRate: 52.8, pickRate: 62.0, tier: 'S' },
    ],
  },
  bind: {
    high: [
      { agent: 'Raze', role: 'Duelist', winRate: 54.1, pickRate: 84.5, tier: 'S+' },
      { agent: 'Brimstone', role: 'Controller', winRate: 53.4, pickRate: 66.8, tier: 'S' },
      { agent: 'Skye', role: 'Initiator', winRate: 52.9, pickRate: 61.2, tier: 'S' },
    ],
    mid: [
      { agent: 'Raze', role: 'Duelist', winRate: 53.5, pickRate: 79.1, tier: 'S+' },
      { agent: 'Brimstone', role: 'Controller', winRate: 53.0, pickRate: 64.5, tier: 'S' },
      { agent: 'Cypher', role: 'Sentinel', winRate: 52.6, pickRate: 58.2, tier: 'S' },
    ],
    low: [
      { agent: 'Reyna', role: 'Duelist', winRate: 53.6, pickRate: 83.4, tier: 'S+' },
      { agent: 'Raze', role: 'Duelist', winRate: 53.2, pickRate: 72.0, tier: 'S' },
      { agent: 'Brimstone', role: 'Controller', winRate: 52.9, pickRate: 61.3, tier: 'S' },
    ],
  },
  sunset: {
    high: [
      { agent: 'Cypher', role: 'Sentinel', winRate: 54.8, pickRate: 86.4, tier: 'S+' },
      { agent: 'Omen', role: 'Controller', winRate: 53.2, pickRate: 74.5, tier: 'S' },
      { agent: 'Breach', role: 'Initiator', winRate: 52.8, pickRate: 61.0, tier: 'S' },
    ],
    mid: [
      { agent: 'Cypher', role: 'Sentinel', winRate: 54.1, pickRate: 81.2, tier: 'S+' },
      { agent: 'Omen', role: 'Controller', winRate: 52.8, pickRate: 70.1, tier: 'S' },
      { agent: 'Raze', role: 'Duelist', winRate: 52.3, pickRate: 66.4, tier: 'S' },
    ],
    low: [
      { agent: 'Reyna', role: 'Duelist', winRate: 53.8, pickRate: 84.1, tier: 'S+' },
      { agent: 'Cypher', role: 'Sentinel', winRate: 53.2, pickRate: 68.5, tier: 'S' },
      { agent: 'Clove', role: 'Controller', winRate: 52.9, pickRate: 63.8, tier: 'S' },
    ],
  },
  haven: {
    high: [
      { agent: 'Omen', role: 'Controller', winRate: 53.8, pickRate: 81.0, tier: 'S+' },
      { agent: 'Sova', role: 'Initiator', winRate: 53.2, pickRate: 71.4, tier: 'S' },
      { agent: 'Breach', role: 'Initiator', winRate: 52.9, pickRate: 59.2, tier: 'S' },
    ],
    mid: [
      { agent: 'Omen', role: 'Controller', winRate: 53.1, pickRate: 76.5, tier: 'S+' },
      { agent: 'Sova', role: 'Initiator', winRate: 52.7, pickRate: 67.2, tier: 'S' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 52.4, pickRate: 60.1, tier: 'S' },
    ],
    low: [
      { agent: 'Reyna', role: 'Duelist', winRate: 53.5, pickRate: 82.3, tier: 'S+' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 52.9, pickRate: 58.6, tier: 'S' },
      { agent: 'Clove', role: 'Controller', winRate: 52.6, pickRate: 61.2, tier: 'S' },
    ],
  },
  split: {
    high: [
      { agent: 'Raze', role: 'Duelist', winRate: 54.0, pickRate: 86.8, tier: 'S+' },
      { agent: 'Cypher', role: 'Sentinel', winRate: 53.4, pickRate: 70.1, tier: 'S' },
      { agent: 'Omen', role: 'Controller', winRate: 52.9, pickRate: 75.3, tier: 'S' },
    ],
    mid: [
      { agent: 'Raze', role: 'Duelist', winRate: 53.5, pickRate: 82.0, tier: 'S+' },
      { agent: 'Cypher', role: 'Sentinel', winRate: 53.0, pickRate: 65.4, tier: 'S' },
      { agent: 'Omen', role: 'Controller', winRate: 52.6, pickRate: 72.1, tier: 'S' },
    ],
    low: [
      { agent: 'Raze', role: 'Duelist', winRate: 53.6, pickRate: 78.4, tier: 'S+' },
      { agent: 'Reyna', role: 'Duelist', winRate: 53.2, pickRate: 81.0, tier: 'S' },
      { agent: 'Sage', role: 'Sentinel', winRate: 52.7, pickRate: 70.5, tier: 'S' },
    ],
  },
  lotus: {
    high: [
      { agent: 'Fade', role: 'Initiator', winRate: 53.9, pickRate: 78.4, tier: 'S+' },
      { agent: 'Omen', role: 'Controller', winRate: 53.2, pickRate: 80.1, tier: 'S' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 52.9, pickRate: 66.3, tier: 'S' },
    ],
    mid: [
      { agent: 'Killjoy', role: 'Sentinel', winRate: 53.1, pickRate: 63.8, tier: 'S+' },
      { agent: 'Fade', role: 'Initiator', winRate: 52.8, pickRate: 72.0, tier: 'S' },
      { agent: 'Omen', role: 'Controller', winRate: 52.5, pickRate: 76.4, tier: 'S' },
    ],
    low: [
      { agent: 'Clove', role: 'Controller', winRate: 53.4, pickRate: 65.2, tier: 'S+' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 52.9, pickRate: 60.1, tier: 'S' },
      { agent: 'Reyna', role: 'Duelist', winRate: 52.7, pickRate: 79.5, tier: 'S' },
    ],
  },
  icebox: {
    high: [
      { agent: 'Viper', role: 'Controller', winRate: 54.6, pickRate: 89.4, tier: 'S+' },
      { agent: 'Sova', role: 'Initiator', winRate: 53.8, pickRate: 74.2, tier: 'S' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 53.1, pickRate: 64.0, tier: 'S' },
    ],
    mid: [
      { agent: 'Viper', role: 'Controller', winRate: 53.9, pickRate: 84.1, tier: 'S+' },
      { agent: 'Sova', role: 'Initiator', winRate: 53.2, pickRate: 69.5, tier: 'S' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 52.7, pickRate: 60.2, tier: 'S' },
    ],
    low: [
      { agent: 'Sage', role: 'Sentinel', winRate: 53.8, pickRate: 76.1, tier: 'S+' },
      { agent: 'Reyna', role: 'Duelist', winRate: 53.2, pickRate: 81.4, tier: 'S' },
      { agent: 'Killjoy', role: 'Sentinel', winRate: 52.9, pickRate: 58.0, tier: 'S' },
    ],
  },
  breeze: {
    high: [
      { agent: 'Sova', role: 'Initiator', winRate: 54.5, pickRate: 80.2, tier: 'S+' },
      { agent: 'Viper', role: 'Controller', winRate: 54.0, pickRate: 88.1, tier: 'S+' },
      { agent: 'Cypher', role: 'Sentinel', winRate: 53.2, pickRate: 66.5, tier: 'S' },
    ],
    mid: [
      { agent: 'Sova', role: 'Initiator', winRate: 53.8, pickRate: 75.4, tier: 'S+' },
      { agent: 'Viper', role: 'Controller', winRate: 53.4, pickRate: 83.2, tier: 'S+' },
      { agent: 'Cypher', role: 'Sentinel', winRate: 52.8, pickRate: 61.0, tier: 'S' },
    ],
    low: [
      { agent: 'Reyna', role: 'Duelist', winRate: 53.7, pickRate: 83.0, tier: 'S+' },
      { agent: 'Viper', role: 'Controller', winRate: 53.1, pickRate: 74.5, tier: 'S' },
      { agent: 'Sova', role: 'Initiator', winRate: 52.8, pickRate: 68.2, tier: 'S' },
    ],
  },
  abyss: {
    high: [
      { agent: 'Sova', role: 'Initiator', winRate: 54.1, pickRate: 77.2, tier: 'S+' },
      { agent: 'Omen', role: 'Controller', winRate: 53.5, pickRate: 79.0, tier: 'S' },
      { agent: 'Cypher', role: 'Sentinel', winRate: 52.9, pickRate: 65.8, tier: 'S' },
    ],
    mid: [
      { agent: 'Sova', role: 'Initiator', winRate: 53.4, pickRate: 72.1, tier: 'S+' },
      { agent: 'Omen', role: 'Controller', winRate: 52.9, pickRate: 74.3, tier: 'S' },
      { agent: 'Cypher', role: 'Sentinel', winRate: 52.5, pickRate: 60.1, tier: 'S' },
    ],
    low: [
      { agent: 'Reyna', role: 'Duelist', winRate: 53.3, pickRate: 82.5, tier: 'S+' },
      { agent: 'Clove', role: 'Controller', winRate: 52.9, pickRate: 66.0, tier: 'S' },
      { agent: 'Sova', role: 'Initiator', winRate: 52.5, pickRate: 65.4, tier: 'S' },
    ],
  },
};

export function getMapMetaPicks(mapName: string, tier = 21): MapMetaAgent[] {
  const norm = mapName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bracket = getRankBracket(tier);
  const mapData = META_BY_MAP[norm] || META_BY_MAP.ascent;
  return mapData[bracket] || mapData.high;
}

/**
 * Filter match history by the active map to compute real per-agent performance on this map
 */
export function computeMapAgentStats(
  activeMapName: string,
  detailsById: Record<string, TrackerMatchDetail>,
  mapById: Record<string, string>,
  myPuuid?: string
): AgentStatSummary[] {
  if (!activeMapName || !myPuuid) return [];
  const normMap = activeMapName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const statsMap: Record<
    string,
    { matches: number; wins: number; losses: number; kills: number; deaths: number; headshots: number; totalShots: number }
  > = {};

  for (const match of Object.values(detailsById)) {
    const rawMap = (mapById[match.mapId?.toLowerCase()] || match.mapId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!rawMap.includes(normMap) && !normMap.includes(rawMap)) continue;

    const me = match.players?.find((p) => p.puuid === myPuuid);
    if (!me || !me.agent) continue;

    const myTeam = me.team;
    const teamScore = match.teamScore?.[myTeam] ?? 0;
    const enemyTeam = Object.keys(match.teamScore || {}).find((t) => t !== myTeam);
    const enemyScore = enemyTeam ? match.teamScore[enemyTeam] ?? 0 : 0;
    const won = teamScore > enemyScore;

    const aName = me.agent;
    if (!statsMap[aName]) {
      statsMap[aName] = { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, headshots: 0, totalShots: 0 };
    }
    statsMap[aName].matches += 1;
    if (won) statsMap[aName].wins += 1;
    else statsMap[aName].losses += 1;
    statsMap[aName].kills += me.kills || 0;
    statsMap[aName].deaths += me.deaths || 0;
    statsMap[aName].headshots += me.headshots || 0;
    statsMap[aName].totalShots += (me.headshots || 0) + (me.bodyshots || 0) + (me.legshots || 0);
  }

  return Object.entries(statsMap)
    .map(([agent, s]) => {
      const winPct = s.matches > 0 ? (s.wins / s.matches) * 100 : 0;
      const kd = s.deaths > 0 ? s.kills / s.deaths : s.kills;
      const hsPct = s.totalShots > 0 ? (s.headshots / s.totalShots) * 100 : 0;
      return {
        agent,
        matches: s.matches,
        wins: s.wins,
        losses: s.losses,
        winPct: Number(winPct.toFixed(1)),
        kd: Number(kd.toFixed(2)),
        hsPct: Number(hsPct.toFixed(0)),
      };
    })
    .sort((a, b) => b.matches - a.matches || b.winPct - a.winPct);
}
