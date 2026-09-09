import type { TrackerMatchDetail } from '../types';

/**
 * Stats in → tip strings out. Deterministic, no AI, no network.
 * Every rule guards missing data and stays silent instead of guessing.
 * Player is identified by puuid (stable across name changes).
 */
export function buildTips(detail: TrackerMatchDetail, puuid: string): string[] {
  const tips: string[] = [];
  if (!puuid || detail.rounds.length === 0) return tips;

  const me = detail.players.find((p) => p.puuid === puuid);
  const rounds = detail.rounds.length;

  // Per-round kill map for the player.
  const myKillsByRound = new Map<number, number>();
  // First death per round: earliest kill event in each round.
  const firstDeathByRound = new Map<number, string>();
  const firstKillByRound = new Map<number, string>();
  const byRound = new Map<number, typeof detail.kills>();
  for (const k of detail.kills) {
    if (!byRound.has(k.round)) byRound.set(k.round, []);
    byRound.get(k.round)!.push(k);
  }
  for (const [round, ks] of byRound) {
    const ordered = [...ks].sort((a, b) => a.timeInRound - b.timeInRound);
    const first = ordered[0];
    if (first) {
      firstDeathByRound.set(round, first.victimPuuid);
      firstKillByRound.set(round, first.killerPuuid);
    }
    myKillsByRound.set(round, ks.filter((k) => k.killerPuuid === puuid).length);
  }

  let firstDeaths = 0;
  let openingDuels = 0;
  let openingWins = 0;
  for (const [round, victim] of firstDeathByRound) {
    if (victim === puuid) {
      firstDeaths++;
      openingDuels++;
    } else if (firstKillByRound.get(round) === puuid) {
      openingDuels++;
      openingWins++;
    }
  }

  let multiRounds = 0;
  let blankLosses = 0;
  detail.rounds.forEach((r, i) => {
    const k = myKillsByRound.get(i) ?? 0;
    if (k >= 2) multiRounds++;
    const myTeam = me?.team ?? '';
    const won = myTeam !== '' && r.winningTeam === myTeam;
    if (!won && k === 0) blankLosses++;
  });

  // 1. Dying first.
  if (me && me.deaths >= 5 && firstDeaths / me.deaths > 0.4) {
    const pct = Math.round((firstDeaths / me.deaths) * 100);
    tips.push(`Dying first in ${pct}% of your deaths (${firstDeaths}/${me.deaths}) — play off your entry or trade closer.`);
  }

  // 2. Opening duels.
  if (openingDuels >= 4) {
    const pct = Math.round((openingWins / openingDuels) * 100);
    if (pct < 40) tips.push(`Losing opening duels (${openingWins}/${openingDuels}, ${pct}%) — take fewer 50/50 peeks, hold angles instead.`);
    else if (pct > 65) tips.push(`Winning ${pct}% of opening duels — keep taking space early, it's working.`);
  }

  // 3. Impact rounds.
  if (rounds >= 10 && multiRounds / rounds < 0.12) {
    tips.push(`Only ${multiRounds} multi-kill round(s) in ${rounds} — look for swing timing with your duelist instead of late lurks.`);
  }

  // 4. Aim: headshot rate + damage per round.
  if (me) {
    const fired = me.headshots + me.bodyshots + me.legshots;
    if (fired >= 30) {
      const hs = Math.round((me.headshots / fired) * 100);
      if (hs < 20) tips.push(`Headshot rate ${hs}% — raise crosshair to head level, stop crouch-spraying.`);
    }
    const adr = Math.round(me.damage / rounds);
    const teamDmg = detail.players.filter((p) => p.team === me.team && p.puuid !== puuid);
    if (teamDmg.length > 0) {
      const teamAdr = Math.round(teamDmg.reduce((n, p) => n + p.damage, 0) / teamDmg.length / rounds);
      if (adr < teamAdr * 0.75) {
        tips.push(`Damage ${adr}/round vs team avg ${teamAdr} — you're alive but not trading; stay within refrag distance.`);
      }
    }
    // 5. Blank losses.
    if (blankLosses >= rounds * 0.35 && rounds >= 10) {
      tips.push(`${blankLosses} lost rounds with zero kills — in losing rounds, go for the trade or save, never die alone.`);
    }
  }

  return tips.slice(0, 5);
}
