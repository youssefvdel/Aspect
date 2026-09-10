import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  Eye,
  Shield,
  Radio,
  Lock,
} from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer } from '../types';
import { fetchLiveMatchState, gameData } from '../utils/tracker';
import { showOverlay, hideOverlay, isOverlayVisible } from '../utils/ipc';

export const LiveMatchView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [autoPoll, setAutoPoll] = useState(false);

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
  }, [loadState]);

  useEffect(() => {
    if (!autoPoll) return;
    const interval = setInterval(() => {
      fetchLiveMatchState().then(setMatchState).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [autoPoll]);

  const handleToggleOverlay = async () => {
    const isVis = await isOverlayVisible();
    if (isVis) {
      await hideOverlay();
      setOverlayOpen(false);
    } else {
      await showOverlay();
      setOverlayOpen(true);
    }
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
          <label className="flex items-center gap-1.5 text-[11px] text-m3-outline cursor-pointer select-none bg-m3-surface-container px-2.5 py-1.5 rounded-xl border border-m3-outline-subtle">
            <input
              type="checkbox"
              checked={autoPoll}
              onChange={(e) => setAutoPoll(e.target.checked)}
              className="w-3 h-3 rounded accent-m3-primary cursor-pointer"
            />
            <span>Auto-poll</span>
          </label>

          <button
            onClick={loadState}
            disabled={loading}
            className="h-8 px-3 rounded-xl bg-m3-surface-container hover:bg-m3-surface-container-high border border-m3-outline-subtle text-xs font-semibold text-m3-on-surface flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-m3-primary' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleToggleOverlay}
            className={`h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              overlayOpen
                ? 'bg-m3-coral/15 border-m3-coral/40 text-m3-coral hover:bg-m3-coral/25'
                : 'bg-m3-primary text-m3-on-primary border-transparent hover:bg-m3-primary/90'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{overlayOpen ? 'Close In-Game Overlay' : 'Open In-Game Overlay'}</span>
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
      ) : (
        <div className="flex flex-col gap-4">
          {/* Blue Team (Allies) */}
          <TeamSection
            title="Team Blue (Your Squad)"
            color="border-blue-500/40"
            tagColor="bg-blue-500/10 text-blue-300 border-blue-500/30"
            players={matchState.blueTeam}
            tierIcons={tierIcons}
          />

          {/* Red Team (Opponents) */}
          {matchState.phase === 'coregame' ? (
            <TeamSection
              title="Team Red (Opponents)"
              color="border-red-500/40"
              tagColor="bg-red-500/10 text-red-300 border-red-500/30"
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
