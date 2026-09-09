import React from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, RefreshCw } from 'lucide-react';
import { tierName } from '../utils/tracker';
import { useTrackerData } from '../hooks/useTrackerData';
import { useCountUp } from '../hooks/useCountUp';
import { TrackerSkeletons } from './TrackerSkeletons';

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
};

const shortAct = (label: string): string =>
  label
    .replace('Episode', 'E')
    .replace(/V(\d+)/, 'V$1')
    .replace('ACT', 'A')
    .replace(/\s*·\s*/g, ':');

/** Big TRN-style headline tile. `locked` = needs live observation, shows dim + lock. */
const BigTile: React.FC<{ label: string; value?: string; numeric?: number; decimals?: number; suffix?: string; locked?: boolean; index: number }> = ({
  label,
  value,
  numeric,
  decimals = 0,
  suffix = '',
  locked = false,
  index,
}) => {
  const v = useCountUp(numeric ?? 0, 900, !locked && numeric !== undefined);
  return (
    <motion.div variants={rise} custom={index}
      className={`rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 flex flex-col gap-1 min-w-0 ${locked ? 'opacity-70' : ''}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-outline flex items-center gap-1">
        {label}
        {locked && <Lock className="w-2.5 h-2.5" />}
      </span>
      <span className="font-display font-black text-2xl text-m3-on-surface tabular-nums truncate">
        {locked ? (value ?? '—') : numeric !== undefined ? <>{v.toFixed(decimals)}{suffix}</> : (value ?? '—')}
      </span>
    </motion.div>
  );
};

const SmallStat: React.FC<{ label: string; value: string; locked?: boolean; tone?: 'win' | 'loss' }> = ({ label, value, locked = false, tone }) => (
  <div className={`flex flex-col gap-0.5 min-w-0 ${locked ? 'opacity-60' : ''}`}>
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-outline flex items-center gap-1">
      {label}
      {locked && <Lock className="w-2.5 h-2.5" />}
    </span>
    <span className={`font-display font-extrabold text-lg tabular-nums truncate ${tone === 'win' ? 'text-m3-tertiary' : tone === 'loss' ? 'text-red-400' : 'text-m3-on-surface'}`}>{value}</span>
  </div>
);

export const Overview: React.FC = () => {
  const { profile, games, seasonNames, seasonOrder, tierIcons, agg, isLoading, banner, setBanner, refresh } =
    useTrackerData();

  const losses = profile ? Math.max(0, profile.games - profile.wins) : 0;
  const winPct = profile && profile.games > 0 ? (profile.wins / profile.games) * 100 : 0;
  const form = games.slice(0, 10);
  const formW = form.filter((g) => g.change > 0).length;
  const maxAbs = Math.max(10, ...games.map((p) => Math.abs(p.change)));
  const rrNow = useCountUp(profile?.rr ?? 0, 900, !!profile);

  // acts newest-first by Riot's own ordering; current act excluded → previous 3
  const orderIdx = (id: string): number => {
    const i = seasonOrder.indexOf(id.toLowerCase());
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const prevActs = (profile?.seasons ?? [])
    .filter((s) => s.id.toLowerCase() !== (profile?.currentSeasonId ?? '').toLowerCase())
    .sort((a, b) => orderIdx(a.id) - orderIdx(b.id))
    .slice(0, 3);
  const actLabel = profile?.currentSeasonId
    ? (seasonNames[profile.currentSeasonId.toLowerCase()] ?? '')
    : '';

  if (isLoading && !profile) {
    return (
      <div className="h-full min-h-0 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
        <TrackerSkeletons />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" className="h-full min-h-0 flex flex-col gap-2.5 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
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

      {profile ? (
        <>
          {/* Identity + playlist/act pills */}
          <motion.div variants={rise} custom={0} className="flex items-center gap-2 flex-wrap shrink-0">
            <span className="font-display font-extrabold text-lg text-m3-on-surface">
              {profile.name}<span className="text-m3-outline font-bold">#{profile.tag}</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-m3-surface-container border border-m3-outline-subtle text-[10px] font-bold text-m3-on-surface-variant">
              Competitive
            </span>
            {actLabel && (
              <span className="px-2.5 py-1 rounded-full bg-m3-primary-container/60 border border-m3-primary/40 text-[10px] font-bold text-m3-primary">
                {actLabel}
              </span>
            )}
            <button onClick={refresh} disabled={isLoading} title="Refresh"
              className="w-8 h-8 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-m3-on-surface-variant flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0 ml-auto">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </motion.div>

          {/* Rank panel: badges + current + peak */}
          <motion.section variants={rise} custom={1}
            className="rounded-2xl bg-m3-surface-container border border-m3-primary/30 p-4 shrink-0 shadow-m3-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col items-center gap-1 flex-1">
                {tierIcons[profile.tier] ? (
                  <img src={tierIcons[profile.tier]} alt={profile.rank} className="w-16 h-16 object-contain" />
                ) : null}
                <span className="font-display font-extrabold text-base text-m3-on-surface text-center">{profile.rank}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-m3-outline">Current</span>
                <span className="font-mono text-xs text-m3-primary font-bold tabular-nums">{Math.round(rrNow)} RR</span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1 border-l border-m3-outline-subtle">
                {tierIcons[profile.tier] ? (
                  <img src={tierIcons[profile.tier]} alt={profile.peak} className="w-16 h-16 object-contain opacity-90" />
                ) : null}
                <span className="font-display font-extrabold text-base text-m3-tertiary text-center">{profile.peak}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-m3-outline">Lifetime peak</span>
                <span className="font-mono text-xs text-m3-outline tabular-nums">
                  {profile.wins}W–{losses}L
                </span>
              </div>
            </div>
          </motion.section>

          {/* Headline tiles */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
            <BigTile index={2} label="Win %" numeric={winPct} decimals={1} suffix="%" />
            {agg ? (
              <BigTile index={3} label="K/D" numeric={agg.kd} decimals={2} />
            ) : (
              <BigTile index={3} label="K/D" value="…" />
            )}
            <BigTile index={4} label="Headshot %" value="—" locked />
            {agg ? (
              <BigTile index={5} label="Damage/Round" numeric={agg.adr} decimals={1} />
            ) : (
              <BigTile index={5} label="Damage/Round" value="…" />
            )}
          </section>

          {/* Sub stats */}
          <motion.section variants={rise} custom={6}
            className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 shrink-0">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              <SmallStat label="Wins" value={String(profile.wins)} tone="win" />
              <SmallStat label="Losses" value={String(losses)} tone="loss" />
              <SmallStat label="Kills" value={agg ? String(agg.kills) : '…'} />
              <SmallStat label="Deaths" value={agg ? String(agg.deaths) : '…'} />
              <SmallStat label="Assists" value={agg ? String(agg.assists) : '…'} />
              <SmallStat label="Headshots" value="—" locked />
              <SmallStat label="Flawless" value={agg ? String(agg.flawless) : '…'} />
              <SmallStat label="Clutches" value={agg ? String(agg.clutches) : '…'} />
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-m3-outline-subtle/60 text-[10px] text-m3-outline flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" />
              <span>K/D stats cover your last {agg ? agg.matches : '…'} games{agg ? '' : ' (scoreboards loading…)'} — only headshots stay locked, Riot strips them from past matches.</span>
            </div>
          </motion.section>

          {/* Heroics + top agent */}
          {agg && (
            <motion.section variants={rise} custom={7}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-outline">Top agent</span>
                <span className="font-display font-extrabold text-xl text-m3-on-surface truncate">{agg.topAgent.name}</span>
                <span className="text-[10px] text-m3-outline">{agg.topAgent.matches} games • {agg.topAgent.hours}h</span>
              </div>
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-outline">Aces</span>
                <span className="font-display font-extrabold text-xl text-m3-on-surface tabular-nums">{agg.aces}</span>
                <span className="text-[10px] text-m3-outline">5K rounds</span>
              </div>
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-outline">First kills</span>
                <span className="font-display font-extrabold text-xl text-m3-tertiary tabular-nums">{agg.firstKills}</span>
                <span className="text-[10px] text-m3-outline">opening duels won</span>
              </div>
              <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-outline">First deaths</span>
                <span className="font-display font-extrabold text-xl text-red-400 tabular-nums">{agg.firstDeaths}</span>
                <span className="text-[10px] text-m3-outline">opening duels lost</span>
              </div>
            </motion.section>
          )}

          {/* Previous acts */}
          {prevActs.length > 0 && (
            <motion.section variants={rise} custom={7}
              className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 shrink-0">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-primary mb-2.5">Previous acts</h4>
              <div className="grid grid-cols-3 gap-2">
                {prevActs.map((s) => (
                  <div key={s.id} className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 p-2.5 flex flex-col items-center gap-1 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-m3-outline">
                      {shortAct(seasonNames[s.id.toLowerCase()] ?? 'Past act')}
                    </span>
                    {tierIcons[s.tier] ? (
                      <img src={tierIcons[s.tier]} alt={tierName(s.tier)} className="w-12 h-12 object-contain" />
                    ) : null}
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-m3-outline">Peak rating</span>
                    <span className="font-display font-extrabold text-sm text-m3-on-surface">{tierName(s.tier)}</span>
                    <span className="font-mono text-[10px] text-m3-outline tabular-nums">
                      {s.wins}W–{Math.max(0, s.games - s.wins)}L • {s.games} games
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Form + trend */}
          <motion.section variants={rise} custom={8}
            className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-primary">Recent form</h4>
              <span className="text-[11px] font-bold text-m3-on-surface">
                {formW}W–{form.length - formW}L <span className="text-m3-outline font-semibold">last {form.length}</span>
              </span>
            </div>
            {games.length > 0 && (
              <div className="flex items-end gap-1 h-16">
                {[...games].slice(0, 20).reverse().map((p, i) => {
                  const h = Math.max(8, Math.round((Math.abs(p.change) / maxAbs) * 100));
                  return (
                    <motion.div key={p.matchId || p.when}
                      title={`${p.tier}: ${p.change > 0 ? '+' : ''}${p.change} RR`}
                      initial={{ height: '8%' }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.3 + i * 0.03, type: 'spring', stiffness: 200, damping: 20 }}
                      className={`flex-1 rounded-sm ${p.change >= 0 ? 'bg-m3-tertiary' : 'bg-red-500/70'}`} />
                  );
                })}
              </div>
            )}
          </motion.section>
        </>
      ) : (
        !isLoading && (
          <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-[11px] text-m3-on-surface-variant shrink-0">
            Open the Riot Client and this tab fills itself — rank, season stats, recent form. No keys, no signup.
          </div>
        )
      )}
    </motion.div>
  );
};
