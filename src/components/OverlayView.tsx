import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Lock as LockIcon, Check, Users, Shield, RotateCcw, Move, X, Plus, Trophy, EyeOff, Swords, Clock, AlertTriangle } from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer } from '../types';
import { fetchLiveMatchState, gameData } from '../utils/tracker';
import { useTrackerData } from '../hooks/useTrackerData';
import { computeMapAgentStats, getMapMetaPicks, getRankTierLabel, type AgentStatSummary } from '../utils/mapMeta';
import { getOverlayEditMode, setOverlayEditMode, isTabDown } from '../utils/ipc';
import { listen } from '@tauri-apps/api/event';

export interface WidgetPos {
  x: number;
  y: number;
}

export interface OverlayConfig {
  showLobby: boolean;
  showPregame: boolean;
  showTopAgents: boolean;
  positions: {
    lobby: WidgetPos;
    pregame: WidgetPos;
    topAgents: WidgetPos;
  };
  scales: {
    lobby: number;
    pregame: number;
    topAgents: number;
  };
}

export function getDefaultOverlayPositions(): OverlayConfig['positions'] {
  const w = typeof window !== 'undefined' ? window.innerWidth : 2088;
  const h = typeof window !== 'undefined' ? window.innerHeight : 1440;

  return {
    lobby: {
      x: Math.max(16, Math.round(w * 0.02)),
      y: Math.max(80, Math.round(h * 0.18)),
    },
    pregame: {
      x: Math.max(20, Math.round(w * 0.165)),
      y: Math.max(60, Math.round(h * 0.235)),
    },
    topAgents: {
      x: Math.max(20, Math.round(w * 0.74)),
      y: Math.max(60, Math.round(h * 0.735)),
    },
  };
}

export function getDefaultOverlayConfig(): OverlayConfig {
  return {
    showLobby: true,
    showPregame: true,
    showTopAgents: true,
    positions: getDefaultOverlayPositions(),
    scales: {
      lobby: 1.0,
      pregame: 1.0,
      topAgents: 1.0,
    },
  };
}

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = getDefaultOverlayConfig();

function getFlagUrl(code?: string): string | null {
  if (!code || code.length !== 2 || ['EU', 'NA', 'AP', 'KR'].includes(code.toUpperCase())) return null;
  let lower = code.toLowerCase();
  if (lower === 'uk') lower = 'gb';
  return `https://flagcdn.com/24x18/${lower}.png`;
}

/** Full MMR picture for a lobby player, surfaced on hover. */
function rankTooltip(p: LiveMatchPlayer, actLabel?: string): string {
  const bits: string[] = [];
  bits.push(p.tier > 0 ? `${p.rank}` : 'Unranked');
  if (p.rr > 0) bits.push(`${p.rr} RR`);
  if (p.actGames && p.actGames > 0) {
    bits.push(`${p.actWins ?? 0}W-${Math.max(0, p.actGames - (p.actWins ?? 0))}L this act`);
  }
  if (p.leaderboardRank && p.leaderboardRank > 0) bits.push(`#${p.leaderboardRank} Leaderboard`);
  if (p.peakTier > 0) bits.push(`Peak ${p.peakRank}${actLabel ? ` (${actLabel})` : ''}`);
  if (p.isRankHidden) bits.push('Act rank hidden (unmasked)');
  return bits.join(' • ');
}

/** "V25 · ACT III" → "V25·III" — fits under a 16px emblem. */
function shortAct(label?: string): string {
  if (!label) return '';
  return label
    .replace(/ACT\s*/i, '')
    .replace(/\s*·\s*/g, '·')
    .trim();
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

const PARTY_STYLES: Record<number, { border: string; bg: string; dot: string; text: string; badge: string; name: string }> = {
  1: {
    border: 'border-l-[3px] border-l-cyan-400',
    bg: 'bg-cyan-500/10',
    dot: 'bg-cyan-400',
    text: 'text-cyan-300',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
    name: 'Party 1',
  },
  2: {
    border: 'border-l-[3px] border-l-amber-400',
    bg: 'bg-amber-500/10',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    name: 'Party 2',
  },
  3: {
    border: 'border-l-[3px] border-l-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    dot: 'bg-fuchsia-400',
    text: 'text-fuchsia-300',
    badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40',
    name: 'Party 3',
  },
};



const PREVIEW_TOP_AGENTS: AgentStatSummary[] = [
  {
    agent: 'Jett',
    role: 'Duelist',
    matches: 48,
    wins: 30,
    losses: 18,
    winPct: 62.5,
    kd: 1.34,
    hsPct: 28.4,
  },
  {
    agent: 'Omen',
    role: 'Controller',
    matches: 32,
    wins: 19,
    losses: 13,
    winPct: 59.4,
    kd: 1.18,
    hsPct: 22.1,
  },
  {
    agent: 'Sova',
    role: 'Initiator',
    matches: 26,
    wins: 15,
    losses: 11,
    winPct: 57.7,
    kd: 1.12,
    hsPct: 24.6,
  },
  {
    agent: 'Cypher',
    role: 'Sentinel',
    matches: 18,
    wins: 10,
    losses: 8,
    winPct: 55.6,
    kd: 1.08,
    hsPct: 21.8,
  },
];

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
    peakSeasonId: '8102cd81-43a0-d0d7-bd59-47b8fe9bed1b',
    accountLevel: 142,
    cardId: '',
    isMe: true,
    country: 'DE',
    region: 'EU',
    kd: 1.28,
    winPct: 58,
    hsPct: 28,
    recentWon: 3,
    recentLost: 1,
    streak: 2,
    selectionState: 'locked',
    partyIndex: 1,
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
    winPct: 52,
    hsPct: 21,
    recentWon: 2,
    recentLost: 2,
    streak: 1,
    selectionState: 'locked',
    partyIndex: 1,
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
    winPct: 49,
    hsPct: 18,
    recentWon: 1,
    recentLost: 3,
    streak: 0,
    selectionState: 'selected',
    partyIndex: 0,
    isIncognito: true,
  },
  {
    puuid: 'p4',
    name: 'SovaGod',
    tag: 'DART',
    team: 'Blue',
    agentId: '',
    agentName: 'Sova',
    agentIcon: 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png',
    agentRole: 'Initiator',
    tier: 23,
    rank: 'Diamond 3',
    rr: 45,
    peakTier: 25,
    peakRank: 'Ascendant 2',
    accountLevel: 178,
    cardId: '',
    isMe: false,
    country: 'UK',
    region: 'EU',
    kd: 1.18,
    winPct: 56,
    hsPct: 24,
    recentWon: 4,
    recentLost: 1,
    streak: 3,
    selectionState: 'locked',
    partyIndex: 2,
  },
  {
    puuid: 'p5',
    name: 'CypherWire',
    tag: 'TRAP',
    team: 'Blue',
    agentId: '',
    agentName: 'Cypher',
    agentIcon: 'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/displayicon.png',
    agentRole: 'Sentinel',
    tier: 22,
    rank: 'Diamond 2',
    rr: 15,
    peakTier: 23,
    peakRank: 'Diamond 3',
    accountLevel: 95,
    cardId: '',
    isMe: false,
    country: 'IT',
    region: 'EU',
    kd: 1.10,
    winPct: 53,
    hsPct: 22,
    recentWon: 3,
    recentLost: 2,
    streak: 1,
    selectionState: 'selected',
    partyIndex: 2,
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
  const [agentMap, setAgentMap] = useState<Record<string, { name: string; icon: string; role: string }>>({});
  const [seasonNames, setSeasonNames] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'auto' | 'personal' | 'blitz'>('auto');

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

  const { detailsById, mapById, profile } = useTrackerData();

  const activeMapName =
    matchState?.mapName && matchState.mapName !== 'No Match Active' && matchState.mapName !== 'Live Match Status'
      ? matchState.mapName
      : 'Ascent';

  const normActiveMap = activeMapName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Compute user's real stats on this specific active map
  const mapAgentStats = computeMapAgentStats(
    activeMapName,
    detailsById || {},
    mapById || {},
    profile?.puuid
  );

  // 2. Check if user has an agent on this map with >= 50% win rate
  const hasWinningAgentOnMap = mapAgentStats.some((s) => s.matches >= 2 && s.winPct >= 50);

  // 3. Rank-tuned map meta picks
  const userTier = profile?.tier || 22;
  const rankTierLabel = getRankTierLabel(userTier);
  const metaPicks = getMapMetaPicks(normActiveMap, userTier);

  // Decide whether to show meta recommendations or personal stats
  const showMetaPicks = viewMode === 'blitz' || (viewMode === 'auto' && !hasWinningAgentOnMap);

  const topAgentsList: AgentStatSummary[] =
    mapAgentStats.length > 0
      ? mapAgentStats
      : PREVIEW_TOP_AGENTS;

  // Direct element references for GPU hardware-accelerated zero-lag dragging
  const rootRef = useRef<HTMLDivElement>(null);
  const lobbyRef = useRef<HTMLDivElement>(null);
  const pregameRef = useRef<HTMLDivElement>(null);
  const topAgentsRef = useRef<HTMLDivElement>(null);

  const widgetRefs = {
    lobby: lobbyRef,
    pregame: pregameRef,
    topAgents: topAgentsRef,
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
    gameData()
      .then((d) => {
        setTierIcons(d.tierIcons);
        setAgentMap(d.agentInfo || {});
        setSeasonNames(d.seasons || {});
      })
      .catch(() => {});

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

  // Phase-split visibility: agent select gets its own big centered panel;
  // the in-match scoreboard renders ONLY while Tab is physically held.
  const isPregame = matchState?.phase === 'pregame';
  const isCoregame = matchState?.phase === 'coregame';
  const showScorePanel = isEditMode || (isCoregame && tabHeld);
  const showPregamePanel = isEditMode || isPregame;

  // Single source of truth for players:
  // If a live match is detected, always display real players.
  // Only fall back to PREVIEW_PLAYERS when no game is running (idle).
  const hasLivePlayers = !!(
    matchState &&
    matchState.phase !== 'idle' &&
    (matchState.blueTeam.length > 0 || matchState.redTeam.length > 0)
  );

  const yourTeam = hasLivePlayers
    ? matchState.blueTeam.some((p) => p.isMe)
      ? matchState.blueTeam
      : matchState.redTeam.some((p) => p.isMe)
      ? matchState.redTeam
      : matchState.blueTeam.length > 0
      ? matchState.blueTeam
      : matchState.redTeam
    : PREVIEW_PLAYERS;

  const enemyTeam = hasLivePlayers
    ? yourTeam === matchState.blueTeam
      ? matchState.redTeam
      : matchState.blueTeam
    : PREVIEW_OPPONENTS;
  // Scoreboard mounts/unmounts on every Tab press and panels flip on phase
  // changes — repaint after each transition so DWM never keeps a stale
  // white region from the mount/unmount repaint storm.
  const scoreVisible = config.showLobby && showScorePanel;
  const pregameVisible = config.showPregame && showPregamePanel;
  const topAgentsVisible = config.showTopAgents && (isPregame || isEditMode);
  useEffect(() => {
    const t = setTimeout(forceRepaint, 80);
    return () => clearTimeout(t);
  }, [scoreVisible, pregameVisible, topAgentsVisible, forceRepaint]);

  return (
    <div
      ref={rootRef}
      onDragStart={(e) => e.preventDefault()}
      className="fixed inset-0 w-screen h-screen select-none overflow-hidden font-sans pointer-events-none"
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Edit Mode Dimmer: subtle 40% darkness so desktop/game remains visible */}
      {isEditMode && (
        <div
          className="fixed inset-0 pointer-events-auto bg-black/40 transition-opacity duration-200 z-0"
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
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[96vw] z-50 pointer-events-auto flex flex-col gap-2 p-3 rounded-3xl bg-[#0c0816]/85 border border-white/15 shadow-2xl">
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
                onClick={() => saveConfig(getDefaultOverlayConfig())}
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
                        pregame: getDefaultOverlayPositions().pregame,
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

            {/* 3. TOP AGENTS MINI PREVIEW CARD */}
            <div
              className={`flex flex-col gap-2 p-3 rounded-2xl border select-none transition-all w-52 ${
                config.showTopAgents
                  ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/50'
                  : 'bg-zinc-900/60 border-white/10 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-m3-gold" />
                  <span>Top Agents</span>
                </span>
                <span
                  className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full ${
                    config.showTopAgents
                      ? 'bg-m3-mint/20 text-m3-mint border border-m3-mint/30'
                      : 'bg-white/10 text-zinc-400 border border-white/10'
                  }`}
                >
                  {config.showTopAgents ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Mini visual mockup of Top Agents */}
              <div className="rounded-xl bg-black/40 border border-white/5 p-1.5 flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center justify-between text-[8px] font-mono">
                  <span className="text-white font-bold">Jett • 62.5% WR</span>
                  <span className="text-m3-mint font-bold">1.34 KD</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400">
                  <span>Omen • 59.4% WR</span>
                  <span>1.18 KD</span>
                </div>
              </div>

              {/* Add to Default Place Button */}
              <button
                type="button"
                onClick={() => {
                  if (config.showTopAgents) {
                    saveConfig({ ...config, showTopAgents: false });
                  } else {
                    saveConfig({
                      ...config,
                      showTopAgents: true,
                      positions: {
                        ...config.positions,
                        topAgents: getDefaultOverlayPositions().topAgents,
                      },
                    });
                  }
                }}
                className={`mt-auto px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  config.showTopAgents
                    ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300'
                    : 'bg-m3-primary/20 hover:bg-m3-primary/30 border border-m3-primary/40 text-m3-primary font-bold'
                }`}
              >
                {config.showTopAgents ? (
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
          } select-none w-[340px] will-change-transform z-10 ${
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
                ? 'bg-[#0c0816]/85 border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.85)] ring-1 ring-white/10'
                : 'bg-[#0c0816]/75 border-white/10'
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
              <span className="shrink-0 w-6 text-center">Rank</span>
              <span className="shrink-0 w-6 text-center">Peak</span>
              <span className="shrink-0 w-8 text-right">K/D</span>
            </div>

            {/* Vertical Compact Teams / Player Stack */}
            <div className="flex flex-col gap-2">
              {matchState?.isDeathmatch ? (
                /* FFA / Deathmatch — Single unified leaderboard, NOT grouped by teams or groups */
                <VerticalSquadColumn
                  title="Deathmatch"
                  tagColor="text-m3-gold"
                  players={matchState.blueTeam}
                  tierIcons={tierIcons}
                />
              ) : (
                /* Standard Match Stack — Your Team vs Enemy Team */
                <>
                  <VerticalSquadColumn
                    title="Your Team"
                    tagColor="text-m3-primary"
                    players={yourTeam}
                    tierIcons={tierIcons}
                  />
                  {enemyTeam.length > 0 ? (
                    <VerticalSquadColumn
                      title="Enemy Team"
                      tagColor="text-rose-400"
                      players={enemyTeam}
                      tierIcons={tierIcons}
                    />
                  ) : matchState?.phase === 'coregame' ? (
                    <div className="rounded-xl bg-black/20 border border-white/5 p-2 flex items-center justify-center gap-2 text-center">
                      <LockIcon className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="text-[10px] font-semibold text-zinc-300">Enemy Team Hidden</span>
                      <span className="text-[9px] text-zinc-500">• Visible on match start</span>
                    </div>
                  ) : null}
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
          } select-none w-[560px] max-w-[96vw] will-change-transform z-10 ${
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
            className={`rounded-3xl border p-3.5 shadow-2xl flex flex-col gap-2 transition-all ${
              isEditMode
                ? 'bg-[#0c0816]/85 border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.9)] ring-1 ring-white/10'
                : 'bg-[#0c0816]/75 border-white/10'
            }`}
          >
            {/* Header: Map • Starting Side Badge */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-m3-mint animate-pulse shadow-[0_0_8px_rgba(58,227,116,0.8)]" />
                <span className="font-display font-black text-white text-xs tracking-wider uppercase">
                  {matchState?.mapName || 'Ascent'} • Team Scout
                </span>
                {matchState?.mode && (
                  <span className="text-[10px] font-mono text-zinc-400 truncate">• {matchState.mode}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {matchState?.startingSide && (
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase shrink-0 border ${
                      matchState.startingSide === 'Defense'
                        ? 'bg-m3-mint/15 text-m3-mint border-m3-mint/30'
                        : 'bg-m3-coral/15 text-m3-coral border-m3-coral/30'
                    }`}
                  >
                    {matchState.startingSide === 'Defense' ? (
                      <>
                        <Shield className="w-3 h-3 text-m3-mint" />
                        <span>Starting Defense</span>
                      </>
                    ) : (
                      <>
                        <Swords className="w-3 h-3 text-m3-coral" />
                        <span>Starting Attack</span>
                      </>
                    )}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[9px] font-mono font-bold uppercase shrink-0">
                  {isPregame ? 'Agent Select' : 'Preview'}
                </span>
              </div>
            </div>

            <PregameTeamColumn
              title="Your Team"
              tagColor="text-m3-primary"
              players={yourTeam}
              tierIcons={tierIcons}
              seasons={seasonNames}
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* WIDGET 3: Player Top Agents on Active Map & Blitz Meta      */}
      {/* ============================================================ */}
      {config.showTopAgents && (isPregame || isEditMode) && (
        <div
          ref={topAgentsRef}
          onPointerDown={(e) => startDrag('topAgents', e)}
          style={{
            transform: `translate3d(${config.positions.topAgents.x}px, ${config.positions.topAgents.y}px, 0) scale(${config.scales?.topAgents ?? 1.0})`,
            transformOrigin: 'top left',
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 ${
            isEditMode ? 'pointer-events-auto' : 'pointer-events-none'
          } select-none w-[370px] will-change-transform z-10 ${
            isEditMode
              ? 'cursor-grab active:cursor-grabbing ring-2 ring-m3-primary/70 ring-dashed rounded-3xl p-1 shadow-2xl'
              : ''
          }`}
        >
          {isEditMode && (
            <>
              <div
                onPointerDown={(e) => startDrag('topAgents', e)}
                className="mb-2 px-3.5 py-1.5 rounded-2xl bg-m3-primary/20 border border-m3-primary/40 flex items-center justify-between cursor-grab active:cursor-grabbing text-xs font-mono font-bold text-m3-primary select-none shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5" />
                  <span>Move Map Agents Panel</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 font-normal">Hold to drag</span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      saveConfig({ ...config, showTopAgents: false });
                    }}
                    className="w-5 h-5 rounded-md bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    title="Remove Map Agents from screen"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
              <div
                onPointerDown={(e) => startResize('topAgents', e)}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-br-2xl bg-m3-primary/90 hover:bg-m3-primary cursor-nwse-resize flex items-center justify-center text-[11px] text-zinc-950 font-black select-none shadow-md z-10"
                title="Drag to resize HUD widget"
              >
                ↘
              </div>
            </>
          )}

          <div
            className={`rounded-3xl border p-3 shadow-2xl flex flex-col gap-2 transition-all ${
              isEditMode
                ? 'bg-[#0c0816]/85 border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.9)] ring-1 ring-white/10'
                : 'bg-[#0c0816]/75 border-white/10'
            }`}
          >
            {/* Header with Map name & Mode toggle */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Trophy className="w-3.5 h-3.5 text-m3-gold shrink-0" />
                <span className="font-display font-black text-white text-xs tracking-wider uppercase truncate">
                  {activeMapName} • {showMetaPicks ? 'Recommended' : 'Your Top Picks'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setViewMode(showMetaPicks ? 'personal' : 'blitz')}
                  className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-[9px] font-mono font-bold uppercase shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Toggle between your map stats and rank recommended picks"
                >
                  {showMetaPicks ? (
                    <span>Your Stats ({mapAgentStats.length})</span>
                  ) : (
                    <span>Meta ({rankTierLabel})</span>
                  )}
                </button>
              </div>
            </div>

            {/* If user struggles on this map (<50% win rate), show tactical alert */}
            {!hasWinningAgentOnMap && !showMetaPicks && (
              <div className="px-2.5 py-1 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-between text-[10px] font-mono text-amber-200">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>&lt;50% Win Rate on {activeMapName}</span>
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setViewMode('blitz')}
                  className="text-[9px] underline text-amber-300 hover:text-white cursor-pointer font-bold"
                >
                  See Recommended
                </button>
              </div>
            )}

            {/* Table / Rows */}
            {showMetaPicks ? (
              /* RECOMMENDED PICKS FOR THIS MAP AND RANK (NO TIPS) */
              <div className="flex flex-col gap-1.5">
                <div className="px-1 text-[9px] font-mono text-zinc-400 flex items-center justify-between border-b border-white/5 pb-1">
                  <span>Rank-Tuned Meta ({rankTierLabel})</span>
                  <span className="text-m3-mint font-bold">Tier &amp; Win%</span>
                </div>
                {metaPicks.map((b) => {
                  const norm = b.agent.toLowerCase();
                  const meta = Object.values(agentMap).find((a) => a.name.toLowerCase() === norm);
                  const icon =
                    meta?.icon ||
                    (norm === 'sova'
                      ? 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png'
                      : '');

                  return (
                    <div
                      key={b.agent}
                      className="grid grid-cols-[1fr_56px_50px_46px] items-center px-2.5 py-1.5 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        {icon ? (
                          <img
                            src={icon}
                            alt=""
                            draggable={false}
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                            className="w-7 h-7 rounded-lg object-cover shrink-0 border border-white/10 pointer-events-none select-none"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-zinc-800 shrink-0 border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-400">
                            {b.agent.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 leading-tight">
                          <span className="font-bold text-[11px] text-white truncate">{b.agent}</span>
                          <span className="text-[8px] font-mono text-zinc-400 truncate">{b.role}</span>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[8px] font-mono font-bold uppercase">
                          {b.tier} Tier
                        </span>
                      </div>

                      <div className="text-right font-mono text-[10px] font-bold text-m3-mint" title="Lobby Win Rate">
                        {b.winRate}%
                      </div>

                      <div className="text-right font-mono text-[9px] text-zinc-400 font-medium" title="Pick Rate">
                        {b.pickRate}%
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* PLAYER PERSONAL STATS ON THIS SPECIFIC MAP */
              <div className="flex flex-col gap-1">
                {/* Column Headers */}
                <div className="grid grid-cols-[1fr_58px_50px_46px_40px] items-center px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400 border-b border-white/5">
                  <span>Agent</span>
                  <span className="text-right">Matches</span>
                  <span className="text-right">Win%</span>
                  <span className="text-right">K/D</span>
                  <span className="text-right">HS%</span>
                </div>

                {topAgentsList.slice(0, 5).map((stat) => {
                  const normName = stat.agent.toLowerCase();
                  const meta = Object.values(agentMap).find(
                    (a) => a.name.toLowerCase() === normName
                  );
                  const icon =
                    meta?.icon ||
                    (normName === 'sova'
                      ? 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png'
                      : '');
                  const role = meta?.role || stat.role || 'Agent';
                  const kd = stat.kd.toFixed(2);
                  const kdColor =
                    stat.kd >= 1.2
                      ? 'text-emerald-400 font-bold'
                      : stat.kd >= 1.0
                      ? 'text-m3-mint font-semibold'
                      : 'text-rose-400 font-medium';

                  return (
                    <div
                      key={stat.agent}
                      className="grid grid-cols-[1fr_58px_50px_46px_40px] items-center px-2 py-1.5 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] text-xs transition-colors"
                    >
                      {/* Agent Icon & Name */}
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        {icon ? (
                          <img
                            src={icon}
                            alt=""
                            draggable={false}
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                            className="w-7 h-7 rounded-lg object-cover shrink-0 border border-white/10 pointer-events-none select-none"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-zinc-800 shrink-0 border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-400">
                            {stat.agent.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 flex-1 leading-tight">
                          <span className="font-bold text-[11px] text-white truncate">{stat.agent}</span>
                          <span className="text-[8px] font-mono text-zinc-400 truncate">{role}</span>
                        </div>
                      </div>

                      {/* Matches on this map */}
                      <div
                        className="flex flex-col items-end leading-none font-mono"
                        title={`${stat.wins} Wins - ${stat.losses} Losses on ${activeMapName}`}
                      >
                        <span className="text-[10px] font-bold text-white">{stat.matches}G</span>
                        <span className="text-[8px] text-zinc-400 mt-0.5">{stat.wins}W-{stat.losses}L</span>
                      </div>

                      {/* Win % */}
                      <div className="text-right font-mono text-[10px] font-bold" title="Win Rate">
                        <span className={stat.winPct >= 50 ? 'text-m3-mint' : 'text-zinc-400'}>
                          {stat.winPct.toFixed(1)}%
                        </span>
                      </div>

                      {/* K/D */}
                      <div className="text-right font-mono text-[10px] font-bold" title="K/D Ratio">
                        <span className={kdColor}>{kd}</span>
                      </div>

                      {/* HS% */}
                      <div className="text-right font-mono text-[10px] text-amber-200/90 font-medium" title="Headshot %">
                        {stat.hsPct.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
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
  seasons?: Record<string, string>;
}> = ({ players, tierIcons, seasons }) => {
  return (
    <div className="flex flex-col gap-1.5 pointer-events-none select-none">
      {/* Table Column Headers: Agent, Player, Rank (Icon), Peak (Icon), K/D, Win%, HS%, Recent */}
      <div className="grid grid-cols-[1fr_36px_36px_44px_48px_44px_68px] items-center px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400 border-b border-white/5">
        <span>Player</span>
        <span className="text-center">Rank</span>
        <span className="text-center">Peak</span>
        <span className="text-right">K/D</span>
        <span className="text-right">Win%</span>
        <span className="text-right">HS%</span>
        <span className="text-right">24H</span>
      </div>

      {/* Teammate Rows */}
      <div className="flex flex-col gap-1">
        {players.map((p) => {
          const icon = tierIcons[p.tier];
          const peakIcon = tierIcons[p.peakTier];
          const kd = formatKd(p.kd);
          const locked = (p.selectionState || '').toLowerCase().includes('lock');
          const hasPick = !locked && !!p.agentName && p.agentName !== 'Selecting…';
          const party = p.partyIndex ? PARTY_STYLES[p.partyIndex] : null;
          const flagUrl = getFlagUrl(p.country);

          return (
            <div
              key={p.puuid}
              className={`grid grid-cols-[1fr_36px_36px_44px_48px_44px_68px] items-center px-2 py-1 rounded-xl border text-xs transition-colors ${
                party
                  ? `${party.border} ${party.bg} border-white/5`
                  : p.isMe
                  ? 'bg-purple-500/15 border-purple-400/30 text-white shadow-xs'
                  : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 text-zinc-200'
              }`}
            >
              {/* Agent Icon (with Flag overlay) + Player Name & Pick State */}
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div className="relative shrink-0">
                  {p.agentIcon ? (
                    <img
                      src={p.agentIcon}
                      alt=""
                      draggable={false}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                      className={`w-7 h-7 rounded-lg object-cover border ${
                        locked ? 'border-m3-mint/60' : hasPick ? 'border-amber-300/60' : 'border-white/10'
                      } pointer-events-none select-none`}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-400">
                      ?
                    </div>
                  )}
                  {flagUrl && (
                    <img
                      src={flagUrl}
                      alt={p.country || ''}
                      title={`Country: ${p.country}`}
                      draggable={false}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-2.5 object-cover rounded-[2px] shadow-sm border border-black/80 pointer-events-none select-none"
                    />
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-bold text-[11px] text-white truncate" title={`${p.name}${p.tag ? '#' + p.tag : ''}`}>
                      {p.name}
                    </span>
                    {p.isMe && (
                      <span className="px-1 py-px rounded bg-purple-500/80 text-[7px] font-black text-white uppercase shrink-0">
                        You
                      </span>
                    )}
                    {p.isIncognito && (
                      <span
                        className="flex items-center gap-0.5 px-1 py-px rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[7px] font-mono font-bold uppercase shrink-0"
                        title="Name Hidden in Valorant (Unmasked by Recon)"
                      >
                        <EyeOff className="w-2.5 h-2.5" />
                        Hidden
                      </span>
                    )}
                    {party && (
                      <span
                        className={`px-1 py-px rounded text-[7px] font-mono font-bold uppercase shrink-0 border ${party.badge}`}
                        title={party.name}
                      >
                        {party.name}
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] font-mono font-semibold">
                    {locked ? (
                      <span className="flex items-center gap-1 text-m3-mint">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        {p.agentName}
                      </span>
                    ) : hasPick ? (
                      <span className="flex items-center gap-1 text-amber-300">
                        <Clock className="w-2.5 h-2.5" />
                        {p.agentName}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Picking…</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Current Rank emblem + live RR */}
              <div
                className="flex flex-col items-center justify-center leading-none"
                title={rankTooltip(p, seasons?.[p.peakSeasonId?.toLowerCase() ?? ''])}
              >
                {icon ? (
                  <img src={icon} alt="" draggable={false} className="w-5 h-5 object-contain shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500">—</span>
                )}
                {p.rr > 0 && (
                  <span className="text-[8px] font-mono font-bold text-m3-primary mt-0.5">{p.rr}</span>
                )}
              </div>

              {/* Peak Rank emblem + the act it was reached in */}
              <div
                className="flex flex-col items-center justify-center leading-none"
                title={`Peak: ${p.peakRank}${
                  seasons?.[p.peakSeasonId?.toLowerCase() ?? '']
                    ? ` — ${seasons[p.peakSeasonId!.toLowerCase()]}`
                    : ''
                }`}
              >
                {peakIcon ? (
                  <img src={peakIcon} alt="" draggable={false} className="w-4 h-4 object-contain opacity-75 shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500">—</span>
                )}
                {p.peakSeasonId && seasons?.[p.peakSeasonId.toLowerCase()] && (
                  <span className="text-[7px] font-mono font-bold text-zinc-400 mt-0.5 tracking-tight">
                    {shortAct(seasons[p.peakSeasonId.toLowerCase()])}
                  </span>
                )}
              </div>

              {/* K/D */}
              <div className="text-right font-mono text-[10px] font-bold" title="K/D Ratio">
                <span className={kd.color}>{kd.text}</span>
              </div>

              {/* Win % */}
              <div className="text-right font-mono text-[10px] font-semibold" title="Act Win Rate">
                {p.winPct != null ? (
                  <span className={p.winPct >= 50 ? 'text-m3-mint' : 'text-zinc-400'}>
                    {p.winPct}%
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </div>

              {/* HS % */}
              <div className="text-right font-mono text-[10px]" title="Headshot %">
                {p.hsPct != null ? (
                  <span className="text-amber-200/90 font-medium">{p.hsPct}%</span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </div>

              {/* Last 24h record (W/L) + current streak */}
              <div
                className="flex flex-col items-end leading-none font-mono"
                title={`Last 24 hours: ${p.recentWon ?? 0}W - ${p.recentLost ?? 0}L${
                  p.streak && p.streak > 0 ? ` • ${p.streak} ${p.streakIsWin ? 'win' : 'loss'} streak` : ''
                }`}
              >
                {p.recentWon != null || p.recentLost != null ? (
                  <>
                    <span className="text-[9px] font-bold">
                      <span className={p.recentWon ? 'text-m3-mint' : 'text-zinc-500'}>{p.recentWon ?? 0}W</span>
                      <span className="text-zinc-600"> - </span>
                      <span className={p.recentLost ? 'text-rose-400' : 'text-zinc-500'}>{p.recentLost ?? 0}L</span>
                    </span>
                    {p.streak && p.streak > 1 && p.streakIsWin !== undefined ? (
                      <span
                        className={`text-[8px] font-bold mt-0.5 ${
                          p.streakIsWin ? 'text-m3-mint' : 'text-rose-400'
                        }`}
                      >
                        {p.streak}
                        {p.streakIsWin ? 'W' : 'L'} Strk
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-600">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
      const kd = formatKd(p.kd);
      const party = p.partyIndex ? PARTY_STYLES[p.partyIndex] : null;
      const flagUrl = getFlagUrl(p.country);

      return (
        <div
          key={p.puuid}
          className={`flex items-center gap-2 px-2 py-1 rounded-xl border text-xs transition-colors ${
            party
              ? `${party.border} ${party.bg} border-white/5`
              : p.isMe
              ? 'bg-purple-950/30 border-purple-500/40 text-white shadow-xs'
              : 'bg-black/25 hover:bg-black/40 border-white/5 text-zinc-200'
          }`}
        >
          {/* Agent Icon (with Flag Overlay) */}
          <div className="relative shrink-0">
            {p.agentIcon ? (
              <img
                src={p.agentIcon}
                alt=""
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
                className="w-5 h-5 rounded-md object-cover pointer-events-none select-none border border-white/10"
              />
            ) : (
              <div className="w-5 h-5 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                ?
              </div>
            )}
            {flagUrl && (
              <img
                src={flagUrl}
                alt={p.country || ''}
                title={`Country: ${p.country}`}
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
                className="absolute -bottom-0.5 -right-0.5 w-3 h-2 object-cover rounded-[1.5px] shadow-xs border border-black/80 pointer-events-none select-none"
              />
            )}
          </div>

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
            {p.isIncognito && (
              <span
                className="flex items-center gap-0.5 px-1 py-px rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[7px] font-mono font-bold uppercase shrink-0"
                title="Name Hidden in Valorant (Unmasked by Recon)"
              >
                <EyeOff className="w-2.5 h-2.5" />
              </span>
            )}
            {party && (
              <span
                className={`px-1 py-px rounded text-[7px] font-mono font-bold uppercase shrink-0 border ${party.badge}`}
                title={party.name}
              >
                {party.name}
              </span>
            )}
          </div>

          {/* Current Rank emblem + live RR */}
          <div className="flex flex-col items-center justify-center w-7 shrink-0 leading-none" title={rankTooltip(p)}>
            {icon ? (
              <img src={icon} alt="" draggable={false} className="w-4 h-4 object-contain shrink-0" />
            ) : (
              <span className="text-[10px] font-mono text-zinc-500">—</span>
            )}
            {p.rr > 0 && (
              <span className="text-[7px] font-mono font-bold text-m3-primary mt-0.5">{p.rr}</span>
            )}
          </div>

          {/* Peak Rank (Icon only) */}
          <div className="flex items-center justify-center w-6 shrink-0" title={`Peak: ${p.peakRank}`}>
            {peakIcon ? (
              <img src={peakIcon} alt="" draggable={false} className="w-3.5 h-3.5 object-contain opacity-75 shrink-0" />
            ) : (
              <span className="text-[10px] font-mono text-zinc-500">—</span>
            )}
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
