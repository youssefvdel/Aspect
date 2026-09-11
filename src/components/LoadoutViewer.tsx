import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, Crosshair } from 'lucide-react';
import type { LiveMatchPlayer } from '../types';
import {
  LOADOUT_COLUMNS,
  groupByCategory,
  playerCardIcon,
  playerCardLarge,
  type PlayerLoadout,
  type EquippedWeapon,
} from '../utils/loadout';

/* ------------------------------------------------------------------ */
/* Layout primitives — the five-column collection grid                 */
/* ------------------------------------------------------------------ */

const SectionHeading: React.FC<{ children: React.ReactNode; muted?: boolean }> = ({
  children,
  muted,
}) => (
  <div
    className={`text-center font-display font-bold uppercase tracking-[0.18em] ${
      muted ? 'text-[10px] text-m3-outline' : 'text-[11px] text-m3-on-surface'
    }`}
  >
    {children}
  </div>
);

/**
 * One weapon tile: art on top, a hairline divider, then the weapon name and
 * the equipped skin. The skin is the point of the screen, so it gets the
 * brighter line and the weapon name sits above it as the quiet label.
 */
const WeaponCard: React.FC<{ weapon: EquippedWeapon }> = ({ weapon }) => (
  <div
    className="w-[132px] shrink-0 rounded-md border border-m3-outline-subtle bg-m3-surface-container/70 overflow-hidden group"
    title={`${weapon.weaponName} — ${weapon.skinName}`}
  >
    <div className="h-[62px] flex items-center justify-center p-1.5">
      {weapon.icon ? (
        <img
          src={weapon.icon}
          alt={weapon.skinName}
          loading="lazy"
          className="max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <Crosshair className="w-6 h-6 text-m3-outline/40" />
      )}
    </div>
    <div className="border-t border-m3-outline-subtle px-2 py-1">
      <div className="text-[8px] font-mono uppercase tracking-wider text-m3-outline truncate">
        {weapon.weaponName}
      </div>
      <div
        className={`text-[10px] font-semibold truncate ${
          weapon.isDefaultSkin ? 'text-m3-on-surface-variant' : 'text-m3-primary'
        }`}
      >
        {weapon.skinName}
      </div>
    </div>
  </div>
);

/** Empty slot — shown so the grid keeps its shape instead of collapsing. */
const EmptySlot: React.FC = () => (
  <div className="w-[132px] h-[86px] shrink-0 rounded-md border border-dashed border-m3-outline-subtle/50 bg-m3-surface-container/20" />
);

/**
 * The spray wheel: four expressions placed at the cardinal points of a ring,
 * transcribed from the in-game expressions screen.
 */
const SprayWheel: React.FC<{ items: { icon: string; kind: string }[] }> = ({ items }) => {
  const positions = [
    { top: '6%', left: '50%', tx: '-50%', ty: '0%' },
    { top: '50%', left: '88%', tx: '-50%', ty: '-50%' },
    { top: '94%', left: '50%', tx: '-50%', ty: '-100%' },
    { top: '50%', left: '12%', tx: '-50%', ty: '-50%' },
  ];
  return (
    <div className="relative w-[168px] h-[168px] mx-auto">
      {/* Ring */}
      <div className="absolute inset-[12%] rounded-full border border-m3-outline/30" />
      <div className="absolute inset-[30%] rounded-full border border-m3-outline/15" />
      {/* Hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-m3-outline/30 bg-m3-surface-container/60" />
      {positions.map((pos, i) => {
        const item = items[i];
        if (!item) return null;
        return (
          <div
            key={i}
            className="absolute w-11 h-11 rounded-full border border-m3-outline-subtle bg-m3-surface-container/80 flex items-center justify-center overflow-hidden"
            style={{ top: pos.top, left: pos.left, transform: `translate(${pos.tx}, ${pos.ty})` }}
            title={item.kind}
          >
            <img src={item.icon} alt={item.kind} loading="lazy" className="w-9 h-9 object-contain" />
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* The viewer                                                          */
/* ------------------------------------------------------------------ */

export const LoadoutViewer: React.FC<{
  player: LiveMatchPlayer;
  loadout: PlayerLoadout | null;
  loading: boolean;
  /** A weaker join key was used because agents collided (Deathmatch). */
  ambiguous?: boolean;
  /** Names the source state, e.g. why nothing is showing. */
  unavailableReason?: string | null;
  onClose: () => void;
}> = ({ player, loadout, loading, ambiguous, unavailableReason, onClose }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grouped = loadout ? groupByCategory(loadout.weapons) : {};
  const cardArt = player.cardId ? playerCardLarge(player.cardId) : '';
  const cardFallback = player.cardId ? playerCardIcon(player.cardId) : '';
  const [cardSrc, setCardSrc] = useState(cardArt || cardFallback);
  useEffect(() => {
    setCardSrc(cardArt || cardFallback);
    force((n) => n + 1);
  }, [cardArt, cardFallback, player.cardId]);

  const rioId = `${player.name}${player.tag ? '#' + player.tag : ''}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1180px] max-h-[92vh] overflow-y-auto rounded-3xl border border-m3-outline-subtle bg-m3-surface-container-low shadow-m3-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3 rounded-t-3xl bg-m3-surface-container-low/95 backdrop-blur border-b border-m3-outline-subtle">
          {player.agentIcon && (
            <img src={player.agentIcon} alt={player.agentName} className="w-8 h-8 rounded-md object-cover" />
          )}
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="font-display font-extrabold text-[14px] text-m3-on-surface truncate">
              {rioId}
            </span>
            <span className="text-[10px] text-m3-outline truncate">
              {player.agentName}
              {player.rank ? ` • ${player.rank}` : ''}
              {player.accountLevel ? ` • Lvl ${player.accountLevel}` : ''}
            </span>
          </div>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-m3-outline">
            Loadout
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-m3-surface-container-high/60 text-m3-on-surface-variant transition-colors"
            aria-label="Close loadout"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-m3-outline">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[11px] font-mono">Reading live loadout…</span>
          </div>
        ) : !loadout ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 px-8 text-center text-m3-outline">
            <AlertTriangle className="w-6 h-6" />
            <span className="text-[12px] font-semibold text-m3-on-surface-variant">
              No loadout available
            </span>
            <span className="text-[11px] max-w-[440px]">
              {unavailableReason ??
                'Riot only exposes equipped skins while a match is in progress.'}
            </span>
          </div>
        ) : (
          <div className="p-5">
            {ambiguous && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[10.5px] text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Duplicate agent in this lobby — showing the loadout of the first matching player.
              </div>
            )}

            {loadout.weapons.length === 0 && (
              <div className="mb-4 rounded-lg border border-m3-outline-subtle bg-m3-surface-container/50 px-3 py-2 text-[10.5px] text-m3-on-surface-variant">
                Riot returned no equipped weapons for this player yet — loadouts populate a few
                seconds after the buy phase starts.
              </div>
            )}

            {/* Five-column collection grid */}
            <div className="flex items-start gap-5 overflow-x-auto pb-2">
              {LOADOUT_COLUMNS.map((column, ci) => (
                <div key={ci} className="flex flex-col gap-1.5 shrink-0">
                  {column.map((section, si) => {
                    const weapons = grouped[section.category] ?? [];
                    return (
                      <React.Fragment key={section.category}>
                        <div className={si === 0 ? 'mb-1' : 'mt-4 mb-1'}>
                          <SectionHeading>{section.label}</SectionHeading>
                        </div>
                        {weapons.length > 0
                          ? weapons.map((w) => <WeaponCard key={w.weaponUuid} weapon={w} />)
                          : // Keep the column's rhythm when nothing is equipped yet.
                            Array.from({ length: 2 }).map((_, i) => <EmptySlot key={i} />)}
                      </React.Fragment>
                    );
                  })}
                </div>
              ))}

              {/* Column 5 — player card + expressions */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <div className="mb-1">
                  <SectionHeading>Player Card</SectionHeading>
                </div>
                <div className="relative w-[168px] aspect-[3/4] rounded-lg border-[3px] border-m3-coral/70 overflow-hidden bg-m3-surface-container">
                  {cardSrc ? (
                    <img
                      src={cardSrc}
                      alt="Player card"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={() => cardSrc !== cardFallback && setCardSrc(cardFallback)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-m3-outline text-[10px] font-mono">
                      No card
                    </div>
                  )}
                  {/* Name banner */}
                  <div className="absolute bottom-0 inset-x-0 bg-m3-gold/90 px-2 py-1 text-center">
                    <span className="text-[11px] font-black text-black truncate block">{player.name}</span>
                  </div>
                </div>

                <div className="mt-4 mb-1">
                  <SectionHeading>Expressions</SectionHeading>
                </div>
                {loadout.expressions.length > 0 ? (
                  <SprayWheel items={loadout.expressions} />
                ) : (
                  <div className="w-[168px] h-[168px] mx-auto rounded-full border border-dashed border-m3-outline-subtle/50 flex items-center justify-center text-[10px] font-mono text-m3-outline">
                    None equipped
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
