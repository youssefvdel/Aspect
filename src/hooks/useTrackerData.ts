import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackerMatchDetail, TrackerMmrPoint, TrackerProfile } from '../types';
import {
  aggregateDetails,
  detectLocalAccount,
  detectRegion,
  fetchCompetitiveUpdates,
  fetchHistoryMeta,
  fetchMmrDirect,
  gameData,
  shortMapName,
  type AggStats,
} from '../utils/tracker';
import { fetchTrnActStats, fetchTrnAgents, fetchTrnMaps, type TrnActStats, type TrnAgentStat, type TrnMapStat } from '../utils/trn';

export interface TrackerData {
  profile: TrackerProfile | null;
  games: TrackerMmrPoint[];
  queueById: Record<string, string>;
  mapById: Record<string, string>;
  seasonNames: Record<string, string>;
  seasonOrder: string[];
  tierIcons: Record<number, string>;
  agentInfo: Record<string, { name: string; icon: string; role: string; roleIcon: string }>;
  weapons: Record<string, string>;
  agg: AggStats | null;
  trn: TrnActStats | null;
  trnAgents: TrnAgentStat[];
  trnMaps: TrnMapStat[];
  trnPrev: Record<string, { kd: number; matches: number }>;
  detailsById: Record<string, TrackerMatchDetail>;
  detailsReady: number;
  detailsTotal: number;
  isLoading: boolean;
  ready: boolean;
  banner: string | null;
  setBanner: (m: string | null) => void;
  refresh: () => Promise<void>;
}

/** Single shared loader for Overview + Match History. Auto-loads once on mount. */
export function useTrackerData(): TrackerData {
  const [profile, setProfile] = useState<TrackerProfile | null>(null);
  const [games, setGames] = useState<TrackerMmrPoint[]>([]);
  const [queueById, setQueueById] = useState<Record<string, string>>({});
  const [mapById, setMapById] = useState<Record<string, string>>({});
  const [seasonNames, setSeasonNames] = useState<Record<string, string>>({});
  const [seasonOrder, setSeasonOrder] = useState<string[]>([]);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [agentInfo, setAgentInfo] = useState<Record<string, { name: string; icon: string; role: string; roleIcon: string }>>({});
  const [weapons, setWeapons] = useState<Record<string, string>>({});
  const [agg, setAgg] = useState<AggStats | null>(null);
  const [trn, setTrn] = useState<TrnActStats | null>(null);
  const [trnAgents, setTrnAgents] = useState<TrnAgentStat[]>([]);
  const [trnMaps, setTrnMaps] = useState<TrnMapStat[]>([]);
  const [trnPrev, setTrnPrev] = useState<Record<string, { kd: number; matches: number }>>({});
  const [trnDone, setTrnDone] = useState(false);
  const [detailsDone, setDetailsDone] = useState(false);
  const [detailsById, setDetailsById] = useState<Record<string, TrackerMatchDetail>>({});
  const [detailsReady, setDetailsReady] = useState(0);
  const [detailsTotal, setDetailsTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const autoTried = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setBanner(null);
    setTrnDone(false);
    setDetailsDone(false);
    try {
      const region = await detectRegion();
      let accName = '';
      let accTag = '';
      try {
        const acc = await detectLocalAccount();
        accName = acc.game_name;
        accTag = acc.tagline;
      } catch {}
      const [prof, comp] = await Promise.all([
        fetchMmrDirect(region, accName, accTag),
        fetchCompetitiveUpdates(region, 20),
      ]);
      setProfile({ ...prof, name: accName, tag: accTag });
      setGames(comp);
      const [gd, meta] = await Promise.all([
        gameData(),
        fetchHistoryMeta(region, 0, 20).catch(() => ({ total: 0, queueById: {} as Record<string, string> })),
      ]);
      const mm: Record<string, string> = {};
      for (const g of comp) mm[g.matchId] = shortMapName(g.mapId, gd.maps);
      setMapById(mm);
      setQueueById(meta.queueById);
      setSeasonNames(gd.seasons);
      setSeasonOrder(gd.seasonOrder);
      setTierIcons(gd.tierIcons);
      setAgentInfo(gd.agentInfo);
      setWeapons(gd.weapons);
      // TRN enrichment (act-wide incl. ties + HS%): best effort, Riot-direct
      // stays the fallback so the tab never depends on it.
      if (accName) {
        fetchTrnActStats(accName, accTag, prof.currentSeasonId)
          .then(({ stats }) => setTrn(stats))
          .catch(() => setTrn(null))
          .finally(() => setTrnDone(true));
        if (prof.currentSeasonId) {
          fetchTrnAgents(accName, accTag, prof.currentSeasonId)
            .then(setTrnAgents)
            .catch(() => setTrnAgents([]));
          fetchTrnMaps(accName, accTag, prof.currentSeasonId)
            .then(setTrnMaps)
            .catch(() => setTrnMaps([]));
        }
      } else {
        setTrnDone(true);
      }
        // Previous-act K/D + match counts (max 3, best effort).
        {
          const played = new Set(prof.seasons.filter((s) => s.games > 0).map((s) => s.id.toLowerCase()));
          const order = gd.seasonOrder.length > 0 ? gd.seasonOrder : [...played];
          const prev = order
            .filter((id) => id !== prof.currentSeasonId.toLowerCase() && played.has(id))
            .slice(0, 3);
          Promise.all(
            prev.map((sid) =>
              fetchTrnActStats(accName, accTag, sid)
                .then(({ stats }) => ({ sid, kd: stats.kd, matches: stats.wins + stats.losses + stats.ties }))
                .catch(() => null)
            )
          ).then((res) => {
            const m: Record<string, { kd: number; matches: number }> = {};
            for (const r of res) if (r) m[r.sid] = { kd: r.kd, matches: r.matches };
            setTrnPrev(m);
          });
        }
      const puuid = prof.puuid;
      const ids = comp.map((g) => g.matchId).filter(Boolean);
      setDetailsTotal(ids.length);
      setDetailsReady(0);
      if (puuid && ids.length > 0) {
        aggregateDetails(region, ids, puuid)
          .then(({ agg: a, byId }) => {
            setAgg(a);
            setDetailsById(byId);
            setDetailsReady(Object.keys(byId).length);
          })
          .catch(() => {})
          .finally(() => setDetailsDone(true));
      } else {
        setDetailsDone(true);
      }
    } catch (e) {
      setBanner(String(e instanceof Error ? e.message : e));
      setTrnDone(true);
      setDetailsDone(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    refresh();
  }, [refresh]);

  const ready = !isLoading && profile !== null && trnDone && detailsDone;

  return { profile, games, queueById, mapById, seasonNames, seasonOrder, tierIcons, agentInfo, weapons, agg, trn, trnAgents, trnMaps, trnPrev, detailsById, detailsReady, detailsTotal, isLoading, ready, banner, setBanner, refresh };
}
