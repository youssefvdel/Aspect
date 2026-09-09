import React from 'react';

export type ScoreTier = 'S' | 'A' | 'B' | 'C' | 'D';

export const SCORE_TIERS: { tier: ScoreTier; min: number; color: string; dim: string }[] = [
  { tier: 'S', min: 825, color: '#40c4ff', dim: '#1c5a76' },
  { tier: 'A', min: 650, color: '#3ddc84', dim: '#1d6b41' },
  { tier: 'B', min: 475, color: '#e8b73a', dim: '#7a5c17' },
  { tier: 'C', min: 300, color: '#9fb2c8', dim: '#4a5a6e' },
  { tier: 'D', min: 0, color: '#c98a94', dim: '#6e3f46' },
];

export const scoreTier = (score: number): (typeof SCORE_TIERS)[number] =>
  SCORE_TIERS.find((t) => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];

/** Letter grade from a TRN percentile. Reproduces TRN's observed bands
    (S≤15% top, A≤35%, B≤50%, C bottom≤25%, else D). */
export const gradeFor = (pct: number): ScoreTier => {
  const top = 100 - pct;
  if (top <= 15) return 'S';
  if (top <= 35) return 'A';
  if (top <= 50) return 'B';
  if (pct >= 25) return 'C';
  return 'D';
};

const TIER_COLOR: Record<ScoreTier, string> = {
  S: '#40c4ff',
  A: '#3ddc84',
  B: '#e8b73a',
  C: '#9fb2c8',
  D: '#c98a94',
};

/** Hex-badge with crown, tinted by tier — same language as TRN's, our own art. */
export const ScoreBadge: React.FC<{ tier: ScoreTier; size?: number }> = ({ tier, size = 64 }) => {
  const c = TIER_COLOR[tier];
  const cx = 50;
  const cy = 54;
  const pt = (i: number, r: number): string => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  };
  const ring = [0, 1, 2, 3, 4, 5].map((i) => pt(i, 44)).join(' ');
  const inner = [0, 1, 2, 3, 4, 5].map((i) => pt(i, 30)).join(' ');
  return (
    <svg width={size} height={size} viewBox="0 0 100 108" aria-label={`${tier} tier`}>
      <polygon points={ring} fill="#14141c" stroke={c} strokeWidth="5" strokeLinejoin="round" opacity="0.95" />
      <polygon points={ring} fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" opacity="0.35" transform={`translate(0,0) scale(1)`} />
      <polygon points={inner} fill="#0b0b12" stroke="#2a2a38" strokeWidth="2" strokeLinejoin="round" />
      {/* crown */}
      <g transform="translate(50,54)">
        <path
          d="M-16,8 L-20,-8 L-10,-1 L-5,-12 L0,-2 L5,-12 L10,-1 L20,-8 L16,8 Z M-13,12 L13,12 L11,16 L-11,16 Z"
          fill="#f2f2f5"
        />
        <circle cx="-5" cy="-14" r="2.2" fill={c} />
        <circle cx="5" cy="-14" r="2.2" fill={c} />
        <circle cx="0" cy="-4" r="2.2" fill={c} />
      </g>
    </svg>
  );
};
