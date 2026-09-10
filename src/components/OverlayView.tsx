import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  EyeOff,
  Lock,
  Edit3,
  Check,
  Sliders,
  Move,
  Trophy,
  Users,
  BarChart2,
  Tv,
} from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer, TrackerProfile } from '../types';
import { fetchLiveMatchState, gameData, detectLocalAccount, detectRegion, fetchMmrDirect } from '../utils/tracker';
import { hideOverlay, setOverlayClickthrough, fetchDisplayInfo } from '../utils/ipc';

interface WidgetConfig {
  showRank: boolean;
  showLobby: boolean;
  showKpi: boolean;
  showDisplay: boolean;
}

const DEFAULT_CONFIG: WidgetConfig = {
  showRank: true,
  showLobby: true,
  showKpi: false,
  showDisplay: false,
};

export const OverlayView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [profile, setProfile] = useState<TrackerProfile | null>(null);
  const [displayTag, setDisplayTag] = useState<string>('2088×1440 @ 260Hz • 1.45:1');

  // Widget settings
  const [isEditMode, setIsEditMode] = useState(true);
  const [widgets, setWidgets] = useState<WidgetConfig>(() => {
    try {
      const saved = localStorage.getItem('aspect_overlay_widgets_v1');
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const saveWidgets = (next: WidgetConfig) => {
    setWidgets(next);
    try {
      localStorage.setItem('aspect_overlay_widgets_v1', JSON.stringify(next));
    } catch {}
  };

  // Poll live match state ONLY when visible
  useEffect(() => {
    gameData().then((d) => setTierIcons(d.tierIcons)).catch(() => {});
    fetchDisplayInfo().then((info) => {
      setDisplayTag(`${info.current_width}×${info.current_height} @ ${info.current_hz}Hz`);
    }).catch(() => {});

    // Profile data for Rank widget
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
    const id = setInterval(tick, 5000);
    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, []);

  // Update Win32 clickthrough based on edit mode
  // Edit mode = interactive (click-through disabled so user can drag)
  // Play mode = click-through enabled (mouse clicks pass 100% into Valorant)
  useEffect(() => {
    setOverlayClickthrough(!isEditMode).catch(() => {});
  }, [isEditMode]);

  const isLive = matchState && matchState.phase !== 'idle';
  const myPlayer = matchState
    ? [...matchState.blueTeam, ...matchState.redTeam].find((p) => p.isMe)
    : null;

  return (
    <div
      className={`w-screen h-screen select-none overflow-hidden p-4 sm:p-6 flex flex-col justify-between font-sans transition-colors ${
        isEditMode
          ? 'bg-black/35 pointer-events-auto ring-4 ring-m3-primary/30 ring-inset'
          : 'bg-transparent pointer-events-none'
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="flex items-center justify-between gap-3 w-full max-w-6xl mx-auto pointer-events-auto">
        {isEditMode ? (
          /* Edit Mode Toolbar */
          <div className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-m3-primary/50 shadow-2xl flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-primary text-m3-on-primary text-xs font-bold uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5" />
                <span>HUD Edit Mode</span>
              </span>
              <span className="text-xs text-zinc-300 font-medium hidden sm:inline">
                Drag widgets to reposition anywhere on your screen.
              </span>
            </div>

            {/* Widget Toggles */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => saveWidgets({ ...widgets, showRank: !widgets.showRank })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                  widgets.showRank
                    ? 'bg-m3-primary/20 border-m3-primary text-m3-primary'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                <Trophy className="w-3 h-3" />
                <span>Rank</span>
              </button>

              <button
                onClick={() => saveWidgets({ ...widgets, showLobby: !widgets.showLobby })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                  widgets.showLobby
                    ? 'bg-m3-primary/20 border-m3-primary text-m3-primary'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Lobby</span>
              </button>

              <button
                onClick={() => saveWidgets({ ...widgets, showKpi: !widgets.showKpi })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                  widgets.showKpi
                    ? 'bg-m3-primary/20 border-m3-primary text-m3-primary'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                <BarChart2 className="w-3 h-3" />
                <span>Stats</span>
              </button>

              <button
                onClick={() => saveWidgets({ ...widgets, showDisplay: !widgets.showDisplay })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                  widgets.showDisplay
                    ? 'bg-m3-primary/20 border-m3-primary text-m3-primary'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                <Tv className="w-3 h-3" />
                <span>Res</span>
              </button>
            </div>

            {/* Lock / Exit Edit Mode */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditMode(false)}
                className="h-7 px-3.5 rounded-xl bg-m3-mint text-zinc-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer hover:bg-m3-mint/90 shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lock & Play</span>
              </button>

              <button
                onClick={() => hideOverlay()}
                className="w-7 h-7 rounded-xl bg-zinc-800 hover:bg-red-500/80 text-white flex items-center justify-center cursor-pointer"
                title="Hide Overlay"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Play Mode Minimal Badge */
          <div className="w-full flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Unlock Edit Mode Chip */}
              <button
                onClick={() => setIsEditMode(true)}
                className="px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5 cursor-pointer shadow-xl transition-all"
                title="Unlock Edit Mode to move or customize widgets"
              >
                <Edit3 className="w-3 h-3 text-m3-primary" />
                <span>Edit HUD</span>
              </button>

              <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-m3-mint/30 text-[10px] font-mono font-bold text-m3-mint flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>Pass-Through Active</span>
              </span>
            </div>

            <button
              onClick={() => hideOverlay()}
              className="h-6 px-2 rounded-full bg-black/60 hover:bg-red-500/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer pointer-events-auto"
            >
              <EyeOff className="w-3 h-3" />
              <span>Hide</span>
            </button>
          </div>
        )}
      </div>

      {/* Draggable Widgets Workspace */}
      <div className="relative flex-1 w-full h-full min-h-0 pointer-events-none my-2">
        {/* WIDGET 1: Rank & RR Widget */}
        {widgets.showRank && (
          <motion.div
            drag={isEditMode}
            dragMomentum={false}
            className={`absolute top-4 left-4 pointer-events-auto ${
              isEditMode ? 'cursor-move ring-2 ring-m3-primary/60 ring-dashed p-1 rounded-3xl' : ''
            }`}
          >
            <div className="rounded-2xl bg-black/85 backdrop-blur-xl border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-3">
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
              {isEditMode && <Move className="w-3.5 h-3.5 text-m3-primary opacity-60 ml-2" />}
            </div>
          </motion.div>
        )}

        {/* WIDGET 2: Display & Stretched Tag */}
        {widgets.showDisplay && (
          <motion.div
            drag={isEditMode}
            dragMomentum={false}
            className={`absolute top-4 right-4 pointer-events-auto ${
              isEditMode ? 'cursor-move ring-2 ring-m3-primary/60 ring-dashed p-1 rounded-2xl' : ''
            }`}
          >
            <div className="rounded-xl bg-black/85 backdrop-blur-xl border border-white/10 px-3 py-1.5 shadow-2xl flex items-center gap-2 text-xs font-mono text-white">
              <span className="w-2 h-2 rounded-full bg-m3-mint animate-pulse" />
              <span>{displayTag}</span>
              {isEditMode && <Move className="w-3 h-3 text-m3-primary opacity-60 ml-1" />}
            </div>
          </motion.div>
        )}

        {/* WIDGET 3: Performance KPI */}
        {widgets.showKpi && profile && (
          <motion.div
            drag={isEditMode}
            dragMomentum={false}
            className={`absolute bottom-4 left-4 pointer-events-auto ${
              isEditMode ? 'cursor-move ring-2 ring-m3-primary/60 ring-dashed p-1 rounded-2xl' : ''
            }`}
          >
            <div className="rounded-2xl bg-black/85 backdrop-blur-xl border border-white/10 px-3.5 py-2 shadow-2xl flex items-center gap-4 text-xs font-mono">
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
              {isEditMode && <Move className="w-3.5 h-3.5 text-m3-primary opacity-60 ml-1" />}
            </div>
          </motion.div>
        )}

        {/* WIDGET 4: Live Match Lobby Radar */}
        {widgets.showLobby && isLive && (
          <motion.div
            drag={isEditMode}
            dragMomentum={false}
            className={`absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-4xl pointer-events-auto ${
              isEditMode ? 'cursor-move ring-2 ring-m3-primary/60 ring-dashed p-1.5 rounded-3xl' : ''
            }`}
          >
            <div className="rounded-3xl bg-black/90 backdrop-blur-2xl border border-white/10 p-3 shadow-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-display font-extrabold text-white">
                    {matchState.mapName} • {matchState.mode}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-m3-primary/20 text-m3-primary text-[10px] font-mono font-bold">
                    {matchState.phase === 'coregame' ? 'LIVE' : 'AGENT SELECT'}
                  </span>
                </div>
                {isEditMode && (
                  <span className="text-[10px] font-mono text-m3-primary flex items-center gap-1">
                    <Move className="w-3 h-3" /> Drag to move
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
          </motion.div>
        )}
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-[10px] text-zinc-500 pointer-events-none">
        <span>Aspect In-Game HUD</span>
        {isEditMode ? (
          <span className="text-m3-primary font-semibold">Click "Lock & Play" to enable pass-through mode</span>
        ) : (
          <span>Click "Edit HUD" anytime to customize</span>
        )}
      </div>
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
