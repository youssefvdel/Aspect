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
  detailsById: Record<string, TrackerMatchDetail>;
  detailsReady: number;
  detailsTotal: number;
  isLoading: boolean;
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
  const [detailsById, setDetailsById] = useState<Record<string, TrackerMatchDetail>>({});
  const [detailsReady, setDetailsReady] = useState(0);
  const [detailsTotal, setDetailsTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const autoTried = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setBanner(null);
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
      // Scoreboards load in the background: details are immutable and cached
      // forever, so every visit gets faster.
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
          .catch(() => {});
      }
    } catch (e) {
      setBanner(String(e instanceof Error ? e.message : e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    refresh();
  }, [refresh]);

  return { profile, games, queueById, mapById, seasonNames, seasonOrder, tierIcons, agentInfo, weapons, agg, detailsById, detailsReady, detailsTotal, isLoading, banner, setBanner, refresh };
}
