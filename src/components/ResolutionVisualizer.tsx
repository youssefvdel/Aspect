import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye,
  Check,
  Columns,
  Square,
  ExternalLink,
  Grid,
} from 'lucide-react';
import type { DisplayInfo } from '../types';

interface ResolutionVisualizerProps {
  displayInfo: DisplayInfo | null;
  onApplyResolution: (w: number, h: number, hz: number) => Promise<void>;
}

interface RatioPreset {
  name: string;
  ratio: number;
  label: string;
  description: string;
  isBlackBar: boolean;
  isTrueStretch: boolean;
}

interface AgentProfile {
  id: string;
  name: string;
  role: string;
  roleBadge: string;
  portrait: string;
  icon: string;
  bio: string;
}

const AGENTS: AgentProfile[] = [
  {
    id: 'clove',
    name: 'Clove',
    role: 'Controller',
    roleBadge: 'Kingdom Archives 3D',
    portrait: '/agents/clove.png',
    icon: '/agents/clove_ka_thumb.png',
    bio: 'Scottish immortal troublemaker. Official 3D in-game model in upright combat posture.',
  },
  {
    id: 'jett',
    name: 'Jett',
    role: 'Duelist',
    roleBadge: 'Kingdom Archives 3D',
    portrait: '/agents/jett.png',
    icon: '/agents/jett_ka_thumb.png',
    bio: 'South Korean agile entry fragger. Official 3D in-game model in upright combat posture.',
  },
  {
    id: 'reyna',
    name: 'Reyna',
    role: 'Duelist',
    roleBadge: 'Kingdom Archives 3D',
    portrait: '/agents/reyna.png',
    icon: '/agents/reyna_ka_thumb.png',
    bio: 'Mexican aggressive duelist. Official 3D in-game model in upright combat posture.',
  },
  {
    id: 'omen',
    name: 'Omen',
    role: 'Controller',
    roleBadge: 'Kingdom Archives 3D',
    portrait: '/agents/omen.png',
    icon: '/agents/omen_ka_thumb.png',
    bio: 'Shadow hunter with broad silhouette. Official 3D in-game model in upright combat posture.',
  },
  {
    id: 'sova',
    name: 'Sova',
    role: 'Initiator',
    roleBadge: 'Kingdom Archives 3D',
    portrait: '/agents/sova.png',
    icon: '/agents/sova_ka_thumb.png',
    bio: 'Russian master scout with tactical bow. Official 3D in-game model in upright combat posture.',
  },
  {
    id: 'iso',
    name: 'Iso',
    role: 'Duelist',
    roleBadge: 'Kingdom Archives 3D',
    portrait: '/agents/iso.png',
    icon: '/agents/iso_ka_thumb.png',
    bio: 'Chinese bulletproof fixer with kinetic armor. Official 3D in-game model in upright combat posture.',
  },
  {
    id: 'viper',
    name: 'Viper',
    role: 'Controller',
    roleBadge: 'Kingdom Archives 3D',
    portrait: '/agents/viper.png',
    icon: '/agents/viper_ka_thumb.png',
    bio: 'American toxic chemist. Official 3D in-game model in upright combat posture.',
  },
];

const PRESETS: RatioPreset[] = [
  {
    name: '1.45:1',
    ratio: 1.451,
    label: 'True Stretch 1.45:1',
    description: 'Bypasses VALORANT letterbox clamp completely. Targets are +22.5% wider with 0 black bars.',
    isBlackBar: false,
    isTrueStretch: true,
  },
  {
    name: '4:3',
    ratio: 1.333,
    label: '4:3 Classic',
    description: 'Standard CS stretched ratio; triggers black bars in VALORANT unless using F4 trick.',
    isBlackBar: true,
    isTrueStretch: false,
  },
  {
    name: '16:10',
    ratio: 1.6,
    label: '16:10 Balanced',
    description: 'Moderate +11% target expansion while preserving standard field-of-view baseline.',
    isBlackBar: false,
    isTrueStretch: false,
  },
  {
    name: '5:4',
    ratio: 1.25,
    label: '5:4 Ultra Wide',
    description: 'Heaviest target expansion (+42%), enforced letterbox bars in default fullscreen.',
    isBlackBar: true,
    isTrueStretch: false,
  },
  {
    name: '16:9',
    ratio: 1.777,
    label: '16:9 Native',
    description: 'Standard 1:1 pixel square aspect ratio baseline without stretch.',
    isBlackBar: false,
    isTrueStretch: false,
  },
];

export const ResolutionVisualizer: React.FC<ResolutionVisualizerProps> = ({
  displayInfo,
  onApplyResolution,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile>(AGENTS[0]);
  const [selectedRatio, setSelectedRatio] = useState<number>(1.451);
  const [activePresetName, setActivePresetName] = useState<string>('1.45:1');
  const [viewMode, setViewMode] = useState<'single' | 'split'>('split');

  const nativeH = displayInfo?.native_height || 1440;
  const currentHz = displayInfo?.current_hz || 260;

  // Calculate calculated width for current selected ratio
  const calcWidth = Math.round(nativeH * selectedRatio);
  const evenWidth = calcWidth % 2 === 0 ? calcWidth : calcWidth + 1;

  // Horizontal stretch multiplier compared to 16:9 (1.777)
  const percentageWider = Math.max(0, Math.round(((1.777 / selectedRatio) - 1) * 100));

  // Character model width scale (1.0 at 16:9, expands at lower aspect ratios)
  const hitboxWidthScale = Math.min(1.6, 1.777 / selectedRatio);

  const handleSelectPreset = (preset: RatioPreset) => {
    setSelectedRatio(preset.ratio);
    setActivePresetName(preset.name);
  };

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      {/* Header Info (M3 Expressive Surface) */}
      <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-m3-1">
        <div>
          <h2 className="font-display font-extrabold text-lg text-m3-on-surface tracking-tight">
            VALORANT Agent Stretch Simulator
          </h2>
          <p className="text-[11px] text-m3-on-surface-variant leading-tight">
            Real-time optical stretch simulation showing authentic VALORANT agent models and Unreal Engine letterbox limits.
          </p>
        </div>

        <button
          onClick={() => onApplyResolution(evenWidth, nativeH, currentHz)}
          className="px-4 py-2 rounded-full bg-m3-primary hover:bg-m3-primary/90 active:bg-m3-primary/80 text-m3-on-primary text-xs font-semibold shadow-m3-1 hover:shadow-m3-2 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer shrink-0"
        >
          <Check className="w-3.5 h-3.5 text-m3-on-primary" />
          <span>
            Apply <span className="font-mono tabular-nums">{evenWidth}×{nativeH}</span> @{' '}
            <span className="font-mono tabular-nums">{currentHz}Hz</span>
          </span>
        </button>
      </section>

      {/* Agent Selector & Viewport Controls Bar (M3 Tonal Surface) */}
      <div className="p-2.5 rounded-2xl bg-m3-surface-container border border-m3-outline-subtle space-y-2 shadow-m3-1">
        {/* Row 1: Agent Selector (M3 Filter Chips) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-m3-on-surface-variant shrink-0">Agent Model:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {AGENTS.map((agent) => {
                const isSelected = selectedAgent.id === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-m3-primary text-m3-on-primary font-semibold shadow-m3-1'
                        : 'bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface-variant font-medium border border-m3-outline-subtle'
                    }`}
                  >
                    <img
                      src={agent.icon}
                      alt={agent.name}
                      className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                    />
                    <span>{agent.name}</span>
                    <span className={`text-[9px] ${isSelected ? 'text-m3-on-primary/80' : 'text-m3-outline'}`}>
                      {agent.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* View Mode Toggle: Segmented Capsule */}
          <div className="flex items-center space-x-2">
            <div className="flex rounded-full bg-m3-surface-container-lowest p-0.5 border border-m3-outline-subtle">
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-0.5 rounded-full text-[11px] transition-all flex items-center space-x-1 cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-m3-primary text-m3-on-primary font-semibold shadow-xs'
                    : 'text-m3-outline hover:text-m3-on-surface font-medium'
                }`}
                title="Side-by-Side Comparison (Native vs Stretched)"
              >
                <Columns className="w-3 h-3" />
                <span>Side-by-Side</span>
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`px-2.5 py-0.5 rounded-full text-[11px] transition-all flex items-center space-x-1 cursor-pointer ${
                  viewMode === 'single'
                    ? 'bg-m3-primary text-m3-on-primary font-semibold shadow-xs'
                    : 'text-m3-outline hover:text-m3-on-surface font-medium'
                }`}
                title="Single Monitor View"
              >
                <Square className="w-3 h-3" />
                <span>Single</span>
              </button>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-m3-surface-container-high border border-m3-outline-subtle text-m3-on-surface-variant font-medium flex items-center space-x-1 shadow-xs">
              <Grid className="w-3 h-3 text-m3-primary" />
              <span>Range Grid</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Left 7 Cols: The Simulated Gaming Monitor Screen */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Monitor Frame */}
          <div className="w-full bg-m3-surface-container-lowest p-2 rounded-2xl border border-m3-outline-subtle shadow-m3-2 relative">
            {/* Monitor Brand & Power LED */}
            <div className="flex justify-between items-center px-2.5 pb-1.5 text-[10px] font-mono text-m3-outline">
              <div className="flex items-center space-x-2">
                <span className="tracking-widest uppercase text-m3-secondary font-semibold">TRUESTRETCH SIMULATOR 240+</span>
                <span>•</span>
                <span className="text-m3-primary font-bold">{selectedAgent.name} ({selectedAgent.role})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-m3-primary shadow-[0_0_6px_rgba(208,188,255,0.8)]" />
                <span className="text-m3-primary font-bold tabular-nums">{currentHz}Hz ACTIVE</span>
              </div>
            </div>

            {/* Screen Glass Surface - Constrained height */}
            <div className="relative w-full h-[240px] bg-[#0c0812] rounded-xl overflow-hidden border border-m3-outline-subtle/80 flex items-center justify-center select-none">
              {/* Tactical Range Grid Canvas */}
              <div
                className="absolute inset-0 opacity-25 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(208, 188, 255, 0.12) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(208, 188, 255, 0.12) 1px, transparent 1px),
                    radial-gradient(circle, rgba(208, 188, 255, 0.3) 1px, transparent 1px)
                  `,
                  backgroundSize: '40px 40px, 40px 40px, 80px 80px',
                }}
              />

              {/* Perspective Distance Sightlines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                <line x1="0" y1="0" x2="50%" y2="50%" stroke="#d0bcff" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="100%" y1="0" x2="50%" y2="50%" stroke="#d0bcff" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="100%" x2="50%" y2="50%" stroke="#d0bcff" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="100%" y1="100%" x2="50%" y2="50%" stroke="#d0bcff" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="84%" x2="100%" y2="84%" stroke="#4f378b" strokeWidth="1.5" strokeDasharray="8 6" />
              </svg>

              {/* Authentic Vertical Pillarbox Bars (Only in Single View when ratio triggers UE clamp) */}
              {viewMode === 'single' && selectedRatio < 1.44 && (
                <>
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-black/95 border-r border-m3-coral/60 flex items-center justify-center z-30"
                    style={{ width: `${Math.min(16, Math.max(4, (1.444 - selectedRatio) * 32))}%` }}
                  >
                    <span className="text-[9px] text-m3-coral font-mono font-bold tracking-widest [writing-mode:vertical-rl] select-none">
                      LETTERBOX
                    </span>
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-black/95 border-l border-m3-coral/60 flex items-center justify-center z-30"
                    style={{ width: `${Math.min(16, Math.max(4, (1.444 - selectedRatio) * 32))}%` }}
                  >
                    <span className="text-[9px] text-m3-coral font-mono font-bold tracking-widest [writing-mode:vertical-rl] select-none">
                      LETTERBOX
                    </span>
                  </div>
                </>
              )}

              {/* VIEW MODE: SINGLE SCREEN */}
              {viewMode === 'single' && (
                <div className="relative w-full h-full flex items-center justify-center">
                  <motion.div
                    animate={{ scaleX: hitboxWidthScale }}
                    transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                    className="relative z-10 h-[88%] flex items-center justify-center"
                  >
                    <img
                      src={selectedAgent.portrait}
                      alt={selectedAgent.name}
                      className="h-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] pointer-events-none"
                    />
                  </motion.div>
                </div>
              )}

              {/* VIEW MODE: SIDE-BY-SIDE COMPARISON */}
              {viewMode === 'split' && (
                <div className="relative w-full h-full grid grid-cols-2 divide-x divide-m3-outline-subtle">
                  {/* Left: Native 16:9 Baseline */}
                  <div className="relative h-full flex flex-col items-center justify-center p-1.5">
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-m3-surface-container-highest/90 border border-m3-outline-subtle text-[9px] font-mono text-m3-on-surface z-10 shadow-xs">
                      16:9 Native (1.00×)
                    </div>
                    <div className="relative h-[80%] flex items-center justify-center">
                      <img
                        src={selectedAgent.portrait}
                        alt={selectedAgent.name}
                        className="h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] opacity-90 pointer-events-none"
                      />
                    </div>
                    <span className="text-[9px] font-mono text-m3-outline font-medium">
                      Baseline: 100%
                    </span>
                  </div>

                  {/* Right: Selected Stretched Profile */}
                  <div className="relative h-full flex flex-col items-center justify-center p-1.5 bg-m3-primary-container/10">
                    <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-m3-primary-container/90 border border-m3-primary/40 text-[9px] font-mono text-m3-primary font-bold z-10 shadow-xs flex items-center space-x-1">
                      <span>{activePresetName} (+{percentageWider}%)</span>
                      {selectedRatio < 1.44 && (
                        <span className="text-m3-coral font-bold">• UE Letterbox Clamped</span>
                      )}
                    </div>
                    <div className="relative h-[80%] flex items-center justify-center">
                      <motion.div
                        animate={{ scaleX: hitboxWidthScale }}
                        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                        className="h-full flex items-center justify-center"
                      >
                        <img
                          src={selectedAgent.portrait}
                          alt={selectedAgent.name}
                          className="h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] pointer-events-none"
                        />
                      </motion.div>
                    </div>
                    <span className="text-[9px] font-mono text-m3-primary font-bold">
                      +{percentageWider}% Wider Hitbox
                    </span>
                  </div>
                </div>
              )}

              {/* Bottom HUD Dimension Badges */}
              <div className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-m3-surface-container-highest/90 border border-m3-outline-subtle text-[9px] font-mono text-m3-on-surface z-20 shadow-xs">
                Buffer: <span className="text-m3-primary font-bold tabular-nums">{evenWidth} × {nativeH}</span> ({selectedRatio.toFixed(3)}:1)
              </div>

              <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-m3-primary-container/90 border border-m3-primary/40 text-[9px] font-mono text-m3-on-primary-container z-20 font-bold shadow-xs">
                Model: <span className="font-bold tabular-nums">+{percentageWider}% WIDER</span>
              </div>
            </div>

            {/* Monitor Stand Base */}
            <div className="w-12 h-1 bg-m3-surface-container mx-auto rounded-b-lg border-x border-b border-m3-outline-subtle" />
            <div className="w-20 h-0.5 bg-m3-surface-container-high mx-auto rounded-full mt-0.5" />
          </div>

          {/* Agent Bio / Description */}
          <div className="w-full mt-2 p-2 rounded-2xl bg-m3-surface-container border border-m3-outline-subtle text-[11px] text-m3-on-surface-variant flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shadow-m3-1">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="font-bold text-m3-on-surface font-display">{selectedAgent.name}:</span>
              <span className="truncate">{selectedAgent.bio}</span>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="px-1.5 py-0.2 text-[9px] font-mono rounded-full bg-m3-surface-container-high border border-m3-outline-subtle text-m3-secondary font-medium">
                {selectedAgent.roleBadge}
              </span>
              <a
                href="https://kingdomarchives.com/models"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-m3-primary hover:text-m3-primary/80 transition-colors inline-flex items-center space-x-1 font-semibold"
              >
                <span>Kingdom Archives</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Presets & Controls */}
        <div className="lg:col-span-5 space-y-2.5">
          <section className="bg-m3-surface-container border border-m3-outline-subtle rounded-2xl p-3 sm:p-3.5 space-y-2 shadow-m3-1">
            <div className="flex items-center justify-between border-b border-m3-outline-subtle pb-2">
              <div className="flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5 text-m3-primary" />
                <h3 className="font-display font-bold text-xs text-m3-on-surface">
                  Aspect Ratio Presets
                </h3>
              </div>
              <span className="text-[10px] font-mono text-m3-outline font-semibold">
                {selectedRatio.toFixed(3)}:1 Ratio
              </span>
            </div>

            <div className="space-y-1">
              {PRESETS.map((preset) => {
                const isSelected = activePresetName === preset.name;
                return (
                  <button
                    key={preset.name}
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-m3-primary-container/40 border-2 border-m3-primary text-m3-on-primary-container shadow-xs'
                        : 'bg-m3-surface-container-high/60 hover:bg-m3-surface-container-high border-m3-outline-subtle text-m3-on-surface-variant'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-display font-bold text-xs text-m3-on-surface">{preset.label}</span>
                        {preset.isTrueStretch && (
                          <span className="px-1.5 py-0.2 rounded-full bg-m3-tertiary text-m3-on-tertiary text-[8px] font-bold uppercase tracking-wider shadow-xs">
                            OPTIMAL
                          </span>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-m3-outline font-semibold">
                        {Math.round(nativeH * preset.ratio)}×{nativeH}
                      </span>
                    </div>
                    <p className="text-[10px] text-m3-on-surface-variant mt-0.5 leading-tight">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Custom Ratio Slider */}
            <div className="pt-2 border-t border-m3-outline-subtle space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-m3-on-surface-variant font-medium">Fine-Tune Aspect Ratio:</span>
                <span className="font-mono tabular-nums font-bold text-m3-primary">
                  {selectedRatio.toFixed(3)}:1
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="1.777"
                step="0.005"
                value={selectedRatio}
                onChange={(e) => {
                  setSelectedRatio(parseFloat(e.target.value));
                  setActivePresetName('Custom');
                }}
                className="w-full h-1.5 bg-m3-surface-container-highest rounded-full appearance-none accent-m3-primary cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-m3-outline font-mono tabular-nums font-medium">
                <span>1.0:1 (Square)</span>
                <span>1.45:1 (True Stretch)</span>
                <span>1.78:1 (16:9)</span>
              </div>

              <div className="pt-1.5 text-[10px] text-m3-outline flex items-center justify-between border-t border-m3-outline-subtle/50">
                <span>UE 4.27 Clamp: <strong className="text-m3-primary font-mono">1.444:1</strong></span>
                <span className="text-m3-secondary font-medium">1.45:1 = 0 Black Bars (+22.5% Width)</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
