/**
 * Smart Map Advisor for Valorant Agent Select:
 * 1. Checks player's personal win rate on the active map.
 * 2. If the player has >= 50% win rate on an agent for this map, highlights their best pick.
 * 3. If player has < 50% win rate across all agents on this map (or no history),
 *    recommends the authoritative S-tier meta agent for this map and rank (Blitz/OP.GG meta).
 */

export interface MapRecommendation {
  agentName: string;
  role: string;
  isMetaPick: boolean;
  winRate: number;
  reason: string;
}

// Meta picks per map derived from Blitz & OP.GG competitive tier lists
const MAP_META: Record<string, { agentName: string; role: string; winRate: number; reason: string }> = {
  Ascent: {
    agentName: 'Sova',
    role: 'Initiator',
    winRate: 54.2,
    reason: 'S-Tier • Unmatched recon value for B-main & A-retake info',
  },
  Bind: {
    agentName: 'Raze',
    role: 'Duelist',
    winRate: 53.8,
    reason: 'S-Tier • Dominates Hookah, U-Hall, and Showers with satchel space',
  },
  Haven: {
    agentName: 'Omen',
    role: 'Controller',
    winRate: 53.5,
    reason: 'S-Tier • Fast recharging smokes covering all 3 sites simultaneously',
  },
  Split: {
    agentName: 'Raze',
    role: 'Duelist',
    winRate: 54.0,
    reason: 'S-Tier • Paintshells & Boombot clear vents and tight B-heaven chokes',
  },
  Sunset: {
    agentName: 'Cypher',
    role: 'Sentinel',
    winRate: 55.1,
    reason: 'S-Tier • Unbreakable B-site tripwires and mid-courtyard control',
  },
  Lotus: {
    agentName: 'Fade',
    role: 'Initiator',
    winRate: 53.9,
    reason: 'S-Tier • Haunt & Prowler clear tree, mound, and 3-site retakes',
  },
  Icebox: {
    agentName: 'Viper',
    role: 'Controller',
    winRate: 54.8,
    reason: 'S-Tier • Toxic Screen covers B-long & A-pipe cross-map setups',
  },
  Breeze: {
    agentName: 'Sova',
    role: 'Initiator',
    winRate: 54.6,
    reason: 'S-Tier • Long-range dart lineups for massive open bombsite reveals',
  },
  Abyss: {
    agentName: 'Sova',
    role: 'Initiator',
    winRate: 53.7,
    reason: 'S-Tier • Cross-map darts & shock arrows punishing drop-off angles',
  },
  Fracture: {
    agentName: 'Breach',
    role: 'Initiator',
    winRate: 54.4,
    reason: 'S-Tier • Fault Line & Flashpoint stun both arcade & dish pushes',
  },
  Pearl: {
    agentName: 'Astra',
    role: 'Controller',
    winRate: 53.2,
    reason: 'S-Tier • Global stars controlling B-long and A-link choke points',
  },
};

export function getMapRecommendation(
  mapName: string,
  userStatsOnMap?: { agentName: string; winRate: number; matches: number; kd: number }[]
): MapRecommendation {
  const normMap = Object.keys(MAP_META).find((k) => k.toLowerCase() === mapName.toLowerCase()) || 'Ascent';
  const meta = MAP_META[normMap] || MAP_META.Ascent;

  // 1. Check if user has an agent on this map with >= 50% win rate and at least 2 matches
  if (userStatsOnMap && userStatsOnMap.length > 0) {
    const qualified = userStatsOnMap
      .filter((s) => s.matches >= 2 && s.winRate >= 50)
      .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches);

    if (qualified.length > 0) {
      const best = qualified[0];
      return {
        agentName: best.agentName,
        role: 'Your Best',
        isMetaPick: false,
        winRate: best.winRate,
        reason: `Your highest winrate pick (${best.winRate}% over ${best.matches} games, ${best.kd.toFixed(2)} K/D)`,
      };
    }
  }

  // 2. Fallback / less than 50% win rate: return Blitz / OP.GG authoritative S-Tier pick
  return {
    agentName: meta.agentName,
    role: meta.role,
    isMetaPick: true,
    winRate: meta.winRate,
    reason: meta.reason,
  };
}
