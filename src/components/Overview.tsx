import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, RefreshCw, Trophy } from 'lucide-react';
import { tierName } from '../utils/tracker';
import { fetchTrnActStats, fetchTrnAgents, type TrnActStats, type TrnAgentStat } from '../utils/trn';
import { useTrackerData } from '../hooks/useTrackerData';
import { useCountUp } from '../hooks/useCountUp';
import { TrackerSkeletons } from './TrackerSkeletons';
import { CustomDropdown } from './ValorantConfig';

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: 'easeOut' as const },
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

const PLAYLISTS = [
  { value: 'competitive', label: 'Competitive' },
  { value: 'unrated', label: 'Unrated' },
];

export const Overview: React.FC = () => {
  const { profile, games, seasonNames, seasonOrder, tierIcons, agentInfo, agg, trn, trnAgents, trnPrev, isLoading, banner, setBanner, refresh } =
    useTrackerData();

  // View selection (mirrors TRN's Playlist/Act boxes; stats sections follow it).
  const [playlist, setPlaylist] = useState('competitive');
  const [seasonId, setSeasonId] = useState('');
  const [selStats, setSelStats] = useState<TrnActStats | null>(null);
  const [selAgents, setSelAgents] = useState<TrnAgentStat[] | null>(null);
  const [selLoading, setSelLoading] = useState(false);
  const isDefault = playlist === 'competitive' && !seasonId;

  const seasonOptions = useMemo(() => {
    if (!profile) return [];
    const played = new Set(profile.seasons.filter((s) => s.games > 0).map((s) => s.id.toLowerCase()));
    const order = seasonOrder.length > 0 ? seasonOrder : [...played];
    const ids = [profile.currentSeasonId.toLowerCase(), ...order.filter((id) => id !== profile.currentSeasonId.toLowerCase() && played.has(id))];
    return [
      { value: '', label: seasonNames[profile.currentSeasonId.toLowerCase()] ?? 'Current Act' },
      ...ids.slice(1).map((id) => ({ value: id, label: seasonNames[id] ?? shortAct(id) })),
    ];
  }, [profile, seasonOrder, seasonNames]);

  useEffect(() => {
    if (isDefault || !profile) {
      setSelStats(null);
      setSelAgents(null);
      return;
    }
    let live = true;
    setSelLoading(true);
    const sid = seasonId || profile.currentSeasonId;
    Promise.all([
      fetchTrnActStats(profile.name, profile.tag, sid, playlist).then((r) => r.stats).catch(() => null),
      fetchTrnAgents(profile.name, profile.tag, sid, playlist).catch(() => []),
    ]).then(([st, ag]) => {
      if (!live) return;
      setSelStats(st);
      setSelAgents(st ? ag : []);
      setSelLoading(false);
    });
    return () => {
      live = false;
    };
  }, [isDefault, playlist, seasonId, profile]);

  const S = selStats ?? trn;
  const agents = selAgents ?? trnAgents;
  const losses = S ? S.losses : profile ? Math.max(0, profile.games - profile.wins) : 0;
  const wins = S ? S.wins : profile?.wins ?? 0;
  const winPct = S ? S.winPct : profile && profile.games > 0 ? (profile.wins / profile.games) * 100 : 0;
  const kd = S?.kd ?? agg?.kd ?? 0;
  const adr = S?.adr ?? agg?.adr ?? 0;
  const kills = S?.kills ?? agg?.kills ?? 0;
  const deaths = S?.deaths ?? agg?.deaths ?? 0;
  const assists = S?.assists ?? agg?.assists ?? 0;
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

  const topAgent = agents[0] ?? null;
  const topAgentIcon = topAgent
    ? Object.values(agentInfo).find((a) => a.name.toLowerCase() === topAgent.agent.toLowerCase())?.icon ?? ''
    : '';
  const hitTotal = (S?.headHits ?? 0) + (S?.bodyHits ?? 0) + (S?.legHits ?? 0);
  const bodyPct = hitTotal > 0 ? ((S?.bodyHits ?? 0) / hitTotal) * 100 : 0;
  const legPct = hitTotal > 0 ? ((S?.legHits ?? 0) / hitTotal) * 100 : 0;

  if (isLoading && !profile) {
    return (
      <div className="h-full min-h-0 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
        <TrackerSkeletons />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" className="h-full min-h-0 flex gap-2.5 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
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

        {/* Playlist / Act selectors */}
        <motion.div variants={rise} custom={0} className="grid grid-cols-2 gap-2 shrink-0">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-m3-outline mb-1 px-1">Playlist</div>
            <CustomDropdown value={playlist} options={PLAYLISTS} onChange={(v) => setPlaylist(v)} />
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-m3-outline mb-1 px-1">Act</div>
            <CustomDropdown value={seasonId} options={seasonOptions} onChange={(v) => setSeasonId(v)} />
          </div>
        </motion.div>

        {profile ? (
          <>
            {/* Rank hero strip (identity lives in the sidebar) */}
            <motion.section variants={rise} custom={1}
              className="rounded-2xl bg-m3-surface-container border border-m3-primary/30 p-3 flex items-center gap-3 shrink-0">
              {trn?.avatarUrl ? (
                <img src={trn.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover border border-m3-primary/40 shrink-0" />
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display font-extrabold text-base text-m3-on-surface">{profile.rank}</span>
                  <span className="font-mono text-xs text-m3-primary font-bold tabular-nums">{Math.round(rrNow)} RR</span>
                </div>
                <div className="text-[11px] text-m3-outline truncate">{profile.name}#{profile.tag}</div>
              </div>
              <button onClick={refresh} disabled={isLoading} title="Refresh"
                className="w-8 h-8 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-m3-on-surface-variant flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </motion.section>

            {/* Headline tiles */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 opacity-100">
              <BigTile index={2} label="Win %" numeric={selLoading ? undefined : winPct} decimals={2} suffix="%" value={selLoading ? '…' : undefined} />
              <BigTile index={3} label="K/D" numeric={selLoading ? undefined : kd} decimals={3} value={selLoading ? '…' : undefined} />
              {S ? (
                <BigTile index={4} label="Headshot %" numeric={S.hsPct} decimals={2} suffix="%" />
              ) : (
                <BigTile index={4} label="Headshot %" value="—" locked />
              )}
              <BigTile index={5} label="Damage/Round" numeric={selLoading ? undefined : adr} decimals={2} value={selLoading ? '…' : undefined} />
            </section>

            {/* Sub stats */}
            <motion.section variants={rise} custom={6}
              className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5 shrink-0">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                <SmallStat label="Wins" value={String(wins)} tone="win" />
                <SmallStat label="Losses" value={S && S.ties > 0 ? String(losses) : String(losses)} tone="loss" />
                <SmallStat label="Kills" value={kills ? kills.toLocaleString() : '…'} />
                <SmallStat label="Deaths" value={deaths ? deaths.toLocaleString() : '…'} />
                <SmallStat label="Assists" value={assists ? assists.toLocaleString() : '…'} />
                <SmallStat label="Headshots" value={S ? S.headshots.toLocaleString() : '—'} locked={!S} />
                <SmallStat label="Flawless" value={String(S?.flawless ?? agg?.flawless ?? '…')} />
                <SmallStat label="Clutches" value={String(S?.clutches ?? agg?.clutches ?? '…')} />
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-m3-outline-subtle/60 text-[10px] text-m3-outline flex items-center gap-1.5">
                <Lock className="w-3 h-3 shrink-0" />
                <span>
                  {S
                    ? `Act-wide via TRN (${wins}W–${losses}L${S.ties > 0 ? `–${S.ties}T` : ''}) • rank live from Riot`
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
                  <div className="font-display font-extrabold text-lg text-m3-on-surface tabular-nums">{S ? String(S.bestKills || '…') : '…'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-m3-outline">First Kills / Deaths</div>
                  <div className="font-display font-extrabold text-lg text-m3-on-surface tabular-nums">
                    {S ? `${S.firstKills} / ${S.firstDeaths}` : agg ? `${agg.firstKills} / ${agg.firstDeaths}` : '…'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-m3-outline">Aces</div>
                  <div className="font-display font-extrabold text-lg text-m3-on-surface tabular-nums">{S?.aces ?? agg?.aces ?? '…'}</div>
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
                {S && hitTotal > 0 ? (
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-m3-outline w-8">Head</span>
                      <span className="font-mono font-bold text-m3-primary">{S.hsPct.toFixed(2)}%</span>
                      <span className="font-mono text-m3-outline tabular-nums ml-auto">{S.headHits.toLocaleString()} hits</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-m3-outline w-8">Body</span>
                      <span className="font-mono font-bold text-m3-on-surface">{bodyPct.toFixed(2)}%</span>
                      <span className="font-mono text-m3-outline tabular-nums ml-auto">{S.bodyHits.toLocaleString()} hits</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-m3-outline w-8">Legs</span>
                      <span className="font-mono font-bold text-m3-on-surface">{legPct.toFixed(2)}%</span>
                      <span className="font-mono text-m3-outline tabular-nums ml-auto">{S.legHits.toLocaleString()} hits</span>
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

            {/* Previous acts + Tracker score, half and half */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
            {prevActs.length > 0 && (
              <motion.section variants={rise} custom={10}
                className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-primary mb-2.5">Previous acts</h4>
                <div className="flex flex-col gap-2">
                  {prevActs.map((s) => {
                    const prev = trnPrev[s.id.toLowerCase()];
                    return (
                      <div key={s.id} className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 p-2 flex items-center gap-2.5">
                        {tierIcons[s.tier] ? (
                          <img src={tierIcons[s.tier]} alt={tierName(s.tier)} className="w-10 h-10 object-contain shrink-0" />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-m3-outline">
                            {shortAct(seasonNames[s.id.toLowerCase()] ?? 'Past act')}
                          </div>
                          <div className="font-display font-extrabold text-sm text-m3-on-surface">{tierName(s.tier)}</div>
                          <div className="font-mono text-[10px] text-m3-outline tabular-nums">
                            {prev ? `K/D ${prev.kd.toFixed(2)} • ${prev.matches} games` : `${s.wins}W–${Math.max(0, s.games - s.wins)}L • ${s.games} games`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            )}
            {trn && (
              <motion.section variants={rise} custom={11}
                className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3.5">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-on-surface mb-2.5">Tracker score</h4>
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-full bg-m3-tertiary-container/50 border-2 border-m3-tertiary/50 flex items-center justify-center shrink-0">
                    <Trophy className="w-5 h-5 text-m3-tertiary" />
                  </div>
                  <div className="font-display font-black text-2xl text-m3-on-surface tabular-nums">{trn.trnScore}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  {[
                    { label: 'Round Win %', v: trn.roundWinPct.toFixed(1) + '%', p: trn.roundWinPctile },
                    { label: 'KAST', v: trn.kast.toFixed(1) + '%', p: trn.kastPctile },
                    { label: 'ACS', v: trn.acs.toFixed(1), p: trn.acsPctile },
                    { label: 'DDΔ/R', v: String(Math.round(trn.damageDelta / Math.max(1, trn.rounds))), p: trn.adrPctile },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-m3-outline">{s.label}</div>
                      <div className="text-[13px] font-mono font-bold text-m3-on-surface">{s.v}</div>
                      <div className="text-[9px] font-mono text-m3-tertiary">{s.p > 0 ? pctLabel(s.p) : ''}</div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
            </div>

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
      </div>
    </motion.div>
  );
};
