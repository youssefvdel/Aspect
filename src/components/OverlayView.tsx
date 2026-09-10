import React, { useEffect, useState, useRef } from 'react';
import { Lock as LockIcon } from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer, TrackerProfile } from '../types';
import { fetchLiveMatchState, gameData, detectLocalAccount, detectRegion, fetchMmrDirect } from '../utils/tracker';
import { getOverlayEditMode, setOverlayEditMode, fetchDisplayInfo, isTabDown } from '../utils/ipc';
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
  scales: {
    rank: number;
    lobby: number;
    kpi: number;
    display: number;
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
    lobby: { x: 16, y: 240 }, // Default position: left-mid
  },
  scales: {
    rank: 1.0,
    lobby: 1.0,
    kpi: 1.0,
    display: 1.0,
  },
};

function shortRank(rank?: string): string {
  if (!rank || rank === 'Unrated' || rank === '—') return 'Unr';
  return rank
    .replace('Iron ', 'I')
    .replace('Bronze ', 'B')
    .replace('Silver ', 'S')
    .replace('Gold ', 'G')
    .replace('Platinum ', 'P')
    .replace('Diamond ', 'D')
    .replace('Ascendant ', 'A')
    .replace('Immortal ', 'Imm')
    .replace('Radiant', 'Rad');
}

function getCountryDisplay(p: LiveMatchPlayer): { flag: string; label: string } {
  const code = (p.country || p.region || 'EU').toUpperCase();
  if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
    try {
      const codePoints = code
        .split('')
        .map((c) => 127397 + c.charCodeAt(0));
      const flag = String.fromCodePoint(...codePoints);
      return { flag, label: code };
    } catch {}
  }
  return { flag: '🌐', label: code.slice(0, 3) };
}

function formatKd(kd?: number | string): { text: string; color: string } {
  if (kd == null || kd === '' || kd === 0) return { text: '—', color: 'text-zinc-500' };
  const num = typeof kd === 'number' ? kd : parseFloat(kd);
  if (isNaN(num) || num <= 0) return { text: '—', color: 'text-zinc-500' };
  const text = num.toFixed(2);
  const color =
    num >= 1.2
      ? 'text-emerald-400 font-bold'
      : num >= 1.0
      ? 'text-m3-mint font-semibold'
      : 'text-rose-400 font-medium';
  return { text, color };
}

const PREVIEW_PLAYERS: LiveMatchPlayer[] = [
  {
    puuid: 'p1',
    name: 'You',
    tag: 'EUW',
    team: 'Blue',
    agentId: '',
    agentName: 'Jett',
    agentIcon: 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png',
    agentRole: 'Duelist',
    tier: 22,
    rank: 'Diamond 2',
    rr: 64,
    peakTier: 24,
    peakRank: 'Ascendant 1',
    accountLevel: 142,
    cardId: '',
    isMe: true,
    country: 'DE',
    region: 'EU',
    kd: 1.28,
  },
  {
    puuid: 'p2',
    name: 'Shadow',
    tag: '1337',
    team: 'Blue',
    agentId: '',
    agentName: 'Omen',
    agentIcon: 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png',
    agentRole: 'Controller',
    tier: 21,
    rank: 'Diamond 1',
    rr: 38,
    peakTier: 23,
    peakRank: 'Diamond 3',
    accountLevel: 89,
    cardId: '',
    isMe: false,
    country: 'EG',
    region: 'EU',
    kd: 1.05,
  },
  {
    puuid: 'p3',
    name: 'ViperX',
    tag: 'NA1',
    team: 'Blue',
    agentId: '',
    agentName: 'Viper',
    agentIcon: 'https://media.valorant-api.com/agents/707eab51-47e6-8043-86d8-d69c45b3d5b8/displayicon.png',
    agentRole: 'Controller',
    tier: 20,
    rank: 'Platinum 3',
    rr: 82,
    peakTier: 22,
    peakRank: 'Diamond 2',
    accountLevel: 210,
    cardId: '',
    isMe: false,
    country: 'FR',
    region: 'EU',
    kd: 0.94,
  },
];

export const OverlayView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [profile, setProfile] = useState<TrackerProfile | null>(null);
  const [displayTag, setDisplayTag] = useState<string>('2088×1440 @ 260Hz • 1.45:1');

  // Edit mode state (synced with main app)
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [, setActiveDragKey] = useState<string | null>(null);

  // Tab-held peek state: in-match scoreboard shows ONLY while Tab is physically held.
  // The click-through overlay never gets keyboard focus, so this is fed by the
  // OS-level GetAsyncKeyState probe — never by JS key listeners.
  const [tabHeld, setTabHeld] = useState<boolean>(false);

  // Widget config + positions (persisted)
  const [config, setConfig] = useState<OverlayConfig>(() => {
    try {
      const saved = localStorage.getItem('aspect_overlay_cfg_v4') || localStorage.getItem('aspect_overlay_cfg_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_OVERLAY_CONFIG,
          ...parsed,
          positions: { ...DEFAULT_OVERLAY_CONFIG.positions, ...(parsed.positions || {}) },
          scales: { ...DEFAULT_OVERLAY_CONFIG.scales, ...(parsed.scales || {}) },
        };
      }
    } catch {}
    return DEFAULT_OVERLAY_CONFIG;
  });

  const saveConfig = (next: OverlayConfig) => {
    setConfig(next);
    try {
      localStorage.setItem('aspect_overlay_cfg_v4', JSON.stringify(next));
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

  // Poll live match data ONLY when visible; idle backs off to ~1/3 rate
  // (agent select lasts ~60s+, so a 13s worst-case detect delay is fine).
  const phaseRef = useRef<string>('idle');
  const idleSkips = useRef(0);
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
      if (phaseRef.current === 'idle') {
        idleSkips.current = (idleSkips.current + 1) % 3;
        if (idleSkips.current !== 0) return;
      }
      fetchLiveMatchState()
        .then((s) => {
          phaseRef.current = s.phase;
          setMatchState(s);
        })
        .catch(() => {});
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

  // Tab-peek probe: polls the OS-level Tab state ONLY during a live match
  // (coregame) and only when NOT editing. One cheap IPC per 150ms, zero curl,
  // zero timers when hidden / idle / pregame / edit mode.
  useEffect(() => {
    const inCoregame = matchState?.phase === 'coregame' && !isEditMode;
    if (!inCoregame) {
      setTabHeld(false);
      return;
    }
    let cancelled = false;
    const probe = async () => {
      try {
        const down = await isTabDown();
        if (!cancelled) setTabHeld((prev) => (prev === down ? prev : down));
      } catch {}
    };
    void probe();
    const id = setInterval(probe, 150);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [matchState?.phase, isEditMode]);

  // Esc exits edit mode (overlay holds focus while editing, so the main
  // app's Lock button may be unreachable behind the fullscreen layer).
  useEffect(() => {
    if (!isEditMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void setOverlayEditMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEditMode]);

  // Smooth GPU-composited drag handler
  const startDrag = (key: keyof OverlayConfig['positions'], e: React.PointerEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveDragKey(key);

    const targetEl = widgetRefs[key].current;
    const current = config.positions[key] || { x: 16, y: 240 };

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
        const sc = config.scales?.[key] ?? 1.0;
        targetEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0) scale(${sc})`;
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

  const changeScale = (key: keyof OverlayConfig['positions'], delta: number) => {
    setConfig((prev) => {
      const cur = prev.scales?.[key] ?? 1.0;
      const nextScale = Math.max(0.6, Math.min(1.6, Number((cur + delta).toFixed(2))));
      const next = {
        ...prev,
        scales: {
          ...(prev.scales || DEFAULT_OVERLAY_CONFIG.scales),
          [key]: nextScale,
        },
      };
      saveConfig(next);
      return next;
    });
  };

  const resetScale = (key: keyof OverlayConfig['positions']) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        scales: {
          ...(prev.scales || DEFAULT_OVERLAY_CONFIG.scales),
          [key]: 1.0,
        },
      };
      saveConfig(next);
      return next;
    });
  };

  const startResize = (key: keyof OverlayConfig['positions'], e: React.PointerEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();

    const targetEl = widgetRefs[key].current;
    const initialScale = config.scales?.[key] ?? 1.0;
    const startX = e.clientX;
    const startY = e.clientY;
    let currentScale = initialScale;

    const onPointerMove = (moveEv: PointerEvent) => {
      moveEv.preventDefault();
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;
      const delta = (dx + dy) / 350;
      const nextScale = Math.max(0.6, Math.min(1.6, Number((initialScale + delta).toFixed(2))));
      currentScale = nextScale;

      if (targetEl) {
        const pos = config.positions[key] || { x: 16, y: 240 };
        targetEl.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${nextScale})`;
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      upEv.preventDefault();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      setConfig((prev) => {
        const next = {
          ...prev,
          scales: {
            ...(prev.scales || DEFAULT_OVERLAY_CONFIG.scales),
            [key]: currentScale,
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
  // Phase-split visibility: agent select shows team panels outright;
  // in-match scoreboard renders ONLY while Tab is physically held.
  const isPregame = matchState?.phase === 'pregame';
  const isCoregame = matchState?.phase === 'coregame';
  const showMatchPanel = isEditMode || isPregame || (isCoregame && tabHeld);
  const myPlayer = matchState
    ? [...matchState.blueTeam, ...matchState.redTeam].find((p) => p.isMe)
    : null;

  return (
    <div
      onDragStart={(e) => e.preventDefault()}
      className="fixed inset-0 w-screen h-screen select-none overflow-hidden font-sans pointer-events-none"
      style={{ backgroundColor: 'transparent' }}
    >
      {/* ZERO top bars. ZERO bottom footers. ZERO perimeter rings. Only widgets. */}

      {/* Edit-mode self-exit: the fullscreen edit layer sits above the Aspect
          app, so the Lock control lives here too (plus Esc). The main app
          stays in sync via the overlay-edit-mode-changed event. */}
      {isEditMode && (
        <button
          type="button"
          onClick={() => void setOverlayEditMode(false)}
          className="fixed top-4 right-4 z-50 pointer-events-auto px-4 py-2 rounded-2xl bg-m3-mint text-zinc-950 text-xs font-black shadow-2xl border border-white/20 cursor-pointer hover:brightness-110"
        >
          ✓ Lock HUD (Esc)
        </button>
      )}

      {/* ============================================================ */}
      {/* WIDGET 1: Player Rank & RR                                  */}
      {/* ============================================================ */}
      {config.showRank && (
        <div
          ref={rankRef}
          onPointerDown={(e) => startDrag('rank', e)}
          style={{
            transform: `translate3d(${config.positions.rank.x}px, ${config.positions.rank.y}px, 0) scale(${config.scales?.rank ?? 1.0})`,
            transformOrigin: 'top left',
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 pointer-events-auto select-none will-change-transform ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-2xl p-0.5'
              : ''
          }`}
        >
          {isEditMode && (
            <>
              <div className="absolute -top-7 right-0 flex items-center gap-1 bg-zinc-900/90 border border-white/10 rounded-lg px-1.5 py-0.5 shadow-md z-10">
                <span className="text-[9px] font-mono text-zinc-300">
                  {Math.round((config.scales?.rank ?? 1.0) * 100)}%
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    changeScale('rank', -0.1);
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                  title="Decrease size"
                >
                  -
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    changeScale('rank', 0.1);
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                  title="Increase size"
                >
                  +
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    resetScale('rank');
                  }}
                  className="text-[9px] font-mono text-zinc-400 hover:text-white px-1"
                  title="Reset size to 100%"
                >
                  100%
                </button>
              </div>
              <div
                onPointerDown={(e) => startResize('rank', e)}
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-br-xl bg-m3-primary/90 hover:bg-m3-primary cursor-nwse-resize flex items-center justify-center text-[10px] text-zinc-950 font-bold select-none shadow-sm z-10"
                title="Drag to resize widget"
              >
                ↘
              </div>
            </>
          )}
          <div className="rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-3">
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
            transform: `translate3d(${config.positions.display.x}px, ${config.positions.display.y}px, 0) scale(${config.scales?.display ?? 1.0})`,
            transformOrigin: 'top left',
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 pointer-events-auto select-none will-change-transform ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-xl p-0.5'
              : ''
          }`}
        >
          {isEditMode && (
            <div
              onPointerDown={(e) => startResize('display', e)}
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-br-lg bg-m3-primary/90 hover:bg-m3-primary cursor-nwse-resize flex items-center justify-center text-[9px] text-zinc-950 font-bold select-none shadow-sm z-10"
              title="Drag to resize widget"
            >
              ↘
            </div>
          )}
          <div className="rounded-xl bg-black/35 backdrop-blur-md border border-white/10 px-3 py-1.5 shadow-2xl flex items-center gap-2 text-xs font-mono text-white">
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
            transform: `translate3d(${config.positions.kpi.x}px, ${config.positions.kpi.y}px, 0) scale(${config.scales?.kpi ?? 1.0})`,
            transformOrigin: 'top left',
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 pointer-events-auto select-none will-change-transform ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-2xl p-0.5'
              : ''
          }`}
        >
          {isEditMode && (
            <div
              onPointerDown={(e) => startResize('kpi', e)}
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-br-xl bg-m3-primary/90 hover:bg-m3-primary cursor-nwse-resize flex items-center justify-center text-[10px] text-zinc-950 font-bold select-none shadow-sm z-10"
              title="Drag to resize widget"
            >
              ↘
            </div>
          )}
          <div className="rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-4 text-xs font-mono">
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
      {/* WIDGET 4: Match Panel — agent select always on, in-match Tab-peek only */}
      {/* ============================================================ */}
      {config.showLobby && showMatchPanel && (
        <div
          ref={lobbyRef}
          onPointerDown={(e) => startDrag('lobby', e)}
          style={{
            transform: `translate3d(${config.positions.lobby.x}px, ${config.positions.lobby.y}px, 0) scale(${config.scales?.lobby ?? 1.0})`,
            transformOrigin: 'top left',
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 pointer-events-auto select-none w-[325px] will-change-transform ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-2xl p-1'
              : ''
          }`}
        >
          {isEditMode && (
            <>
              <div className="absolute -top-7 right-0 flex items-center gap-1 bg-zinc-900/90 border border-white/10 rounded-lg px-1.5 py-0.5 shadow-md z-10">
                <span className="text-[9px] font-mono text-zinc-300">
                  {Math.round((config.scales?.lobby ?? 1.0) * 100)}%
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    changeScale('lobby', -0.1);
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                  title="Decrease size"
                >
                  -
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    changeScale('lobby', 0.1);
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                  title="Increase size"
                >
                  +
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    resetScale('lobby');
                  }}
                  className="text-[9px] font-mono text-zinc-400 hover:text-white px-1"
                  title="Reset size to 100%"
                >
                  100%
                </button>
              </div>
              <div
                onPointerDown={(e) => startResize('lobby', e)}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-br-2xl bg-m3-primary/90 hover:bg-m3-primary cursor-nwse-resize flex items-center justify-center text-[11px] text-zinc-950 font-black select-none shadow-md z-10"
                title="Drag to resize HUD widget"
              >
                ↘
              </div>
            </>
          )}
          <div className="rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 p-2.5 shadow-2xl flex flex-col gap-2">
            {/* Header: Map • Mode • Phase */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-display font-black text-white truncate">
                  {matchState?.mapName || 'Live Match Status'}
                </span>
                {matchState?.mode && (
                  <span className="text-[10px] font-mono text-zinc-400 truncate">
                    • {matchState.mode}
                  </span>
                )}
              </div>
              <span className="px-1.5 py-0.5 rounded bg-m3-primary/20 text-m3-primary text-[9px] font-mono font-extrabold uppercase shrink-0">
                {matchState?.phase === 'coregame' ? 'LIVE' : matchState?.phase === 'pregame' ? 'SELECT' : 'PREVIEW'}
              </span>
            </div>

            {/* Column Titles */}
            <div className="flex items-center gap-2 px-2 text-[9px] font-mono text-zinc-400 uppercase tracking-wider border-b border-white/5 pb-1">
              <span className="flex-1">Player</span>
              <span className="shrink-0 w-10 text-center">From</span>
              <span className="shrink-0 w-10 text-left">Rank</span>
              <span className="shrink-0 w-10 text-left">Peak</span>
              <span className="shrink-0 w-8 text-right">KD</span>
            </div>

            {/* Vertical Compact Teams / Player Stack */}
            <div className="flex flex-col gap-2">
              {!isLive && isEditMode ? (
                /* Edit Mode Sample Preview */
                <VerticalSquadColumn
                  title="Team Preview"
                  tagColor="text-m3-primary"
                  players={PREVIEW_PLAYERS}
                  tierIcons={tierIcons}
                />
              ) : matchState?.isDeathmatch ? (
                /* FFA / Deathmatch */
                <>
                  <VerticalSquadColumn
                    title="Deathmatch"
                    tagColor="text-m3-gold"
                    players={matchState.blueTeam}
                    tierIcons={tierIcons}
                  />
                  {matchState.redTeam.length > 0 && (
                    <VerticalSquadColumn
                      title="Group 2"
                      tagColor="text-m3-gold"
                      players={matchState.redTeam}
                      tierIcons={tierIcons}
                    />
                  )}
                </>
              ) : (
                /* Standard Competitive / 5v5 Stack */
                <>
                  <VerticalSquadColumn
                    title={`Attackers ${matchState?.blueTeam.some((p) => p.isMe) ? '(Your Team)' : ''}`}
                    tagColor="text-m3-coral"
                    players={matchState?.blueTeam || []}
                    tierIcons={tierIcons}
                  />
                  {matchState?.phase === 'coregame' || matchState?.phase === 'pregame' ? (
                    <VerticalSquadColumn
                      title={`Defenders ${matchState.redTeam.some((p) => p.isMe) ? '(Your Team)' : ''}`}
                      tagColor="text-m3-mint"
                      players={matchState.redTeam}
                      tierIcons={tierIcons}
                    />
                  ) : (
                    <div className="rounded-xl bg-black/20 border border-white/5 p-2 flex items-center justify-center gap-2 text-center">
                      <LockIcon className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="text-[10px] font-semibold text-zinc-300">Enemy Team Hidden</span>
                      <span className="text-[9px] text-zinc-500">• Visible on match start</span>
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

const VerticalSquadColumn: React.FC<{
  title: string;
  tagColor: string;
  players: LiveMatchPlayer[];
  tierIcons: Record<number, string>;
}> = ({ title, tagColor, players, tierIcons }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between px-1.5 py-0.5">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${tagColor}`}>{title}</span>
      <span className="text-[9px] font-mono text-zinc-400">{players.length}P</span>
    </div>
    {players.map((p) => {
      const icon = tierIcons[p.tier];
      const peakIcon = tierIcons[p.peakTier];
      const country = getCountryDisplay(p);
      const kd = formatKd(p.kd);

      return (
        <div
          key={p.puuid}
          className={`flex items-center gap-2 px-2 py-1 rounded-xl border text-xs transition-colors ${
            p.isMe
              ? 'bg-purple-950/30 border-purple-500/40 text-white shadow-xs'
              : 'bg-black/25 hover:bg-black/40 border-white/5 text-zinc-200'
          }`}
        >
          {/* Agent Icon */}
          {p.agentIcon ? (
            <img
              src={p.agentIcon}
              alt=""
              draggable={false}
              className="w-5 h-5 rounded-md object-cover shrink-0 pointer-events-none select-none border border-white/10"
            />
          ) : (
            <div className="w-5 h-5 rounded-md bg-zinc-800 shrink-0 border border-white/10 flex items-center justify-center text-[9px] font-bold text-zinc-400">
              ?
            </div>
          )}

          {/* Player Name */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="font-semibold truncate text-white text-[11px]" title={`${p.name}${p.tag ? '#' + p.tag : ''}`}>
              {p.name}
            </span>
            {p.isMe && (
              <span className="px-1 py-px rounded bg-purple-500 text-[8px] font-black text-white uppercase shrink-0">
                You
              </span>
            )}
          </div>

          {/* Where is he from (Flag + Code) */}
          <div className="flex items-center gap-1 shrink-0 px-1 py-0.5 rounded bg-white/5 border border-white/5" title={`Region: ${p.region || 'EU'}`}>
            <span className="text-xs leading-none select-none">{country.flag}</span>
            <span className="font-mono text-[9px] font-bold text-zinc-300">{country.label}</span>
          </div>

          {/* Current Rank */}
          <div className="flex items-center gap-1 shrink-0 w-10 justify-start" title={`Rank: ${p.rank} (${p.rr} RR)`}>
            {icon ? (
              <img src={icon} alt="" draggable={false} className="w-3.5 h-3.5 object-contain shrink-0" />
            ) : null}
            <span className="font-mono text-[10px] font-bold text-purple-300">{shortRank(p.rank)}</span>
          </div>

          {/* Peak Rank */}
          <div className="flex items-center gap-1 shrink-0 w-10 justify-start" title={`Peak: ${p.peakRank}`}>
            {peakIcon ? (
              <img src={peakIcon} alt="" draggable={false} className="w-3.5 h-3.5 object-contain opacity-75 shrink-0" />
            ) : null}
            <span className="font-mono text-[10px] text-zinc-400">{shortRank(p.peakRank)}</span>
          </div>

          {/* KD */}
          <div className="shrink-0 w-8 text-right font-mono text-[10px]" title="K/D Ratio">
            <span className={kd.color}>{kd.text}</span>
          </div>
        </div>
      );
    })}
  </div>
);
