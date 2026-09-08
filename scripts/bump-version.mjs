// One command to bump the app version everywhere:
//
//   npm run bump -- 0.1.3
//
// Single source of truth: src-tauri/Cargo.toml.
// Everything else follows automatically:
//   - tauri.conf.json has NO version field -> Tauri uses Cargo.toml (official behavior)
//   - src-tauri/src/updater.rs reads env!("CARGO_PKG_VERSION")
//   - frontend __APP_VERSION__ is injected from package.json at build time
// This script just keeps package.json and Cargo.toml in sync, then verifies.

import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf-8');

const next = process.argv[2];
if (!next || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(next)) {
  console.error('Usage: npm run bump -- <semver>   (e.g. npm run bump -- 0.1.3)');
  process.exit(1);
}

// Guard the invariant: version must NOT live in tauri.conf.json.
const tauriConf = read('src-tauri/tauri.conf.json');
if (/"version"\s*:/.test(tauriConf)) {
  console.error('REFUSED: src-tauri/tauri.conf.json contains a "version" field.');
  console.error('Remove it — Tauri falls back to Cargo.toml automatically.');
  process.exit(1);
}

// Guard: no hardcoded versions may remain in source (excluding lockfiles/build output).
// Only version *assignments* count — test fixtures like is_newer_version("0.1.0", …) are fine.
const banned = ['src-tauri/src/updater.rs', 'src/utils/ipc.ts', 'vite.config.ts'];
for (const f of banned) {
  const stale = [...read(f).matchAll(/[:=]\s*['"]\d+\.\d+\.\d+(-[\w.]+)?['"]/g)].map((m) => m[0].trim());
  if (stale.length > 0) {
    console.error(`REFUSED: hardcoded version in ${f}: ${stale.join(', ')}`);
    process.exit(1);
  }
}

// 1. package.json
const pkgPath = new URL('package.json', root);
const pkg = JSON.parse(read('package.json'));
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. Cargo.toml [package] version (first `version =` under [package])
const cargoPath = new URL('src-tauri/Cargo.toml', root);
let cargo = read('src-tauri/Cargo.toml');
const before = cargo;
// NOTE: function replacer — a "$1…​" string would misparse ($1 + "0.1.2" = $10).
cargo = cargo.replace(
  /(\[package\][^\[]*?^version\s*=\s*")[^"]+(")/m,
  (_m, p1, p2) => `${p1}${next}${p2}`,
);
if (cargo === before) {
  console.error('REFUSED: could not find [package] version in src-tauri/Cargo.toml');
  process.exit(1);
}
writeFileSync(cargoPath, cargo);

console.log(`Bumped to ${next}: package.json + src-tauri/Cargo.toml`);
console.log('Next: npx tauri build && git add -A && git commit && git push');
