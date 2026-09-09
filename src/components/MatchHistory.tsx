import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lightbulb, Lock } from 'lucide-react';
import type { TrackerMatchDetail, TrackerMmrPoint } from '../types';
import { matchCard, queueLabel, shortMapName } from '../utils/tracker';
import { useTrackerData } from '../hooks/useTrackerData';
import { buildTips } from '../utils/trackerTips';
import { TrackerSkeletons } from './TrackerSkeletons';
import { CustomDropdown } from './ValorantConfig';

const ago = (ms: number): string => {
  if (!ms) return '';
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
};

const dayLabel = (ms: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

interface Row {
  g: TrackerMmrPoint;
  detail?: TrackerMatchDetail;
  agent: string;
  won: boolean;
  us: number;
  them: number;
  k: number;
  d: number;
  a: number;
  acs: number;
  dd: number;
}

const MatchRow: React.FC<{
  r: Row;
  queue: string;
  map: string;
  index: number;
  icon: string;
  puuid: string;
}> = ({ r, queue, map, index, icon, puuid }) => {
  const [open, setOpen] = useState(false);
  const card = useMemo(() => (r.detail ? matchCard(r.detail, puuid) : null), [r.detail, puuid]);
  const teams = useMemo(() => {
    if (!r.detail) return [];
    return ['Blue', 'Red']
      .map((t) => ({
        team: t,
        score: r.detail!.teamScore[t] ?? 0,
        players: [...r.detail!.players]
          .filter((p) => p.team === t)
          .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths),
      }))
      .filter((x) => x.players.length > 0);
  }, [r.detail]);
  const tips = useMemo(() => (r.detail && puuid ? buildTips(r.detail, puuid) : []), [r.detail, puuid]);

  const badges: { label: string; good: boolean }[] = [];
  if (card) {
    if (card.kills4 > 0) badges.push({ label: '4k', good: true });
    else if (card.kills3 > 0) badges.push({ label: '3k', good: true });
    if (card.aces > 0) badges.push({ label: 'Ace', good: true });
    if (card.clutchWon) badges.push({ label: 'Clutch', good: true });
    if (card.clutchLost) badges.push({ label: 'Clutch Lost', good: false });
    if (card.kastPct >= 85) badges.push({ label: 'High KAST', good: true });
  }
  const kd = r.d > 0 ? r.k / r.d : r.k;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.3, ease: 'easeOut' }}
      className={`rounded-xl border overflow-hidden ${r.won ? 'bg-emerald-400/[0.07] border-emerald-400/25' : 'bg-m3-surface-container-low/60 border-m3-outline-subtle/60'}`}>
      <button onClick={() => r.detail && setOpen((o) => !o)}
        className={`w-full px-2.5 py-2 flex items-center gap-2.5 text-left ${r.detail ? 'cursor-pointer hover:bg-m3-surface-container-high/30' : ''}`}>
        <span className={`w-1 self-stretch rounded-full shrink-0 ${r.won ? 'bg-m3-tertiary' : 'bg-red-500/70'}`} />
        {icon ? (
          <img src={icon} alt={r.agent} className="w-9 h-9 rounded-lg object-cover bg-m3-surface-container-high shrink-0" />
        ) : (
          <span className="w-9 h-9 rounded-lg bg-m3-surface-container-high shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-m3-outline">{ago(r.g.when)} // {queue}</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-bold text-m3-on-surface">{map}</span>
            <span className={`text-[12px] font-mono font-bold ${r.won ? 'text-emerald-400' : 'text-red-400'}`}>
              {r.detail ? `${r.us} : ${r.them}` : ''}
            </span>
            <span className={`text-[11px] font-mono font-bold ${r.g.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {r.g.change > 0 ? `+${r.g.change}` : r.g.change} RR
            </span>
          </div>
          {badges.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {badges.map((b) => (
                <span key={b.label}
                  className={`px-1.5 py-px rounded-md text-[9px] font-bold border ${b.good ? 'bg-amber-400/10 border-amber-400/40 text-amber-200' : 'bg-red-500/10 border-red-500/40 text-red-300'}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0 text-right">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-m3-outline">K/D</div>
            <div className={`text-[13px] font-mono font-bold ${kd >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{kd.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-m3-outline">K/D/A</div>
            <div className="text-[13px] font-mono font-bold text-m3-on-surface tabular-nums">{r.k} / {r.d} / {r.a}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-m3-outline">DDΔ</div>
            <div className={`text-[13px] font-mono font-bold ${r.dd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.dd > 0 ? `+${r.dd}` : r.dd}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-m3-outline">ACS</div>
            <div className="text-[13px] font-mono font-bold text-m3-on-surface">{r.acs}</div>
          </div>
        </div>
        <div className="sm:hidden shrink-0 text-right">
          <div className="text-[12px] font-mono font-bold text-m3-on-surface tabular-nums">{r.k}/{r.d}/{r.a}</div>
          <div className="text-[10px] font-mono text-m3-outline">ACS {r.acs}</div>
        </div>
        {r.detail && <span className="text-[10px] text-m3-outline shrink-0">{open ? '▾' : '▸'}</span>}
      </button>
      {open && r.detail && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-m3-outline-subtle/50">
          {teams.map((t) => (
            <div key={t.team} className="mt-1.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-m3-outline mb-1">
                Team {t.team} • {t.score}
              </div>
              {t.players.map((p) => {
                const isMe = p.puuid === puuid;
                const pacs = p.rounds > 0 ? Math.round(p.score / p.rounds) : 0;
                return (
                  <div key={p.puuid || `${p.agent}-${p.kills}`}
                    className={`flex items-center justify-between gap-2 py-1 px-1.5 rounded-lg text-[11px] ${isMe ? 'bg-m3-primary/10 border border-m3-primary/30' : ''}`}>
                    <span className="truncate text-m3-on-surface">
                      <span className="font-semibold">{isMe ? 'You' : p.agent}</span>
                      <span className="text-m3-outline"> • {p.agent}</span>
                    </span>
                    <span className="font-mono text-m3-on-surface-variant shrink-0 tabular-nums">
                      {p.kills}/{p.deaths}/{p.assists} • {pacs}
                    </span>
                  </div>
                );
              })}
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
        </div>
      )}
    </motion.div>
  );
};

export const MatchHistory: React.FC = () => {
  const { profile, games, queueById, mapById, detailsById, agentInfo, weapons, agg, isLoading, ready, banner, setBanner } = useTrackerData();
  const [agentFilter, setAgentFilter] = useState('All');
  const [mapFilter, setMapFilter] = useState('All');
  const puuid = profile?.puuid ?? '';

  const infoByName = useMemo(() => {
    const m: Record<string, { name: string; icon: string; role: string; roleIcon: string }> = {};
    for (const v of Object.values(agentInfo)) m[v.name.toLowerCase()] = v;
    return m;
  }, [agentInfo]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const g of games) {
      const detail = detailsById[g.matchId];
      const me = detail?.players.find((p) => p.puuid === puuid);
      const agent = me?.agent ?? '?';
      const map = mapById[g.matchId] ?? shortMapName(g.mapId, {});
      if (agentFilter !== 'All' && agent !== agentFilter) continue;
      if (mapFilter !== 'All' && map !== mapFilter) continue;
      const myTeam = me?.team ?? '';
      const us = myTeam && detail ? (detail.teamScore[myTeam] ?? 0) : 0;
      const them = myTeam && detail
        ? Math.max(0, ...Object.entries(detail.teamScore).filter(([t]) => t !== myTeam).map(([, n]) => n), 0)
        : 0;
      const won = detail && us !== them ? us > them : g.change > 0;
      out.push({
        g,
        detail,
        agent,
        won,
        us,
        them,
        k: me?.kills ?? 0,
        d: me?.deaths ?? 0,
        a: me?.assists ?? 0,
        acs: me && me.rounds > 0 ? Math.round(me.score / me.rounds) : 0,
        dd: me ? me.damage - me.damageTaken : 0,
      });
    }
    return out;
  }, [games, detailsById, puuid, mapById, agentFilter, mapFilter]);

  const agentsPlayed = useMemo(() => [...new Set(rows.map((r) => r.agent).filter((a) => a && a !== '?'))].sort(), [rows]);
  const mapsPlayed = useMemo(
    () => [...new Set(games.map((g) => mapById[g.matchId] ?? shortMapName(g.mapId, {})).filter((m) => m && m !== '?'))].sort(),
    [games, mapById]
  );

  const sum = useMemo(() => {
    let w = 0;
    let k = 0;
    let d = 0;
    let dmg = 0;
    let rds = 0;
    for (const r of rows) {
      if (r.won) w++;
      k += r.k;
      d += r.d;
      const me = r.detail?.players.find((p) => p.puuid === puuid);
      if (me) {
        dmg += me.damage;
        rds += me.rounds;
      }
    }
    return {
      w,
      l: rows.length - w,
      kd: d > 0 ? k / d : k,
      adr: rds > 0 ? dmg / rds : 0,
    };
  }, [rows, puuid]);

  const topAgents = useMemo(() => {
    const m = new Map<string, { w: number; n: number; k: number; d: number }>();
    for (const r of rows) {
      if (r.agent === '?') continue;
      const e = m.get(r.agent) ?? { w: 0, n: 0, k: 0, d: 0 };
      e.n++;
      if (r.won) e.w++;
      e.k += r.k;
      e.d += r.d;
      m.set(r.agent, e);
    }
    return [...m.entries()]
      .map(([name, e]) => ({ name, ...e, wr: e.n > 0 ? (e.w / e.n) * 100 : 0, kd: e.d > 0 ? e.k / e.d : e.k }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 3);
  }, [rows]);

  const days = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const key = dayLabel(r.g.when) || 'Older';
      const l = groups.get(key) ?? [];
      l.push(r);
      groups.set(key, l);
    }
    return [...groups.entries()].map(([label, rs]) => {
      let w = 0;
      let k = 0;
      let d = 0;
      let a = 0;
      let dmg = 0;
      let rds = 0;
      for (const r of rs) {
        if (r.won) w++;
        k += r.k;
        d += r.d;
        a += r.a;
        const me = r.detail?.players.find((p) => p.puuid === puuid);
        if (me) {
          dmg += me.damage;
          rds += me.rounds;
        }
      }
      return {
        label,
        rs,
        w,
        l: rs.length - w,
        kd: d > 0 ? k / d : k,
        kda: `${k}K // ${d}D // ${a}A`,
        acs: rds > 0 ? Math.round(dmg / rds) : 0,
      };
    });
  }, [rows, puuid]);

  const roles = useMemo(() => {
    const m = new Map<string, { w: number; n: number; k: number; d: number; a: number; icon: string }>();
    for (const r of rows) {
      const info = infoByName[r.agent.toLowerCase()];
      const role = info?.role || 'Unknown';
      if (role === 'Unknown') continue;
      const e = m.get(role) ?? { w: 0, n: 0, k: 0, d: 0, a: 0, icon: info.roleIcon };
      e.n++;
      if (r.won) e.w++;
      e.k += r.k;
      e.d += r.d;
      e.a += r.a;
      m.set(role, e);
    }
    return [...m.entries()].map(([role, e]) => ({
      role,
      icon: e.icon,
      wr: e.n > 0 ? (e.w / e.n) * 100 : 0,
      rec: `${e.w}W - ${e.n - e.w}L`,
      kda: `${(e.d > 0 ? (e.k + e.a) / e.d : e.k + e.a).toFixed(2)}`,
      kdaLine: `${e.k} // ${e.d} // ${e.a}`,
    }));
  }, [rows, infoByName]);

  const topWeapons = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!r.detail) continue;
      const c = matchCard(r.detail, puuid);
      for (const [w, n] of Object.entries(c.weaponKills)) m.set(w, (m.get(w) ?? 0) + n);
    }
    return [...m.entries()]
      .map(([id, kills]) => ({ name: weapons[id.toLowerCase()] ?? 'Ability', kills }))
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 4);
  }, [rows, puuid, weapons]);

  const topMaps = useMemo(() => {
    const m = new Map<string, { n: number; w: number }>();
    for (const r of rows) {
      const map = mapById[r.g.matchId] ?? shortMapName(r.g.mapId, {});
      if (!map || map === '?') continue;
      const e = m.get(map) ?? { n: 0, w: 0 };
      e.n++;
      if (r.won) e.w++;
      m.set(map, e);
    }
    return [...m.entries()]
      .map(([map, e]) => ({ map, ...e, wr: e.n > 0 ? Math.round((e.w / e.n) * 100) : 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 4);
  }, [rows, games, mapById]);

  if (!ready) {
    return (
      <div className="h-full min-h-0 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
        <TrackerSkeletons />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex gap-2.5 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar pb-2">
      {/* Left rail */}
      <aside className="hidden lg:flex flex-col gap-2.5 w-56 shrink-0">
        <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-on-surface mb-1">Accuracy</h4>
          <div className="text-[10px] text-m3-outline mb-2">Last {rows.length} matches</div>
          <div className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 p-2.5 text-[10px] text-m3-outline flex items-start gap-1.5">
            <Lock className="w-3 h-3 shrink-0 mt-px" />
            <span>Riot hides hit data from past matches — unlocks with live tracking.</span>
          </div>
        </section>
        {roles.length > 0 && (
          <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-on-surface mb-2">Roles</h4>
            <div className="flex flex-col gap-2.5">
              {roles.map((r) => (
                <div key={r.role} className="flex items-center gap-2">
                  {r.icon ? <img src={r.icon} alt={r.role} className="w-7 h-7 object-contain shrink-0" /> : null}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-m3-on-surface-variant">{r.role}</div>
                    <div className={`text-[12px] font-bold ${r.wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                      WR {r.wr.toFixed(1)}%
                    </div>
                    <div className="text-[10px] font-mono text-m3-outline">{r.rec}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-mono font-bold text-m3-on-surface">KDA {r.kda}</div>
                    <div className="text-[10px] font-mono text-m3-outline">{r.kdaLine}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {topWeapons.length > 0 && (
          <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-on-surface mb-2">Top weapons</h4>
            <div className="flex flex-col gap-2">
              {topWeapons.map((w) => (
                <div key={w.name} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-m3-on-surface truncate">{w.name}</span>
                  <span className="text-[11px] font-mono text-m3-outline shrink-0">{w.kills} kills</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {topMaps.length > 0 && (
          <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-m3-on-surface mb-2">Top maps</h4>
            <div className="flex flex-col gap-2">
              {topMaps.map((m) => (
                <div key={m.map} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-m3-on-surface truncate">{m.map}</span>
                  <span className={`text-[11px] font-mono font-bold shrink-0 ${m.wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.wr}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

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

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="w-36">
            <CustomDropdown value={agentFilter} options={[{ value: 'All', label: 'All Agents' }, ...agentsPlayed.map((a) => ({ value: a, label: a }))]} onChange={setAgentFilter} />
          </div>
          <div className="w-36">
            <CustomDropdown value={mapFilter} options={[{ value: 'All', label: 'All Maps' }, ...mapsPlayed.map((m) => ({ value: m, label: m }))]} onChange={setMapFilter} />
          </div>
          {agg && (
            <span className="ml-auto text-[10px] font-mono text-m3-outline">
              {agg.matches} scoreboards • {agg.kills}K // {agg.deaths}D
            </span>
          )}
        </div>

        {/* Summary */}
        {rows.length > 0 && (
          <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="font-display font-extrabold text-lg text-emerald-400">{sum.w}W</span>
                <span className="text-m3-outline font-bold"> - </span>
                <span className="font-display font-extrabold text-lg text-red-400">{sum.l}L</span>
                <span className="text-[11px] text-m3-outline ml-1.5">
                  ({rows.length > 0 ? Math.round((sum.w / rows.length) * 100) : 0}%)
                </span>
                <div className="text-[10px] font-mono text-m3-outline mt-0.5">
                  {sum.kd.toFixed(2)} K/D | {Math.round(sum.adr)} ADR
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {topAgents.map((a) => {
                  const info = infoByName[a.name.toLowerCase()];
                  return (
                    <div key={a.name} className="flex items-center gap-1.5 rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 px-2 py-1.5">
                      {info?.icon ? <img src={info.icon} alt={a.name} className="w-8 h-8 rounded-lg object-cover" /> : null}
                      <div>
                        <div className="text-[10px] font-bold text-m3-on-surface whitespace-nowrap">
                          {a.w}W - {a.n - a.w}L ({Math.round(a.wr)}%)
                        </div>
                        <div className="text-[10px] font-mono text-m3-outline">K/D {a.kd.toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Day groups */}
        {days.map((day) => (
          <div key={day.label} className="flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center gap-2 px-1 flex-wrap">
              <span className="text-[12px] font-bold text-m3-on-surface">{day.label}</span>
              <span className="text-[10px] font-mono text-m3-outline border border-m3-outline-subtle rounded-md px-1.5 py-px">
                {day.rs.length}
              </span>
              <span className="text-[11px] font-bold ml-2">
                <span className="text-emerald-400">{day.w} W</span>
                <span className="text-m3-outline"> // </span>
                <span className="text-red-400">{day.l} L</span>
              </span>
              <span className="ml-auto text-[10px] font-mono text-m3-outline hidden sm:block">
                K/D {day.kd.toFixed(1)} • {day.kda} • ACS {day.acs}
              </span>
            </div>
            {day.rs.map((r, i) => (
              <MatchRow key={r.g.matchId || r.g.when} r={r} index={i}
                queue={queueLabel(detailsById[r.g.matchId]?.queue || queueById[r.g.matchId] || '')}
                map={mapById[r.g.matchId] ?? shortMapName(r.g.mapId, {})}
                icon={infoByName[r.agent.toLowerCase()]?.icon ?? ''}
                puuid={puuid} />
            ))}
          </div>
        ))}

        {!profile && !isLoading && (
          <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-subtle text-center text-[11px] text-m3-on-surface-variant shrink-0">
            Open the Riot Client and this tab fills itself — matches, scoreboards, roles, weapons.
          </div>
        )}
      </div>
    </div>
  );
};
