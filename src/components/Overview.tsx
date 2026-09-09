import React from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, RefreshCw, Trophy } from 'lucide-react';
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

/** "Top 13%" / "Bottom 29%" from a TRN percentile. */
const pctLabel = (p: number): string => (p >= 50 ? `Top ${Math.round(100 - p)}%` : `Bottom ${Math.round(p)}%`);

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
  const { profile, games, seasonNames, seasonOrder, tierIcons, agentInfo, agg, trn, trnAgents, trnPrev, isLoading, banner, setBanner, refresh } =
    useTrackerData();

  const losses = trn ? trn.losses : profile ? Math.max(0, profile.games - profile.wins) : 0;
  const wins = trn ? trn.wins : profile?.wins ?? 0;
  const winPct = trn ? trn.winPct : profile && profile.games > 0 ? (profile.wins / profile.games) * 100 : 0;
  const kd = trn?.kd ?? agg?.kd ?? 0;
  const adr = trn?.adr ?? agg?.adr ?? 0;
  const kills = trn?.kills ?? agg?.kills ?? 0;
  const deaths = trn?.deaths ?? agg?.deaths ?? 0;
  const assists = trn?.assists ?? agg?.assists ?? 0;
  const form = games.slice(0, 10);
  const formW = form.filter((g) => g.change > 0).length;
  const maxAbs = Math.max(10, ...games.map((p) => Math.abs(p.change)));
  const rrNow = useCountUp(profile?.rr ?? 0, 900, !!profile);

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

  const topAgent = trnAgents[0] ?? null;
  const topAgentIcon = topAgent
    ? Object.values(agentInfo).find((a) => a.name.toLowerCase() === topAgent.agent.toLowerCase())?.icon ?? ''
    : '';
  const hitTotal = (trn?.headHits ?? 0) + (trn?.bodyHits ?? 0) + (trn?.legHits ?? 0);
  const bodyPct = hitTotal > 0 ? ((trn?.bodyHits ?? 0) / hitTotal) * 100 : 0;
  const legPct = hitTotal > 0 ? ((trn?.legHits ?? 0) / hitTotal) * 100 : 0;

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
          {/* Identity: avatar + name + playlist/act */}
          <motion.div variants={rise} custom={0} className="flex items-center gap-2.5 flex-wrap shrink-0">
            {trn?.avatarUrl ? (
              <img src={trn.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-m3-primary/40 shrink-0" />
            ) : null}
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

          {/* Rank panel: current + peak badges */}
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
                  {wins}W–{losses}L{trn && trn.ties > 0 ? `–${trn.ties}T` : ''}
                </span>
              </div>
            </div>
          </motion.section>

          {/* Headline tiles */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
            <BigTile index={2} label="Win %" numeric={winPct} decimals={2} suffix="%" />
            <BigTile index={3} label="K/D" numeric={kd} decimals={3} />
            {trn ? (
              <BigTile index={4} label="Headshot %" numeric={trn.hsPct} decimals={2} suffix="%" />
            ) : (
              <BigTile index={4} label="Headshot %" value="—" locked />
            )}
            <BigTile index={5} label="Damage/Round" numeric={adr} decimals={2} />
          </section>

          {/* Sub stats */}
          <motion.section variants={rise} custom={6}
            className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 shrink-0">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              <SmallStat label="Wins" value={String(wins)} tone="win" />
              <SmallStat label="Losses" value={trn && trn.ties > 0 ? `${losses}` : String(losses)} tone="loss" />
              <SmallStat label="Kills" value={kills ? kills.toLocaleString() : '…'} />
              <SmallStat label="Deaths" value={deaths ? deaths.toLocaleString() : '…'} />
              <SmallStat label="Assists" value={assists ? assists.toLocaleString() : '…'} />
              <SmallStat label="Headshots" value={trn ? trn.headshots.toLocaleString() : '—'} locked={!trn} />
              <SmallStat label="Flawless" value={String(trn?.flawless ?? agg?.flawless ?? '…')} />
              <SmallStat label="Clutches" value={String(trn?.clutches ?? agg?.clutches ?? '…')} />
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-m3-outline-subtle/60 text-[10px] text-m3-outline flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" />
              <span>
                {trn
                  ? `Act-wide via TRN (${wins}W–${losses}L${trn.ties > 0 ? `–${trn.ties}T` : ''}) • rank live from Riot`
                  : 'Act-wide stats loading — rank and trend are live from Riot.'}
              </span>
            </div>
          </motion.section>

          {/* Records + Top Agent + Accuracy */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
            <motion.section variants={rise} custom={7}
              className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 flex flex-col gap-2.5 justify-center">
              <div>
                <div className="text-[10px] text-m3-outline">Match Kills (Best)</div>
                <div className="font-display font-extrabold text-lg text-m3-on-surface tabular-nums">{trn?.bestKills ?? agg?.aces ? String(trn?.bestKills ?? '…') : '…'}</div>
              </div>
              <div>
                <div className="text-[10px] text-m3-outline">First Kills / Deaths</div>
                <div className="font-display font-extrabold text-lg text-m3-on-surface tabular-nums">
                  {trn ? `${trn.firstKills} / ${trn.firstDeaths}` : agg ? `${agg.firstKills} / ${agg.firstDeaths}` : '…'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-m3-outline">Aces</div>
                <div className="font-display font-extrabold text-lg text-m3-on-surface tabular-nums">{trn?.aces ?? agg?.aces ?? '…'}</div>
              </div>
            </motion.section>

            <motion.section variants={rise} custom={8}
              className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-on-surface mb-2 text-center">Top Agent</h4>
              {topAgent ? (
                <div className="flex flex-col items-center gap-1">
                  {topAgentIcon ? <img src={topAgentIcon} alt={topAgent.agent} className="w-14 h-14 rounded-xl object-cover" /> : null}
                  <span className="font-display font-extrabold text-base text-m3-on-surface">{topAgent.agent}</span>
                  <span className="text-[10px] text-m3-outline">{topAgent.hours > 0 ? `${topAgent.hours}h, ` : ''}{topAgent.matches} matches</span>
                  <div className="grid grid-cols-4 gap-2 mt-1 w-full text-center">
                    <div>
                      <div className="text-[9px] text-m3-outline">Win %</div>
                      <div className="text-[12px] font-mono font-bold text-m3-on-surface">{topAgent.winPct.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-m3-outline">K/D</div>
                      <div className="text-[12px] font-mono font-bold text-m3-on-surface">{topAgent.kd.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-m3-outline">ADR</div>
                      <div className="text-[12px] font-mono font-bold text-m3-on-surface">{Math.round(topAgent.adr)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-m3-outline">ACS</div>
                      <div className="text-[12px] font-mono font-bold text-m3-on-surface">{Math.round(topAgent.acs)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-m3-outline text-center">…</div>
              )}
            </motion.section>

            <motion.section variants={rise} custom={9}
              className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-on-surface">Accuracy</h4>
                <span className="text-[9px] text-m3-outline">Act-wide</span>
              </div>
              {trn && hitTotal > 0 ? (
                <div className="flex flex-col gap-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-m3-outline w-8">Head</span>
                    <span className="font-mono font-bold text-m3-primary">{trn.hsPct.toFixed(2)}%</span>
                    <span className="font-mono text-m3-outline tabular-nums ml-auto">{trn.headHits.toLocaleString()} hits</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-m3-outline w-8">Body</span>
                    <span className="font-mono font-bold text-m3-on-surface">{bodyPct.toFixed(2)}%</span>
                    <span className="font-mono text-m3-outline tabular-nums ml-auto">{trn.bodyHits.toLocaleString()} hits</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-m3-outline w-8">Legs</span>
                    <span className="font-mono font-bold text-m3-on-surface">{legPct.toFixed(2)}%</span>
                    <span className="font-mono text-m3-outline tabular-nums ml-auto">{trn.legHits.toLocaleString()} hits</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 p-2.5 text-[10px] text-m3-outline flex items-start gap-1.5">
                  <Lock className="w-3 h-3 shrink-0 mt-px" />
                  <span>Hit data loading…</span>
                </div>
              )}
            </motion.section>
          </div>

          {/* Previous acts */}
          {prevActs.length > 0 && (
            <motion.section variants={rise} custom={10}
              className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 shrink-0">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-primary mb-2.5">Previous acts</h4>
              <div className="grid grid-cols-3 gap-2">
                {prevActs.map((s) => {
                  const prev = trnPrev[s.id.toLowerCase()];
                  return (
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
                        {prev ? `K/D ${prev.kd.toFixed(2)} • ${prev.matches} games` : `${s.wins}W–${Math.max(0, s.games - s.wins)}L • ${s.games} games`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* Tracker score */}
          {trn && (
            <motion.section variants={rise} custom={11}
              className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 shrink-0">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-on-surface mb-2.5">Tracker score</h4>
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-full bg-m3-tertiary-container/50 border-2 border-m3-tertiary/50 flex items-center justify-center shrink-0 shadow-m3-1">
                  <Trophy className="w-7 h-7 text-m3-tertiary" />
                </div>
                <div className="font-display font-black text-3xl text-m3-on-surface tabular-nums">{trn.trnScore}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 ml-auto flex-1">
                  {[
                    { label: 'Round Win %', v: trn.roundWinPct.toFixed(1) + '%', p: trn.roundWinPctile },
                    { label: 'KAST', v: trn.kast.toFixed(1) + '%', p: trn.kastPctile },
                    { label: 'ACS', v: trn.acs.toFixed(1), p: trn.acsPctile },
                    { label: 'DDΔ/Round', v: String(Math.round(trn.damageDelta / Math.max(1, trn.rounds))), p: trn.adrPctile },
                  ].map((s) => (
                    <div key={s.label} className="text-right">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-m3-outline">{s.label}</div>
                      <div className="text-[15px] font-mono font-bold text-m3-on-surface">{s.v}</div>
                      <div className="text-[9px] font-mono text-m3-tertiary">{s.p > 0 ? pctLabel(s.p) : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {/* Recent form */}
          <motion.section variants={rise} custom={12}
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
