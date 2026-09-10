import React, { useEffect, useState, useRef } from 'react';
import { Lock as LockIcon } from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer, TrackerProfile } from '../types';
import { fetchLiveMatchState, gameData, detectLocalAccount, detectRegion, fetchMmrDirect } from '../utils/tracker';
import { getOverlayEditMode, fetchDisplayInfo } from '../utils/ipc';
import { listen } from '@tauri-apps/api/event';

export interface WidgetPos {
  x: number;
  y: number;
}

export interface OverlayConfig {
  showRank: boolean;
  showLobby: boolean;
  showKpi: boolean;
  showDisplay: boolean;
  positions: {
    rank: WidgetPos;
    lobby: WidgetPos;
    kpi: WidgetPos;
    display: WidgetPos;
  };
}

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  showRank: true,
  showLobby: true,
  showKpi: false,
  showDisplay: false,
  positions: {
    rank: { x: 24, y: 24 },
    display: { x: 300, y: 24 },
    kpi: { x: 24, y: 140 },
    lobby: { x: 120, y: 90 },
  },
};

export const OverlayView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [profile, setProfile] = useState<TrackerProfile | null>(null);
  const [displayTag, setDisplayTag] = useState<string>('2088×1440 @ 260Hz • 1.45:1');

  // Edit mode state (synced with main app)
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [, setActiveDragKey] = useState<string | null>(null);

  // Widget config + positions (persisted)
  const [config, setConfig] = useState<OverlayConfig>(() => {
    try {
      const saved = localStorage.getItem('aspect_overlay_cfg_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_OVERLAY_CONFIG,
          ...parsed,
          positions: { ...DEFAULT_OVERLAY_CONFIG.positions, ...(parsed.positions || {}) },
        };
      }
    } catch {}
    return DEFAULT_OVERLAY_CONFIG;
  });

  const saveConfig = (next: OverlayConfig) => {
    setConfig(next);
    try {
      localStorage.setItem('aspect_overlay_cfg_v3', JSON.stringify(next));
    } catch {}
  };

  // Direct element references for GPU hardware-accelerated zero-lag dragging
  const rankRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const kpiRef = useRef<HTMLDivElement>(null);
  const lobbyRef = useRef<HTMLDivElement>(null);

  const widgetRefs = {
    rank: rankRef,
    display: displayRef,
    kpi: kpiRef,
    lobby: lobbyRef,
  };

  // Sync edit mode and config changes from main app
  useEffect(() => {
    getOverlayEditMode().then(setIsEditMode).catch(() => {});
    const unlistenEdit = listen<boolean>('overlay-edit-mode-changed', (event) => {
      setIsEditMode(event.payload);
    });
    const unlistenCfg = listen<OverlayConfig>('overlay-config-changed', (event) => {
      setConfig(event.payload);
    });
    return () => {
      unlistenEdit.then((fn) => fn()).catch(() => {});
      unlistenCfg.then((fn) => fn()).catch(() => {});
    };
  }, []);

  // Poll live match data ONLY when visible
  useEffect(() => {
    gameData().then((d) => setTierIcons(d.tierIcons)).catch(() => {});
    fetchDisplayInfo().then((info) => {
      setDisplayTag(`${info.current_width}×${info.current_height} @ ${info.current_hz}Hz`);
    }).catch(() => {});

    detectLocalAccount().then(async (acc) => {
      const reg = await detectRegion();
      const prof = await fetchMmrDirect(reg, acc.game_name, acc.tagline);
      setProfile(prof);
    }).catch(() => {});

    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchLiveMatchState().then(setMatchState).catch(() => {});
    };

    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) tick();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }
    const id = setInterval(tick, 4500);
    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, []);

  // Smooth GPU-composited drag handler
  const startDrag = (key: keyof OverlayConfig['positions'], e: React.PointerEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveDragKey(key);

    const targetEl = widgetRefs[key].current;
    const current = config.positions[key] || { x: 24, y: 24 };

    let curX = current.x;
    let curY = current.y;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const onPointerMove = (moveEv: PointerEvent) => {
      moveEv.preventDefault();
      const dx = moveEv.clientX - startClientX;
      const dy = moveEv.clientY - startClientY;

      // Clamp strictly within screen bounds
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 2088;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 1440;
      const clampedX = Math.max(0, Math.min(screenW - 80, current.x + dx));
      const clampedY = Math.max(0, Math.min(screenH - 50, current.y + dy));

      curX = clampedX;
      curY = clampedY;

      if (targetEl) {
        targetEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      upEv.preventDefault();
      setActiveDragKey(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      setConfig((prev) => {
        const next = {
          ...prev,
          positions: {
            ...prev.positions,
            [key]: { x: Math.round(curX), y: Math.round(curY) },
          },
        };
        saveConfig(next);
        return next;
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
  };

  const isLive = matchState && matchState.phase !== 'idle';
  const myPlayer = matchState
    ? [...matchState.blueTeam, ...matchState.redTeam].find((p) => p.isMe)
    : null;

  return (
    <div
      onDragStart={(e) => e.preventDefault()}
      className={`fixed inset-0 w-screen h-screen select-none overflow-hidden font-sans ${
        isEditMode ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{ backgroundColor: 'transparent' }}
    >
      {/* ZERO top bars. ZERO bottom footers. ZERO perimeter rings. Only widgets. */}

      {/* ============================================================ */}
      {/* WIDGET 1: Player Rank & RR                                  */}
      {/* ============================================================ */}
      {config.showRank && (
        <div
          ref={rankRef}
          onPointerDown={(e) => startDrag('rank', e)}
          style={{
            transform: `translate3d(${config.positions.rank.x}px, ${config.positions.rank.y}px, 0)`,
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 pointer-events-auto select-none will-change-transform ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-2xl p-0.5'
              : ''
          }`}
        >
          <div className="rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-3">
            {tierIcons[myPlayer?.tier ?? profile?.tier ?? 0] ? (
              <img
                src={tierIcons[myPlayer?.tier ?? profile?.tier ?? 0]}
                alt=""
                draggable={false}
                className="w-10 h-10 object-contain shrink-0 drop-shadow-md pointer-events-none select-none"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-black text-sm text-white tracking-tight leading-tight">
                  {myPlayer?.rank || profile?.rank || 'Unrated'}
                </span>
                <span className="text-xs font-mono font-extrabold text-m3-primary">
                  {myPlayer?.rr ?? profile?.rr ?? 0} RR
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                Peak: <strong className="text-zinc-200">{myPlayer?.peakRank || profile?.peak || '—'}</strong>
                {profile && (
                  <span className="ml-1.5 text-m3-mint">
                    ({profile.wins}W / {profile.games - profile.wins}L)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* WIDGET 2: Display & Stretched Tag                           */}
      {/* ============================================================ */}
      {config.showDisplay && (
        <div
          ref={displayRef}
          onPointerDown={(e) => startDrag('display', e)}
          style={{
            transform: `translate3d(${config.positions.display.x}px, ${config.positions.display.y}px, 0)`,
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 pointer-events-auto select-none will-change-transform ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-xl p-0.5'
              : ''
          }`}
        >
          <div className="rounded-xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 px-3 py-1.5 shadow-2xl flex items-center gap-2 text-xs font-mono text-white">
            <span className="w-2 h-2 rounded-full bg-m3-mint animate-pulse" />
            <span>{displayTag}</span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* WIDGET 3: Performance KPI                                   */}
      {/* ============================================================ */}
      {config.showKpi && profile && (
        <div
          ref={kpiRef}
          onPointerDown={(e) => startDrag('kpi', e)}
          style={{
            transform: `translate3d(${config.positions.kpi.x}px, ${config.positions.kpi.y}px, 0)`,
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 pointer-events-auto select-none will-change-transform ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-2xl p-0.5'
              : ''
          }`}
        >
          <div className="rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-4 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-zinc-400">Wins</span>
              <span className="text-m3-mint font-bold">{profile.wins}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-zinc-400">Matches</span>
              <span className="text-white font-bold">{profile.games}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-zinc-400">Win Rate</span>
              <span className="text-purple-300 font-bold">
                {profile.games > 0 ? `${Math.round((profile.wins / profile.games) * 100)}%` : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* WIDGET 4: Live Match Lobby Radar                            */}
      {/* ============================================================ */}
      {config.showLobby && isLive && (
        <div
          ref={lobbyRef}
          onPointerDown={(e) => startDrag('lobby', e)}
          style={{
            transform: `translate3d(${config.positions.lobby.x}px, ${config.positions.lobby.y}px, 0)`,
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 pointer-events-auto select-none w-full max-w-3xl will-change-transform ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-3xl p-1'
              : ''
          }`}
        >
          <div className="rounded-3xl bg-zinc-950/90 backdrop-blur-2xl border border-white/10 p-3 shadow-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-display font-extrabold text-white">
                  {matchState.mapName} • {matchState.mode}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-m3-primary/20 text-m3-primary text-[10px] font-mono font-bold">
                  {matchState.phase === 'coregame' ? 'LIVE' : 'AGENT SELECT'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {matchState.isDeathmatch ? (
                <>
                  <CompactSquadColumn
                    title="Deathmatch (Group 1)"
                    tagColor="text-m3-gold"
                    players={matchState.blueTeam}
                    tierIcons={tierIcons}
                  />
                  <CompactSquadColumn
                    title="Deathmatch (Group 2)"
                    tagColor="text-m3-gold"
                    players={matchState.redTeam}
                    tierIcons={tierIcons}
                  />
                </>
              ) : (
                <>
                  <CompactSquadColumn
                    title={`Attackers ${matchState.blueTeam.some((p) => p.isMe) ? '(Your Team)' : ''}`}
                    tagColor="text-m3-coral"
                    players={matchState.blueTeam}
                    tierIcons={tierIcons}
                  />
                  {matchState.phase === 'coregame' ? (
                    <CompactSquadColumn
                      title={`Defenders ${matchState.redTeam.some((p) => p.isMe) ? '(Your Team)' : ''}`}
                      tagColor="text-m3-mint"
                      players={matchState.redTeam}
                      tierIcons={tierIcons}
                    />
                  ) : (
                    <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 flex flex-col items-center justify-center text-center">
                      <LockIcon className="w-5 h-5 text-zinc-500 mb-1" />
                      <span className="text-xs font-semibold text-zinc-300">Enemy Team Hidden</span>
                      <span className="text-[10px] text-zinc-500">Visible on match start</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CompactSquadColumn: React.FC<{
  title: string;
  tagColor: string;
  players: LiveMatchPlayer[];
  tierIcons: Record<number, string>;
}> = ({ title, tagColor, players, tierIcons }) => (
  <div className="flex flex-col gap-1 rounded-2xl bg-zinc-950/60 p-2 border border-white/5 pointer-events-none select-none">
    <span className={`text-[10px] font-bold uppercase tracking-wider px-1 ${tagColor}`}>
      {title}
    </span>
    {players.map((p) => {
      const icon = tierIcons[p.tier];
      return (
        <div
          key={p.puuid}
          className={`flex items-center gap-2 px-2 py-1 rounded-xl border text-xs ${
            p.isMe ? 'bg-purple-950/40 border-purple-500/40 text-white' : 'bg-zinc-900/50 border-white/5 text-zinc-300'
          }`}
        >
          {p.agentIcon ? (
            <img
              src={p.agentIcon}
              alt=""
              draggable={false}
              className="w-6 h-6 rounded-md object-cover shrink-0 pointer-events-none select-none"
            />
          ) : (
            <div className="w-6 h-6 rounded-md bg-zinc-800 shrink-0" />
          )}

          <span className="font-semibold truncate max-w-28 text-white">
            {p.name}
          </span>
          {p.isMe && (
            <span className="px-1 py-px rounded bg-purple-500 text-[8px] font-black text-white uppercase">
              You
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {icon && (
              <img
                src={icon}
                alt=""
                draggable={false}
                className="w-5 h-5 object-contain pointer-events-none select-none"
              />
            )}
            <span className="font-mono text-[10px] font-bold text-purple-300">
              {p.rank}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);
