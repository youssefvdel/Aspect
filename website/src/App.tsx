import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
const CRTWarp = lazy(() => import('./components/CRTWarp'));
import PixelTrail from './components/PixelTrail';
import VariableProximity from './components/VariableProximity';
import AppPreviewsStack from './components/AppPreviewsStack';
import Lenis from 'lenis';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import confetti from 'canvas-confetti';
import {
  Download,
  Shield,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
  Lock,
  Cpu,
  Zap,
  Coffee,
  CheckCircle2,
  XCircle,
  Crosshair,
  Sliders,
  Maximize2,
  Eye,
  Layers,
  Sparkles,
  Move,
  Search,
  Check,
  X,
  Play,
  Terminal,
  Activity,
  User,
  Flame,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface ReleaseInfo {
  version: string;
  downloadUrl: string;
  size: string;
}

const DEFAULT_RELEASE: ReleaseInfo = {
  version: 'v0.3.2',
  downloadUrl: 'https://github.com/youssefvdel/Recon/releases/download/v0.3.2/Recon_0.3.2_x64-setup.exe',
  size: '18 MB',
};
const GITHUB_REPO_URL = 'https://github.com/youssefvdel/Recon';

const GithubIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* 1. INTERACTIVE BEFORE/AFTER TRUE STRETCH SLIDER                    */
/* Inspired by awesome-react-components image comparison tools        */
/* ------------------------------------------------------------------ */

function StretchComparisonSlider() {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  const handlePointerDown = () => setIsDragging(true);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) handleMove(e.clientX);
    };
    const onPointerUp = () => setIsDragging(false);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging]);

  return (
    <div className="w-full flex flex-col items-center">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="relative w-full max-w-3xl h-64 sm:h-80 rounded-2xl border border-white/20 bg-[#0d0914] overflow-hidden select-none cursor-ew-resize shadow-2xl touch-none"
      >
        {/* Left Side: Native 16:9 (Thin Hitbox) */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0914]">
          {/* Simulated Valorant Crosshair & Target */}
          <div className="flex flex-col items-center scale-x-100 transition-transform">
            <div className="w-10 h-10 rounded-full bg-[#ff4655] border-2 border-white/70 shadow-lg flex items-center justify-center font-mono text-[9px] font-black text-white">
              16:9
            </div>
            <div className="w-16 h-28 mt-1.5 rounded-xl bg-zinc-800 border border-white/20 flex items-center justify-center font-mono text-[9px] text-zinc-400">
              HITBOX
            </div>
          </div>
          {/* Native Label */}
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 font-mono text-xs text-zinc-300">
            Native 16:9 (1920×1080)
          </div>
        </div>

        {/* Right Side: Stretched (+22.6% Wider Hitbox) with Clip Path */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-[#140b20]"
          style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
        >
          {/* Stretched Target */}
          <div className="flex flex-col items-center scale-x-[1.226] transition-transform">
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#b6abf7] to-[#806bff] border-2 border-white shadow-[0_0_15px_rgba(182,171,247,0.6)] flex items-center justify-center font-mono text-[9px] font-black text-[#1b1721]">
              STRETCH
            </div>
            <div className="w-16 h-28 mt-1.5 rounded-xl bg-[#2b1b42] border border-[#b6abf7]/50 shadow-inner flex items-center justify-center font-mono text-[9px] font-bold text-[#b6abf7]">
              +22.6% WIDE
            </div>
          </div>
          {/* Stretched Label */}
          <div className="absolute top-4 right-4 bg-[#b6abf7]/20 backdrop-blur-md px-3 py-1 rounded-lg border border-[#b6abf7]/40 font-mono text-xs font-bold text-[#b6abf7]">
            Recon True Stretch 1.45:1 (2088×1440)
          </div>
        </div>

        {/* Crosshair Center Reference */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ffcc]" />
          <div className="absolute w-8 h-[1px] bg-[#00ffcc]/70" />
          <div className="absolute h-8 w-[1px] bg-[#00ffcc]/70" />
        </div>

        {/* Draggable Divider Bar */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] flex items-center justify-center pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="w-8 h-8 rounded-full bg-white text-zinc-950 font-black text-[10px] flex items-center justify-center shadow-2xl border-2 border-zinc-950">
            ↔
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between w-full max-w-3xl text-xs font-mono text-zinc-400 px-1">
        <span>← Drag left to reveal True Stretch</span>
        <span className="text-[#a8f5cc] font-bold">100% Vertical FOV Kept • 0ms Added Latency</span>
        <span>Drag right for Native →</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. INTERACTIVE STREAMER-MODE UNMASKER SIMULATOR                     */
/* Demonstrates how Recon decodes hidden player tags in real-time      */
/* ------------------------------------------------------------------ */

function StreamerUnmaskerDemo() {
  const [isUnmasked, setIsUnmasked] = useState(false);

  const players = [
    {
      agent: 'Reyna',
      masked: 'Anonymous Player #1',
      realName: '4523461375#4135',
      rank: 'Diamond 3',
      peak: 'Ascendant 2',
      kd: '1.42',
      hs: '32%',
    },
    {
      agent: 'Breach',
      masked: 'Secret Agent #2',
      realName: 'ジLeViジ#2113',
      rank: 'Gold 2',
      peak: 'Platinum 2',
      kd: '1.08',
      hs: '24%',
    },
    {
      agent: 'Cypher',
      masked: 'Hidden User #3',
      realName: 'ben#zwace',
      rank: 'Bronze 1',
      peak: 'Bronze 2',
      kd: '0.94',
      hs: '19%',
    },
    {
      agent: 'Sova',
      masked: 'Ghost #4',
      realName: 'xSilentxStorm#4198',
      rank: 'Silver 1',
      peak: 'Gold 2',
      kd: '1.15',
      hs: '26%',
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-white/10 bg-[#0e0914] p-5 sm:p-7 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="font-mono text-xs text-[#b6abf7] uppercase tracking-wider">
            VALORANT STREAMER-MODE BYPASS
          </div>
          <h3 className="font-display font-black text-xl text-white mt-0.5">
            Real-Time Incognito Unmasker Simulator
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Opponents hide names to conceal rank/stats. Recon reads the official client loopback to expose real MMR.
          </p>
        </div>

        <button
          onClick={() => setIsUnmasked(!isUnmasked)}
          className={`px-4 py-2 rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md ${
            isUnmasked
              ? 'bg-[#a8f5cc] text-[#0d1f14] shadow-[0_0_15px_rgba(168,245,204,0.4)]'
              : 'bg-[#b6abf7] text-[#1b1721] shadow-[0_0_15px_rgba(182,171,247,0.4)]'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{isUnmasked ? 'Mask Identities' : 'Unmask Streamer Mode'}</span>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((p, i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-3 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1f152b] border border-white/10 flex items-center justify-center font-bold text-xs text-[#b6abf7]">
                {p.agent[0]}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-display font-bold text-sm transition-colors ${
                      isUnmasked ? 'text-white' : 'text-zinc-400 line-through'
                    }`}
                  >
                    {isUnmasked ? p.realName : p.masked}
                  </span>
                  {!isUnmasked && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-red-500/20 text-red-300 border border-red-500/30">
                      HIDDEN
                    </span>
                  )}
                </div>
                <span className="text-[10.5px] font-mono text-zinc-400">
                  {p.agent} • Rank: <strong className="text-[#a8f5cc]">{p.rank}</strong> (Peak: {p.peak})
                </span>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <div className="text-white font-bold">{p.kd} KD</div>
              <div className="text-[10px] text-zinc-400">{p.hs} HS%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. LIGHTBOX MODAL FOR REAL APP SCREENSHOT INSPECTION               */
/* ------------------------------------------------------------------ */

function ScreenshotLightbox({
  isOpen,
  imageSrc,
  title,
  onClose,
}: {
  isOpen: boolean;
  imageSrc: string;
  title: string;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-6xl w-full max-h-[92vh] rounded-2xl border border-white/20 bg-[#0e0914] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-black/60">
          <span className="font-mono text-xs text-white font-bold">{title}</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 overflow-auto max-h-[84vh] flex items-center justify-center bg-[#07040a]">
          <img src={imageSrc} alt={title} className="max-w-full h-auto object-contain rounded-lg shadow-2xl" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN APPARATUS COMPONENT                                            */
/* ------------------------------------------------------------------ */

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const [activeShot, setActiveShot] = useState<'hud' | 'inventory' | 'unmasked' | 'overview' | 'stretch'>('hud');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [release, setRelease] = useState<ReleaseInfo>(DEFAULT_RELEASE);
  const [lightbox, setLightbox] = useState<{ isOpen: boolean; src: string; title: string }>({
    isOpen: false,
    src: '',
    title: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchLatestRelease() {
      // 1. First attempt: latest.json directly from GitHub Releases (fastest, no rate limits)
      try {
        const res = await fetch(
          'https://github.com/youssefvdel/Recon/releases/latest/download/latest.json',
          { cache: 'no-cache' }
        );
        if (res.ok) {
          const data = await res.json();
          const v = data.version?.startsWith('v') ? data.version : `v${data.version}`;
          const url = data.platforms?.['windows-x86_64']?.url;
          if (isMounted && v && url) {
            setRelease((prev) => ({
              ...prev,
              version: v,
              downloadUrl: url,
            }));
          }
        }
      } catch {}

      // 2. Second attempt: GitHub REST API to obtain exact asset file size
      try {
        const apiRes = await fetch('https://api.github.com/repos/youssefvdel/Recon/releases/latest');
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          const exeAsset = apiData.assets?.find((a: { name?: string; browser_download_url?: string; size?: number }) =>
            a.name?.endsWith('.exe')
          );
          if (isMounted && exeAsset) {
            const mb = `${Math.round(exeAsset.size / (1024 * 1024))} MB`;
            setRelease((prev) => ({
              version: apiData.tag_name || prev.version,
              downloadUrl: exeAsset.browser_download_url || prev.downloadUrl,
              size: mb,
            }));
          }
        }
      } catch {}
    }

    fetchLatestRelease();
    return () => {
      isMounted = false;
    };
  }, []);

  // Smooth scrolling engine (Lenis + GSAP ticker with 2.0s delayed ice glide)
  useEffect(() => {
    const lenis = new Lenis({
      duration: 2.0, // 2.0s lazy catch-up delay for floating ice-slide feel
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Exponential deceleration
      smoothWheel: true,
      wheelMultiplier: 1.2,
      touchMultiplier: 1.5,
      anchors: true,
      respectReducedMotion: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const onTicker = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(onTicker);
    gsap.ticker.lagSmoothing(0);

    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href^="#"]');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href) return;
      if (href === '#') {
        e.preventDefault();
        lenis.scrollTo(0, { duration: 2.0 });
      } else if (href.startsWith('#')) {
        const el = document.querySelector(href);
        if (el) {
          e.preventDefault();
          lenis.scrollTo(el as HTMLElement, { offset: -60, duration: 2.0 });
        }
      }
    };
    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      gsap.ticker.remove(onTicker);
      lenis.destroy();
    };
  }, []);

  const handleDownload = () => {
    confetti({
      particleCount: 110,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#b6abf7', '#f4a390', '#a8f5cc', '#ffffff'],
    });
    window.location.href = release.downloadUrl;
  };

  useGSAP(
    () => {
      // Cinematic hero text entrance
      gsap.from('.gsap-hero-title', {
        y: 45,
        opacity: 0,
        duration: 1.1,
        ease: 'power3.out',
      });
      gsap.from('.gsap-hero-sub', {
        y: 35,
        opacity: 0,
        duration: 1.1,
        delay: 0.15,
        ease: 'power3.out',
      });
      gsap.from('.gsap-hero-cta', {
        y: 25,
        opacity: 0,
        duration: 1.0,
        delay: 0.3,
        ease: 'power3.out',
      });

      // Bento cards staggered entrance on scroll
      gsap.utils.toArray<HTMLElement>('.gsap-bento-card').forEach((card, i) => {
        gsap.from(card, {
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
          },
          y: 40,
          opacity: 0,
          duration: 0.8,
          delay: (i % 3) * 0.1,
          ease: 'power2.out',
        });
      });

      // Vanguard blueprint reveal
      gsap.from('.gsap-vanguard-card', {
        scrollTrigger: {
          trigger: '.gsap-vanguard-card',
          start: 'top 80%',
        },
        y: 50,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
      });
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-[#09060d] text-[#e8def8] selection:bg-[#b6abf7]/30 selection:text-white font-sans antialiased overflow-x-hidden"
    >
      {/* Precision ambient lighting matching real Recon Radar colors */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-[#b6abf7]/12 via-[#f4a390]/5 to-transparent blur-[120px] opacity-70" />
        <div className="absolute top-[45%] right-0 w-[500px] h-[500px] bg-[#3a205a]/20 blur-[150px] opacity-60" />
        <div className="absolute bottom-[15%] left-0 w-[500px] h-[500px] bg-[#1a5238]/15 blur-[160px] opacity-50" />
      </div>

      {/* Top subtle hairline highlight */}
      <div className="fixed top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#b6abf7]/50 to-transparent z-50 pointer-events-none" />

      {/* Global Interactive Pixel Trail across entire website (under text & photos, over background) */}
      <PixelTrail
        gridSize={20}
        trailSize={0.09}
        maxAge={320}
        interpolate={10}
        color="#b6abf7"
      />

      {/* Lightbox Modal */}
      <ScreenshotLightbox
        isOpen={lightbox.isOpen}
        imageSrc={lightbox.src}
        title={lightbox.title}
        onClose={() => setLightbox({ isOpen: false, src: '', title: '' })}
      />

      {/* ========================================================================= */}
      {/* 1. MINIMAL TECHNICAL HEADER                                               */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#09060d]/85 border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 rounded-xl bg-[#140e1b] border border-[#b6abf7]/30 flex items-center justify-center p-1.5 shadow-md group-hover:border-[#b6abf7] transition-colors">
              <img src="/icon.png" alt="Recon Radar Icon" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg tracking-wider text-white">RECON</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#261738] text-[#b6abf7] border border-[#b6abf7]/40">
                  {release.version}
                </span>
              </div>
              <span className="text-[9.5px] font-mono text-zinc-500 uppercase tracking-widest leading-none mt-0.5">
                COMPETITIVE ESPORTS TOOLKIT
              </span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-wider text-zinc-400">
            <a href="#app-previews" className="hover:text-white transition-colors">Live App</a>
            <a href="#simulator" className="hover:text-white transition-colors">Hitbox Math</a>
            <a href="#vanguard" className="hover:text-[#a8f5cc] transition-colors flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a8f5cc]" />
              <span>Vanguard Safe</span>
            </a>
            <a href="#benchmarks" className="hover:text-white transition-colors">Benchmarks</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={`${GITHUB_REPO_URL}/releases/tag/${release.version}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.02] text-xs font-mono text-zinc-300 hover:text-white transition-colors"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>{release.version}</span>
            </a>

            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg bg-[#b6abf7] hover:bg-[#c8c0fa] text-[#1b1721] font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 tap-feedback active:scale-[0.97] cursor-pointer shadow-[0_0_20px_rgba(182,171,247,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6abf7]"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Download .exe</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CINEMATIC HERO (2-LINE IRON RULE, WIDE BREATHING CONTAINER)           */}
      {/* ========================================================================= */}
      <section ref={heroRef} className="relative pt-16 sm:pt-28 pb-16 z-10 text-center overflow-hidden">
        {/* CRT Warp plasma backdrop: first thing behind the hero */}
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <Suspense fallback={null}>
            <CRTWarp
            color="#b6abf7"
            backgroundColor="#09060d"
            speed={0.45}
            curvature={0.3}
            scanlineStrength={0.22}
            scanlineFrequency={220}
            waveAmplitude={0.32}
            waveFrequency={2.4}
            bloom={1.4}
            bloomRadius={1}
            noise={0.08}
            vignette={0.35}
            brightness={1.1}
            mouseReact={true}
            mouseStrength={0.5}
            fps={30}
            style={{ opacity: 0.6 }}
          />
          </Suspense>
          {/* Legibility wash: keeps headline readable over the plasma */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#09060d]/70 via-[#09060d]/25 to-[#09060d]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Radar Active Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b1721] border border-[#b6abf7]/30 text-xs font-mono text-[#b6abf7] mb-7 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-[#f4a390] shadow-[0_0_8px_#f4a390]" />
          <span>TRUE STRETCHED RESOLUTION & IN-GAME SCOUT FOR VALORANT</span>
        </div>

        {/* Interactive VariableProximity Hero Title */}
        <h1 className="gsap-hero-title font-display font-medium text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white max-w-5xl mx-auto leading-[1.12] text-balance select-none my-4 sm:my-6">
          <VariableProximity
            label="Hardware-Level True Stretched Scaling &"
            className="text-white"
            fromFontVariationSettings="'wght' 500, 'opsz' 14"
            toFontVariationSettings="'wght' 950, 'opsz' 40"
            containerRef={heroRef}
            radius={160}
            falloff="linear"
          />
          <br className="hidden sm:inline" />
          <VariableProximity
            label="Real-Time In-Game Match Recon."
            className="text-[#b6abf7]"
            fromFontVariationSettings="'wght' 500, 'opsz' 14"
            toFontVariationSettings="'wght' 950, 'opsz' 40"
            containerRef={heroRef}
            radius={160}
            falloff="linear"
          />
        </h1>

        <p className="gsap-hero-sub mt-6 text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          Expand target geometry by <strong className="text-white font-mono tabular-nums">+22.6%</strong> with zero input latency, unmask hidden streamer-mode players, inspect real in-game weapon skins, and customize transparent HUD widgets over Valorant.
        </p>

        {/* CTA Section */}
        <div className="gsap-hero-cta mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
          <button
            onClick={handleDownload}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#b6abf7] hover:bg-[#c8c0fa] text-[#1b1721] font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 tap-feedback active:scale-[0.97] shadow-[0_0_35px_rgba(182,171,247,0.4)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6abf7]"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Download Recon {release.version}</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#1b1721]/15 font-bold tabular-nums">{release.size}</span>
          </button>

          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-6 py-4 rounded-xl border border-white/15 hover:border-white/30 bg-white/[0.02] text-sm font-bold text-zinc-200 flex items-center justify-center gap-2 transition-colors cursor-pointer tap-feedback active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6abf7]"
          >
            <GithubIcon className="w-4 h-4" />
            <span>Source Code (Source-Available)</span>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
          </a>
        </div>

        {/* Hardware Status Strip */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-4xl mx-auto text-left">
          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#120d1a]/50">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Input Latency</div>
            <div className="text-sm font-mono font-bold text-[#a8f5cc] mt-0.5">0.00 ms (Win32 GDI)</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#120d1a]/50">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Memory Overhead</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">~35 MB (Rust + Tauri)</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#120d1a]/50">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Vanguard Status</div>
            <div className="text-sm font-mono font-bold text-[#a8f5cc] mt-0.5">100% Ban-Safe Loopback</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#120d1a]/50">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Installer Format</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">Clean Signed .EXE</div>
          </div>
        </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. LIVE APP PREVIEWS STACK (REACTBITS SCROLLSTACK)                         */}
      {/* ========================================================================= */}
      <AppPreviewsStack />

      {/* ========================================================================= */}
      {/* 4. INTERACTIVE BEFORE/AFTER TRUE STRETCH SLIDER                            */}
      {/* ========================================================================= */}
      <section id="simulator" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto z-10 text-center">
        <div className="max-w-2xl mx-auto mb-10">
          <div className="font-mono text-xs text-[#b6abf7] uppercase tracking-wider">
            OPTICAL HITBOX GEOMETRY
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight mt-1">
            Interactive Hitbox Width Simulator
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2">
            Drag the split-slider to compare Native 16:9 model geometry against Recon True Stretch 1.45:1 (+22.6% wider crosshair targets).
          </p>
        </div>
        <StretchComparisonSlider />
      </section>

      {/* ========================================================================= */}
      {/* 5. VANGUARD COMPLIANCE ARCHITECTURE (PROPRIETARY ARCHITECTURE)            */}
      {/* ========================================================================= */}
      <section id="vanguard" className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10">
        <div className="gsap-vanguard-card rounded-2xl border border-[#a8f5cc]/30 bg-gradient-to-b from-[#0e1913] via-[#09110d] to-[#09060d] p-8 sm:p-14 relative overflow-hidden">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#a8f5cc]/15 border border-[#a8f5cc]/30 text-xs font-mono font-bold text-[#a8f5cc] mb-4">
              <ShieldCheck className="w-4 h-4" />
              <span>VANGUARD-SAFE ARCHITECTURE</span>
            </div>

            <h2 className="font-display font-black text-3xl sm:text-5xl text-white tracking-tight">
              Why Vanguard Approves Recon.
            </h2>

            <p className="mt-4 text-sm sm:text-base text-zinc-300 leading-relaxed">
              Standard overlays hook into game memory or modify direct rendering pipelines, which triggers Vanguard detection. Recon operates strictly outside the Valorant game boundary:
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl border border-white/10 bg-black/50 hover:border-[#a8f5cc]/30 transition-colors">
                <div className="font-mono text-xs text-[#a8f5cc] font-bold tracking-wider">NO PROCESS HOOKING</div>
                <h4 className="font-bold text-sm text-white mt-1.5">Zero Memory Injection</h4>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Recon never opens a handle to <code className="text-[#b6abf7]">VALORANT.exe</code>. No memory reading, no DLL injection, no code modification.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-white/10 bg-black/50 hover:border-[#a8f5cc]/30 transition-colors">
                <div className="font-mono text-xs text-[#a8f5cc] font-bold tracking-wider">OFFICIAL PROTOCOL</div>
                <h4 className="font-bold text-sm text-white mt-1.5">Riot Local Client API</h4>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Queries only the official local client loopback socket authenticated by Riot's lockfile: the exact same verified method used by Tracker Network and Blitz.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-white/10 bg-black/50 hover:border-[#a8f5cc]/30 transition-colors">
                <div className="font-mono text-xs text-[#a8f5cc] font-bold tracking-wider">WIN32 NATIVE</div>
                <h4 className="font-bold text-sm text-white mt-1.5">Hardware Display Driver</h4>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Resolution switching communicates directly with the Windows Display Driver Model (WDDM), introducing zero software compositing latency.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. HARDWARE BENCHMARKS MATRIX                                            */}
      {/* ========================================================================= */}
      <section id="benchmarks" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10">
        <div className="mb-10 text-center">
          <div className="font-mono text-xs text-[#b6abf7] uppercase">PERFORMANCE TELEMETRY</div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight mt-1">
            Recon vs Overwolf Trackers
          </h2>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/60 overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-zinc-400">
                <th className="p-4 uppercase">Parameter</th>
                <th className="p-4 text-[#b6abf7] font-bold uppercase">Recon {release.version}</th>
                <th className="p-4 uppercase">Overwolf Trackers</th>
                <th className="p-4 uppercase">Direct Registry Hacks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              <tr>
                <td className="p-4 text-white font-bold">Runtime Backend</td>
                <td className="p-4 text-[#a8f5cc] font-bold">Rust + Tauri (Native GDI)</td>
                <td className="p-4 text-red-400">Chromium Embedded (CEF)</td>
                <td className="p-4 text-zinc-400">Manual Windows Registry</td>
              </tr>
              <tr>
                <td className="p-4 text-white font-bold">Idle RAM Usage</td>
                <td className="p-4 text-[#a8f5cc] font-bold">~35 MB</td>
                <td className="p-4 text-red-400">650 MB - 1.4 GB</td>
                <td className="p-4">0 MB</td>
              </tr>
              <tr>
                <td className="p-4 text-white font-bold">Input Overhead</td>
                <td className="p-4 text-[#a8f5cc] font-bold">0.00 ms (Hardware direct)</td>
                <td className="p-4 text-red-400">+4ms to +11ms (Hook layer)</td>
                <td className="p-4">0.00 ms</td>
              </tr>
              <tr>
                <td className="p-4 text-white font-bold">In-Game Advertising</td>
                <td className="p-4 text-[#a8f5cc] font-bold">Zero (No Ads)</td>
                <td className="p-4 text-red-400">Heavy Video & Banner Ads</td>
                <td className="p-4">None</td>
              </tr>
              <tr>
                <td className="p-4 text-white font-bold">True Stretched Engine</td>
                <td className="p-4 text-[#a8f5cc] font-bold">Native Hotkey Switcher</td>
                <td className="p-4 text-red-400">Unsupported</td>
                <td className="p-4 text-zinc-400">Crash risk / Reboot needed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FAQ (SYSTEM TRANSPARENCY)                                              */}
      {/* ========================================================================= */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto z-10">
        <div className="text-center mb-12">
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight text-balance">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-zinc-400">
            Verified facts regarding Vanguard compliance, display driver latency, and security architecture.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              q: 'Can Vanguard ban my Riot account for running Recon?',
              a: 'No. Recon does not inject DLLs, read/write Valorant memory, or hook game binaries. It connects purely to the official local client loopback HTTPS port that Riot provides on your PC: the identical method used by Tracker Network, Blitz, and ValoPlant. Furthermore, v0.3.2 includes a toggle to disable Attack/Defense pregame indicators if you prefer complete visual parity.',
            },
            {
              q: 'How does True Stretched Resolution operate with 0ms delay?',
              a: 'Recon interfaces directly with the Windows Display Driver via the Win32 ChangeDisplaySettingsEx API. It resizes the native monitor output before frames are rendered, introducing zero software compositing latency.',
            },
            {
              q: 'Why did you remove the MSI installer in v0.3.2?',
              a: 'Users requested a streamlined, single-file experience. The single signed .EXE setup installer is only 18 MB, includes cryptographic minisign signature verification, and automatically handles quiet background updates without MSI dependencies.',
            },
            {
              q: 'Is Recon free to use and what is the license?',
              a: 'Recon is 100% free to download and use for all players. The source code is openly published on GitHub for transparency and Vanguard auditing under a proprietary Source-Available license. Unauthorized redistribution, cloning, or commercial exploitation is strictly prohibited.',
            },
          ].map((item, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-colors hover:border-white/20">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors tap-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6abf7]"
                >
                  <span className="font-display font-bold text-sm sm:text-base text-white">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#b6abf7] shrink-0 transition-transform duration-200 ease-out ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  id={`faq-answer-${idx}`}
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-4 text-xs sm:text-sm text-zinc-300 leading-relaxed border-t border-white/5 pt-3">
                      {item.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. BOTTOM ACTION                                                          */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 text-center">
        <div className="rounded-2xl border border-white/15 bg-gradient-to-b from-[#160f22] to-[#0a0510] p-8 sm:p-14 shadow-2xl">
          <h2 className="font-display font-black text-3xl sm:text-5xl text-white">
            Ready to Upgrade Your Setup?
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
            Lightweight 18 MB standalone setup executable. Fully verified and cryptographically signed.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#b6abf7] hover:bg-[#c8c0fa] text-[#1b1721] font-display font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 tap-feedback active:scale-[0.97] cursor-pointer shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6abf7]"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download Recon {release.version} (.exe)</span>
            </button>
            <a
              href="https://ko-fi.com/youssefvdel"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-6 py-4 rounded-xl border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/15 text-amber-300 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors tap-feedback active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Coffee className="w-4 h-4" />
              <span>Support on Ko-fi</span>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="border-t border-white/[0.08] bg-[#050308] py-10 px-4 sm:px-6 lg:px-8 text-xs font-mono text-zinc-500 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Recon Radar Logo" className="w-6 h-6 object-contain opacity-80" />
            <span>RECON // BY YOUSSEF ADEL • ALL RIGHTS RESERVED • SOURCE-AVAILABLE</span>
          </div>

          <div className="flex items-center gap-5">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors">
              GITHUB
            </a>
            <a href="https://ko-fi.com/youssefvdel" target="_blank" rel="noreferrer" className="hover:text-amber-300 transition-colors">
              KO-FI
            </a>
            <a href="https://recon.qd.je" className="hover:text-[#b6abf7] transition-colors">
              RECON.QD.JE
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-white/5 text-center text-[10px] text-zinc-600">
          Recon is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Valorant is a registered trademark of Riot Games, Inc.
        </div>
      </footer>
    </div>
  );
}
