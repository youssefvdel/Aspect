import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  AlertCircle,
} from 'lucide-react';
import type { UpdateInfo } from '../types';
import { checkAppUpdates, openExternalUrl } from '../utils/ipc';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatusChange?: (hasUpdate: boolean, latestVersion: string) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  onUpdateStatusChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await checkAppUpdates();
      setUpdateInfo(res);
      if (onUpdateStatusChange) {
        onUpdateStatusChange(res.has_update, res.latest_version);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      performCheck();
    }
  }, [isOpen]);

  // Keyboard Esc listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
                <p className="text-[10px] text-m3-outline">
                  Aspect • GitHub Releases
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-m3-surface-container-high flex items-center justify-center text-m3-outline hover:text-m3-on-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex flex-col gap-3 py-1">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-center">
                <Loader2 className="w-6 h-6 text-m3-primary animate-spin" />
                <p className="text-xs font-medium text-m3-on-surface">
                  Checking for new releases...
                </p>
                <p className="text-[10px] text-m3-outline font-mono">
                  github.com/youssefvdel/truestretch_tauri
                </p>
              </div>
            ) : error ? (
              <div className="py-4 px-3 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Update check error</span>
                </div>
                <p className="text-[11px] text-red-300/80 break-words">
                  {error}
                </p>
              </div>
            ) : updateInfo?.has_update ? (
              <div className="flex flex-col gap-3">
                {/* Update Banner */}
                <div className="p-3 rounded-xl bg-m3-primary/10 border border-m3-primary/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ArrowUpCircle className="w-5 h-5 text-m3-primary shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-m3-primary">
                          New Version Available
                        </span>
                        <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-m3-primary text-m3-on-primary">
                          {updateInfo.latest_version}
                        </span>
                      </div>
                      <span className="text-[10px] text-m3-outline">
                        Installed: {updateInfo.current_version}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Release Title & Notes */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-m3-on-surface">
                    {updateInfo.release_title}
                  </span>
                  <div className="p-3 rounded-xl bg-m3-surface-container-lowest border border-m3-outline-subtle/70 custom-scrollbar max-h-40 overflow-y-auto text-xs text-m3-on-surface-variant font-mono whitespace-pre-wrap leading-relaxed">
                    {updateInfo.release_notes}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-m3-on-surface">
                    You're up to date!
                  </h4>
                  <p className="text-[11px] text-m3-outline mt-0.5">
                    Aspect {updateInfo?.current_version || 'v0.1.0'} is the latest version.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-m3-outline-subtle/80 flex items-center justify-between gap-2">
            <button
              onClick={performCheck}
              disabled={loading}
              className="h-8 px-3 rounded-xl bg-m3-surface-container-high hover:bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Check Again</span>
            </button>

            <div className="flex items-center gap-2">
              {updateInfo?.has_update && updateInfo.download_url ? (
                <button
                  onClick={() => openExternalUrl(updateInfo.download_url!)}
                  className="h-8 px-4 rounded-xl bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Update</span>
                </button>
              ) : updateInfo?.has_update ? (
                <button
                  onClick={() => openExternalUrl(updateInfo.html_url)}
                  className="h-8 px-4 rounded-xl bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View on GitHub</span>
                </button>
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
