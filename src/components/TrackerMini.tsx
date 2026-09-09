import React, { useEffect, useState } from 'react';
import { detectLocalAccount, detectRegion, fetchMmrDirect, gameData } from '../utils/tracker';
import { fetchTrnActStats } from '../utils/trn';

interface Mini {
  name: string;
  tag: string;
  rank: string;
  rr: number;
  peak: string;
  icon: string;
  peakIcon: string;
  avatarUrl: string;
  bannerUrl: string;
  countryCode: string;
}

/** Full TRN-style player profile card docked in the app sidebar. */
export const TrackerMini: React.FC = () => {
  const [mini, setMini] = useState<Mini | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const region = await detectRegion();
        const acc = await detectLocalAccount().catch(() => null);
        const name = acc?.game_name ?? '';
        const tag = acc?.tagline ?? '';
        const prof = await fetchMmrDirect(region, name, tag);
        const [gd, trn] = await Promise.all([
          gameData().catch(() => null),
          name
            ? fetchTrnActStats(name, tag, prof.currentSeasonId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!live) return;

        const peakTier = prof.seasons.reduce((m, s) => Math.max(m, s.tier), 0);
        const rawAvatar = trn?.stats.avatarUrl ?? '';
        const cardMatch = rawAvatar.match(/playercards\/([^/]+)/);
        const bannerUrl = cardMatch
          ? `https://media.valorant-api.com/playercards/${cardMatch[1]}/wideart.png`
          : '';

        setMini({
          name: name || prof.name,
          tag: tag || prof.tag,
          rank: prof.rank,
          rr: prof.rr,
          peak: prof.peak,
          icon: gd?.tierIcons[prof.tier] ?? '',
          peakIcon: gd?.tierIcons[peakTier] ?? (gd?.tierIcons[prof.tier] ?? ''),
          avatarUrl: rawAvatar,
          bannerUrl,
          countryCode: trn?.countryCode ?? '',
        });
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, []);

  if (!mini || !mini.name) return null;

  const flagUrl = mini.countryCode ? `https://flagcdn.com/24x18/${mini.countryCode.toLowerCase()}.png` : '';

  return (
    <div className="mx-3 mb-2.5 rounded-2xl overflow-hidden bg-m3-surface-container border border-m3-outline-subtle shadow-m3-1 shrink-0">
      {/* Banner hero */}
      <div className="relative h-16 w-full bg-m3-surface-container-high overflow-hidden shrink-0">
        {mini.bannerUrl ? (
          <img
            src={mini.bannerUrl}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-m3-primary/30 via-m3-surface-container-high to-m3-tertiary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-m3-surface-container via-transparent to-transparent opacity-90" />
      </div>

      {/* Avatar + Identity */}
      <div className="px-2.5 pb-2.5 flex flex-col items-center -mt-7 relative z-10">
        <div className="relative mb-1 shrink-0">
          {mini.avatarUrl ? (
            <img
              src={mini.avatarUrl}
              alt={mini.name}
              className="w-13 h-13 rounded-full object-cover border-2 border-m3-surface-container shadow-md bg-m3-surface-container-highest"
            />
          ) : (
            <div className="w-13 h-13 rounded-full border-2 border-m3-surface-container shadow-md bg-m3-surface-container-highest flex items-center justify-center font-bold text-base text-m3-primary">
              {mini.name[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          {flagUrl ? (
            <img
              src={flagUrl}
              alt={mini.countryCode}
              className="absolute -bottom-0.5 -right-0.5 w-4.5 h-3 object-cover rounded-xs shadow border border-black/40"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          ) : null}
        </div>

        <div className="font-display font-extrabold text-sm text-m3-on-surface text-center truncate max-w-full">
          {mini.name}
          <span className="text-m3-outline text-xs font-semibold ml-0.5">#{mini.tag}</span>
        </div>

        {/* Current & Peak Ranks row */}
        <div className="grid grid-cols-2 gap-1.5 w-full mt-2 pt-2 border-t border-m3-outline-subtle/40">
          {/* Current */}
          <div className="flex flex-col items-center text-center px-0.5">
            {mini.icon ? (
              <img src={mini.icon} alt={mini.rank} className="w-8 h-8 object-contain mb-0.5" />
            ) : null}
            <div className="text-[10px] font-bold text-m3-on-surface leading-tight truncate max-w-full">
              {mini.rank}
            </div>
            <div className="text-[8px] font-bold uppercase tracking-wider text-m3-primary mt-0.5">
              Current • {mini.rr} RR
            </div>
          </div>

          {/* Lifetime Peak */}
          <div className="flex flex-col items-center text-center px-0.5 border-l border-m3-outline-subtle/40">
            {mini.peakIcon ? (
              <img src={mini.peakIcon} alt={mini.peak} className="w-8 h-8 object-contain mb-0.5 opacity-90" />
            ) : null}
            <div className="text-[10px] font-bold text-m3-tertiary leading-tight truncate max-w-full">
              {mini.peak}
            </div>
            <div className="text-[8px] font-bold uppercase tracking-wider text-m3-outline mt-0.5">
              Lifetime Peak
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
