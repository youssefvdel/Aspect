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

export interface BlitzMetaAgent {
  agent: string;
  role: string;
  winRate: number;
  pickRate: number;
  tier: 'S+' | 'S';
  reason: string;
}

/** Authoritative S-Tier meta agent picks per map from Blitz.gg competitive stats */
export const BLITZ_MAP_META: Record<string, BlitzMetaAgent[]> = {
  ascent: [
    { agent: 'Sova', role: 'Initiator', winRate: 53.8, pickRate: 74.2, tier: 'S+', reason: 'Unmatched B-main reveal & A-retake shock lineups' },
    { agent: 'Killjoy', role: 'Sentinel', winRate: 52.9, pickRate: 68.5, tier: 'S', reason: 'Lockdown guarantees free retake on A-site & B-site' },
    { agent: 'Omen', role: 'Controller', winRate: 52.4, pickRate: 78.1, tier: 'S', reason: 'One-way smokes on A-short and B-main defend push' },
  ],
  bind: [
    { agent: 'Raze', role: 'Duelist', winRate: 53.6, pickRate: 82.4, tier: 'S+', reason: 'Dominates Hookah, U-Hall & Showers with satchel space' },
    { agent: 'Brimstone', role: 'Controller', winRate: 53.1, pickRate: 65.0, tier: 'S', reason: 'Triple smoke executes & post-plant molly lineups' },
    { agent: 'Cypher', role: 'Sentinel', winRate: 52.8, pickRate: 62.3, tier: 'S', reason: 'Unbreakable B-site cage traps & teleporter surveillance' },
  ],
  sunset: [
    { agent: 'Cypher', role: 'Sentinel', winRate: 54.4, pickRate: 84.6, tier: 'S+', reason: 'B-site trips are impossible to break without utility' },
    { agent: 'Omen', role: 'Controller', winRate: 52.7, pickRate: 72.1, tier: 'S', reason: 'Fast mid courtyard & market smokes for aggressive takes' },
    { agent: 'Breach', role: 'Initiator', winRate: 52.3, pickRate: 58.4, tier: 'S', reason: 'Fault Line stuns entire B-main corridor & A-elbow' },
  ],
  haven: [
    { agent: 'Omen', role: 'Controller', winRate: 53.2, pickRate: 79.5, tier: 'S+', reason: 'Recharging smokes can cover all 3 sites simultaneously' },
    { agent: 'Sova', role: 'Initiator', winRate: 52.8, pickRate: 68.4, tier: 'S', reason: 'Early C-long & Garage recon dart sets up easy picks' },
    { agent: 'Breach', role: 'Initiator', winRate: 52.4, pickRate: 56.2, tier: 'S', reason: 'Flashpoint & Aftershock clear Garage and A-sewer' },
  ],
  split: [
    { agent: 'Raze', role: 'Duelist', winRate: 53.5, pickRate: 85.1, tier: 'S+', reason: 'Paintshells clear vents, screens, and B-heaven chokes' },
    { agent: 'Cypher', role: 'Sentinel', winRate: 53.1, pickRate: 67.8, tier: 'S', reason: 'Holds B-site completely solo with B-back trapwires' },
    { agent: 'Omen', role: 'Controller', winRate: 52.6, pickRate: 74.3, tier: 'S', reason: 'Vertical teleports on A-rafter & B-heaven lurks' },
  ],
  lotus: [
    { agent: 'Fade', role: 'Initiator', winRate: 53.4, pickRate: 76.5, tier: 'S+', reason: 'Haunt roof lineups reveal Tree, A-rubble & C-mound' },
    { agent: 'Killjoy', role: 'Sentinel', winRate: 53.0, pickRate: 64.2, tier: 'S', reason: 'Turret locks C-mound, Lockdown covers all of C-site' },
    { agent: 'Omen', role: 'Controller', winRate: 52.7, pickRate: 78.9, tier: 'S', reason: 'Paranoia hits entire revolving door & A-main corridor' },
  ],
  icebox: [
    { agent: 'Viper', role: 'Controller', winRate: 54.2, pickRate: 88.3, tier: 'S+', reason: 'Toxic Screen is mandatory to cross B-long & block A-pipes' },
    { agent: 'Sova', role: 'Initiator', winRate: 53.5, pickRate: 72.1, tier: 'S', reason: 'Hunter fury & recon darts reveal top site and yellow' },
    { agent: 'Killjoy', role: 'Sentinel', winRate: 52.8, pickRate: 61.4, tier: 'S', reason: 'Alarmbot & Nanoswarms deny B-site default spike plant' },
  ],
  breeze: [
    { agent: 'Sova', role: 'Initiator', winRate: 54.1, pickRate: 78.4, tier: 'S+', reason: 'Huge open sites make recon darts reveal entire bomb sites' },
    { agent: 'Viper', role: 'Controller', winRate: 53.7, pickRate: 86.2, tier: 'S', reason: 'Only controller with wall long enough for Breeze sites' },
    { agent: 'Cypher', role: 'Sentinel', winRate: 52.9, pickRate: 64.1, tier: 'S', reason: 'Flank tripwires on cannon/elbow and B-window surveillance' },
  ],
  abyss: [
    { agent: 'Sova', role: 'Initiator', winRate: 53.6, pickRate: 74.5, tier: 'S+', reason: 'Cross-map darts & shock arrows punish narrow drop-offs' },
    { agent: 'Omen', role: 'Controller', winRate: 53.0, pickRate: 76.8, tier: 'S', reason: 'Paranoia & Shrouded Step across elevated mid drop zones' },
    { agent: 'Cypher', role: 'Sentinel', winRate: 52.5, pickRate: 63.4, tier: 'S', reason: 'Drop-off tripwires cause instant pit fall-off deaths' },
  ],
};

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
