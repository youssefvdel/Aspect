import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Eye,
  Shield,
  Radio,
  Lock,
  Edit3,
  Check,
  EyeOff,
  Swords,
  Users,
  Clock,
} from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer } from '../types';
import { fetchLiveMatchState, gameData } from '../utils/tracker';
import { useTrackerData } from '../hooks/useTrackerData';
import { ScoreBadge, scoreTier } from './ScoreBadge';
import {
  getFlagUrl,
  rankTooltip,
  shortAct,
  formatKd,
  recentLabel,
  getPartyStyle,
  splitTeams,
  byAcsDesc,
  queueLabel,
} from '../utils/playerDisplay';
import { showOverlay, hideOverlay, isOverlayVisible, setOverlayEditMode, getOverlayEditMode } from '../utils/ipc';
import { listen } from '@tauri-apps/api/event';

/* In-app Live Match page.

   IMPORTANT — data honesty:
   Riot's local client API exposes the live match LOBBY (who is in it, their
   ranks, agent picks, party grouping) but NO live combat data. There is no
   endpoint, log line, or local socket carrying current-match kills, deaths,
   round score, or in-match headshot %. Verified against the live payload, the
   official endpoint schema, and the game's own log files.

   So every number on this page is act/career aggregate from Riot + Tracker.gg,
   never a fabricated "current match" figure. The column header says so
   explicitly. Live combat stats would require Overwolf's Game Events Provider
   (a licensed Overwolf-only API) or screen OCR — see ROADMAP.md. */

export const LiveMatchView: React.FC = () => {
  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [inEditMode, setInEditMode] = useState(false);

  // Act labels for the peak-act caption under the peak emblem.
  const { seasonNames } = useTrackerData();

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

  // Background live sync: paused while the app is hidden (in-game the main
  // window sits in the tray/background — no point re-rendering tables).
  useEffect(() => {
    const poll = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchLiveMatchState().then(setMatchState).catch(() => {});
    };
    const interval = setInterval(poll, 8000);
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

  // Your team / enemy team, with Deathmatch flattened into one FFA board.
  const teams = useMemo(
    () =>
      matchState
        ? splitTeams({
            isDeathmatch: matchState.isDeathmatch,
            blueTeam: matchState.blueTeam,
            redTeam: matchState.redTeam,
          })
        : { yours: [], theirs: [], isFfa: false },
    [matchState]
  );

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

      {/* Match status strip — what Riot actually tells us about the live game. */}
      {isLive && matchState && (
        <MatchStatusStrip state={matchState} />
      )}

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
            Queue into Agent Select or an active game. Recon detects lobby players and pulls ranks, RR, and top agents live.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-m3-outline font-medium bg-m3-surface-container px-3 py-1.5 rounded-xl border border-m3-outline-subtle">
            <Shield className="w-3.5 h-3.5 text-m3-mint" />
            <span>100% Vanguard Safe • Zero DLL / Game Memory Injections</span>
          </div>
        </div>
      ) : teams.isFfa ? (
        <PlayerTable
          title={`Free For All • Deathmatch (${teams.yours.length} Players)`}
          accent="gold"
          players={teams.yours}
          tierIcons={tierIcons}
          seasonNames={seasonNames}
          queueId={matchState?.queueId}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <PlayerTable
            title="Your Team"
            accent="primary"
            players={teams.yours}
            tierIcons={tierIcons}
            seasonNames={seasonNames}
            queueId={matchState?.queueId}
          />

          {matchState.phase === 'coregame' ? (
            <PlayerTable
              title="Enemy Team"
              accent="coral"
              players={teams.theirs}
              tierIcons={tierIcons}
              seasonNames={seasonNames}
              queueId={matchState?.queueId}
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

/* ------------------------------------------------------------------ */
/* Live match status strip                                             */
/* ------------------------------------------------------------------ */

const MatchStatusStrip: React.FC<{
  state: LiveMatchState;
}> = ({ state }) => {
  const units = (n: number) => `${n} Player${n === 1 ? '' : 's'}`;

  return (
    <section className="rounded-2xl bg-m3-surface-container-low border border-m3-outline-subtle px-3.5 py-2.5 flex items-center gap-x-4 gap-y-2 flex-wrap text-[11px]">
      <span className="flex items-center gap-1.5 font-mono text-m3-outline">
        <Swords className="w-3.5 h-3.5 text-m3-primary" />
        <span className="font-bold text-m3-on-surface">{state.mapName || 'Unknown map'}</span>
        <span>•</span>
        <span>{state.mode}</span>
      </span>

      {state.startingSide && !state.isDeathmatch && (
        <span className="flex items-center gap-1.5 font-mono text-m3-outline">
          <span className="text-m3-outline">Starting side</span>
          <span
            className={`px-1.5 py-px rounded font-bold ${
              state.startingSide === 'Attack'
                ? 'bg-m3-coral/15 text-m3-coral border border-m3-coral/30'
                : 'bg-m3-mint/15 text-m3-mint border border-m3-mint/30'
            }`}
          >
            {state.startingSide}
          </span>
        </span>
      )}

      <span className="flex items-center gap-1.5 font-mono text-m3-outline">
        <Users className="w-3.5 h-3.5" />
        <span>{units(state.blueTeam.length + state.redTeam.length)} in lobby</span>
      </span>

      <span className="flex items-center gap-1.5 font-mono text-m3-outline ml-auto">
        <Clock className="w-3.5 h-3.5" />
        <span>synced {new Date(state.updatedAt || Date.now()).toLocaleTimeString()}</span>
      </span>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Player table — mirrors the Agent Select widget's columns            */
/* ------------------------------------------------------------------ */

const GRID = 'grid grid-cols-[32px_1fr_40px_40px_52px_48px_54px_48px_74px_52px] items-center gap-x-1';

const ACCENTS: Record<string, { tag: string; border: string }> = {
  primary: { tag: 'bg-m3-primary/15 text-m3-primary border-m3-primary/30', border: 'border-m3-primary/25' },
  coral: { tag: 'bg-m3-coral/15 text-m3-coral border-m3-coral/30', border: 'border-m3-coral/25' },
  gold: { tag: 'bg-m3-gold/15 text-m3-gold border-m3-gold/30', border: 'border-m3-gold/25' },
};

const PlayerTable: React.FC<{
  title: string;
  accent: keyof typeof ACCENTS;
  players: LiveMatchPlayer[];
  tierIcons: Record<number, string>;
  seasonNames: Record<string, string>;
  /** Queue being played — captions the Last-24h column so it reads mode-scoped. */
  queueId?: string;
}> = ({ title, accent, players, tierIcons, seasonNames, queueId }) => {
  const a = ACCENTS[accent] ?? ACCENTS.primary;
  const scope = queueLabel(queueId);

  return (
    <section
      className={`rounded-3xl bg-m3-surface-container-low border ${a.border} p-3 shadow-m3-1 flex flex-col gap-2`}
    >
      <div className="flex items-center justify-between px-1">
        <span className={`text-[11px] font-bold font-display px-2.5 py-0.5 rounded-full border ${a.tag}`}>
          {title}
        </span>
        <span className="text-[10px] font-mono text-m3-outline">
          {players.length} Players
        </span>
      </div>

      {/* Column headers. Act-wide disclosure is deliberate: Riot exposes no
          live combat stats, so nothing here may imply "this match". */}
      <div
        className={`${GRID} px-2 pb-1 text-[9px] font-mono uppercase tracking-wider text-m3-outline border-b border-m3-outline-subtle`}
      >
        <span className="text-center" title="Tracker Score tier">TS</span>
        <span>Player</span>
        <span className="text-center">Rank</span>
        <span className="text-center" title="Peak rank — the act it was earned in is shown under the emblem">
          Peak
        </span>
        <span className="text-right" title="Act-wide average combat score — the column this board is sorted by">
          ACS
        </span>
        <span className="text-right" title="Act-wide K/D (Riot exposes no live kill data)">K/D</span>
        <span className="text-right" title="Act-wide win rate">Win%</span>
        <span className="text-right" title="Act-wide headshot %">HS%</span>
        <span
          className="text-right"
          title={scope ? `Wins/losses in the last 24 hours — ${scope} games only` : 'Wins/losses in the last 24 hours'}
        >
          {scope ? `24h ${scope}` : 'Last 24h'}
        </span>
        <span className="text-right">Lvl</span>
      </div>

      <div className="flex flex-col gap-1">
        {[...players].sort(byAcsDesc).map((p) => (
          <PlayerRow key={p.puuid} p={p} tierIcons={tierIcons} seasonNames={seasonNames} />
        ))}
        {players.length === 0 && (
          <div className="px-2 py-3 text-center text-[11px] text-m3-outline font-mono">
            No players detected yet.
          </div>
        )}
      </div>
    </section>
  );
};

const PlayerRow: React.FC<{
  p: LiveMatchPlayer;
  tierIcons: Record<number, string>;
  seasonNames: Record<string, string>;
}> = ({ p, tierIcons, seasonNames }) => {
  const rankIcon = tierIcons[p.tier];
  const peakIcon = tierIcons[p.peakTier];
  const kd = formatKd(p.kd);
  const recent = recentLabel(p);
  const party = getPartyStyle(p.partyIndex);
  const flagUrl = getFlagUrl(p.country);
  const actLabel = p.peakSeasonId ? seasonNames[p.peakSeasonId] : undefined;

  return (
    <div
      className={`${GRID} relative overflow-hidden rounded-2xl border px-2 py-1.5 transition-colors ${
        party
          ? `${party.bg} border-m3-outline-subtle/40`
          : p.isMe
          ? 'bg-m3-primary/10 border-m3-primary/40 shadow-xs'
          : 'bg-m3-surface-container border-m3-outline-subtle hover:bg-m3-surface-container-high'
      }`}
    >
      {party && (
        <div
          className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full ${party.bar}`}
          title={`Queued together in ${party.name}`}
        />
      )}
      {/* Tracker Score badge (hex tier emblem, never a raw number) */}
      <div
        className="flex items-center justify-center"
        title={
          p.trnScore != null
            ? `Tracker Score: ${p.trnScore} / 1000 — Tier ${scoreTier(p.trnScore).tier}`
            : 'Tracker Score unavailable'
        }
      >
        {p.trnScore != null ? (
          <ScoreBadge tier={scoreTier(p.trnScore).tier} size={24} />
        ) : (
          <span className="w-6 h-6 rounded-md border border-m3-outline-subtle bg-m3-surface-container flex items-center justify-center text-[9px] font-mono text-m3-outline">
            —
          </span>
        )}
      </div>

      {/* Agent portrait + flag, name, badges */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative shrink-0">
          {p.agentIcon ? (
            <img
              src={p.agentIcon}
              alt={p.agentName}
              className="w-8 h-8 rounded-xl object-cover bg-m3-surface-container-highest border border-m3-outline-subtle"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-m3-surface-container-highest border border-m3-outline-subtle flex items-center justify-center text-xs font-bold text-m3-outline">
              ?
            </div>
          )}
          {flagUrl && (
            <img
              src={flagUrl}
              alt={p.country || ''}
              title={`Country: ${p.country}`}
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-2.5 object-cover rounded-[2px] border border-m3-surface shadow-sm"
            />
          )}
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 min-w-0">
            {party && (
              <span
                className={`w-2 h-2 rounded-full ${party.bar} shrink-0 shadow-xs`}
                title={`Queued together in ${party.name}`}
              />
            )}
            <span
              className="font-display font-extrabold text-[12px] text-m3-on-surface truncate"
              title={`${p.name}${p.tag ? '#' + p.tag : ''}`}
            >
              {p.name}
            </span>
            {p.tag && (
              <span className="text-[9px] font-mono text-m3-outline truncate">#{p.tag}</span>
            )}
            {p.isMe && (
              <span className="px-1 py-px rounded bg-m3-primary text-m3-on-primary text-[8px] font-black uppercase shrink-0">
                You
              </span>
            )}
            {p.isIncognito && (
              <span
                className="flex items-center gap-0.5 px-1 py-px rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[8px] font-mono font-bold uppercase shrink-0"
                title={
                  p.nameResolved
                    ? 'Name hidden in Valorant — unmasked by Recon from account UUID'
                    : 'Riot hides this name during live matches — revealed automatically after the game'
                }
              >
                <EyeOff className="w-2.5 h-2.5" />
                {p.nameResolved ? 'Unmasked' : 'Hidden'}
              </span>
            )}
          </div>
          <div className="text-[10px] text-m3-outline truncate flex items-center gap-1">
            <span className="font-semibold text-m3-on-surface-variant truncate">
              {p.agentName}
            </span>
            {p.agentRole && <span className="truncate">• {p.agentRole}</span>}
          </div>
        </div>
      </div>

      {/* Current rank — emblem only, per the "no rank text" rule */}
      <div className="flex items-center justify-center" title={rankTooltip(p, actLabel)}>
        {rankIcon ? (
          <img src={rankIcon} alt={p.rank} className="w-8 h-8 object-contain" />
        ) : (
          <span className="text-[9px] font-mono text-m3-outline">—</span>
        )}
      </div>

      {/* Peak rank — emblem with the act it was earned in beneath it */}
      <div
        className="flex flex-col items-center justify-center"
        title={p.peakTier > 0 ? `Peak ${p.peakRank}${actLabel ? ` (${shortAct(actLabel)})` : ''}` : 'Peak unavailable'}
      >
        {peakIcon ? (
          <img src={peakIcon} alt={p.peakRank} className="w-7 h-7 object-contain opacity-90" />
        ) : (
          <span className="text-[9px] font-mono text-m3-outline">—</span>
        )}
        {p.peakSeasonId && actLabel && (
          <span className="text-[7px] font-mono text-m3-outline leading-none mt-px">
            {shortAct(actLabel)}
          </span>
        )}
      </div>

      {/* ACS — the sort key, so it reads first among the numbers */}
      <div className="text-right font-mono text-[11px] font-bold" title="Act-wide average combat score">
        {p.acs != null ? (
          <span className={p.acs >= 200 ? 'text-m3-primary' : p.acs >= 150 ? 'text-m3-on-surface' : 'text-m3-outline'}>
            {p.acs}
          </span>
        ) : (
          <span className="text-m3-outline">—</span>
        )}
      </div>

      {/* K/D */}
      <div className="text-right font-mono text-[11px] font-bold" title="Act-wide K/D">
        <span className={kd.color}>{kd.text}</span>
      </div>

      {/* Win % */}
      <div className="text-right font-mono text-[11px]" title="Act-wide win rate">
        {p.winPct != null ? (
          <span className={p.winPct >= 50 ? 'text-m3-mint font-semibold' : 'text-rose-400'}>
            {p.winPct.toFixed(0)}%
          </span>
        ) : (
          <span className="text-m3-outline">—</span>
        )}
      </div>

      {/* HS % */}
      <div className="text-right font-mono text-[11px] text-amber-500" title="Act-wide headshot %">
        {p.hsPct != null && p.hsPct > 0 ? `${p.hsPct.toFixed(0)}%` : <span className="text-m3-outline">—</span>}
      </div>

      {/* Last 24h W/L */}
      <div className="text-right font-mono text-[10px]" title="Wins / losses in the last 24 hours">
        {recent ? <span className={recent.color}>{recent.text}</span> : <span className="text-m3-outline">—</span>}
      </div>

      {/* Account level */}
      <div className="text-right font-mono text-[10px] text-m3-outline" title="Account level">
        {p.accountLevel > 0 ? p.accountLevel : '—'}
      </div>
    </div>
  );
};
