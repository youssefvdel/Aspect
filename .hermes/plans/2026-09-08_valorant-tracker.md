# Valorant Tracker Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a Tracker tab that shows rank, match history, team scoreboards, RR trend, and rule-based tips — zero new dependencies.

**Architecture:** Frontend-only `fetch()` calls to the free keyless HenrikDev API, results cached in localStorage, all rendering with existing M3 components. No Rust changes, no npm packages, no chart lib (pure SVG bars), no AI calls.

**Tech Stack:** Existing Tauri 2 + React 19 + Tailwind M3 tokens. New files: `src/utils/tracker.ts`, `src/components/Tracker.tsx`. Touched: `src/types.ts`, `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/App.tsx`.

---

## Research verdict (do not re-research)

### Data sources ranked

1. **HenrikDev unofficial API (`https://api.henrikdev.xyz`)** — USE THIS, with one change: **since v4.0.0 an API key is required** (was keyless; botting forced auth). Key is free from their dashboard; user pastes it once, stored in localStorage, sent as `Authorization` header. All endpoints below stay the same.
   - `GET /valorant/v3/mmr/{region}/{platform}/{name}/{tag}` → current rank, RR, peak, wins/games.
   - `GET /valorant/v1/mmr-history/{region}/{name}/{tag}` → recent games with RR movement (trend chart).
   - `GET /valorant/v1/stored-matches/{region}/{name}/{tag}` → recent matches (map, mode, agent, KDA, score).
   - `GET /valorant/v2/match/{matchId}` → full details: per-round results, all 10 players, damage, clutch-relevant stats.
2. **Riot official API** — REJECTED. Personal/dev keys are blocked from all VALORANT endpoints; production access needs product approval + Riot Sign-On + per-player opt-in audit. Revisit only if we ever need data HenrikDev lacks.
3. **Tracker.gg** — REJECTED. No public API (only paid scrape proxies). Skip.
4. **Overwolf GEP live events** — REJECTED for live use. Kill feed / scoreboard / roster events only fire inside Overwolf apps; our Tauri binary cannot subscribe. This kills anything genuinely "live".

### Can / cannot matrix (honest)

| Wanted | Verdict | How |
|---|---|---|
| Rank + RR + peak | ✅ | HenrikDev MMR endpoints |
| Match history + KDA/ACS/HS% | ✅ | stored-matches |
| Team + enemy scoreboard per match | ✅ | match details (all 10 players) |
| RR-over-time chart | ✅ | mmr-history, pure-SVG bars |
| Agent / map win-rate splits | ✅ | aggregate client-side from history |
| Rule-based tips (eco discipline, first-death rate, clutch conversion, consistency) | ✅ | pure function over match details, no AI |
| Live reaction time in ms | ❌ | No API exposes duel timings; Overwolf-only live |
| True "where you messed up" replay moments | ⚠️ partial | Approximate from round data (first death, 1vX losses, low-damage rounds). No timeline/positions exist anywhere |
| Live match overlay | ❌ | Needs Overwolf framework, not Tauri |
| Private accounts | ⚠️ | API returns 404/empty — show "profile private or wrong Riot ID" state |

### Framework decision: NO SWITCH

Tracker tab = occasional HTTPS polling + JSON render. Tauri+React already does this; WebView2 stays idle between refreshes. Adding Overwolf/Electron would 10x the weight for zero gain since live events are off-limits anyway.

### Ponytail cuts (applied to every task below)

- No `sqlite`/backend store → localStorage cache (key `aspect_tracker_<region>_<name>_<tag>`, 10-min TTL).
- No chart library → ~20 lines of SVG/divs.
- No AI tips endpoint → ~60-line pure rule function.
- No Riot key flow, no login, no secrets — user types own `Name#Tag` + region once.
- Reuse `CustomDropdown` pattern and M3 card styles already in the repo.

### Open risks

1. **CORS**: HenrikDev is browser-called by many web trackers, but if the WebView blocks it, fallback = one tiny Tauri command using the OS `curl` (same pattern `updater.rs` already uses — zero new deps). Task 2 must prove a live call in dev mode first.
2. **Rate limits**: community API, fair-use (~tens of req/min). Mitigate: 10-min cache, manual Refresh button, exponential backoff on 429, never auto-poll.
3. **Schema drift**: unofficial API can change fields. Mitigate: parse defensively (`?.` + fallbacks), show "tracker unavailable" banner on shape mismatch, never crash.

---

## Tasks

### Task 0: Install the ponytail skill pack

**Objective:** Future implementation work follows ponytail minimal-code rules.

**Files:** none in repo (installs to Hermes skills dir).

**Steps:**
1. `git clone --depth 1 https://github.com/DietrichGebert/ponytail /tmp/ponytail`
2. `find /tmp/ponytail -name SKILL.md` → inventory skill dirs.
3. Check each frontmatter `name:` against `skills_list` for collisions.
4. `mkdir -p ~/.hermes/skills/dev && cp -r /tmp/ponytail/skills/<each> ~/.hermes/skills/dev/`
5. Smoke test per agent-skill-pack-install §7, confirm via `skills_list`.

**Verify:** `skills_list` shows the ponytail skills. **Commit:** n/a (outside repo).

### Task 1: Tracker types (minimal fields only)

**Objective:** Type the exact HenrikDev shapes we render — nothing more (YAGNI).

**Files:**
- Modify: `src/types.ts` (append)

**Steps:**
1. Append interfaces: `TrackerProfile { name, tag, region, rank, rr, peak, wins, games }`, `TrackerMatch { id, map, mode, agent, result, scoreUs, scoreThem, kills, deaths, assists, acs, hsPct, startedAt }`, `TrackerMatchDetail { rounds: { winningTeam, bombPlanter? }[], players: { name, tag, team, agent, kills, deaths, assists, damage, headshots, bodyshots, legshots }[] }`.
2. Run `npm run build`. Expected: PASS (types only, no usage yet).

**Verify:** build passes. **Commit:** `feat(tracker): add tracker types`.

### Task 2: Prove the live API call (risk #1 first)

**Objective:** Confirm browser-side `fetch()` to HenrikDev works from the Tauri WebView before building on it.

**Files:**
- Create: `src/utils/tracker.ts` with ONE function `fetchMmr(region, name, tag)` + typed parse with fallbacks.

**Steps:**
1. Write `fetchMmr` using plain `fetch()` with `Authorization: <key>` header (key from localStorage, pasted once in the Tracker tab), defensive field access, throws friendly errors on 404 (wrong ID/private), 401 (missing/bad key), and 429 (rate-limited).
2. Temporarily call it from dev console via `npm run dev` (paste a test call, check Network + console).
3. Keep the function, delete the temp call.

**Verify:** real rank JSON returns for a known public Riot ID. If CORS blocks → switch to the `updater.rs`-style OS-curl Tauri command fallback (document the pivot in the commit message). **Commit:** `feat(tracker): fetch MMR from HenrikDev API`.

### Task 2b: Auto-detect the local account (no typing)

**Objective:** Read the logged-in Riot ID from the PC like the big trackers do — manual entry becomes the fallback, not the default.

**How it works (verified on this machine):** `%LOCALAPPDATA%/Riot Games/Riot Client/Config/lockfile` holds `name:pid:port:password:protocol`. While the Riot Client runs, `https://127.0.0.1:{port}/player-account/aliases/v1/active` (Basic auth `riot:{password}`) returns `{ game_name, tagline, puuid }`. Same technique Blitz/Tracker use (they add RSO login on top; we don't need it for public data).

**Files:**
- Modify: `src-tauri/src/game_config.rs` (or new `src-tauri/src/tracker.rs` if cleaner — prefer new file, ~60 lines) + register command in `src-tauri/src/lib.rs`
- Modify: `src/utils/tracker.ts` (append `detectLocalAccount()` invoking the command)

**Steps:**
1. Rust command `detect_local_account`: read lockfile → if missing, `Err("Riot Client not found")` → check pid alive (stale lockfile is the common case — client closed) → OS `curl -k` (same `CREATE_NO_WINDOW` pattern as `updater.rs`, zero new deps — browser `fetch()` cannot ignore the self-signed cert, so this MUST live in Rust) → parse only `game_name`/`tagline`/`puuid`, never log the password.
2. Frontend: on Tracker first open, try `detectLocalAccount()` → prefill + auto-load; on any failure, show manual `Name#Tag` + region inputs (persisted to localStorage as today).
3. `cargo test` passes (existing suite), `npm run build` passes.

**Verify:** with Riot Client open, Tracker tab shows your ID without typing; with client closed, manual inputs appear. Test both states. **Commit:** `feat(tracker): auto-detect local Riot account`.

### Task 2c: Local live match state (no Overwolf needed)

**Objective:** Near-live "LIVE" badge + live scoreboard while a match runs, using the same local client the reviewers confirmed (rank-yoinker proves the technique).

**How it works:** While playing, poll two local endpoints (same lockfile auth as Task 2b, 30–60s interval only): `GET /chat/v4/presences` → MENUS/PREGAME/INGAME state; when INGAME, `GET /core-game/v1/players/{puuid}` → MatchID, then `GET /core-game/v1/matches/{id}` → live scoreboard. Bonus from the same session: puuid via `/entitlements/v1/token` (more reliable than aliases), region/shard parsed from `VALORANT/Saved/Logs/ShooterGame.log` (`pd.<region>.a.pvp.net`) — kills manual region input too.

**Files:**
- Modify: `src-tauri/src/tracker.rs` (append `local_game_state`, `local_live_match` commands reusing the lockfile+curl helper)
- Modify: `src/utils/tracker.ts` (append callers + `TrackerLiveMatch` type in `src/types.ts`)

**Steps:**
1. Extract a `lockfile_auth()` helper returning `(port, password)` so all three commands share it (no duplication).
2. Poll ONLY while the Tracker tab is open and shows INGAME; stop on tab switch (perf budget: no background polling, ever).
3. `cargo test` passes, `npm run build` passes.

**Verify:** queue into a match with client open → tab shows LIVE + live score; after match, HenrikDev history picks it up. **Commit:** `feat(tracker): local live match state`.

### Task 2d: Keyless direct Riot calls via local entitlements (kill the API key)

**Objective:** Tracker works with ZERO signup — no HenrikDev key for the user. Big trackers hide their company key on their servers; we instead borrow the logged-in client's own credentials locally (rank-yoinker proves the pattern; Vanguard doesn't police loopback reads).

**How it works:** `GET /entitlements/v1/token` on the local client (lockfile auth) returns `{ accessToken, entitlements JWT, subject=puuid }`. With headers `Authorization: Bearer <token>` + `X-Riot-Entitlements-JWT` + `X-Riot-ClientPlatform`/`X-Riot-ClientVersion` (parsed once from `VALORANT/Saved/Logs/ShooterGame.log`, same as VRY), call Riot directly: `https://pd.{eu,na,ap,kr}.a.pvp.net/mmr/v1/players/{puuid}`, `/match-history/v1/history/{puuid}?startIndex=0&endIndex=20`, `/match/v1/matches/{id}`. HenrikDev (user key) drops to fallback for when the client is closed.

**Files:**
- Modify: `src-tauri/src/tracker.rs` (append `local_entitlements`, `riot_direct_get` commands reusing `lockfile_auth()`)
- Modify: `src/utils/tracker.ts` (try direct-first, HenrikDev-fallback; key field becomes optional)

**Steps:**
1. `local_entitlements` returns token triple; `riot_direct_get(path, shard)` performs the authed call from Rust (browser can't reach Riot: CORS + no cert issue here, but Riot blocks browser origins — Rust stays the caller).
2. Shard from log region (`eu`→`pd.eu.a.pvp.net`); default `eu`, manual override stays.
3. Tokens expire (~1h): on 401 from Riot, refetch entitlements once and retry, then fall back to HenrikDev.
4. `cargo test` passes, `npm run build` passes.

**Verify:** client open + NO HenrikDev key configured → rank + history load. Client closed + key configured → HenrikDev path loads. **Commit:** `feat(tracker): keyless direct Riot calls`.

### Task 3: Cache + match history fetchers

**Objective:** `fetchMatchHistory` + `fetchMatchDetail` with 10-min localStorage cache and 429 backoff.

**Files:**
- Modify: `src/utils/tracker.ts` (append)

**Steps:**
1. Add `readCache/writeCache` helpers (key includes region+name+tag, `{ savedAt, data }`, 10-min TTL).
2. Add `fetchMatchHistory` (stored-matches → `TrackerMatch[]`, cap 20) and `fetchMatchDetail` (match id → `TrackerMatchDetail`).
3. 429 → wait `Retry-After` (default 5s) once, then throw friendly message.
4. `npm run build`. Expected: PASS.

**Verify:** build passes; temp dev-console call returns 20 matches. **Commit:** `feat(tracker): cached match history + detail fetchers`.

### Task 4: Tips engine (pure function)

**Objective:** Stats in → tip strings out. No AI, fully deterministic.

**Files:**
- Create: `src/utils/trackerTips.ts` — `buildTips(detail, playerName): string[]`

**Steps:**
1. Implement 5 rules max: first-death share high → "entry discipline"; clutch rounds (1vX) lost → "clutch isolation"; damage/round low on wins → "trade partner"; HS% < 20% on rifles → "crosshair height"; eco-round force-buy losses → "eco discipline". Each rule guards missing data (return nothing, never crash).
2. `npm run build`. Expected: PASS.

**Verify:** build passes; hand-check tips against one real match detail JSON in dev console. **Commit:** `feat(tracker): rule-based tips engine`.

### Task 5: Tracker tab UI (profile + history + detail + chart + tips)

**Objective:** One `Tracker.tsx` reusing repo patterns (M3 cards, CustomDropdown-style picker, verify-style banners).

**Files:**
- Create: `src/components/Tracker.tsx`
- Modify: `src/components/Sidebar.tsx` (add tab, shortcut `6`, icon `Activity`), `src/components/TopBar.tsx` (metadata), `src/App.tsx` (import, `5`→ keep, add `6` key, `checkRequestedTab` list, render branch — mirror the valorant-tab wiring exactly)

**Steps:**
1. Identity row: region dropdown (eu/na/ap/br/latam), Name + Tag inputs (persist to localStorage), Load button.
2. Profile header: rank, RR, peak, W/L.
3. RR trend: pure-SVG bars from mmr-history.
4. Match list → click expands: both-team scoreboard + tips for that match.
5. Error states: wrong ID/private (404), rate-limited (429), offline.
6. `npm run build`. Expected: PASS.

**Verify:** build passes; in-app: load a real Riot ID, see rank + 20 matches + one expanded scoreboard. **Commit:** `feat(tracker): tracker tab UI`.

### Task 6: Release it

**Objective:** Ship behind the existing updater flow.

**Files:** version bumps (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/updater.rs`, `src/components/Sidebar.tsx`, `src/utils/ipc.ts`) → `0.1.2`.

**Steps:**
1. Bump versions, `npm run build`, `npx tauri build`.
2. Commit, tag `v0.1.2`, push, `gh release upload` the NSIS setup (same flow as v0.1.1).
3. Install from the release on this machine, open Tracker tab, load Riot ID — end-to-end proof.

**Verify:** in-app Tracker works from the installed build. **Commit:** `feat: Aspect v0.1.2 - Valorant Tracker`.

---

## Competitive intel (what they use, where we win)

| App | Client stack | Data | Weight / cost to user |
|---|---|---|---|
| Tracker.gg desktop | **Overwolf** (own client + overlay hooks) | Riot official API (production key) + Overwolf live events | Overwolf runtime always on, overlay hooks into game, ads + subscription |
| Blitz | **Electron** (bundled Chromium) | Riot official API + own backend | ~150MB+ download, 200–400MB RAM, account + ads |
| OP.GG desktop | **Electron 84MB** standalone (Overwolf store) | Riot official API + own backend | Same Electron tax, account + ads |

Where we beat them (ship these as our edge, not their features):
- **10x lighter**: Tauri + OS WebView2 (~12MB exe, <150MB RAM) vs bundled Chromium / Overwolf runtime. No overlay hooks into the game process, no FPS risk, nothing for Vanguard to care about.
- **No account, no ads, no login**: keyless public API, Riot ID typed once.
- **One app, two jobs**: nobody combines tracker insights with stretched-res + config sync. Our tips can reference the user's actual setup (e.g. "your stretch res costs X" stays ours alone).
- **Honest scope**: post-match only. We do NOT chase live scouting, overlays, clip recording, or lineup libraries — each needs Overwolf or a content team, and each is exactly what makes their apps heavy.

## Performance budget (enforced, not wished)

- Tracker tab fetches NOTHING until first opened (lazy).
- No polling, no intervals: manual Refresh only + 10-min localStorage cache.
- Images (rank/agent icons): `loading="lazy"`, small sizes, zero image libraries.
- Zero new Rust threads, zero new npm/Rust dependencies for this feature.
- Targets: total app <150MB RAM at idle (existing 12s trimmer keeps it there), 0% CPU idle, tracker load <2s on cache hit.
- Task 5 verification must include a Task Manager reading before/after opening the tab.

## What this plan deliberately excludes

Live overlay, reaction-time lab, Riot official API + RSO login, Tracker.gg scraping, SQLite, chart libs, AI tips, auto-polling, other-player lookup. Each is a documented NO above — adding any of them later starts a new plan, not scope creep on this one.
