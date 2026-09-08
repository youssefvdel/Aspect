import React from 'react';
import { Check } from 'lucide-react';
import type { TrackerMmrPoint } from '../types';
import { queueLabel, shortMapName } from '../utils/tracker';
import { useTrackerData } from '../hooks/useTrackerData';

const fmtDate = (ms: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
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

export const MatchHistory: React.FC = () => {
  const { profile, games, queueById, mapById, isLoading, banner, setBanner } = useTrackerData();
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

      {/* Games */}
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
          Open the Riot Client and this tab fills itself — last 20 games with map, mode, and RR earned.
        </div>
      )}
    </div>
  );
};
