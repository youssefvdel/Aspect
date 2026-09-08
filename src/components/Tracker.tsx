import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Crosshair,
  Lightbulb,
  Search,
} from 'lucide-react';
import type { TrackerMatch, TrackerMatchDetail, TrackerMmrPoint, TrackerProfile } from '../types';
import { CustomDropdown } from './ValorantConfig';
import {
  detectLocalAccount,
  fetchCompetitiveUpdates,
  fetchHistoryIds,
  fetchMatchDetail,
  fetchMatchDetailDirect,
  fetchMatchHistory,
  fetchMmr,
  fetchMmrDirect,
  fetchMmrHistory,
  gameData,
  getEntitlements,
  toHistoryRow,
} from '../utils/tracker';
import { buildTips } from '../utils/trackerTips';

const REGIONS = [
  { value: 'eu', label: 'Europe' },
  { value: 'na', label: 'North America' },
  { value: 'ap', label: 'Asia-Pacific' },
  { value: 'br', label: 'Brazil' },
  { value: 'latam', label: 'Latin America' },
  { value: 'kr', label: 'Korea' },
];

const lsGet = (k: string): string => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
const lsSet = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

const MatchRow: React.FC<{
  m: TrackerMatch;
  rrDelta: number | null;
  loadDetail: (id: string) => Promise<TrackerMatchDetail>;
  puuid: string;
  expanded: boolean;
  onToggle: () => void;
  onBanner: (msg: string) => void;
}> = ({ m, rrDelta, loadDetail, puuid, expanded, onToggle, onBanner }) => {
  const [detail, setDetail] = useState<TrackerMatchDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggle = async () => {
    if (expanded) {
      onToggle();
      return;
    }
    onToggle();
    if (detail) return;
    setLoadingDetail(true);
    try {
      setDetail(await loadDetail(m.id));
    } catch (e) {
      onBanner(`Match detail failed: ${String(e)}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const tips = useMemo(
    () => (detail && puuid ? buildTips(detail, puuid) : []),
    [detail, puuid]
  );
  const teams = useMemo(() => {
    if (!detail) return [];
    const order = ['Blue', 'Red'];
    return order
      .map((t) => ({ team: t, players: detail.players.filter((p) => p.team === t) }))
      .filter((g) => g.players.length > 0);
  }, [detail]);

  const resColor =
    m.result === 'win' ? 'text-m3-tertiary' : m.result === 'loss' ? 'text-red-400' : 'text-m3-outline';

  return (
    <div className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 overflow-hidden">
      <button onClick={toggle} className="w-full px-2.5 py-2 flex items-center gap-2.5 text-left cursor-pointer hover:bg-m3-surface-container-high/40 transition-colors">
        <span className={`w-1 self-stretch rounded-full shrink-0 ${m.result === 'win' ? 'bg-m3-tertiary' : m.result === 'loss' ? 'bg-red-500/70' : 'bg-m3-outline'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-m3-on-surface">{m.map}</span>
            <span className="text-[10px] text-m3-outline">{m.agent}</span>
            <span className={`text-[11px] font-mono font-bold ${resColor}`}>
              {m.scoreUs}–{m.scoreThem}
            </span>
            {rrDelta !== null && rrDelta !== 0 && (
              <span className={`text-[10px] font-mono font-bold ${rrDelta > 0 ? 'text-m3-tertiary' : 'text-red-400'}`}>
                {rrDelta > 0 ? `+${rrDelta}` : rrDelta} RR
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-m3-outline mt-0.5">
            {m.kills}/{m.deaths}/{m.assists} • ACS {m.acs} • HS {m.hsPct}% • {m.mode}
          </div>
        </div>
        <span className="text-[10px] text-m3-outline shrink-0">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-m3-outline-subtle/50">
          {loadingDetail && <div className="py-3 text-center text-[11px] text-m3-outline">Loading scoreboard…</div>}
          {detail && (
            <>
              {teams.map((g) => (
                <div key={g.team} className="mt-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-m3-outline mb-1">
                    Team {g.team}
                  </div>
                  {g.players.map((p) => (
                    <div
                      key={p.puuid || `${p.name}#${p.tag}`}
                      className={`flex items-center justify-between gap-2 py-1 px-1.5 rounded-lg text-[11px] ${
                        p.puuid === puuid ? 'bg-m3-primary/10 border border-m3-primary/30' : ''
                      }`}
                    >
                      <span className="truncate text-m3-on-surface">
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-m3-outline"> #{p.tag}</span>
                        <span className="text-m3-outline"> • {p.agent}</span>
                      </span>
                      <span className="font-mono text-m3-on-surface-variant shrink-0 tabular-nums">
                        {p.kills}/{p.deaths}/{p.assists}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {tips.length > 0 && (
                <div className="mt-2 rounded-lg bg-amber-400/10 border border-amber-400/30 p-2 space-y-1">
                  {tips.map((t, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-200/90 leading-snug">
                      <Lightbulb className="w-3 h-3 shrink-0 mt-px" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const Tracker: React.FC = () => {
  const [region, setRegion] = useState(() => lsGet('aspect_tracker_region') || 'eu');
  const [name, setName] = useState(() => lsGet('aspect_tracker_name'));
  const [tag, setTag] = useState(() => lsGet('aspect_tracker_tag'));
  const [apiKey, setApiKey] = useState(() => lsGet('aspect_tracker_key'));
  const [puuid, setPuuid] = useState(() => lsGet('aspect_tracker_puuid'));

  const [profile, setProfile] = useState<TrackerProfile | null>(null);
  const [history, setHistory] = useState<TrackerMatch[]>([]);
  const [mmrHist, setMmrHist] = useState<TrackerMmrPoint[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<'direct' | 'henrik'>('direct');
  const [histTotal, setHistTotal] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => lsSet('aspect_tracker_region', region), [region]);
  useEffect(() => lsSet('aspect_tracker_name', name), [name]);
  useEffect(() => lsSet('aspect_tracker_tag', tag), [tag]);
  useEffect(() => lsSet('aspect_tracker_key', apiKey), [apiKey]);
  useEffect(() => lsSet('aspect_tracker_puuid', puuid), [puuid]);

  // First open with no stored identity: try the local client once.
  useEffect(() => {
    if (name || !apiKey) return;
    let live = true;
    setIsDetecting(true);
    detectLocalAccount()
      .then((acc) => {
        if (!live) return;
        setName(acc.game_name);
        setTag(acc.tagline);
        if (acc.puuid) setPuuid(acc.puuid);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setIsDetecting(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Keyless path: local client credentials straight to Riot. */
  const loadDirect = async (start: number, append: boolean) => {
    const ent = await getEntitlements();
    if (ent.puuid) setPuuid(ent.puuid);
    let accName = '';
    let accTag = '';
    try {
      const acc = await detectLocalAccount();
      accName = acc.game_name;
      accTag = acc.tagline;
      setName(accName);
      setTag(accTag);
    } catch {}
    const [prof, comp, hist] = await Promise.all([
      fetchMmrDirect(region),
      fetchCompetitiveUpdates(region),
      fetchHistoryIds(region, start, 5),
    ]);
    setProfile({ ...prof, name: accName || name, tag: accTag || tag });
    setMmrHist(comp);
    const { maps } = await gameData();
    const rows: TrackerMatch[] = [];
    const details = await Promise.all(
      hist.ids.map((x) =>
        fetchMatchDetailDirect(region, x.id)
          .then((d) => ({ d, x }))
          .catch(() => null)
      )
    );
    for (const item of details) {
      if (!item) continue;
      const row = toHistoryRow(item.d, item.x.id, ent.puuid, item.x.queue, item.x.when, maps);
      if (row) rows.push(row);
    }
    if (rows.length === 0) throw new Error('No readable matches — Riot may have changed its format.');
    setHistory((prev) => (append ? [...prev, ...rows] : rows));
    setHistTotal(hist.total);
    setMode('direct');
    setExpandedId(null);
  };

  /** Fallback path: HenrikDev API with pasted key (works with client closed). */
  const loadHenrik = async () => {
    if (!name.trim() || !tag.trim()) throw new Error('Enter your Riot ID (name + tag) or use Detect.');
    if (!apiKey.trim()) throw new Error('No client session and no API key — open Riot Client or paste a key.');
    const [prof, hist, mh] = await Promise.all([
      fetchMmr(region, name.trim(), tag.trim(), apiKey.trim()),
      fetchMatchHistory(region, name.trim(), tag.trim(), apiKey.trim()),
      fetchMmrHistory(region, name.trim(), tag.trim(), apiKey.trim()),
    ]);
    setProfile(prof);
    setHistory(hist);
    setMmrHist(mh);
    if (prof.puuid) setPuuid(prof.puuid);
    setMode('henrik');
    setExpandedId(null);
  };

  const load = async () => {
    setIsLoading(true);
    setBanner(null);
    try {
      try {
        await loadDirect(0, false);
      } catch (directErr) {
        if (!apiKey.trim()) throw directErr;
        await loadHenrik();
      }
    } catch (e) {
      setBanner(String(e instanceof Error ? e.message : e));
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (mode !== 'direct') return;
    setLoadingMore(true);
    try {
      await loadDirect(history.length, true);
    } catch (e) {
      setBanner(String(e instanceof Error ? e.message : e));
    } finally {
      setLoadingMore(false);
    }
  };

  const loadDetail = async (id: string): Promise<TrackerMatchDetail> => {
    if (mode === 'direct') {
      try {
        const d = await fetchMatchDetailDirect(region, id);
        if (d.players.length > 0) return d;
      } catch {}
      if (apiKey.trim() && name.trim() && tag.trim()) {
        return fetchMatchDetail(id, apiKey.trim());
      }
      throw new Error('Match detail unavailable.');
    }
    return fetchMatchDetail(id, apiKey.trim());
  };

  const detect = async () => {
    setIsDetecting(true);
    try {
      const acc = await detectLocalAccount();
      setName(acc.game_name);
      setTag(acc.tagline);
      if (acc.puuid) setPuuid(acc.puuid);
      setBanner(`Detected ${acc.game_name}#${acc.tagline} — hit Load.`);
    } catch (e) {
      setBanner(String(e instanceof Error ? e.message : e));
    } finally {
      setIsDetecting(false);
    }
  };

  const rrByMatch = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of mmrHist) if (p.matchId) m.set(p.matchId, p.change);
    return m;
  }, [mmrHist]);

  const maxAbs = Math.max(10, ...mmrHist.map((p) => Math.abs(p.change)));

  return (
    <div className="h-full min-h-0 flex flex-col gap-2.5 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
      {banner && (
        <div className="p-2.5 rounded-xl bg-m3-primary-container/40 border border-m3-primary/40 text-m3-on-primary-container text-xs font-semibold flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Check className="w-3.5 h-3.5 text-m3-primary shrink-0" />
            <span>{banner}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-m3-primary hover:underline text-xs ml-3 cursor-pointer font-bold shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Identity */}
      <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 flex flex-col gap-2 shrink-0 shadow-m3-1">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-m3-primary" />
          <h3 className="font-display font-bold text-xs text-m3-on-surface uppercase tracking-wider">
            Who to track
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-40">
            <CustomDropdown value={region} options={REGIONS} onChange={setRegion} />
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (lil ga7ed)"
            className="h-8 px-2.5 rounded-lg bg-m3-surface-container-lowest border border-m3-outline-subtle text-[11px] font-semibold focus:outline-none focus:border-m3-primary w-36" />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag (zngr)"
            className="h-8 px-2.5 rounded-lg bg-m3-surface-container-lowest border border-m3-outline-subtle text-[11px] font-semibold focus:outline-none focus:border-m3-primary w-24" />
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="HenrikDev key — fallback only, optional" type="password" spellCheck={false}
            className="h-8 px-2.5 rounded-lg bg-m3-surface-container-lowest border border-m3-outline-subtle text-[11px] font-mono focus:outline-none focus:border-m3-primary flex-1 min-w-36" />
          <button onClick={detect} disabled={isDetecting}
            className="h-8 px-3 rounded-full bg-m3-surface-container-high border border-m3-primary/40 text-m3-primary text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Search className="w-3 h-3" />
            <span>{isDetecting ? 'Detecting…' : 'Detect my account'}</span>
          </button>
          <button onClick={load} disabled={isLoading}
            className="h-8 px-4 rounded-full bg-m3-primary text-m3-on-primary text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ml-auto">
            {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />}
            <span>{isLoading ? 'Loading…' : 'Load'}</span>
          </button>
        </div>
      </section>

      {/* Profile */}
      {profile && (
        <section className="rounded-2xl bg-m3-surface-container border border-m3-primary/30 p-3 flex items-center gap-3 shrink-0 shadow-m3-1">
          <div className="w-11 h-11 rounded-2xl bg-m3-primary-container border border-m3-primary/40 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-m3-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display font-extrabold text-lg text-m3-on-surface">{profile.rank}</span>
              <span className="font-mono text-xs text-m3-primary font-bold">{profile.rr} RR</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-m3-tertiary text-m3-on-tertiary">
                PEAK {profile.peak}
              </span>
            </div>
            <div className="text-[11px] text-m3-outline">
              {profile.name}#{profile.tag} • {profile.wins}W / {profile.games - profile.wins}L ({profile.games} games)
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-m3-on-surface-variant shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-m3-tertiary" />
            <Crosshair className="w-3.5 h-3.5 text-m3-outline" />
          </div>
        </section>
      )}

      {/* RR trend */}
      {mmrHist.length > 0 && (
        <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 shrink-0">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-primary mb-2">RR trend</h4>
          <div className="flex items-end gap-1 h-16">
            {mmrHist.slice(0, 20).reverse().map((p, i) => {
              const h = Math.max(8, Math.round((Math.abs(p.change) / maxAbs) * 100));
              return (
                <div key={i} title={`${p.tier}: ${p.change > 0 ? '+' : ''}${p.change} RR`}
                  className={`flex-1 rounded-sm ${p.change >= 0 ? 'bg-m3-tertiary' : 'bg-red-500/70'}`}
                  style={{ height: `${h}%` }} />
              );
            })}
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="flex flex-col gap-1.5 shrink-0">
          {history.map((m) => (
            <MatchRow
              key={m.id}
              m={m}
              rrDelta={rrByMatch.has(m.id) ? rrByMatch.get(m.id)! : null}
              loadDetail={loadDetail}
              puuid={puuid}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId((cur) => (cur === m.id ? null : m.id))}
              onBanner={setBanner}
            />
          ))}
          {mode === 'direct' && history.length < histTotal && (
            <button onClick={loadMore} disabled={loadingMore}
              className="h-8 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-[11px] font-bold text-m3-on-surface flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
              {loadingMore ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
              <span>{loadingMore ? 'Loading…' : `Load more (${history.length}/${histTotal})`}</span>
            </button>
          )}
        </div>
      )}

      {!profile && !isLoading && (
        <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-[11px] text-m3-on-surface-variant shrink-0">
          Hit Load — with the Riot Client open it just works, no key needed. Key is only a fallback for when the client is closed.
        </div>
      )}
    </div>
  );
};
