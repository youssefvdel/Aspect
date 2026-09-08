import React from 'react';
import { Check, RefreshCw, ShieldCheck, Trophy } from 'lucide-react';
import type { TrackerMmrPoint } from '../types';
import { queueLabel, shortMapName, tierName } from '../utils/tracker';
import { useTrackerData } from '../hooks/useTrackerData';

const fmtDate = (ms: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
};

const StatTile: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 flex flex-col gap-0.5 min-w-0">
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-outline">{label}</span>
    <span className="font-display font-extrabold text-xl text-m3-on-surface tabular-nums truncate">{value}</span>
    {sub && <span className="text-[10px] text-m3-outline truncate">{sub}</span>}
  </div>
);

export const Overview: React.FC = () => {
  const { profile, games, queueById, mapById, seasonNames, isLoading, banner, setBanner, refresh } =
    useTrackerData();

  const losses = profile ? Math.max(0, profile.games - profile.wins) : 0;
  const winPct = profile && profile.games > 0 ? ((profile.wins / profile.games) * 100).toFixed(1) : '—';
  const form = games.slice(0, 10);
  const formW = form.filter((g) => g.change > 0).length;
  const maxAbs = Math.max(10, ...games.map((p) => Math.abs(p.change)));
  const prevActs = (profile?.seasons ?? []).slice(1, 4);

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

      {/* Hero: current rank + peak */}
      {profile ? (
        <section className="rounded-2xl bg-m3-surface-container border border-m3-primary/30 p-4 flex items-center gap-4 shrink-0 shadow-m3-1">
          <div className="w-14 h-14 rounded-2xl bg-m3-primary-container border border-m3-primary/40 flex items-center justify-center shrink-0">
            <Trophy className="w-7 h-7 text-m3-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-m3-outline">Current rank</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-black text-2xl text-m3-on-surface">{profile.rank}</span>
              <span className="font-mono text-sm text-m3-primary font-bold">{profile.rr} RR</span>
            </div>
            <div className="text-[11px] text-m3-outline mt-0.5">
              {profile.name}#{profile.tag}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-m3-outline">Lifetime peak</div>
            <div className="font-display font-extrabold text-lg text-m3-tertiary">{profile.peak}</div>
          </div>
          <button onClick={refresh} disabled={isLoading} title="Refresh"
            className="w-8 h-8 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-m3-on-surface-variant flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </section>
      ) : (
        !isLoading && (
          <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-[11px] text-m3-on-surface-variant shrink-0">
            Open the Riot Client and this tab fills itself — rank, season stats, recent form. No keys, no signup.
          </div>
        )
      )}

      {/* Season tiles */}
      {profile && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <StatTile label="Win %" value={typeof winPct === 'string' && winPct !== '—' ? `${winPct}%` : '—'} sub="this season" />
          <StatTile label="Wins" value={String(profile.wins)} sub={`${losses} losses`} />
          <StatTile label="Games" value={String(profile.games)} sub="competitive" />
          <StatTile label="Last 10" value={`${formW}W–${form.length - formW}L`} sub="recent form" />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
        {/* Previous acts */}
        {prevActs.length > 0 && (
          <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-primary mb-2">Previous acts</h4>
            <div className="flex flex-col gap-1.5">
              {prevActs.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-m3-outline font-semibold">{seasonNames[s.id.toLowerCase()] ?? 'Past act'}</span>
                  <span className="font-bold text-m3-on-surface">{tierName(s.tier)}</span>
                  <span className="font-mono text-m3-outline tabular-nums">
                    {s.wins}W–{Math.max(0, s.games - s.wins)}L
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Per-round stats unlock via live tracking */}
        <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-m3-tertiary shrink-0 mt-0.5" />
          <div className="text-[11px] leading-snug">
            <span className="font-bold text-m3-on-surface">K/D • HS% • ADR unlock while you play. </span>
            <span className="text-m3-on-surface-variant">
              Riot only hands past-match scoreboards to partnered apps — Aspect reads your live match instead and
              keeps the stats on your PC.
            </span>
          </div>
        </section>
      </div>

      {/* Recent games preview */}
      {games.length > 0 && (
        <section className="flex flex-col gap-1.5 shrink-0">
          {games.slice(0, 5).map((g: TrackerMmrPoint) => (
            <div key={g.matchId || g.when}
              className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 px-2.5 py-2 flex items-center gap-2.5">
              <span className={`w-1 self-stretch rounded-full shrink-0 ${g.change >= 0 ? 'bg-m3-tertiary' : 'bg-red-500/70'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-m3-on-surface">
                    {mapById[g.matchId] ?? shortMapName(g.mapId, {})}
                  </span>
                  <span className="text-[10px] text-m3-outline">{queueLabel(queueById[g.matchId] ?? '')}</span>
                  <span className={`text-[11px] font-mono font-bold ${g.change >= 0 ? 'text-m3-tertiary' : 'text-red-400'}`}>
                    {g.change > 0 ? `+${g.change}` : g.change} RR
                  </span>
                </div>
                <div className="text-[10px] font-mono text-m3-outline mt-0.5">
                  {g.tier} • {fmtDate(g.when)}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
