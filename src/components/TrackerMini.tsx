import React, { useEffect, useState } from 'react';
import { detectLocalAccount, detectRegion, fetchMmrDirect, gameData } from '../utils/tracker';
import { fetchTrnActStats } from '../utils/trn';

interface Mini {
  name: string;
  tag: string;
  rank: string;
  rr: number;
  peak: string;
  peakTier: number;
  tier: number;
  icon: string;
  peakIcon: string;
  banner: string;
  flag: string;
}

const flagEmoji = (cc: string): string => {
  const c = cc.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

/** Full TRN-style player card docked in the app sidebar. */
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
            ? fetchTrnActStats(name, tag, prof.currentSeasonId).then((r) => r).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!live) return;
        const peakTier = prof.seasons.reduce((m, s) => Math.max(m, s.tier), 0);
        setMini({
          name: name || prof.name,
          tag: tag || prof.tag,
          rank: prof.rank,
          rr: prof.rr,
          peak: prof.peak,
          peakTier,
          tier: prof.tier,
          icon: gd?.tierIcons[prof.tier] ?? '',
          peakIcon: gd?.tierIcons[peakTier] ?? '',
          banner: trn?.stats.avatarUrl ?? '',
          flag: flagEmoji(trn?.countryCode ?? ''),
        });
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, []);

  if (!mini || !mini.name) return null;
  return (
    <div className="mx-3.5 mb-3 rounded-2xl overflow-hidden bg-m3-surface-container border border-m3-primary/30">
      {mini.banner ? (
        <div className="h-16 bg-cover bg-center" style={{ backgroundImage: `url(${mini.banner})` }} />
      ) : (
        <div className="h-10 bg-m3-surface-container-high" />
      )}
      <div className="p-2.5 pt-0 flex flex-col items-center gap-1 -mt-6">
        <div className="flex items-end justify-between w-full px-1">
          <div className="flex flex-col items-center gap-0.5 w-16">
            {mini.icon ? <img src={mini.icon} alt={mini.rank} className="w-10 h-10 object-contain" /> : null}
            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-m3-outline text-center leading-tight">
              {mini.rank}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-m3-primary">Current</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 w-16">
            {mini.peakIcon ? <img src={mini.peakIcon} alt={mini.peak} className="w-10 h-10 object-contain opacity-90" /> : null}
            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-m3-tertiary text-center leading-tight">
              {mini.peak}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-m3-outline">Peak</span>
          </div>
        </div>
        <span className="font-display font-extrabold text-[13px] text-m3-on-surface text-center break-all leading-tight">
          {mini.name}<span className="text-m3-outline">#{mini.tag}</span>
        </span>
        <span className="text-[10px] text-m3-outline">
          {mini.flag ? <span className="mr-1">{mini.flag}</span> : null}
          <span className="font-mono text-m3-primary font-bold">{mini.rr} RR</span>
        </span>
      </div>
    </div>
  );
};
