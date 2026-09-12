import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Shield,
  Radio,
  Lock,
  EyeOff,
  Swords,
  Users,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { LiveMatchState, LiveMatchPlayer } from '../types';
import { fetchLiveMatchState, gameData, matchEndHarvest, harvestMatchNames, fetchMatchLoadouts } from '../utils/tracker';
import {
  loadWeaponCatalog,
  parseLoadouts,
  resolveLoadoutForPlayer,
  type PlayerLoadout,
} from '../utils/loadout';
import { LoadoutViewer } from './LoadoutViewer';
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
import { isTauri } from '../utils/ipc';
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
  // Loadout viewer — Riot only serves equipped skins while a match is live, so
  // the data is fetched on demand rather than polled with the rest of the HUD.
  const [loadoutFor, setLoadoutFor] = useState<LiveMatchPlayer | null>(null);
  const [loadoutData, setLoadoutData] = useState<PlayerLoadout | null>(null);
  const [loadoutLoading, setLoadoutLoading] = useState(false);
  const [loadoutAmbiguous, setLoadoutAmbiguous] = useState(false);
  const [loadoutReason, setLoadoutReason] = useState<string | null>(null);
  const [tierIcons, setTierIcons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const prevStateRef = useRef<LiveMatchState | null>(null);

  // Act labels for the peak-act caption under the peak emblem.
  const { seasonNames } = useTrackerData();

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchLiveMatchState(undefined, true);
      setMatchState(s);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    gameData().then((d) => setTierIcons(d.tierIcons)).catch(() => {});
    loadState();
  }, [loadState]);

  // Background live sync: synchronized with in-game overlay via events,
  // refreshed instantly on focus/visibility, and polled in background.
  useEffect(() => {
    const poll = () => {
      fetchLiveMatchState()
        .then((s) => {
          // Match just ended: hidden names are released by Riot only now.
          const harvest = matchEndHarvest(prevStateRef.current, s);
          if (harvest) harvestMatchNames(harvest).catch(() => {});
          prevStateRef.current = s;
          setMatchState(s);
        })
        .catch(() => {});
    };

    const onGlobalRefresh = () => {
      fetchLiveMatchState(undefined, true)
        .then((s) => {
          prevStateRef.current = s;
          setMatchState(s);
        })
        .catch(() => {});
    };
    window.addEventListener('recon:global-refresh', onGlobalRefresh);

    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) poll();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', onVis);
    }

    const unlistenSync = isTauri()
      ? listen<LiveMatchState>('recon:live-match-sync', (event) => {
          if (event.payload) {
            const s = event.payload;
            const harvest = matchEndHarvest(prevStateRef.current, s);
            if (harvest) harvestMatchNames(harvest).catch(() => {});
            prevStateRef.current = s;
            setMatchState(s);
          }
        })
      : null;

    const interval = setInterval(poll, 6000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('recon:global-refresh', onGlobalRefresh);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', onVis);
      }
      unlistenSync?.then((fn) => fn()).catch(() => {});
    };
  }, []);

  /**
   * Open a player's loadout.
   *
   * Riot serves equipped skins only from the in-progress match route, so this
   * needs a live `matchId`. Pre-match the endpoint returns nothing, and the
   * viewer says so rather than rendering an empty grid as if it were real.
   */
  const openLoadout = useCallback(
    async (p: LiveMatchPlayer) => {
      setLoadoutFor(p);
      setLoadoutData(null);
      setLoadoutAmbiguous(false);
      setLoadoutReason(null);

      const matchId = matchState?.matchId ?? '';
      if (!matchId || matchState?.phase !== 'coregame') {
        setLoadoutReason(
          matchState?.phase === 'pregame'
            ? 'Loadouts only become available once the match is in progress (not during agent select).'
            : 'Loadouts are available only while a match is in progress.'
        );
        return;
      }

      setLoadoutLoading(true);
      try {
        const region = (p.region || 'eu').replace(/[0-9]+$/, '').toLowerCase();
        const [raw, catalog] = await Promise.all([
          fetchMatchLoadouts(matchId, region),
          loadWeaponCatalog(),
        ]);
        const all = parseLoadouts(raw, catalog);
        if (all.length === 0) {
          setLoadoutReason('Riot returned no loadout data for this match yet.');
          return;
        }
        const teammates = [...(matchState?.blueTeam ?? []), ...(matchState?.redTeam ?? [])];
        const index = teammates.findIndex((t) => t.puuid === p.puuid);
        const { loadout, ambiguous } = resolveLoadoutForPlayer(all, {
          puuid: p.puuid,
          characterId: p.agentId,
          index: index >= 0 ? index : undefined,
        });
        setLoadoutAmbiguous(ambiguous);
        if (!loadout) {
          setLoadoutReason(
            'No loadout entry matched this player. Riot keys loadouts by agent, so duplicate agents can make the match ambiguous.'
          );
          return;
        }
        setLoadoutData(loadout);
      } catch {
        setLoadoutReason('Could not read the loadout from the Riot client.');
      } finally {
        setLoadoutLoading(false);
      }
    },
    [matchState]
  );

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
    <div className="h-full min-h-0 flex flex-col justify-start gap-2.5 max-w-6xl mx-auto w-full overflow-hidden px-6 pt-3 pb-6 select-none">
      {/* Consolidated Live Match Status Bar */}
      {isLive && matchState && (
        <MatchStatusStrip
          state={matchState}
          onRefresh={loadState}
          refreshing={loading}
        />
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
          hideHeader
          accent="gold"
          players={teams.yours}
          tierIcons={tierIcons}
          seasonNames={seasonNames}
          queueId={matchState?.queueId}
          onShowLoadout={openLoadout}
        />
      ) : matchState?.isRange ? (
        <PlayerTable
          title="The Range — Practice"
          accent="mint"
          players={teams.yours}
          tierIcons={tierIcons}
          seasonNames={seasonNames}
          queueId={matchState?.queueId}
          onShowLoadout={openLoadout}
        />
      ) : (
        <div className="flex flex-col justify-start gap-2.5 shrink-0">
          <PlayerTable
            title="Your Team"
            accent="primary"
            players={teams.yours}
            tierIcons={tierIcons}
            seasonNames={seasonNames}
            queueId={matchState?.queueId}
            onShowLoadout={openLoadout}
          />

          {matchState.phase === 'coregame' ? (
            <PlayerTable
              title="Enemy Team"
              accent="coral"
              players={teams.theirs}
              tierIcons={tierIcons}
              seasonNames={seasonNames}
              queueId={matchState?.queueId}
              onShowLoadout={openLoadout}
            />
          ) : (
            <div className="p-3 rounded-xl bg-m3-surface-container border border-m3-outline-subtle text-center text-[11px] text-m3-outline flex items-center justify-center gap-2">
              <Lock className="w-3.5 h-3.5 text-m3-outline" />
              <span>Opponent team details are hidden by Riot during Agent Select to prevent queue dodging.</span>
            </div>
          )}
        </div>
      )}

      {loadoutFor && (
        <LoadoutViewer
          player={loadoutFor}
          loadout={loadoutData}
          loading={loadoutLoading}
          ambiguous={loadoutAmbiguous}
          unavailableReason={loadoutReason}
          onClose={() => {
            setLoadoutFor(null);
            setLoadoutData(null);
            setLoadoutReason(null);
          }}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Live match status strip                                             */
/* ------------------------------------------------------------------ */

const MatchStatusStrip: React.FC<{
  state: LiveMatchState;
  onRefresh: () => void;
  refreshing: boolean;
}> = ({ state, onRefresh, refreshing }) => {
  const units = (n: number) => `${n} Player${n === 1 ? '' : 's'}`;

  return (
    <section className="rounded-xl bg-m3-surface-container-low border border-m3-outline-subtle px-3 py-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[10px] shrink-0">
      {/* Live Phase indicator */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-[10px] font-mono font-bold shrink-0">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            state.phase === 'coregame' || state.phase === 'pregame'
              ? 'bg-m3-mint animate-pulse'
              : 'bg-m3-outline'
          }`}
        />
        <span className={state.phase === 'coregame' || state.phase === 'pregame' ? 'text-m3-mint' : 'text-m3-outline'}>
          {state.phase === 'coregame'
            ? 'IN MATCH'
            : state.phase === 'pregame'
            ? 'AGENT SELECT'
            : 'IDLE'}
        </span>
      </div>

      {/* Map */}
      <span className="flex items-center gap-1.5 font-mono text-m3-outline shrink-0">
        <Swords className="w-3 h-3 text-m3-primary" />
        <span className="font-bold text-m3-on-surface">{state.mapName || 'Unknown map'}</span>
      </span>

      {/* Mode badge */}
      {state.mode && (
        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[9.5px] font-mono font-bold uppercase shrink-0 tracking-wider">
          {state.mode}
        </span>
      )}

      {state.startingSide && !state.isDeathmatch && (
        <span className="flex items-center gap-1.5 font-mono text-m3-outline shrink-0">
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

      <span className="flex items-center gap-1.5 font-mono text-m3-outline shrink-0">
        <Users className="w-3 h-3" />
        <span>{units(state.blueTeam.length + state.redTeam.length)} in lobby</span>
      </span>

      {/* Refresh button moved right beside sync timestamp */}
      <div className="flex items-center gap-2 font-mono text-m3-outline ml-auto shrink-0">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-m3-primary border border-white/10 text-[10px] font-semibold cursor-pointer active:scale-95 disabled:opacity-50 transition-colors"
          title="Refresh match data"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
        <span className="flex items-center gap-1 text-m3-outline text-[9.5px]">
          <Clock className="w-3 h-3" />
          <span>synced {new Date(state.updatedAt || Date.now()).toLocaleTimeString()}</span>
        </span>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Player table — mirrors the Agent Select widget's columns            */
/* ------------------------------------------------------------------ */

const GRID = 'grid grid-cols-[1fr_64px_28px_70px_68px_42px_38px_42px_38px_60px_34px] items-center gap-x-1.5';

const ACCENTS: Record<string, { tag: string; border: string }> = {
  primary: { tag: 'bg-m3-primary/15 text-m3-primary border-m3-primary/30', border: 'border-m3-primary/25' },
  coral: { tag: 'bg-m3-coral/15 text-m3-coral border-m3-coral/30', border: 'border-m3-coral/25' },
  gold: { tag: 'bg-m3-gold/15 text-m3-gold border-m3-gold/30', border: 'border-m3-gold/25' },
  mint: { tag: 'bg-m3-mint/15 text-m3-mint border-m3-mint/30', border: 'border-m3-mint/25' },
};

const PlayerTable: React.FC<{
  title?: string;
  accent: keyof typeof ACCENTS;
  players: LiveMatchPlayer[];
  tierIcons: Record<number, string>;
  seasonNames: Record<string, string>;
  /** Queue being played — captions the Last-24h column so it reads mode-scoped. */
  queueId?: string;
  onShowLoadout?: (p: LiveMatchPlayer) => void;
  hideHeader?: boolean;
}> = ({ title, accent, players, tierIcons, seasonNames, queueId, onShowLoadout, hideHeader }) => {
  const a = ACCENTS[accent] ?? ACCENTS.primary;
  const scope = queueLabel(queueId);

  return (
    <section
      className={`shrink-0 rounded-2xl bg-m3-surface-container-low border ${a.border} p-2.5 shadow-m3-1 flex flex-col gap-1.5 overflow-hidden`}
    >
      {!hideHeader && title && (
        <div className="flex items-center justify-between px-1 shrink-0 pb-1">
          <span className={`text-[10.5px] font-bold font-display px-2 py-0.5 rounded-full border ${a.tag}`}>
            {title}
          </span>
          <span className="text-[9.5px] font-mono text-m3-outline">
            {players.length} Player{players.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Column headers. Act-wide disclosure is deliberate: Riot exposes no
          live combat stats, so nothing here may imply "this match". */}
      <div
        className={`${GRID} px-2 pb-0.5 text-[8.5px] font-mono uppercase tracking-wider text-m3-outline border-b border-m3-outline-subtle shrink-0`}
      >
        <span>Player</span>
        <span className="text-center" title="Equipped weapon skins & cosmetics">Skins</span>
        <span className="text-center" title="Tracker Score tier">TS</span>
        <span className="text-left pl-1">Rank</span>
        <span className="text-left pl-1" title="Peak rank — the act it was earned in is shown under the emblem">Peak</span>
        <span className="text-right" title="Act-wide average combat score — the column this board is sorted by">ACS</span>
        <span className="text-right" title="Act-wide K/D (Riot exposes no live kill data)">K/D</span>
        <span className="text-right" title="Act-wide win rate">Win%</span>
        <span className="text-right" title="Act-wide headshot %">HS%</span>
        <span
          className="text-right"
          title={scope ? `Wins / losses in the last 24 hours (${scope} games)` : 'Wins / losses in the last 24 hours'}
        >
          24H
        </span>
        <span className="text-right">Lvl</span>
      </div>

      <div className="flex flex-col gap-1.5 overflow-hidden shrink-0">
        {[...players].sort(byAcsDesc).map((p) => (
          <PlayerRow
            key={p.puuid}
            p={p}
            tierIcons={tierIcons}
            seasonNames={seasonNames}
            onShowLoadout={onShowLoadout}
          />
        ))}
        {players.length === 0 && (
          <div className="py-4 flex items-center justify-center p-2 text-center text-[10.5px] text-m3-outline font-mono">
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
  onShowLoadout?: (p: LiveMatchPlayer) => void;
}> = ({ p, tierIcons, seasonNames, onShowLoadout }) => {
  const rankIcon = tierIcons[p.tier];
  const peakIcon = tierIcons[p.peakTier];
  const kd = formatKd(p.kd);
  const recent = recentLabel(p);
  const party = getPartyStyle(p.partyIndex);
  const flagUrl = getFlagUrl(p.country);
  const actLabel = p.peakSeasonId ? seasonNames[p.peakSeasonId] : undefined;

  return (
    <div
      className={`${GRID} h-10 shrink-0 relative overflow-hidden rounded-xl border px-2.5 py-1 transition-colors ${
        party
          ? `${party.bg} border-m3-outline-subtle/40`
          : p.isMe
          ? 'bg-m3-primary/10 border-m3-primary/40 shadow-xs'
          : 'bg-m3-surface-container border-m3-outline-subtle hover:bg-m3-surface-container-high'
      }`}
    >
      {/* Party identifier: curved bow arc wrapping the left edge to show who is queued together in a party */}
      {party && (
        <svg
          className={`absolute left-0 top-0 bottom-0 h-full w-2.5 pointer-events-none ${party.text} drop-shadow-[0_0_6px_currentColor]`}
          viewBox="0 0 10 32"
          fill="none"
          preserveAspectRatio="none"
        >
          <title>{`Queued together in ${party.name}`}</title>
          <path
            d="M 8 2.5 C 3.5 2.5, 1.5 5.5, 1.5 10 L 1.5 22 C 1.5 26.5, 3.5 29.5, 8 29.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* 1. Agent portrait + flag, name, badges */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative shrink-0">
          {p.agentIcon ? (
            <img
              src={p.agentIcon}
              alt={p.agentName}
              className="w-6 h-6 rounded-md object-cover bg-m3-surface-container-highest border border-m3-outline-subtle"
            />
          ) : (
            <div className="w-6 h-6 rounded-md bg-m3-surface-container-highest border border-m3-outline-subtle flex items-center justify-center text-[10px] font-bold text-m3-outline">
              ?
            </div>
          )}
          {flagUrl && (
            <img
              src={flagUrl}
              alt={p.country || ''}
              title={`Country: ${p.country}`}
              className="absolute -bottom-0.5 -right-0.5 w-3 h-2 object-cover rounded-[1.5px] border border-m3-surface shadow-xs"
            />
          )}
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 min-w-0">
            {party && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${party.bar} shrink-0 shadow-xs`}
                title={`Queued together in ${party.name}`}
              />
            )}
            <span
              className="font-display font-bold text-[11.5px] text-m3-on-surface truncate"
              title={`${p.name}${p.tag ? '#' + p.tag : ''}`}
            >
              {p.name}
            </span>
            {p.tag && (
              <span className="text-[8.5px] font-mono text-m3-outline truncate">#{p.tag}</span>
            )}
            {p.isMe && (
              <span className="px-1 py-px rounded bg-m3-primary text-m3-on-primary text-[7.5px] font-black uppercase shrink-0">
                You
              </span>
            )}
            {p.isIncognito && (
              <span
                className="flex items-center gap-0.5 px-1 py-px rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[7.5px] font-mono font-bold uppercase shrink-0"
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
          <div className="text-[9px] text-m3-outline truncate flex items-center gap-1">
            <span className="font-medium text-m3-on-surface-variant truncate">
              {p.agentName}
            </span>
            {p.agentRole && <span className="truncate">• {p.agentRole}</span>}
          </div>
        </div>
      </div>

      {/* 2. Skins / Loadout button — between Player and TS so it pops out */}
      <div className="flex items-center justify-center">
        {onShowLoadout && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowLoadout(p);
            }}
            className="h-6 px-2.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-purple-600/30 hover:from-purple-500/35 hover:to-purple-600/50 border border-purple-400/40 hover:border-purple-300 text-purple-100 hover:text-white transition-all flex items-center justify-center gap-1.5 text-[9.5px] font-bold font-display shadow-xs hover:shadow-[0_0_8px_rgba(192,132,252,0.4)] cursor-pointer active:scale-95 shrink-0"
            title={`View ${p.name}'s weapon skins & loadout`}
            aria-label={`View ${p.name}'s loadout`}
          >
            <Sparkles className="w-2.5 h-2.5 text-purple-300 animate-pulse" />
            <span>Skins</span>
          </button>
        )}
      </div>

      {/* 3. Tracker Score badge — unified 20px size, right next to Rank */}
      <div
        className="flex items-center justify-center"
        title={
          p.trnScore != null
            ? `Tracker Score: ${p.trnScore} / 1000 — Tier ${scoreTier(p.trnScore).tier}`
            : 'Tracker Score unavailable'
        }
      >
        {p.trnScore != null ? (
          <ScoreBadge tier={scoreTier(p.trnScore).tier} size={20} />
        ) : (
          <span className="w-5 h-5 rounded border border-m3-outline-subtle bg-m3-surface-container flex items-center justify-center text-[8px] font-mono text-m3-outline">
            —
          </span>
        )}
      </div>

      {/* 4. Current rank: icon on left (20px), text on right (rank + RR) */}
      <div className="flex items-center gap-1.5 min-w-0" title={rankTooltip(p, actLabel)}>
        {rankIcon ? (
          <img src={rankIcon} alt={p.rank} className="w-5 h-5 object-contain shrink-0" />
        ) : (
          <span className="w-5 text-center text-[8.5px] font-mono text-m3-outline shrink-0">—</span>
        )}
        <div className="flex flex-col min-w-0 leading-none">
          <span className="text-[8.5px] font-display font-bold text-m3-on-surface truncate">
            {p.rank}
          </span>
          {p.tier > 2 ? (
            <span className="text-[7.5px] font-mono font-bold text-m3-primary tracking-tight mt-0.5">
              {p.rr} RR
            </span>
          ) : (
            <span className="text-[7.5px] font-mono text-m3-outline mt-0.5">—</span>
          )}
        </div>
      </div>

      {/* 5. Peak rank: icon on left (20px), text on right (peak + act) */}
      <div
        className="flex items-center gap-1.5 min-w-0"
        title={p.peakTier > 0 ? `Peak ${p.peakRank}${actLabel ? ` (${shortAct(actLabel)})` : ''}` : 'Peak unavailable'}
      >
        {peakIcon ? (
          <img src={peakIcon} alt={p.peakRank} className="w-5 h-5 object-contain opacity-90 shrink-0" />
        ) : (
          <span className="w-5 text-center text-[8.5px] font-mono text-m3-outline shrink-0">—</span>
        )}
        <div className="flex flex-col min-w-0 leading-none">
          <span className="text-[8.5px] font-display font-semibold text-m3-outline truncate">
            {p.peakRank}
          </span>
          {p.peakSeasonId && actLabel && (
            <span className="text-[7px] font-mono text-m3-outline/80 mt-0.5">
              {shortAct(actLabel)}
            </span>
          )}
        </div>
      </div>

      {/* 6. ACS — the sort key, so it reads first among the numbers */}
      <div className="text-right font-mono text-[10.5px] font-bold" title="Act-wide average combat score">
        {p.acs != null ? (
          <span className={p.acs >= 200 ? 'text-m3-primary' : p.acs >= 150 ? 'text-m3-on-surface' : 'text-m3-outline'}>
            {p.acs}
          </span>
        ) : (
          <span className="text-m3-outline">—</span>
        )}
      </div>

      {/* 7. K/D */}
      <div className="text-right font-mono text-[10.5px] font-bold" title="Act-wide K/D">
        <span className={kd.color}>{kd.text}</span>
      </div>

      {/* 8. Win % */}
      <div className="text-right font-mono text-[10.5px]" title="Act-wide win rate">
        {p.winPct != null ? (
          <span className={p.winPct >= 50 ? 'text-m3-mint font-semibold' : 'text-rose-400'}>
            {p.winPct.toFixed(0)}%
          </span>
        ) : (
          <span className="text-m3-outline">—</span>
        )}
      </div>

      {/* 9. HS % */}
      <div className="text-right font-mono text-[10.5px] text-amber-500" title="Act-wide headshot %">
        {p.hsPct != null && p.hsPct > 0 ? `${p.hsPct.toFixed(0)}%` : <span className="text-m3-outline">—</span>}
      </div>

      {/* 10. Last 24h W/L */}
      <div className="text-right font-mono text-[9.5px]" title="Wins / losses in the last 24 hours">
        {recent ? <span className={recent.color}>{recent.text}</span> : <span className="text-m3-outline">—</span>}
      </div>

      {/* 11. Account level */}
      <div className="text-right font-mono text-[9.5px] text-m3-outline" title="Account level">
        {p.accountLevel > 0 ? p.accountLevel : '—'}
      </div>
    </div>
  );
};
