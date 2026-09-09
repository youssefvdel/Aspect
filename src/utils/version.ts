import { getVersion } from '@tauri-apps/api/app';

/* App version — single source of truth.
   The value is injected at build time from package.json `version`
   (see `define.__APP_VERSION__` in vite.config.ts). To bump, run ONCE:
     npm run bump -- 0.3.0
   That syncs package.json + src-tauri/Cargo.toml (the Rust updater reads the
   crate version via env! — no Rust edits needed). tauri.conf.json follows
   package.json automatically ("version": "../package.json").
   UI code must import from here — never hardcode a version string. */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : '0.0.0';

let runtime: string | null = null;

/** Packaged-app truth (Tauri bundle version); build-time fallback in browser dev. */
export async function appVersion(): Promise<string> {
  if (runtime) return runtime;
  try {
    runtime = await getVersion();
  } catch {
    runtime = APP_VERSION;
  }
  return runtime;
}
