import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Lock as LockIcon, Check, Users, Shield, RotateCcw, Move, X, Plus } from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer } from '../types';
import { fetchLiveMatchState, gameData } from '../utils/tracker';
import { getOverlayEditMode, setOverlayEditMode, isTabDown } from '../utils/ipc';
import { listen } from '@tauri-apps/api/event';

export interface WidgetPos {
  x: number;
  y: number;
}

export interface OverlayConfig {
  showLobby: boolean;
  showPregame: boolean;
  positions: {
    lobby: WidgetPos;
    pregame: WidgetPos;
  };
  scales: {
    lobby: number;
    pregame: number;
  };
}

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  showLobby: true,
  showPregame: true,
  positions: {
    lobby: { x: 16, y: 220 },
    pregame: {
      x: typeof window !== 'undefined' ? Math.max(0, Math.round(window.innerWidth / 2 - 360)) : 500,
      y: 90,
    },
  },
  scales: {
    lobby: 1.0,
    pregame: 1.0,
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
    agentIcon: 'https://media.valorant-api.com/agents/707eab51-4836-f488-046a-cda6bf494859/displayicon.png',
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

const PREVIEW_OPPONENTS: LiveMatchPlayer[] = [
  {
    puuid: 'r1',
    name: 'ReynaMain',
    tag: 'EUW',
    team: 'Red',
    agentId: '',
    agentName: 'Reyna',
    agentIcon: '',
    agentRole: 'Duelist',
    tier: 23,
    rank: 'Diamond 3',
    rr: 51,
    peakTier: 25,
    peakRank: 'Ascendant 2',
    accountLevel: 167,
    cardId: '',
    isMe: false,
    selectionState: 'locked',
    country: 'ES',
    region: 'EU',
    kd: 1.42,
  },
  {
    puuid: 'r2',
    name: 'Silent',
    tag: '007',
    team: 'Red',
    agentId: '',
    agentName: 'Selecting…',
    agentIcon: '',
    agentRole: '',
    tier: 20,
    rank: 'Platinum 3',
    rr: 12,
    peakTier: 21,
    peakRank: 'Diamond 1',
    accountLevel: 74,
    cardId: '',
    isMe: false,
    selectionState: '',
    country: 'IT',
    region: 'EU',
    kd: 0.98,
  },
  {
    puuid: 'r3',
    name: 'Headshot',
    tag: 'HS',
    team: 'Red',
    agentId: '',
    agentName: 'Cypher',
    agentIcon: '',
    agentRole: 'Sentinel',
    tier: 22,
    rank: 'Diamond 2',
    rr: 77,
    peakTier: 24,
    peakRank: 'Ascendant 1',
    accountLevel: 198,
    cardId: '',
    isMe: false,
    selectionState: 'selected',
    country: 'TR',
    region: 'EU',
    kd: 1.15,
  },
];

export const OverlayView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});

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
  const rootRef = useRef<HTMLDivElement>(null);
  const lobbyRef = useRef<HTMLDivElement>(null);
  const pregameRef = useRef<HTMLDivElement>(null);

  const widgetRefs = {
    lobby: lobbyRef,
    pregame: pregameRef,
  };

  // Native DWM message handling strips non-client borders natively.
  const forceRepaint = useCallback(() => {}, []);

  // Sync edit mode and config changes from main app
  useEffect(() => {
    getOverlayEditMode().then(setIsEditMode).catch(() => {});
    // Fresh mounts (HMR reload, navigation, first show) start from a blank
    // surface with nothing dirtying transparent regions — repaint now and
    // once more after first paint settles, or stale white survives.
    forceRepaint();
    const mountRepaint = setTimeout(forceRepaint, 600);
    const unlistenEdit = listen<boolean>('overlay-edit-mode-changed', (event) => {
      setIsEditMode(event.payload);
      forceRepaint();
    });
    const unlistenCfg = listen<OverlayConfig>('overlay-config-changed', (event) => {
      setConfig(event.payload);
    });
    // Resolution switches realloc DWM surfaces — repaint once it settles.
    const unlistenDisp = listen<unknown>('display-mode-changed', () => {
      setTimeout(forceRepaint, 350);
    });
    return () => {
      clearTimeout(mountRepaint);
      unlistenEdit.then((fn) => fn()).catch(() => {});
      unlistenCfg.then((fn) => fn()).catch(() => {});
      unlistenDisp.then((fn) => fn()).catch(() => {});
    };
  }, [forceRepaint]);

  // Poll live match data ONLY when visible; idle backs off to ~1/3 rate
  // (agent select lasts ~60s+, so a 13s worst-case detect delay is fine).
  const phaseRef = useRef<string>('idle');
  const idleSkips = useRef(0);
  useEffect(() => {
    gameData().then((d) => setTierIcons(d.tierIcons)).catch(() => {});

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

  // Smooth GPU-composited drag handler with pointer capture
  const startDrag = (
    key: keyof OverlayConfig['positions'],
    e: React.PointerEvent,
    overrideStartPos?: WidgetPos
  ) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveDragKey(key);

    const dragTarget = e.currentTarget as HTMLElement;
    try {
      dragTarget.setPointerCapture(e.pointerId);
    } catch {}

    const targetEl = widgetRefs[key].current;
    const basePos = overrideStartPos || config.positions[key] || { x: 16, y: 200 };

    let curX = basePos.x;
    let curY = basePos.y;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const onPointerMove = (moveEv: PointerEvent) => {
      moveEv.preventDefault();
      const dx = moveEv.clientX - startClientX;
      const dy = moveEv.clientY - startClientY;

      // Clamp strictly within screen bounds
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 2088;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 1440;
      const clampedX = Math.max(0, Math.min(screenW - 120, basePos.x + dx));
      const clampedY = Math.max(0, Math.min(screenH - 80, basePos.y + dy));

      curX = clampedX;
      curY = clampedY;

      if (targetEl) {
        const sc = config.scales?.[key] ?? 1.0;
        targetEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0) scale(${sc})`;
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      upEv.preventDefault();
      try {
        dragTarget.releasePointerCapture(upEv.pointerId);
      } catch {}
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
  // Phase-split visibility: agent select gets its own big centered panel;
  // the in-match scoreboard renders ONLY while Tab is physically held.
  const isPregame = matchState?.phase === 'pregame';
  const isCoregame = matchState?.phase === 'coregame';
  const showScorePanel = isEditMode || (isCoregame && tabHeld);
  const showPregamePanel = isEditMode || isPregame;
  // Scoreboard mounts/unmounts on every Tab press and panels flip on phase
  // changes — repaint after each transition so DWM never keeps a stale
  // white region from the mount/unmount repaint storm.
  const scoreVisible = config.showLobby && showScorePanel;
  const pregameVisible = config.showPregame && showPregamePanel;
  useEffect(() => {
    const t = setTimeout(forceRepaint, 80);
    return () => clearTimeout(t);
  }, [scoreVisible, pregameVisible, forceRepaint]);

  return (
    <div
      ref={rootRef}
      onDragStart={(e) => e.preventDefault()}
      className="fixed inset-0 w-screen h-screen select-none overflow-hidden font-sans pointer-events-none"
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Edit Mode Full-Screen Dark Dimmer Backdrop: darkens the screen for focused editing */}
      {isEditMode && (
        <div
          className="fixed inset-0 pointer-events-auto bg-black/75 transition-opacity duration-200 z-0"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
        />
      )}

      {/* ZERO top bars. ZERO bottom footers. ZERO perimeter rings. Pure in-game transparency. */}

      {/* ============================================================ */}
      {/* CUSTOM EDIT MODE WIDGET DOCK (Visual Miniature Cards)        */}
      {/* ============================================================ */}
      {isEditMode && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[96vw] z-50 pointer-events-auto flex flex-col gap-2 p-3 rounded-3xl bg-[#140e1b] border border-white/20 shadow-2xl">
          {/* Header row */}
          <div className="flex items-center justify-between px-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-m3-mint animate-pulse shadow-[0_0_8px_rgba(58,227,116,0.8)]" />
              <span className="font-display font-black text-xs text-white tracking-wider uppercase">
                HUD Widgets • Click to Add to Screen
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveConfig(DEFAULT_OVERLAY_CONFIG)}
                className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset layout to defaults"
              >
                <RotateCcw className="w-3 h-3 text-zinc-400" />
                <span>Reset Layout</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await setOverlayEditMode(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-m3-mint text-zinc-950 text-xs font-extrabold shadow-md border border-white/20 hover:brightness-110 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Lock HUD (Esc)</span>
              </button>
            </div>
          </div>

          {/* Visual Miniature Widget Cards Row */}
          <div className="flex items-stretch gap-3 pt-1">
            {/* 1. AGENT SELECT MINI PREVIEW CARD */}
            <div
              className={`flex flex-col gap-2 p-3 rounded-2xl border select-none transition-all w-56 ${
                config.showPregame
                  ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/50'
                  : 'bg-zinc-900/60 border-white/10 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-m3-primary" />
                  <span>Agent Select</span>
                </span>
                <span
                  className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full ${
                    config.showPregame ? 'bg-m3-mint/20 text-m3-mint border border-m3-mint/30' : 'bg-white/10 text-zinc-400 border border-white/10'
                  }`}
                >
                  {config.showPregame ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Mini visual mockup of 5v5 Agent Select */}
              <div className="rounded-xl bg-black/40 border border-white/5 p-1.5 flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center justify-between text-[8px] font-mono">
                  <span className="text-red-400 font-bold">5 Attackers</span>
                  <span className="text-teal-300 font-bold">5 Defenders</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-0.5">
                    <span className="w-3 h-3 rounded-xs bg-red-500/60" />
                    <span className="w-3 h-3 rounded-xs bg-red-500/60" />
                    <span className="w-3 h-3 rounded-xs bg-red-500/60" />
                  </div>
                  <span className="text-[8px] font-mono text-zinc-500">VS</span>
                  <div className="flex gap-0.5">
                    <span className="w-3 h-3 rounded-xs bg-teal-400/60" />
                    <span className="w-3 h-3 rounded-xs bg-teal-400/60" />
                    <span className="w-3 h-3 rounded-xs bg-teal-400/60" />
                  </div>
                </div>
              </div>

              {/* Add to Default Place Button */}
              <button
                type="button"
                onClick={() => {
                  if (config.showPregame) {
                    saveConfig({ ...config, showPregame: false });
                  } else {
                    saveConfig({
                      ...config,
                      showPregame: true,
                      positions: {
                        ...config.positions,
                        pregame: DEFAULT_OVERLAY_CONFIG.positions.pregame,
                      },
                    });
                  }
                }}
                className={`mt-auto px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  config.showPregame
                    ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300'
                    : 'bg-m3-primary/20 hover:bg-m3-primary/30 border border-m3-primary/40 text-m3-primary font-bold'
                }`}
              >
                {config.showPregame ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Remove from Screen</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Default Place</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. MATCH STATUS (SCOREBOARD) MINI PREVIEW CARD */}
            <div
              className={`flex flex-col gap-2 p-3 rounded-2xl border select-none transition-all w-52 ${
                config.showLobby
                  ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/50'
                  : 'bg-zinc-900/60 border-white/10 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-m3-gold" />
                  <span>Match Status</span>
                </span>
                <span
                  className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full ${
                    config.showLobby ? 'bg-m3-mint/20 text-m3-mint border border-m3-mint/30' : 'bg-white/10 text-zinc-400 border border-white/10'
                  }`}
                >
                  {config.showLobby ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Mini visual mockup of vertical scoreboard */}
              <div className="rounded-xl bg-black/40 border border-white/5 p-1.5 flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-zinc-700" />
                  <span className="h-1.5 w-10 rounded-full bg-zinc-600" />
                  <span className="ml-auto text-[7px] font-mono text-purple-300 font-bold">D2</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-zinc-700" />
                  <span className="h-1.5 w-12 rounded-full bg-zinc-600" />
                  <span className="ml-auto text-[7px] font-mono text-purple-300 font-bold">A1</span>
                </div>
              </div>

              {/* Add to Default Place Button */}
              <button
                type="button"
                onClick={() => {
                  if (config.showLobby) {
                    saveConfig({ ...config, showLobby: false });
                  } else {
                    saveConfig({
                      ...config,
                      showLobby: true,
                      positions: {
                        ...config.positions,
                        lobby: DEFAULT_OVERLAY_CONFIG.positions.lobby,
                      },
                    });
                  }
                }}
                className={`mt-auto px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  config.showLobby
                    ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300'
                    : 'bg-m3-gold/20 hover:bg-m3-gold/30 border border-m3-gold/40 text-m3-gold font-bold'
                }`}
              >
                {config.showLobby ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Remove from Screen</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Default Place</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* WIDGET: Match Panel — agent select always on, in-match Tab-peek only */}
      {/* ============================================================ */}
      {config.showLobby && showScorePanel && (
        <div
          ref={lobbyRef}
          onPointerDown={(e) => startDrag('lobby', e)}
          style={{
            transform: `translate3d(${config.positions.lobby.x}px, ${config.positions.lobby.y}px, 0) scale(${config.scales?.lobby ?? 1.0})`,
            transformOrigin: 'top left',
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 ${
            isEditMode ? 'pointer-events-auto' : 'pointer-events-none'
          } select-none w-[325px] will-change-transform z-10 ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-2xl p-1 shadow-2xl'
              : ''
          }`}
        >
          {isEditMode && (
            <>
              <div
                onPointerDown={(e) => startDrag('lobby', e)}
                className="mb-1.5 px-3 py-1.5 rounded-xl bg-m3-primary/20 border border-m3-primary/40 flex items-center justify-between cursor-grab active:cursor-grabbing text-[11px] font-mono font-bold text-m3-primary select-none shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5" />
                  <span>Move Scoreboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-400 font-normal">Hold to drag</span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      saveConfig({ ...config, showLobby: false });
                    }}
                    className="w-5 h-5 rounded-md bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    title="Remove Scoreboard from screen"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
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
          <div
            className={`rounded-2xl border p-2.5 shadow-2xl flex flex-col gap-2 transition-all ${
              isEditMode
                ? 'bg-[#181222] border-white/30 shadow-[0_12px_40px_rgba(0,0,0,0.85)] ring-1 ring-white/20'
                : 'bg-[#140e1b]/95 border-white/15'
            }`}
          >
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
      {/* ============================================================ */}
      {/* WIDGET 5: Agent Select — big centered detailed team panel    */}
      {/* ============================================================ */}
      {config.showPregame && showPregamePanel && (
        <div
          ref={pregameRef}
          onPointerDown={(e) => startDrag('pregame', e)}
          style={{
            transform: `translate3d(${config.positions.pregame.x}px, ${config.positions.pregame.y}px, 0) scale(${config.scales?.pregame ?? 1.0})`,
            transformOrigin: 'top left',
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 ${
            isEditMode ? 'pointer-events-auto' : 'pointer-events-none'
          } select-none w-[720px] max-w-[94vw] will-change-transform z-10 ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-3xl p-1 shadow-2xl'
              : ''
          }`}
        >
          {isEditMode && (
            <>
              <div
                onPointerDown={(e) => startDrag('pregame', e)}
                className="mb-2 px-3.5 py-1.5 rounded-2xl bg-m3-primary/20 border border-m3-primary/40 flex items-center justify-between cursor-grab active:cursor-grabbing text-xs font-mono font-bold text-m3-primary select-none shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5" />
                  <span>Move Agent Select Panel</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 font-normal">Hold to drag</span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      saveConfig({ ...config, showPregame: false });
                    }}
                    className="w-5 h-5 rounded-md bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    title="Remove Agent Select from screen"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
              <div
                onPointerDown={(e) => startResize('pregame', e)}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-br-2xl bg-m3-primary/90 hover:bg-m3-primary cursor-nwse-resize flex items-center justify-center text-[11px] text-zinc-950 font-black select-none shadow-md z-10"
                title="Drag to resize HUD widget"
              >
                ↘
              </div>
            </>
          )}
          <div
            className={`rounded-3xl border p-4 shadow-2xl flex flex-col gap-3 transition-all ${
              isEditMode
                ? 'bg-[#181222] border-white/30 shadow-[0_16px_50px_rgba(0,0,0,0.9)] ring-1 ring-white/20'
                : 'bg-[#140e1b]/95 border-white/15'
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display font-black text-white truncate">
                  {isPregame ? matchState?.mapName : 'Agent Select Preview'}
                </span>
                {isPregame && matchState?.mode && (
                  <span className="text-[11px] font-mono text-zinc-400 truncate">• {matchState.mode}</span>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-300/15 text-amber-200 text-[10px] font-mono font-extrabold uppercase shrink-0">
                {isPregame ? 'Agent Select' : 'Preview'}
              </span>
            </div>

            {!isPregame && isEditMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <PregameTeamColumn title="Your Team (Preview)" tagColor="text-m3-coral" players={PREVIEW_PLAYERS} tierIcons={tierIcons} />
                <PregameTeamColumn title="Enemy Team (Preview)" tagColor="text-m3-mint" players={PREVIEW_OPPONENTS} tierIcons={tierIcons} />
              </div>
            ) : matchState?.isDeathmatch ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <PregameTeamColumn title="Group 1" tagColor="text-m3-gold" players={matchState.blueTeam} tierIcons={tierIcons} />
                {matchState.redTeam.length > 0 && (
                  <PregameTeamColumn title="Group 2" tagColor="text-m3-gold" players={matchState.redTeam} tierIcons={tierIcons} />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <PregameTeamColumn
                  title="Your Team"
                  tagColor="text-m3-coral"
                  players={matchState?.blueTeam || []}
                  tierIcons={tierIcons}
                />
                <PregameTeamColumn
                  title="Enemy Team"
                  tagColor="text-m3-mint"
                  players={matchState?.redTeam || []}
                  tierIcons={tierIcons}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PregameTeamColumn: React.FC<{
  title: string;
  tagColor: string;
  players: LiveMatchPlayer[];
  tierIcons: Record<number, string>;
}> = ({ title, tagColor, players, tierIcons }) => (
  <div className="flex flex-col gap-1.5 rounded-2xl bg-black/25 border border-white/5 p-2.5 pointer-events-none select-none">
    <div className="flex items-center justify-between px-1">
      <span className={`text-[11px] font-black uppercase tracking-wider ${tagColor}`}>{title}</span>
      <span className="text-[10px] font-mono text-zinc-500">{players.length} players</span>
    </div>
    {players.map((p) => {
      const icon = tierIcons[p.tier];
      const kd = formatKd(p.kd);
      const locked = (p.selectionState || '').toLowerCase().includes('lock');
      const hasPick = !locked && !!p.agentName && p.agentName !== 'Selecting…';
      return (
        <div
          key={p.puuid}
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl border ${
            p.isMe ? 'bg-purple-950/40 border-purple-500/40' : 'bg-zinc-900/50 border-white/5'
          }`}
        >
          {p.agentIcon ? (
            <img
              src={p.agentIcon}
              alt=""
              draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
              className="w-9 h-9 rounded-xl object-cover shrink-0 border border-white/10 pointer-events-none select-none"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-zinc-800 shrink-0 border border-white/10 flex items-center justify-center text-xs font-black text-zinc-400">
              ?
            </div>
          )}
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-[13px] text-white truncate" title={`${p.name}${p.tag ? '#' + p.tag : ''}`}>
                {p.name}
              </span>
              {p.tag && <span className="text-[10px] font-mono text-zinc-500 shrink-0">#{p.tag}</span>}
              {p.isMe && (
                <span className="px-1 py-px rounded bg-purple-500 text-[8px] font-black text-white uppercase shrink-0">
                  You
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 shrink-0 text-[10px] font-mono font-bold">
                <span className={`w-1.5 h-1.5 rounded-full ${locked ? 'bg-m3-mint' : hasPick ? 'bg-amber-300' : 'bg-zinc-600'}`} />
                <span className={locked ? 'text-m3-mint' : hasPick ? 'text-amber-200' : 'text-zinc-500'}>
                  {locked ? 'Locked' : hasPick ? p.agentName : 'Picking…'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 min-w-0">
              {icon && (
                <img src={icon} alt="" draggable={false} className="w-4 h-4 object-contain shrink-0 pointer-events-none select-none" />
              )}
              <span className="font-bold text-purple-200 truncate">{p.rank}</span>
              <span className="font-bold text-m3-primary shrink-0">{p.rr}RR</span>
              <span className="truncate">Peak {p.peakRank}</span>
              <span className={`font-bold shrink-0 ${kd.color}`}>K/D {kd.text}</span>
              <span className="shrink-0">LVL {p.accountLevel}</span>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

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
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
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
