import React, { useEffect, useState, useRef } from 'react';
import {
  EyeOff,
  Lock,
  Check,
  Sliders,
  Move,
  Trophy,
  Users,
  BarChart2,
  Tv,
  RotateCcw,
} from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer, TrackerProfile } from '../types';
import { fetchLiveMatchState, gameData, detectLocalAccount, detectRegion, fetchMmrDirect } from '../utils/tracker';
import { hideOverlay, setOverlayEditMode, getOverlayEditMode, fetchDisplayInfo } from '../utils/ipc';
import { listen } from '@tauri-apps/api/event';

interface WidgetPos {
  x: number;
  y: number;
}

interface OverlayConfig {
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

const DEFAULT_CONFIG: OverlayConfig = {
  showRank: true,
  showLobby: true,
  showKpi: false,
  showDisplay: false,
  positions: {
    rank: { x: 24, y: 24 },
    display: { x: 300, y: 24 },
    kpi: { x: 24, y: 220 },
    lobby: { x: 120, y: 90 },
  },
};

export const OverlayView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [profile, setProfile] = useState<TrackerProfile | null>(null);
  const [displayTag, setDisplayTag] = useState<string>('2088×1440 @ 260Hz • 1.45:1');

  // Edit mode state (syncs with backend and main window)
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Widget config + positions (persisted)
  const [config, setConfig] = useState<OverlayConfig>(() => {
    try {
      const saved = localStorage.getItem('aspect_overlay_cfg_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          positions: { ...DEFAULT_CONFIG.positions, ...(parsed.positions || {}) },
        };
      }
    } catch {}
    return DEFAULT_CONFIG;
  });

  const saveConfig = (next: OverlayConfig) => {
    setConfig(next);
    try {
      localStorage.setItem('aspect_overlay_cfg_v2', JSON.stringify(next));
    } catch {}
  };

  // Sync edit mode from backend / events
  useEffect(() => {
    getOverlayEditMode().then((m) => setIsEditMode(m)).catch(() => {});
    const unlisten = listen<boolean>('overlay-edit-mode-changed', (event) => {
      setIsEditMode(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
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

  // Dragging mechanics: direct, lag-free pointer drag
  const draggingRef = useRef<{
    key: keyof OverlayConfig['positions'];
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>(null);

  const startDrag = (key: keyof OverlayConfig['positions'], e: React.PointerEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    const current = config.positions[key] || { x: 24, y: 24 };
    draggingRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      initX: current.x,
      initY: current.y,
    };

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = moveEv.clientX - draggingRef.current.startX;
      const dy = moveEv.clientY - draggingRef.current.startY;
      const newX = Math.max(4, Math.min(window.innerWidth - 60, draggingRef.current.initX + dx));
      const newY = Math.max(4, Math.min(window.innerHeight - 60, draggingRef.current.initY + dy));

      setConfig((prev) => ({
        ...prev,
        positions: {
          ...prev.positions,
          [draggingRef.current!.key]: { x: Math.round(newX), y: Math.round(newY) },
        },
      }));
    };

    const onPointerUp = () => {
      draggingRef.current = null;
      try {
        const latest = localStorage.getItem('aspect_overlay_cfg_v2');
        void latest;
      } catch {}
      setConfig((latest) => {
        try {
          localStorage.setItem('aspect_overlay_cfg_v2', JSON.stringify(latest));
        } catch {}
        return latest;
      });
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove as unknown as EventListener);
      window.removeEventListener('mouseup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('mousemove', onPointerMove as unknown as EventListener);
    window.addEventListener('mouseup', onPointerUp);
  };

  const handleExitEditMode = async () => {
    setIsEditMode(false);
    await setOverlayEditMode(false);
  };

  const isLive = matchState && matchState.phase !== 'idle';
  const myPlayer = matchState
    ? [...matchState.blueTeam, ...matchState.redTeam].find((p) => p.isMe)
    : null;

  return (
    <div
      className={`fixed inset-0 w-screen h-screen select-none overflow-hidden font-sans transition-colors ${
        isEditMode
          ? 'bg-black/45 pointer-events-auto ring-4 ring-m3-primary/40 ring-inset'
          : 'bg-transparent pointer-events-none'
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-5xl px-4 z-50 pointer-events-auto">
        {isEditMode ? (
          /* Edit Mode Floating Bar */
          <div className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-m3-primary/60 shadow-2xl flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-primary text-m3-on-primary text-xs font-bold uppercase tracking-wider shadow-sm">
                <Sliders className="w-3.5 h-3.5" />
                <span>HUD Edit Mode</span>
              </span>
              <span className="text-xs text-zinc-300 font-medium hidden md:inline">
                Drag any widget by its header to position it on your screen.
              </span>
            </div>

            {/* Widget Toggles */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => saveConfig({ ...config, showRank: !config.showRank })}
                className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  config.showRank
                    ? 'bg-m3-primary/25 border-m3-primary text-m3-primary'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Rank & RR</span>
              </button>

              <button
                type="button"
                onClick={() => saveConfig({ ...config, showLobby: !config.showLobby })}
                className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  config.showLobby
                    ? 'bg-m3-primary/25 border-m3-primary text-m3-primary'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Lobby Roster</span>
              </button>

              <button
                type="button"
                onClick={() => saveConfig({ ...config, showKpi: !config.showKpi })}
                className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  config.showKpi
                    ? 'bg-m3-primary/25 border-m3-primary text-m3-primary'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Stats</span>
              </button>

              <button
                type="button"
                onClick={() => saveConfig({ ...config, showDisplay: !config.showDisplay })}
                className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  config.showDisplay
                    ? 'bg-m3-primary/25 border-m3-primary text-m3-primary'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Res Tag</span>
              </button>

              <button
                type="button"
                onClick={() => saveConfig(DEFAULT_CONFIG)}
                className="w-7 h-7 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 flex items-center justify-center cursor-pointer"
                title="Reset Default Positions"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Lock / Play Mode Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExitEditMode}
                className="h-7 px-3.5 rounded-xl bg-m3-mint text-zinc-950 text-xs font-black flex items-center gap-1.5 cursor-pointer hover:bg-m3-mint/90 shadow-md transition-transform active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lock & Play</span>
              </button>

              <button
                type="button"
                onClick={() => hideOverlay()}
                className="w-7 h-7 rounded-xl bg-zinc-900 hover:bg-red-500 text-white flex items-center justify-center cursor-pointer"
                title="Close Overlay"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ============================================================ */}
      {/* WIDGET 1: Player Rank & RR                                  */}
      {/* ============================================================ */}
      {config.showRank && (
        <div
          style={{
            left: `${config.positions.rank.x}px`,
            top: `${config.positions.rank.y}px`,
            position: 'absolute',
          }}
          className={`pointer-events-auto select-none touch-none ${
            isEditMode ? 'ring-2 ring-m3-primary/70 ring-dashed p-1 rounded-3xl bg-black/40' : ''
          }`}
        >
          {isEditMode && (
            <div
              onPointerDown={(e) => startDrag('rank', e)}
              className="flex items-center justify-between px-2 py-1 bg-m3-primary/30 rounded-t-2xl cursor-move text-[10px] font-bold text-m3-primary"
            >
              <span className="flex items-center gap-1">
                <Move className="w-3 h-3" /> Drag Rank
              </span>
            </div>
          )}
          <div
            onPointerDown={(e) => isEditMode && startDrag('rank', e)}
            onMouseDown={(e) => isEditMode && startDrag('rank', e as unknown as React.PointerEvent)}
            style={{ touchAction: 'none' }}
            className={`rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-3 ${
              isEditMode ? 'cursor-move' : ''
            }`}
          >
            {tierIcons[myPlayer?.tier ?? profile?.tier ?? 0] ? (
              <img
                src={tierIcons[myPlayer?.tier ?? profile?.tier ?? 0]}
                alt=""
                className="w-10 h-10 object-contain shrink-0 drop-shadow-md"
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
          style={{
            left: `${config.positions.display.x}px`,
            top: `${config.positions.display.y}px`,
            position: 'absolute',
          }}
          className={`pointer-events-auto select-none touch-none ${
            isEditMode ? 'ring-2 ring-m3-primary/70 ring-dashed p-1 rounded-2xl bg-black/40' : ''
          }`}
        >
          {isEditMode && (
            <div
              onPointerDown={(e) => startDrag('display', e)}
              className="flex items-center justify-between px-2 py-0.5 bg-m3-primary/30 rounded-t-xl cursor-move text-[9px] font-bold text-m3-primary"
            >
              <span className="flex items-center gap-1">
                <Move className="w-2.5 h-2.5" /> Drag Res
              </span>
            </div>
          )}
          <div
            onPointerDown={(e) => isEditMode && startDrag('display', e)}
            onMouseDown={(e) => isEditMode && startDrag('display', e as unknown as React.PointerEvent)}
            style={{ touchAction: 'none' }}
            className={`rounded-xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 px-3 py-1.5 shadow-2xl flex items-center gap-2 text-xs font-mono text-white ${
              isEditMode ? 'cursor-move' : ''
            }`}
          >
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
          style={{
            left: `${config.positions.kpi.x}px`,
            top: `${config.positions.kpi.y}px`,
            position: 'absolute',
          }}
          className={`pointer-events-auto select-none touch-none ${
            isEditMode ? 'ring-2 ring-m3-primary/70 ring-dashed p-1 rounded-3xl bg-black/40' : ''
          }`}
        >
          {isEditMode && (
            <div
              onPointerDown={(e) => startDrag('kpi', e)}
              className="flex items-center justify-between px-2 py-0.5 bg-m3-primary/30 rounded-t-xl cursor-move text-[9px] font-bold text-m3-primary"
            >
              <span className="flex items-center gap-1">
                <Move className="w-2.5 h-2.5" /> Drag Stats
              </span>
            </div>
          )}
          <div
            onPointerDown={(e) => isEditMode && startDrag('kpi', e)}
            onMouseDown={(e) => isEditMode && startDrag('kpi', e as unknown as React.PointerEvent)}
            style={{ touchAction: 'none' }}
            className={`rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-4 text-xs font-mono ${
              isEditMode ? 'cursor-move' : ''
            }`}
          >
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
          style={{
            left: `${config.positions.lobby.x}px`,
            top: `${config.positions.lobby.y}px`,
            position: 'absolute',
          }}
          className={`pointer-events-auto select-none touch-none w-full max-w-3xl ${
            isEditMode ? 'ring-2 ring-m3-primary/70 ring-dashed p-1 rounded-3xl bg-black/40' : ''
          }`}
        >
          {isEditMode && (
            <div
              onPointerDown={(e) => startDrag('lobby', e)}
              className="flex items-center justify-between px-3 py-1 bg-m3-primary/30 rounded-t-2xl cursor-move text-[10px] font-bold text-m3-primary"
            >
              <span className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5" /> Drag Lobby Radar
              </span>
              <span className="text-xs font-mono">{matchState.mapName}</span>
            </div>
          )}
          <div
            onPointerDown={(e) => isEditMode && startDrag('lobby', e)}
            onMouseDown={(e) => isEditMode && startDrag('lobby', e as unknown as React.PointerEvent)}
            style={{ touchAction: 'none' }}
            className={`rounded-3xl bg-zinc-950/90 backdrop-blur-2xl border border-white/10 p-3 shadow-2xl flex flex-col gap-2 ${isEditMode ? 'cursor-move' : ''}`}>
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
                      <Lock className="w-5 h-5 text-zinc-500 mb-1" />
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
  <div className="flex flex-col gap-1 rounded-2xl bg-zinc-950/60 p-2 border border-white/5">
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
            <img src={p.agentIcon} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />
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
            {icon && <img src={icon} alt="" className="w-5 h-5 object-contain" />}
            <span className="font-mono text-[10px] font-bold text-purple-300">
              {p.rank}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);
