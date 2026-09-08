import React from 'react';

const Block: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div style={style} className={`animate-pulse bg-m3-surface-container-high ${className}`} />
);

/** Shimmering stand-ins shaped like the real cards — no layout jump when data lands. */
export const TrackerSkeletons: React.FC = () => (
  <div className="flex flex-col gap-2.5 w-full">
    <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4 flex items-center gap-4">
      <Block className="w-14 h-14 rounded-2xl shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Block className="h-3 w-20 rounded-full" />
        <Block className="h-6 w-44 rounded-lg" />
        <Block className="h-3 w-28 rounded-full" />
      </div>
      <Block className="h-8 w-16 rounded-lg shrink-0" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3 flex flex-col gap-2">
          <Block className="h-2.5 w-12 rounded-full" />
          <Block className="h-6 w-16 rounded-lg" />
        </div>
      ))}
    </div>
    <div className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-3">
      <Block className="h-2.5 w-20 rounded-full mb-2" />
      <div className="flex items-end gap-1 h-16">
        {[62, 38, 74, 45, 88, 52, 30, 66, 80, 42, 58, 70, 36, 90, 48, 64, 76, 40, 56, 68].map((h, i) => (
          <Block key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
    {[0, 1, 2].map((i) => (
      <div key={i} className="rounded-xl bg-m3-surface-container-low/60 border border-m3-outline-subtle/60 px-2.5 py-2 flex items-center gap-2.5">
        <Block className="w-1 self-stretch rounded-full min-h-10" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Block className="h-3 w-2/3 rounded-full" />
          <Block className="h-2.5 w-1/3 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);
