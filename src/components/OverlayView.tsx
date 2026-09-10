import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Lock,
  MousePointer,
} from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer } from '../types';
import { fetchLiveMatchState, gameData } from '../utils/tracker';
import { hideOverlay, setOverlayClickthrough } from '../utils/ipc';

export const OverlayView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [minimized, setMinimized] = useState(false);
  const [clickThrough, setClickThrough] = useState(true);

  // Poll live match state every 3.5 seconds
  useEffect(() => {
    gameData().then((d) => setTierIcons(d.tierIcons)).catch(() => {});
    const tick = () => {
      fetchLiveMatchState().then(setMatchState).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 3500);
    return () => clearInterval(id);
  }, []);

  // Ensure click-through is enabled in native Win32 window style
  useEffect(() => {
    setOverlayClickthrough(clickThrough).catch(() => {});
  }, [clickThrough]);

  const isLive = matchState && matchState.phase !== 'idle';

  return (
    <div className="w-screen h-screen bg-transparent select-none overflow-hidden p-4 sm:p-6 flex flex-col justify-between pointer-events-none font-sans">
      {/* Top Floating Control Bar */}
      <div className="flex items-center justify-between gap-3 w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Phase Badge */}
          <div className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xl">
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-m3-mint animate-pulse' : 'bg-m3-outline'
              }`}
            />
            <span className={isLive ? 'text-m3-mint' : 'text-zinc-400'}>
              {matchState?.phase === 'coregame'
                ? 'LIVE MATCH'
                : matchState?.phase === 'pregame'
                ? 'AGENT SELECT'
                : 'WAITING FOR GAME'}
            </span>
            {matchState?.mapName && matchState.phase !== 'idle' && (
              <span className="text-white ml-1.5">
                • {matchState.mapName}
              </span>
            )}
          </div>

          {/* Click-Through Status Chip */}
          <button
            onClick={() => setClickThrough((prev) => !prev)}
            title={
              clickThrough
                ? 'Clicks pass through to Valorant (Aim safe). Click to make overlay interactive.'
                : 'Overlay is interactive. Click to restore in-game click pass-through.'
            }
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors shadow-2xl ${
              clickThrough
                ? 'bg-black/70 border-m3-mint/40 text-m3-mint hover:bg-black/90'
                : 'bg-m3-primary/90 text-m3-on-primary border-transparent'
            }`}
          >
            {clickThrough ? (
              <>
                <Shield className="w-3 h-3 text-m3-mint" />
                <span>Pass-Through ON (Safe)</span>
              </>
            ) : (
              <>
                <MousePointer className="w-3 h-3" />
                <span>Interactive</span>
              </>
            )}
          </button>
        </div>

        {/* Min / Close controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="w-7 h-7 rounded-full bg-black/75 hover:bg-black/95 border border-white/10 text-white flex items-center justify-center cursor-pointer shadow-2xl"
          >
            {minimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={() => hideOverlay()}
            className="h-7 px-2.5 rounded-full bg-black/75 hover:bg-red-500/80 border border-white/10 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xl"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hide</span>
          </button>
        </div>
      </div>

      {/* Center Body: 5v5 Live Match HUD */}
      <AnimatePresence>
        {!minimized && isLive && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="w-full max-w-6xl mx-auto my-auto grid grid-cols-1 md:grid-cols-2 gap-4 pointer-events-auto"
          >
            {/* Team Blue */}
            <OverlaySquadCard
              title="Team Blue"
              tagColor="bg-blue-500/20 text-blue-300 border-blue-500/40"
              players={matchState.blueTeam}
              tierIcons={tierIcons}
            />

            {/* Team Red */}
            {matchState.phase === 'coregame' ? (
              <OverlaySquadCard
                title="Team Red"
                tagColor="bg-red-500/20 text-red-300 border-red-500/40"
                players={matchState.redTeam}
                tierIcons={tierIcons}
              />
            ) : (
              <div className="rounded-3xl bg-black/80 backdrop-blur-xl border border-white/10 p-6 flex flex-col items-center justify-center text-center shadow-2xl">
                <Lock className="w-8 h-8 text-zinc-500 mb-2" />
                <h4 className="font-display font-bold text-sm text-white">Enemy Team Hidden</h4>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                  Riot protects opponent identities during Agent Select. Full enemy roster appears automatically on map load.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom status slot */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-[10px] text-zinc-400">
        <span>Aspect In-Game HUD</span>
        <span>Press Hide or Close in Aspect to dismiss</span>
      </div>
    </div>
  );
};

const OverlaySquadCard: React.FC<{
  title: string;
  tagColor: string;
  players: LiveMatchPlayer[];
  tierIcons: Record<number, string>;
}> = ({ title, tagColor, players, tierIcons }) => (
  <div className="rounded-3xl bg-black/80 backdrop-blur-xl border border-white/10 p-3.5 shadow-2xl flex flex-col gap-2">
    <div className="flex items-center justify-between px-1">
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${tagColor}`}>
        {title}
      </span>
      <span className="text-[10px] font-mono text-zinc-400">
        {players.length} Players
      </span>
    </div>

    <div className="flex flex-col gap-1.5">
      {players.map((p) => {
        const icon = tierIcons[p.tier];
        const peakIcon = tierIcons[p.peakTier];

        return (
          <div
            key={p.puuid}
            className={`rounded-2xl border px-3 py-1.5 flex items-center gap-2.5 transition-all ${
              p.isMe
                ? 'bg-purple-950/40 border-purple-500/50 shadow-sm'
                : 'bg-zinc-900/60 border-white/5'
            }`}
          >
            {/* Agent portrait */}
            {p.agentIcon ? (
              <img
                src={p.agentIcon}
                alt=""
                className="w-8 h-8 rounded-lg object-cover bg-zinc-800 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                ?
              </div>
            )}

            {/* Name + Tag */}
            <div className="w-32 sm:w-40 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-display font-extrabold text-xs text-white truncate">
                  {p.name}
                </span>
                {p.isMe && (
                  <span className="px-1 py-px rounded bg-purple-500 text-[8px] font-black text-white uppercase">
                    You
                  </span>
                )}
              </div>
              <div className="text-[10px] text-zinc-400 truncate">
                {p.agentName}
              </div>
            </div>

            {/* Current Rank */}
            <div className="flex items-center gap-1.5 shrink-0 w-28">
              {icon ? (
                <img src={icon} alt="" className="w-6 h-6 object-contain shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-800 shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white leading-tight truncate">
                  {p.rank}
                </span>
                <span className="text-[9px] font-mono text-purple-300 font-bold">
                  {p.rr} RR
                </span>
              </div>
            </div>

            {/* Peak Rank */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0 ml-auto">
              {peakIcon && (
                <img src={peakIcon} alt="" className="w-5 h-5 object-contain opacity-75 shrink-0" />
              )}
              <span className="text-[9px] font-mono text-zinc-400">
                Peak: {p.peakRank}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
