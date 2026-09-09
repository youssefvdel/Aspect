import React from 'react';
import scoreS from '../assets/badges/score-s.svg';
import scoreA from '../assets/badges/score-a.svg';
import scoreB from '../assets/badges/score-b.svg';
import scoreC from '../assets/badges/score-c.svg';
import scoreD from '../assets/badges/score-d.svg';

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

/** Hex-badge per tier (local assets). */
export const ScoreBadge: React.FC<{ tier: ScoreTier; size?: number }> = ({ tier, size = 64 }) => {
  const src = { S: scoreS, A: scoreA, B: scoreB, C: scoreC, D: scoreD }[tier];
  return <img src={src} alt={`${tier} tier`} width={size} height={size} className="object-contain shrink-0" />;
};
