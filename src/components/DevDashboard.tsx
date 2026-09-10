import React, { useEffect, useState } from 'react';
import { FlaskConical, Play, Trash2, Radio } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import {
  fetchDisplayInfo,
  fetchGpuInfo,
  showOverlay,
  hideOverlay,
  setOverlayEditMode,
  getOverlayEditMode,
  isOverlayVisible,
  isTabDown,
  setOverlayWindowed,
  fetchWindows,
  fetchValorantConfigs,
} from '../utils/ipc';
import { detectLocalAccount } from '../utils/tracker';
import {
  DEV_MOCK_KEY,
  DEV_TAB_KEY,
  DEV_NO_CLIENT_KEY,
  getDevMockPhase,
  type DevMockPhase,
} from '../utils/devTools';

/**
 * DEV-BUILDS ONLY dashboard (never reachable in release: the Sidebar entry
 * and App route are both gated on IS_DEV). Test overlay + tracker flows
 * with zero Riot dependency: canned matches, Tab override, client-closed
 * simulation, raw IPC smoke tests, and a live backend event log.
 */
export const DevDashboard: React.FC = () => {
  const [phase, setPhase] = useState<DevMockPhase>(() => getDevMockPhase());
  const [tabHeld, setTabHeld] = useState(() => {
    try {
      return localStorage.getItem(DEV_TAB_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [noClient, setNoClient] = useState(() => {
    try {
      return localStorage.getItem(DEV_NO_CLIENT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<{ t: string; name: string; payload: string }[]>([]);
  const [windowed, setWindowed] = useState(false);

  const pickPhase = (p: DevMockPhase) => {
    try {
      if (p === 'off') localStorage.removeItem(DEV_MOCK_KEY);
      else localStorage.setItem(DEV_MOCK_KEY, p);
    } catch {}
    setPhase(p);
  };

  const flip = (key: string, cur: boolean, set: (v: boolean) => void) => {
    const next = !cur;
    try {
      if (next) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    } catch {}
    set(next);
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setOutputs((o) => ({ ...o, [label]: '…' }));
    try {
      const r = await fn();
      setOutputs((o) => ({ ...o, [label]: JSON.stringify(r, null, 1)?.slice(0, 900) ?? 'ok' }));
    } catch (e) {
      setOutputs((o) => ({ ...o, [label]: `ERROR: ${e instanceof Error ? e.message : String(e)}` }));
    }
  };

  useEffect(() => {
    const names = ['overlay-edit-mode-changed', 'overlay-config-changed', 'display-mode-changed', 'auto-borderless-applied'];
    let alive = true;
    const stops: (() => void)[] = [];
    for (const n of names) {
      listen<unknown>(n, (ev) => {
        if (!alive) return;
        const t = new Date().toLocaleTimeString();
        setEvents((prev) =>
          [{ t, name: n, payload: JSON.stringify(ev.payload)?.slice(0, 220) ?? '' }, ...prev].slice(0, 30)
        );
      })
        .then((fn) => stops.push(fn))
        .catch(() => {});
    }
    return () => {
      alive = false;
      stops.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, []);

  const tests: { label: string; fn: () => Promise<unknown> }[] = [
    { label: 'Display info', fn: fetchDisplayInfo },
    { label: 'GPU info', fn: fetchGpuInfo },
    { label: 'Overlay visible?', fn: isOverlayVisible },
    { label: 'Edit mode?', fn: getOverlayEditMode },
    { label: 'Tab down?', fn: isTabDown },
    { label: 'Open overlay', fn: () => showOverlay().then(() => 'shown') },
    { label: 'Close overlay', fn: () => hideOverlay().then(() => 'hidden') },
    { label: 'Edit mode ON', fn: () => setOverlayEditMode(true).then(() => 'editing') },
    { label: 'Edit mode OFF', fn: () => setOverlayEditMode(false).then(() => 'locked') },
    { label: 'Windows list', fn: fetchWindows },
    { label: 'Valorant configs', fn: fetchValorantConfigs },
    { label: 'Local account', fn: detectLocalAccount },
  ];

  const phases: { id: DevMockPhase; label: string }[] = [
    { id: 'off', label: 'Off (real client)' },
    { id: 'pregame', label: 'Agent Select 5v5' },
    { id: 'coregame', label: 'In Match 5v5' },
    { id: 'deathmatch', label: 'Deathmatch' },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col gap-3.5 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar px-4 sm:px-6 py-3.5 pb-10">
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="w-8 h-8 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
          <FlaskConical className="w-4 h-4 text-amber-300" />
        </span>
        <div>
          <h2 className="font-display font-black text-m3-on-surface leading-tight">Dev Dashboard</h2>
          <p className="text-[11px] text-m3-outline">Dev builds only — test overlay + tracker with no Riot open. Live views pick up simulators on next poll.</p>
        </div>
      </div>

      {/* Match simulator */}
      <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4 shrink-0">
        <h4 className="font-display font-bold text-sm text-m3-on-surface mb-1">Mock live match</h4>
        <p className="text-[11px] text-m3-outline mb-2.5">Feeds Live Match tab + in-game overlay with canned data. Open the overlay + edit HUD to position widgets against it.</p>
        <div className="flex flex-wrap gap-1.5">
          {phases.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickPhase(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                phase === p.id
                  ? 'bg-m3-primary/20 border-m3-primary text-m3-primary'
                  : 'bg-m3-surface-container-low border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* State simulators */}
      <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4 shrink-0">
        <h4 className="font-display font-bold text-sm text-m3-on-surface mb-2.5">State overrides</h4>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => flip(DEV_TAB_KEY, tabHeld, setTabHeld)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
              tabHeld ? 'bg-m3-primary/20 border-m3-primary text-m3-primary' : 'bg-m3-surface-container-low border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface'
            }`}
          >
            Tab held: {tabHeld ? 'ON (scoreboard shows)' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => flip(DEV_NO_CLIENT_KEY, noClient, setNoClient)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
              noClient ? 'bg-m3-coral/15 border-m3-coral/50 text-m3-coral' : 'bg-m3-surface-container-low border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface'
            }`}
          >
            Riot closed: {noClient ? 'ON (empty states)' : 'OFF'}
          </button>
        </div>
      </section>

      {/* Overlay as window (debug the white bar off-fullscreen) */}
      <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4 shrink-0">
        <h4 className="font-display font-bold text-sm text-m3-on-surface mb-1">Overlay as window</h4>
        <p className="text-[11px] text-m3-outline mb-2.5">
          Drops the overlay out of fullscreen click-through into a framed 1280×800 window you can move, resize, and dock DevTools against. Toggle back to restore fullscreen HUD.
        </p>
        <button
          type="button"
          onClick={() => {
            const next = !windowed;
            setWindowed(next);
            void setOverlayWindowed(next).catch(() => setWindowed(!next));
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
            windowed ? 'bg-m3-primary/20 border-m3-primary text-m3-primary' : 'bg-m3-surface-container-low border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface'
          }`}
        >
          Windowed overlay: {windowed ? 'ON' : 'OFF'}
        </button>
      </section>

      {/* IPC smoke tests */}
      <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4 shrink-0">
        <h4 className="font-display font-bold text-sm text-m3-on-surface mb-2.5">IPC smoke tests</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {tests.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => void run(t.label, t.fn)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-m3-surface-container-low border border-m3-outline-subtle text-m3-on-surface hover:border-m3-primary/50 flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3 h-3 text-m3-primary shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
        {Object.keys(outputs).length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            {Object.entries(outputs).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-zinc-950/80 border border-white/10 p-2">
                <div className="text-[10px] font-mono font-bold text-m3-primary mb-1">{k}</div>
                <pre className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto custom-scrollbar">{v}</pre>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Backend event log */}
      <section className="rounded-2xl bg-m3-surface-container border border-m3-outline-subtle p-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display font-bold text-sm text-m3-on-surface flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-m3-primary" />
            <span>Backend events</span>
          </h4>
          <button
            type="button"
            onClick={() => setEvents([])}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-m3-surface-container-low border border-m3-outline-subtle text-m3-outline hover:text-m3-on-surface flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
        {events.length === 0 ? (
          <p className="text-[11px] text-m3-outline">No events yet — toggle edit mode, switch resolution, or change HUD config.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {events.map((e, i) => (
              <div key={`${e.t}-${i}`} className="rounded-lg bg-zinc-950/80 border border-white/10 px-2 py-1 font-mono text-[10px] flex gap-2 min-w-0">
                <span className="text-zinc-500 shrink-0">{e.t}</span>
                <span className="text-m3-primary font-bold shrink-0">{e.name}</span>
                <span className="text-zinc-300 truncate">{e.payload}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
