import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/* Real updater pipeline.
 *
 * Replaces the old flow, which queried the GitHub API for the latest release,
 * guessed an asset by file extension, downloaded it to %TEMP% and shell-executed
 * it as an installer. That had no signature verification, no manifest, no
 * progress, no relaunch, and silently broke if the asset order changed.
 *
 * This uses Tauri's updater plugin: it fetches the signed `latest.json`
 * manifest, verifies every download against the minisign public key baked into
 * tauri.conf.json, installs quietly in place and relaunches into the new build.
 */

/** An update found and verified by the plugin. */
export interface AvailableUpdate {
  version: string;
  notes: string;
  date?: string;
  /** Opaque handle; hand back to installUpdate(). */
  handle: Update;
}

export type InstallEvent =
  | { phase: 'downloading'; downloaded: number; total: number }
  | { phase: 'installing' };

/** The plugin only exists inside the Tauri webview (dev browser has no updater). */
export function updaterSupported(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Ask the configured endpoint for an update. Returns null when up to date. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!updaterSupported()) return null;
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body ?? '',
    date: update.date,
    handle: update,
  };
}

/** Download, verify, install quietly, and report progress. Does not relaunch. */
export async function installUpdate(
  update: AvailableUpdate,
  onEvent?: (event: InstallEvent) => void
): Promise<void> {
  let downloaded = 0;
  let total = 0;
  await update.handle.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? 0;
        onEvent?.({ phase: 'downloading', downloaded: 0, total });
        break;
      case 'Progress':
        downloaded += event.data.chunkLength ?? 0;
        onEvent?.({ phase: 'downloading', downloaded, total });
        break;
      case 'Finished':
        onEvent?.({ phase: 'installing' });
        break;
    }
  });
}

/** Relaunch into the freshly installed build. */
export async function restartApp(): Promise<void> {
  await relaunch();
}

export const formatBytes = (n: number): string => {
  if (!n) return '';
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};
