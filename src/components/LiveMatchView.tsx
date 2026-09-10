import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  Eye,
  Shield,
  Radio,
  Lock,
  Edit3,
  Check,
  Sliders,
  Trophy,
  Users,
  BarChart2,
  Tv,
  RotateCcw,
} from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer } from '../types';
import { fetchLiveMatchState, gameData } from '../utils/tracker';
import { showOverlay, hideOverlay, isOverlayVisible, setOverlayEditMode, getOverlayEditMode } from '../utils/ipc';
import { listen, emit } from '@tauri-apps/api/event';
import { DEFAULT_OVERLAY_CONFIG, type OverlayConfig } from './OverlayView';

export const LiveMatchView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [inEditMode, setInEditMode] = useState(false);

  const [overlayCfg, setOverlayCfg] = useState<OverlayConfig>(() => {
    try {
      const s = localStorage.getItem('aspect_overlay_cfg_v4') || localStorage.getItem('aspect_overlay_cfg_v3');
      if (s) {
        const parsed = JSON.parse(s);
        return {
          ...DEFAULT_OVERLAY_CONFIG,
          ...parsed,
          positions: { ...DEFAULT_OVERLAY_CONFIG.positions, ...(parsed.positions || {}) },
        };
      }
      return DEFAULT_OVERLAY_CONFIG;
    } catch {
      return DEFAULT_OVERLAY_CONFIG;
    }
  });

  const updateOverlayCfg = async (next: OverlayConfig) => {
    setOverlayCfg(next);
    try {
      localStorage.setItem('aspect_overlay_cfg_v4', JSON.stringify(next));
    } catch {}
    try {
      await emit('overlay-config-changed', next);
    } catch {}
  };

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchLiveMatchState();
      setMatchState(s);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    gameData().then((d) => setTierIcons(d.tierIcons)).catch(() => {});
    loadState();
    isOverlayVisible().then(setOverlayOpen).catch(() => {});
    getOverlayEditMode().then(setInEditMode).catch(() => {});

    const unlisten = listen<boolean>('overlay-edit-mode-changed', (event) => {
      setInEditMode(event.payload);
      if (event.payload) setOverlayOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [loadState]);

  // Always automatically sync live match state in the background
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLiveMatchState().then(setMatchState).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOverlay = async () => {
    const isVis = await isOverlayVisible();
    if (isVis) {
      await hideOverlay();
      setOverlayOpen(false);
      if (inEditMode) {
        await setOverlayEditMode(false);
        setInEditMode(false);
      }
    } else {
      await showOverlay();
      setOverlayOpen(true);
    }
  };

  const handleToggleEditMode = async () => {
    const next = !inEditMode;
    await setOverlayEditMode(next);
    setInEditMode(next);
    setOverlayOpen(true);
  };

  const isLive = matchState && matchState.phase !== 'idle';

  return (
    <div className="h-full min-h-0 flex flex-col gap-3.5 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar px-4 sm:px-6 py-3.5 pb-10">
      {/* Top Header & Actions Bar */}
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-xs font-mono font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-m3-mint animate-pulse' : 'bg-m3-outline'
              }`}
            />
            <span className={isLive ? 'text-m3-mint' : 'text-m3-outline'}>
              {matchState?.phase === 'coregame'
                ? 'IN MATCH'
                : matchState?.phase === 'pregame'
                ? 'AGENT SELECT'
                : 'IDLE / NO MATCH'}
            </span>
          </div>

          {matchState?.mapName && matchState.phase !== 'idle' && (
            <span className="text-xs font-display font-bold text-m3-on-surface">
              {matchState.mapName} • {matchState.mode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={loadState}
            disabled={loading}
            className="h-8 px-3 rounded-xl bg-m3-surface-container hover:bg-m3-surface-container-high border border-m3-outline-subtle text-xs font-semibold text-m3-on-surface flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-m3-primary' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleToggleEditMode}
            className={`h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              inEditMode
                ? 'bg-m3-mint text-zinc-950 border-transparent shadow-md'
                : 'bg-m3-surface-container hover:bg-m3-surface-container-high border-m3-primary/40 text-m3-primary'
            }`}
          >
            {inEditMode ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{inEditMode ? 'Lock HUD (Play Mode)' : 'Edit In-Game HUD'}</span>
          </button>

          <button
            onClick={handleToggleOverlay}
            className={`h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              overlayOpen
                ? 'bg-m3-coral/15 border-m3-coral/40 text-m3-coral hover:bg-m3-coral/25'
                : 'bg-m3-surface-container hover:bg-m3-surface-container-high border-m3-outline-subtle text-m3-on-surface'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{overlayOpen ? 'Close Overlay' : 'Open Overlay'}</span>
          </button>
        </div>
      </div>

      {/* In-Game HUD Widgets Control Ribbon */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-m3-surface-container-low border border-m3-outline-subtle flex-wrap gap-2.5 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-display font-extrabold text-m3-on-surface flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-m3-primary" />
            <span>In-Game HUD Widgets</span>
          </span>
          <span className="text-[11px] text-m3-outline hidden lg:inline">
            {inEditMode
              ? 'HUD unlocked: drag widgets directly on your game screen, then click "Lock HUD".'
              : 'Choose which widgets to display over Valorant.'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          <button
            type="button"
            onClick={() => updateOverlayCfg({ ...overlayCfg, showRank: !overlayCfg.showRank })}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
              overlayCfg.showRank
                ? 'bg-m3-primary/20 border-m3-primary text-m3-primary font-bold'
                : 'bg-m3-surface-container border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Rank & RR</span>
          </button>

          <button
            type="button"
            onClick={() => updateOverlayCfg({ ...overlayCfg, showLobby: !overlayCfg.showLobby })}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
              overlayCfg.showLobby
                ? 'bg-m3-primary/20 border-m3-primary text-m3-primary font-bold'
                : 'bg-m3-surface-container border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Lobby Radar</span>
          </button>

          <button
            type="button"
            onClick={() => updateOverlayCfg({ ...overlayCfg, showKpi: !overlayCfg.showKpi })}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
              overlayCfg.showKpi
                ? 'bg-m3-primary/20 border-m3-primary text-m3-primary font-bold'
                : 'bg-m3-surface-container border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Stats</span>
          </button>

          <button
            type="button"
            onClick={() => updateOverlayCfg({ ...overlayCfg, showDisplay: !overlayCfg.showDisplay })}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
              overlayCfg.showDisplay
                ? 'bg-m3-primary/20 border-m3-primary text-m3-primary font-bold'
                : 'bg-m3-surface-container border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Res Tag</span>
          </button>

          <button
            type="button"
            onClick={() => updateOverlayCfg(DEFAULT_OVERLAY_CONFIG)}
            className="h-7 px-2.5 rounded-xl bg-m3-surface-container hover:bg-m3-surface-container-high border border-m3-outline-subtle text-xs text-m3-outline hover:text-m3-on-surface flex items-center gap-1 cursor-pointer ml-1"
            title="Reset default positions"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Pos</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {!isLive ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-3xl bg-m3-surface-container-low border border-m3-outline-subtle text-center">
          <div className="w-16 h-16 rounded-3xl bg-m3-surface-container-high border border-m3-outline-subtle flex items-center justify-center text-m3-outline mb-3">
            <Radio className="w-8 h-8 animate-pulse text-m3-primary" />
          </div>
          <h3 className="font-display font-bold text-lg text-m3-on-surface">
            Waiting for Valorant Match
          </h3>
          <p className="text-xs text-m3-outline max-w-sm mt-1 mb-4 leading-relaxed">
            Queue into Agent Select or an active game. Aspect detects lobby players and pulls ranks, RR, and top agents live.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-m3-outline font-medium bg-m3-surface-container px-3 py-1.5 rounded-xl border border-m3-outline-subtle">
            <Shield className="w-3.5 h-3.5 text-m3-mint" />
            <span>100% Vanguard Safe • Zero DLL / Game Memory Injections</span>
          </div>
        </div>
      ) : matchState.isDeathmatch ? (
        /* Deathmatch / Free For All: No teams */
        <div className="flex flex-col gap-4">
          <TeamSection
            title={`Free For All • Deathmatch (${matchState.blueTeam.length + matchState.redTeam.length} Players)`}
            color="border-m3-gold/40"
            tagColor="bg-m3-gold/15 text-m3-gold border-m3-gold/30"
            players={[...matchState.blueTeam, ...matchState.redTeam]}
            tierIcons={tierIcons}
          />
        </div>
      ) : (
        /* Standard 5v5 Modes: Attackers & Defenders */
        <div className="flex flex-col gap-4">
          {/* Attackers */}
          <TeamSection
            title={`Attackers ${matchState.blueTeam.some((p) => p.isMe) ? '(Your Team)' : '(Enemy Team)'}`}
            color="border-m3-coral/40"
            tagColor="bg-m3-coral/15 text-m3-coral border-m3-coral/30"
            players={matchState.blueTeam}
            tierIcons={tierIcons}
          />

          {/* Defenders */}
          {matchState.phase === 'coregame' ? (
            <TeamSection
              title={`Defenders ${matchState.redTeam.some((p) => p.isMe) ? '(Your Team)' : '(Enemy Team)'}`}
              color="border-m3-mint/40"
              tagColor="bg-m3-mint/15 text-m3-mint border-m3-mint/30"
              players={matchState.redTeam}
              tierIcons={tierIcons}
            />
          ) : (
            <div className="p-4 rounded-2xl bg-m3-surface-container border border-m3-outline-subtle text-center text-xs text-m3-outline flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-m3-outline" />
              <span>Opponent team details are hidden by Riot during Agent Select to prevent queue dodging.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TeamSection: React.FC<{
  title: string;
  color: string;
  tagColor: string;
  players: LiveMatchPlayer[];
  tierIcons: Record<number, string>;
}> = ({ title, tagColor, players, tierIcons }) => (
  <section className="rounded-3xl bg-m3-surface-container-low border border-m3-outline-subtle p-3.5 shadow-m3-1 flex flex-col gap-2.5">
    <div className="flex items-center justify-between px-1">
      <span className={`text-[11px] font-bold font-display px-2.5 py-0.5 rounded-full border ${tagColor}`}>
        {title}
      </span>
      <span className="text-[10px] font-mono text-m3-outline">
        {players.length} Players
      </span>
    </div>

    <div className="grid grid-cols-1 gap-1.5">
      {players.map((p) => {
        const icon = tierIcons[p.tier];
        const peakIcon = tierIcons[p.peakTier];

        return (
          <div
            key={p.puuid}
            className={`rounded-2xl border px-3 py-2 flex items-center gap-3 transition-colors ${
              p.isMe
                ? 'bg-m3-primary/10 border-m3-primary/40 shadow-xs'
                : 'bg-m3-surface-container border-m3-outline-subtle hover:bg-m3-surface-container-high'
            }`}
          >
            {/* Agent portrait */}
            {p.agentIcon ? (
              <img
                src={p.agentIcon}
                alt={p.agentName}
                className="w-10 h-10 rounded-xl object-cover bg-m3-surface-container-highest border border-m3-outline-subtle shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-m3-surface-container-highest border border-m3-outline-subtle flex items-center justify-center text-xs font-bold text-m3-outline shrink-0">
                ?
              </div>
            )}

            {/* Name + Tag + Agent */}
            <div className="w-40 sm:w-48 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-extrabold text-sm text-m3-on-surface truncate">
                  {p.name}
                </span>
                {p.tag && (
                  <span className="text-[10px] font-mono text-m3-outline truncate">
                    #{p.tag}
                  </span>
                )}
                {p.isMe && (
                  <span className="px-1.5 py-0.5 rounded-full bg-m3-primary text-m3-on-primary text-[9px] font-black uppercase">
                    You
                  </span>
                )}
              </div>
              <div className="text-[11px] text-m3-outline truncate flex items-center gap-1">
                <span className="font-semibold text-m3-on-surface-variant">{p.agentName}</span>
                {p.agentRole && <span>• {p.agentRole}</span>}
              </div>
            </div>

            {/* Current Rank */}
            <div className="flex items-center gap-2 shrink-0 w-36">
              {icon ? (
                <img src={icon} alt="" className="w-8 h-8 object-contain shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-m3-surface-container-high shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-[11px] font-display font-extrabold text-m3-on-surface leading-tight truncate">
                  {p.rank}
                </span>
                <span className="text-[10px] font-mono text-m3-primary font-bold">
                  {p.rr} RR
                </span>
              </div>
            </div>

            {/* Peak Rank */}
            <div className="hidden sm:flex items-center gap-2 shrink-0 w-36">
              {peakIcon ? (
                <img src={peakIcon} alt="" className="w-7 h-7 object-contain opacity-80 shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-m3-surface-container-high shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-m3-outline">
                  Peak
                </span>
                <span className="text-[11px] font-display font-bold text-m3-on-surface leading-tight truncate">
                  {p.peakRank}
                </span>
              </div>
            </div>

            {/* Account Level */}
            {p.accountLevel > 0 && (
              <div className="hidden md:flex ml-auto items-center px-2 py-0.5 rounded-md bg-m3-surface-container-high border border-m3-outline-subtle text-[10px] font-mono text-m3-outline">
                Lvl {p.accountLevel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </section>
);
