import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import {
  checkForUpdate,
  installUpdate,
  restartApp,
  updaterSupported,
  formatBytes,
  getUpdateChannel,
  setUpdateChannel,
  type AvailableUpdate,
  type UpdateChannel,
} from '../utils/updater';
import { APP_VERSION } from '../utils/version';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatusChange?: (hasUpdate: boolean, latestVersion: string) => void;
}

type Phase = 'checking' | 'available' | 'downloading' | 'installing' | 'ready' | 'uptodate' | 'error';

/* Real update flow: the Tauri updater fetches a signed manifest, verifies the
   download against our public key, installs quietly and relaunches. No browser
   download, no GitHub page, no guessing at asset names. */
export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  onUpdateStatusChange,
}) => {
  const [phase, setPhase] = useState<Phase>('checking');
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [channel, setChannel] = useState<UpdateChannel>(getUpdateChannel);

  const performCheck = useCallback(async (channelOverride?: UpdateChannel) => {
    setPhase('checking');
    setError(null);
    try {
      const ch = channelOverride ?? channel;
      const found = await checkForUpdate(ch);
      setUpdate(found);
      if (found) {
        setPhase('available');
        onUpdateStatusChange?.(true, found.version);
      } else {
        setPhase('uptodate');
        onUpdateStatusChange?.(false, APP_VERSION);
      }
    } catch (err) {
      setError(String(err));
      setPhase('error');
    }
  }, [channel, onUpdateStatusChange]);

  const handleSwitchChannel = (next: UpdateChannel) => {
    setChannel(next);
    setUpdateChannel(next);
    performCheck(next);
  };

  useEffect(() => {
    if (isOpen) {
      setDownloaded(0);
      setTotal(0);
      performCheck();
    }
  }, [isOpen, performCheck]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never let Esc kill the modal mid-install.
      if (e.key === 'Escape' && isOpen && phase !== 'downloading' && phase !== 'installing') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, phase]);

  const handleInstall = async () => {
    if (!update) return;
    setError(null);
    try {
      await installUpdate(update, (e) => {
        if (e.phase === 'downloading') {
          setDownloaded(e.downloaded);
          setTotal(e.total);
          setPhase('downloading');
        } else {
          setPhase('installing');
        }
      });
      // Installed and verified — restart into the new build.
      setPhase('ready');
      await restartApp();
    } catch (err) {
      setError(String(err));
      setPhase('error');
    }
  };

  if (!isOpen) return null;

  const pct = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;
  const busy = phase === 'downloading' || phase === 'installing';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md rounded-2xl bg-m3-surface-container border border-m3-outline-subtle shadow-2xl p-5 flex flex-col gap-4 text-m3-on-surface"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-m3-outline-subtle/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-m3-primary/15 border border-m3-primary/30 flex items-center justify-center text-m3-primary">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-m3-on-surface leading-tight">
                  Software Updates
                </h3>
                <p className="text-[10px] text-m3-outline flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-m3-mint" />
                  Signed &amp; verified
                </p>
              </div>
            </div>
            {!busy && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg hover:bg-m3-surface-container-high flex items-center justify-center text-m3-outline hover:text-m3-on-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Update Channel Pill Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle/70 text-[11px] gap-1">
            <button
              type="button"
              onClick={() => handleSwitchChannel('stable')}
              disabled={busy}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                channel === 'stable'
                  ? 'bg-m3-primary/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-m3-outline hover:text-m3-on-surface'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Official Stable
            </button>
            <button
              type="button"
              onClick={() => handleSwitchChannel('early-access')}
              disabled={busy}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                channel === 'early-access'
                  ? 'bg-[#d0bcff]/20 text-[#d0bcff] border border-[#d0bcff]/50 shadow-sm'
                  : 'text-m3-outline hover:text-m3-on-surface'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#d0bcff]" />
              Early Access (Alpha)
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 py-1">
            {!updaterSupported() ? (
              <div className="py-4 px-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-300">
                The updater only runs inside the installed app.
              </div>
            ) : phase === 'checking' ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-center">
                <Loader2 className="w-6 h-6 text-m3-primary animate-spin" />
                <p className="text-xs font-medium text-m3-on-surface">
                  Checking for {channel === 'early-access' ? 'Early Access (Alpha)' : 'Official Stable'} updates…
                </p>
                <p className="text-[10px] text-m3-outline font-mono">
                  github.com/youssefvdel/Recon
                </p>
              </div>
            ) : phase === 'error' ? (
              <div className="py-4 px-3 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Update failed</span>
                </div>
                <p className="text-[11px] text-red-300/80 break-words">{error}</p>
              </div>
            ) : phase === 'downloading' || phase === 'installing' || phase === 'ready' ? (
              <div className="flex flex-col gap-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-m3-on-surface flex items-center gap-2">
                    {phase === 'installing' ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-m3-primary" />
                        Installing {update?.version}…
                      </>
                    ) : phase === 'ready' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-m3-mint" />
                        Installed — restarting…
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 text-m3-primary" />
                        Downloading {update?.version}…
                      </>
                    )}
                  </span>
                  <span className="text-[10px] font-mono text-m3-outline">
                    {pct !== null ? `${pct}%` : formatBytes(downloaded)}
                    {total > 0 ? ` · ${formatBytes(total)}` : ''}
                  </span>
                </div>
                {/* Determinate when the server sends a length, else a pulse. */}
                <div className="h-1.5 rounded-full bg-m3-surface-container-highest overflow-hidden">
                  <div
                    className={`h-full bg-m3-primary transition-[width] duration-200 ${
                      pct === null ? 'w-1/3 animate-pulse' : ''
                    }`}
                    style={pct !== null ? { width: `${pct}%` } : undefined}
                  />
                </div>
                <p className="text-[10px] text-m3-outline">
                  Verified against Recon's signing key before install. The app restarts itself
                  when it's done — no installer window, nothing to click.
                </p>
              </div>
            ) : phase === 'available' && update ? (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-xl bg-m3-primary/10 border border-m3-primary/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ArrowUpCircle className="w-5 h-5 text-m3-primary shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-m3-primary">
                          {update.channel === 'early-access' ? 'Early Access Update' : 'Official Update'}
                        </span>
                        <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-m3-primary text-m3-on-primary">
                          {update.version}
                        </span>
                      </div>
                      <span className="text-[10px] text-m3-outline">
                        Installed: {APP_VERSION}
                      </span>
                    </div>
                  </div>
                </div>

                {update.notes && (
                  <div className="p-3 rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle/70 custom-scrollbar max-h-40 overflow-y-auto text-xs text-m3-on-surface-variant font-mono whitespace-pre-wrap leading-relaxed">
                    {update.notes}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-m3-on-surface">You're up to date</h4>
                  <p className="text-[11px] text-m3-outline mt-0.5">
                    Recon {APP_VERSION} is the latest on the{' '}
                    <span className="font-semibold text-m3-on-surface">
                      {channel === 'early-access' ? 'Early Access (Alpha)' : 'Official Stable'}
                    </span>{' '}
                    channel.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-m3-outline-subtle/80 flex items-center justify-between gap-2">
            <button
              onClick={() => performCheck()}
              disabled={phase === 'checking' || busy}
              className="h-8 px-3 rounded-xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${phase === 'checking' ? 'animate-spin' : ''}`} />
              <span>Check Again</span>
            </button>

            <div className="flex items-center gap-2">
              {phase === 'available' && update ? (
                <button
                  onClick={handleInstall}
                  className="h-8 px-4 rounded-xl bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install &amp; Restart</span>
                </button>
              ) : busy ? (
                <span className="text-[10px] text-m3-outline font-mono">Do not close the app…</span>
              ) : (
                <button
                  onClick={onClose}
                  className="h-8 px-4 rounded-xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold transition-colors cursor-pointer"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
