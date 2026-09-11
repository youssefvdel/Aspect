import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Crosshair, User } from 'lucide-react';
import type { LiveMatchPlayer } from '../types';
import {
  playerCardIcon,
  playerCardLarge,
  loadWeaponCatalog,
  type PlayerLoadout,
  type WeaponCatalog,
  type EquippedExpression,
} from '../utils/loadout';

/* ------------------------------------------------------------------ */
/* Header & Section Title Primitives                                  */
/* ------------------------------------------------------------------ */

const CategoryHeader: React.FC<{ title: string; className?: string }> = ({ title, className = '' }) => (
  <div
    className={`text-center font-display font-black text-[13px] tracking-[0.2em] text-white uppercase select-none h-5 leading-5 ${className}`}
  >
    {title}
  </div>
);

/* ------------------------------------------------------------------ */
/* Weapon Card Component                                              */
/* Matches the exact Valorant collection tile:                        */
/* - Fixed 96px height                                                */
/* - Centered weapon/skin model                                       */
/* - Bottom-left base weapon name (e.g. CLASSIC, VANDAL)               */
/* - Horizontal hairline divider extending from weapon name to edge   */
/* ------------------------------------------------------------------ */

interface SlotItemData {
  weaponName: string;
  skinName: string;
  icon: string;
  isDefaultSkin: boolean;
}

const WeaponCard: React.FC<{
  slot: SlotItemData;
  className?: string;
}> = ({ slot, className = '' }) => {
  return (
    <div
      className={`flex-1 min-h-[80px] bg-[#1c1326]/85 hover:bg-[#271a35]/95 border border-[#d0bcff]/20 hover:border-[#d0bcff]/70 rounded-xs transition-all duration-150 overflow-hidden flex flex-col justify-between p-2 select-none shadow-[0_4px_12px_rgba(0,0,0,0.5)] group relative ${className}`}
      title={`${slot.weaponName} • ${slot.skinName}`}
    >
      {/* Centered weapon artwork */}
      <div className="flex-1 flex items-center justify-center p-1 min-h-0 relative">
        {slot.icon ? (
          <img
            src={slot.icon}
            alt={slot.skinName}
            loading="lazy"
            className="max-h-[82%] max-w-[88%] object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <Crosshair className="w-5 h-5 text-[#d0bcff]/30" />
        )}
      </div>

      {/* Bottom baseline: base weapon name on left, line extending to the right */}
      <div className="flex items-center px-1 pb-0.5 pt-1 min-w-0">
        <span className="font-display font-black text-[11px] text-[#d0bcff]/80 tracking-wider uppercase shrink-0">
          {slot.weaponName}
        </span>
        {/* Segmented horizontal line */}
        <div className="flex-1 h-[1px] bg-white/10 ml-2 relative">
          {!slot.isDefaultSkin && (
            <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-[#d0bcff] shadow-[0_0_8px_rgba(208,188,255,0.8)]" />
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Expressions (Sprays) Wheel Component                                */
/* 4 cardinal points (12, 3, 6, 9 o'clock) with concentric rings      */
/* ------------------------------------------------------------------ */

const ExpressionsWheel: React.FC<{ items: EquippedExpression[] }> = ({ items }) => {
  // Slots in clock order: Top (12h), Right (3h), Bottom (6h), Left (9h)
  const slots = [
    { pos: 'top-1 left-1/2 -translate-x-1/2', item: items[0] },
    { pos: 'top-1/2 right-1 -translate-y-1/2', item: items[1] },
    { pos: 'bottom-1 left-1/2 -translate-x-1/2', item: items[2] },
    { pos: 'top-1/2 left-1 -translate-y-1/2', item: items[3] },
  ];

  return (
    <div className="relative w-[200px] h-[200px] mx-auto flex items-center justify-center shrink-0">
      {/* Outer faint ring */}
      <div className="absolute w-[194px] h-[194px] rounded-full border border-[#d0bcff]/25" />
      {/* Middle concentric ring */}
      <div className="absolute w-[118px] h-[118px] rounded-full border border-[#d0bcff]/15" />
      {/* Central hub */}
      <div className="absolute w-[46px] h-[46px] rounded-full border border-[#d0bcff]/40 bg-[#1c1326] shadow-inner flex items-center justify-center">
        <div className="w-2.5 h-2.5 rounded-full bg-[#d0bcff]/60 shadow-[0_0_6px_rgba(208,188,255,0.7)]" />
      </div>

      {/* Radial 8-axis spokes */}
      <div className="absolute w-full h-[1px] bg-[#d0bcff]/15 rotate-45" />
      <div className="absolute w-full h-[1px] bg-[#d0bcff]/15 -rotate-45" />
      <div className="absolute w-full h-[1px] bg-[#d0bcff]/15 rotate-0" />
      <div className="absolute h-full w-[1px] bg-[#d0bcff]/15" />

      {/* 4 Cardinal slots */}
      {slots.map((slot, i) => (
        <div
          key={i}
          className={`absolute ${slot.pos} w-12 h-12 rounded-full bg-[#1c1326] border border-[#d0bcff]/35 hover:border-[#d0bcff] hover:shadow-[0_0_12px_rgba(208,188,255,0.6)] flex items-center justify-center overflow-hidden shadow-lg transition-all group`}
          title={slot.item?.name ? `${slot.item.name} (${slot.item.kind})` : 'Unequipped slot'}
        >
          {slot.item?.icon ? (
            <img
              src={slot.item.icon}
              alt={slot.item.name || slot.item.kind}
              loading="lazy"
              className="w-9 h-9 object-contain group-hover:scale-110 transition-transform"
            />
          ) : (
            <div className="w-2 h-2 rounded-full bg-[#d0bcff]/30" />
          )}
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 20 Weapons Slot Definitions (UUIDs match Valorant Content API)      */
/* ------------------------------------------------------------------ */

const SLOTS = {
  // Col 1: SIDEARMS
  CLASSIC: { id: '29a0cfab-485b-f5d5-779a-b59f85e204a8', name: 'CLASSIC' },
  SHORTY: { id: '42da8ccc-40d5-affc-beec-15aa47b42eda', name: 'SHORTY' },
  FRENZY: { id: '44d4e95c-4157-0037-81b2-17841bf2e8e3', name: 'FRENZY' },
  GHOST: { id: '1baa85b4-4c70-1284-64bb-6481dfc3bb4e', name: 'GHOST' },
  BANDIT: { id: '410b2e0b-4ceb-1321-1727-20858f7f3477', name: 'BANDIT' },
  SHERIFF: { id: 'e336c6b8-418d-9340-d77f-7a9e4cfe0702', name: 'SHERIFF' },

  // Col 2: SMGS & SHOTGUNS
  STINGER: { id: 'f7e1b454-4ad4-1063-ec0a-159e56b58941', name: 'STINGER' },
  SPECTRE: { id: '462080d1-4035-2937-7c09-27aa2a5c27a7', name: 'SPECTRE' },
  BUCKY: { id: '910be174-449b-c412-ab22-d0873436b21b', name: 'BUCKY' },
  JUDGE: { id: 'ec845bf4-4f79-ddda-a3da-0db3774b2794', name: 'JUDGE' },

  // Col 3: RIFLES & MELEE
  BULLDOG: { id: 'ae3de142-4d85-2547-dd26-4e90bed35cf7', name: 'BULLDOG' },
  GUARDIAN: { id: '4ade7faa-4cf1-8376-95ef-39884480959b', name: 'GUARDIAN' },
  PHANTOM: { id: 'ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a', name: 'PHANTOM' },
  VANDAL: { id: '9c82e19d-4575-0200-1a81-3eacf00cf872', name: 'VANDAL' },
  MELEE: { id: '2f59173c-4bed-b6c3-2191-dea9b58be9c7', name: 'MELEE' },

  // Col 4: SNIPERS & HEAVIES
  MARSHAL: { id: 'c4883e50-4494-202c-3ec3-6b8a9284f00b', name: 'MARSHAL' },
  OUTLAW: { id: '5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c', name: 'OUTLAW' },
  OPERATOR: { id: 'a03b24d3-4319-996d-0f8c-94bbfba1dfc7', name: 'OPERATOR' },
  ARES: { id: '55d8a0f4-4274-ca67-fe2c-06ab45efdf58', name: 'ARES' },
  ODIN: { id: '63e6c2b6-4a8e-869c-3d4c-e38355226584', name: 'ODIN' },
};

/* ------------------------------------------------------------------ */
/* Main Loadout Viewer Modal                                           */
/* ------------------------------------------------------------------ */

export const LoadoutViewer: React.FC<{
  player: LiveMatchPlayer;
  loadout: PlayerLoadout | null;
  loading: boolean;
  ambiguous?: boolean;
  unavailableReason?: string | null;
  onClose: () => void;
}> = ({ player, loadout, loading, ambiguous, unavailableReason, onClose }) => {
  const [catalog, setCatalog] = useState<WeaponCatalog | null>(null);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load catalog so default weapon icons and chromas resolve instantly
  useEffect(() => {
    loadWeaponCatalog().then(setCatalog).catch(() => {});
  }, []);

  // Map equipped weapons by UUID (lowercase)
  const equippedMap = useMemo(() => {
    const map = new Map<string, SlotItemData>();
    if (loadout) {
      for (const w of loadout.weapons) {
        map.set(w.weaponUuid.toLowerCase(), {
          weaponName: w.weaponName,
          skinName: w.skinName,
          icon: w.icon,
          isDefaultSkin: w.isDefaultSkin,
        });
      }
    }
    return map;
  }, [loadout]);

  // Resolve slot data: equipped skin if present, else canonical default weapon from catalog
  const getSlot = (def: { id: string; name: string }): SlotItemData => {
    const id = def.id.toLowerCase();
    const equipped = equippedMap.get(id);
    if (equipped && equipped.icon) {
      return {
        ...equipped,
        weaponName: def.name,
      };
    }
    const defaultWeapon = catalog?.weapons[id];
    return {
      weaponName: def.name,
      skinName: `Standard ${def.name}`,
      icon: defaultWeapon?.icon || '',
      isDefaultSkin: true,
    };
  };

  const cardArt = player.cardId ? playerCardLarge(player.cardId) : '';
  const cardFallback = player.cardId ? playerCardIcon(player.cardId) : '';
  const [cardImgFailed, setCardImgFailed] = useState(false);
  const cardSrc = cardImgFailed ? cardFallback : cardArt || cardFallback;

  const rioId = `${player.name}${player.tag ? '#' + player.tag : ''}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1540px] rounded-2xl border border-[#d0bcff]/20 bg-gradient-to-b from-[#1a1124] via-[#140e1b] to-[#0f0a15] shadow-[0_24px_64px_rgba(0,0,0,0.9)] p-6 md:p-8 flex flex-col select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            {player.agentIcon ? (
              <img
                src={player.agentIcon}
                alt={player.agentName}
                className="w-9 h-9 rounded-sm object-cover border border-[#d0bcff]/30 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-sm bg-[#22162e] border border-[#d0bcff]/30 flex items-center justify-center">
                <User className="w-5 h-5 text-[#d0bcff]/60" />
              </div>
            )}
            <div className="flex flex-col leading-tight">
              <span className="font-display font-black text-[16px] text-white tracking-wide">
                {rioId}
              </span>
              <span className="text-[11px] text-[#d0bcff]/80 font-semibold">
                {player.agentName}
                {player.rank ? ` • ${player.rank}` : ''}
                {player.accountLevel ? ` • Lvl ${player.accountLevel}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[12px] font-display font-bold uppercase tracking-[0.25em] text-[#d0bcff]/70">
              Collection
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded text-[#d0bcff]/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close loadout"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice banners */}
        {ambiguous && (
          <div className="mb-4 px-3.5 py-1.5 rounded bg-[#ffb4a9]/10 border border-[#ffb4a9]/30 text-[#ffb4a9] text-[11px] font-medium">
            Multiple players picked {player.agentName} in this match — displaying the first matching loadout.
          </div>
        )}
        {unavailableReason && (
          <div className="mb-4 px-3.5 py-1.5 rounded bg-[#22162e] border border-[#d0bcff]/20 text-[#d0bcff]/80 text-[11px]">
            {unavailableReason}
          </div>
        )}

        {/* 5-Column 6-Row Modular Grid */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#140e1b]/90 backdrop-blur-xs rounded-lg">
              <Loader2 className="w-7 h-7 text-[#d0bcff] animate-spin" />
              <span className="text-[12px] font-mono text-[#d0bcff]/80 uppercase tracking-wider">
                Loading live weapon arsenal…
              </span>
            </div>
          )}

          <div className="grid grid-cols-5 gap-6 items-start">
            {/* ------------------------------------------------------------- */}
            {/* Column 1: SIDEARMS (Classic, Shorty, Frenzy, Ghost, Bandit, Sheriff) */}
            {/* ------------------------------------------------------------- */}
            <div className="h-[660px] flex flex-col">
              <CategoryHeader title="SIDEARMS" className="mb-3 shrink-0" />
              <div className="flex-1 min-h-0 flex flex-col justify-between gap-2.5">
                <WeaponCard slot={getSlot(SLOTS.CLASSIC)} />
                <WeaponCard slot={getSlot(SLOTS.SHORTY)} />
                <WeaponCard slot={getSlot(SLOTS.FRENZY)} />
                <WeaponCard slot={getSlot(SLOTS.GHOST)} />
                <WeaponCard slot={getSlot(SLOTS.BANDIT)} />
                <WeaponCard slot={getSlot(SLOTS.SHERIFF)} />
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Column 2: SMGS & SHOTGUNS                                     */}
            {/* ------------------------------------------------------------- */}
            <div className="h-[660px] flex flex-col">
              <CategoryHeader title="SMGS" className="mb-3 shrink-0" />
              <div className="flex-1 min-h-0 flex flex-col justify-between gap-2.5">
                <WeaponCard slot={getSlot(SLOTS.STINGER)} />
                <WeaponCard slot={getSlot(SLOTS.SPECTRE)} />
                <CategoryHeader title="SHOTGUNS" className="my-1 shrink-0" />
                <WeaponCard slot={getSlot(SLOTS.BUCKY)} />
                <WeaponCard slot={getSlot(SLOTS.JUDGE)} />
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Column 3: RIFLES & MELEE                                      */}
            {/* ------------------------------------------------------------- */}
            <div className="h-[660px] flex flex-col">
              <CategoryHeader title="RIFLES" className="mb-3 shrink-0" />
              <div className="flex-1 min-h-0 flex flex-col justify-between gap-2.5">
                <WeaponCard slot={getSlot(SLOTS.BULLDOG)} />
                <WeaponCard slot={getSlot(SLOTS.GUARDIAN)} />
                <WeaponCard slot={getSlot(SLOTS.PHANTOM)} />
                <WeaponCard slot={getSlot(SLOTS.VANDAL)} />
                <CategoryHeader title="MELEE" className="my-1 shrink-0" />
                <WeaponCard slot={getSlot(SLOTS.MELEE)} />
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Column 4: SNIPER RIFLES & MACHINE GUNS                        */}
            {/* ------------------------------------------------------------- */}
            <div className="h-[660px] flex flex-col">
              <CategoryHeader title="SNIPER RIFLES" className="mb-3 shrink-0" />
              <div className="flex-1 min-h-0 flex flex-col justify-between gap-2.5">
                <WeaponCard slot={getSlot(SLOTS.MARSHAL)} />
                <WeaponCard slot={getSlot(SLOTS.OUTLAW)} />
                <WeaponCard slot={getSlot(SLOTS.OPERATOR)} />
                <CategoryHeader title="MACHINE GUNS" className="my-1 shrink-0" />
                <WeaponCard slot={getSlot(SLOTS.ARES)} />
                <WeaponCard slot={getSlot(SLOTS.ODIN)} />
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Column 5: PLAYER CARDS & EXPRESSIONS                          */}
            {/* Rows 1–4: Player Card Banner (Level Badge + Card Art + Name)  */}
            {/* Rows 5–6: EXPRESSIONS header + Radial Wheel                   */}
            {/* ------------------------------------------------------------- */}
            <div className="h-[660px] flex flex-col">
              <CategoryHeader title="PLAYER CARDS" className="mb-3 shrink-0" />
              <div className="flex-1 min-h-0 flex flex-col justify-between items-center">
                {/* Top: Player Card Banner */}
                <div className="w-full flex flex-col items-center">
                  <div className="flex justify-center -mb-2.5 z-10">
                    <div className="bg-[#22162e] border border-[#d0bcff]/50 rounded px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#d0bcff] shadow-md flex items-center gap-1">
                      <span className="text-[#d0bcff]/40 text-[9px]">&lt;</span>
                      <span>{player.accountLevel || 398}</span>
                      <span className="text-[#d0bcff]/40 text-[9px]">&gt;</span>
                    </div>
                  </div>

                  <div
                    className="relative w-[220px] h-[330px] border-2 border-[#ffb4a9]/80 bg-[#1c1326] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
                    style={{
                      clipPath: 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)',
                    }}
                  >
                    {cardSrc ? (
                      <img
                        src={cardSrc}
                        alt="Player Card"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={() => setCardImgFailed(true)}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[#d0bcff]/60 text-xs font-mono">
                        No Card Equipped
                      </div>
                    )}

                    {/* Gold name banner across lower section */}
                    <div className="absolute bottom-11 inset-x-0 bg-[#e8c66c] py-1 text-center shadow-md">
                      <span className="font-display font-black text-[15px] text-[#10171b] uppercase tracking-wide block truncate px-2">
                        {player.name}
                      </span>
                    </div>

                    {/* Subtitle / Title below banner */}
                    <div className="absolute bottom-3 inset-x-0 text-center text-white text-[11px] font-semibold tracking-wider drop-shadow-md">
                      <span>{player.agentName || 'Six Seven'}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom: Expressions Radial Wheel */}
                <div className="w-full flex flex-col items-center">
                  <CategoryHeader title="EXPRESSIONS" className="mb-2" />
                  <ExpressionsWheel items={loadout?.expressions ?? []} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
