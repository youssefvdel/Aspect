import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackerMmrPoint, TrackerProfile } from '../types';
import {
  detectLocalAccount,
  detectRegion,
  fetchCompetitiveUpdates,
  fetchHistoryMeta,
  fetchMmrDirect,
  gameData,
  shortMapName,
} from '../utils/tracker';

export interface TrackerData {
  profile: TrackerProfile | null;
  games: TrackerMmrPoint[];
  queueById: Record<string, string>;
  mapById: Record<string, string>;
  seasonNames: Record<string, string>;
  seasonOrder: string[];
  tierIcons: Record<number, string>;
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

  return { profile, games, queueById, mapById, seasonNames, seasonOrder, tierIcons, isLoading, banner, setBanner, refresh };
}
