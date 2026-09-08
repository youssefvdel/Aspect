import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Check,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Crosshair,
  Search,
} from 'lucide-react';
import type { TrackerMmrPoint, TrackerProfile } from '../types';
import { CustomDropdown } from './ValorantConfig';
import {
  detectLocalAccount,
  fetchCompetitiveUpdates,
  fetchHistoryMeta,
  fetchMmrDirect,
  gameData,
  queueLabel,
  shortMapName,
} from '../utils/tracker';

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

const fmtDate = (ms: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
};

const GameRow: React.FC<{ g: TrackerMmrPoint; queue: string; map: string }> = ({ g, queue, map }) => (
  <div className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 px-2.5 py-2 flex items-center gap-2.5">
    <span className={`w-1 self-stretch rounded-full shrink-0 ${g.change >= 0 ? 'bg-m3-tertiary' : 'bg-red-500/70'}`} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-bold text-m3-on-surface">{map}</span>
        <span className="text-[10px] text-m3-outline">{queue}</span>
        <span className={`text-[11px] font-mono font-bold ${g.change >= 0 ? 'text-m3-tertiary' : 'text-red-400'}`}>
          {g.change > 0 ? `+${g.change}` : g.change} RR
        </span>
      </div>
      <div className="text-[10px] font-mono text-m3-outline mt-0.5">
        {g.tier} • {g.rr} RR • {fmtDate(g.when)}
      </div>
    </div>
  </div>
);

export const Tracker: React.FC = () => {
  const [region, setRegion] = useState(() => lsGet('aspect_tracker_region') || 'eu');
  const [name, setName] = useState(() => lsGet('aspect_tracker_name'));
  const [tag, setTag] = useState(() => lsGet('aspect_tracker_tag'));

  const [profile, setProfile] = useState<TrackerProfile | null>(null);
  const [games, setGames] = useState<TrackerMmrPoint[]>([]);
  const [queueById, setQueueById] = useState<Record<string, string>>({});
  const [mapById, setMapById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const autoTried = useRef(false);

  useEffect(() => lsSet('aspect_tracker_region', region), [region]);
  useEffect(() => lsSet('aspect_tracker_name', name), [name]);
  useEffect(() => lsSet('aspect_tracker_tag', tag), [tag]);

  const load = async () => {
    setIsLoading(true);
    setBanner(null);
    try {
      let accName = name.trim();
      let accTag = tag.trim();
      try {
        const acc = await detectLocalAccount();
        if (acc.game_name) {
          accName = acc.game_name;
          accTag = acc.tagline;
          setName(accName);
          setTag(accTag);
        }
      } catch {}
      const [prof, comp] = await Promise.all([
        fetchMmrDirect(region, accName, accTag),
        fetchCompetitiveUpdates(region, 20),
      ]);
      setProfile({ ...prof, name: accName, tag: accTag });
      setGames(comp);
      const [{ maps }, meta] = await Promise.all([
        gameData(),
        fetchHistoryMeta(region, 0, 20).catch(() => ({ total: 0, queueById: {} as Record<string, string> })),
      ]);
      const mm: Record<string, string> = {};
      for (const g of comp) mm[g.matchId] = shortMapName(g.mapId, maps);
      setMapById(mm);
      setQueueById(meta.queueById);
    } catch (e) {
      setBanner(String(e instanceof Error ? e.message : e));
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load once on first open: client already running → data appears, zero taps.
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detect = async () => {
    setIsDetecting(true);
    try {
      const acc = await detectLocalAccount();
      setName(acc.game_name);
      setTag(acc.tagline);
      setBanner(`Detected ${acc.game_name}#${acc.tagline} — hit Load.`);
    } catch (e) {
      setBanner(String(e instanceof Error ? e.message : e));
    } finally {
      setIsDetecting(false);
    }
  };

  const maxAbs = Math.max(10, ...games.map((p) => Math.abs(p.change)));

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
          <button onClick={detect} disabled={isDetecting}
            className="h-8 px-3 rounded-full bg-m3-surface-container-high border border-m3-primary/40 text-m3-primary text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Search className="w-3 h-3" />
            <span>{isDetecting ? 'Detecting…' : 'Detect my account'}</span>
          </button>
          <button onClick={load} disabled={isLoading}
            className="h-8 px-4 rounded-full bg-m3-primary text-m3-on-primary text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ml-auto">
            {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />}
            <span>{isLoading ? 'Loading…' : 'Refresh'}</span>
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
      {games.length > 0 && (
        <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 shrink-0">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-primary mb-2">RR trend</h4>
          <div className="flex items-end gap-1 h-16">
            {[...games].slice(0, 20).reverse().map((p) => {
              const h = Math.max(8, Math.round((Math.abs(p.change) / maxAbs) * 100));
              return (
                <div key={p.matchId || p.when} title={`${p.tier}: ${p.change > 0 ? '+' : ''}${p.change} RR`}
                  className={`flex-1 rounded-sm ${p.change >= 0 ? 'bg-m3-tertiary' : 'bg-red-500/70'}`}
                  style={{ height: `${h}%` }} />
              );
            })}
          </div>
        </section>
      )}

      {/* Recent games */}
      {games.length > 0 && (
        <div className="flex flex-col gap-1.5 shrink-0">
          {games.map((g) => (
            <GameRow key={g.matchId || g.when} g={g}
              queue={queueLabel(queueById[g.matchId] ?? '')}
              map={mapById[g.matchId] ?? shortMapName(g.mapId, {})} />
          ))}
        </div>
      )}

      {!profile && !isLoading && (
        <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-[11px] text-m3-on-surface-variant shrink-0">
          Open the Riot Client and this tab fills itself — rank, RR trend, recent games. No keys, no signup.
        </div>
      )}
    </div>
  );
};
