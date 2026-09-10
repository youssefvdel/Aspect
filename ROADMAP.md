# Product Roadmap & Feature Specification

## 1. Identity & Rebranding
*Current Name:* **Aspect** (too narrow; implies resolution only)  
*Candidate Names:*
- **Recon** (military tactical intel)
- **Catalyst** (performance enhancement & game companion)
- **Overhaul** (total game & display enhancement)
- **ApexTactics / V-Suite / Pulse**

---

## 2. Feature Workstreams

### Phase A: Local Game Enhancements (Zero-Ban Risk, Client API)
1. **Agent Pre-Picker (Safe Hover)**
   - **Mechanism:** Calls Riot Client internal endpoint (`/pregame/v1/matches/{matchId}/select/{agentId}`).
   - **Safety:** Hover only (`select`), NEVER calls `lockfile` instant lock (`/lock`). Safe from auto-lock detection.
2. **Crosshair Studio (ValorantCC Evolution)**
   - Custom hex color codes bypass game UI color restrictions.
   - Live canvas preview, profile storage, shareable crosshair export strings, quick-switch hotkeys.
3. **Inventory & Skin Manager (Ref: Recon Bolt / V-Skins)**
   - Read local player inventory (`/personalization/v2/players/{puuid}/playerloadout`).
   - Lobby skin scout: View weapons, buddies, and skins equipped by teammates and enemies in pregame/in-game.
   - Loadout presets & skin randomizer.

### Phase B: Cloud & Intelligence Services
4. **Toxic Player Warning & Community Karma Network**
   - **Backend:** Lightweight REST/WebSocket server (Bun/Elysia or Cloudflare Workers + D1/Supabase).
   - **Workflow:** Players submit reports with match PUUID + tag (toxicity, AFK, throwing).
   - **Verification:** Threshold-based karma score; flags repeat offenders with visual caution badges in lobby scout.
5. **AI Coach & Gameplay Analyst**
   - **Engine:** OpenCode Zen free LLM API integration.
   - **Inputs:** Round economy, combat stats, death locations, agent utility stats from completed matches.
   - **Outputs:** Bite-sized actionable coaching tips (e.g., eco mistakes, first-death frequency, positioning advice).

### Phase C: Ecosystem Expansion
6. **Product Landing & Distribution Website**
   - Modern landing page (Next.js / Astro / Vite) showcasing features, download links, auto-updater feed, and live community stats.
7. **Mobile Companion App**
   - Live lobby inspect on phone, custom crosshair vault, store checker, and remote notifications when match is found.

---

## 3. Deferred / Backlog

### MMR Signal (raw MMR is not obtainable)
*Status:* Deferred by Youssef — lower priority than the current widget work.

**Verified finding (do not re-litigate):** Riot does **not** expose the hidden/raw MMR
number that sits behind your rank. Confirmed two ways:
1. Scanned the full live `/mmr/v1/players/{puuid}` payload for any key matching
   `mmr|rating|elo|skill` — the only hits are `RankedRating` (= RR, 0-100 inside your
   current tier) and the `LatestCompetitiveUpdate` before/after deltas.
2. The official endpoint schema (`valapidocs.techchrism.me`, `PlayerMMR.ts`) enumerates
   every field the response can contain, and there is no MMR field. Riot removed it.

**So the UI must never claim to show raw MMR.** What we already surface instead:
live RR under the rank emblem, act W/L, leaderboard rank, peak act, per-map/per-agent records.

**If we ever build this**, the only honest option is an **MMR Signal** — a clearly
labelled *estimate*, not a number we pretend is Riot's. Basis: RR swing size and the
performance-bonus component of `/mmr/v1/players/{puuid}/competitiveupdates` (endpoint
verified live, returns 20 matches). Large gains signal MMR above your visible rank;
small gains signal MMR below it. Render as `MMR ↑ above rank` / `MMR ~ at rank` /
`MMR ↓ below rank`, never as a raw value.

### Live in-match combat stats (KDA, round score, headshot %) — not available
*Status:* Blocked by Riot's API surface. The overlay shows act-wide aggregates plus a
real performance trend instead.

Riot does **not** expose live in-match combat data to any local or third-party client.
Verified four ways (do not re-litigate):
1. `/core-game/v1/matches/{id}` is schema'd as `Players[]` containing only `Subject`,
   `TeamID`, `TeamNumber`, `CharacterID`, `PlayerIdentity`, `SeasonalBadgeInfo`,
   `IsCoach`, `IsAssociated`, `PlatformType`, `PremierPrestige`. No `Stats` object.
2. Probed candidate live-stats endpoints — `/core-game/v1/matches/{id}/stats`,
   `/scoreboard`, `/rounds`, `/core-game/v1/players/{puuid}/stats`, `/live-match/v1/...`
   → all 404/503. Only `/loadouts` returns 200.
3. `ShooterGame.log` contains no combat data (0 "Headshot", 1 "Kill" in 2.2 MB).
4. VALORANT.exe and VALORANT-Win64-Shipping.exe open **no local listening sockets** —
   there is no game-side local API to query.

**Where every live overlay gets it:** Overwolf's **Game Events Provider** (GEP) — a
licensed Overwolf-platform API exposing `match_info.score`, `round_number`, per-player
`scoreboard` (kills/deaths/assists/money/alive), `round_report` (damage, headshots,
bodyshots, legshots) and a `kill_feed` event. Tracker.gg's Valorant overlay is an
Overwolf app; that is the source of its "live match stats". GEP requires the Overwolf
runtime, a registered + reviewed app, and `setRequiredFeatures()` subscriptions — it
cannot be used from a standalone Tauri build.

**Remaining honest options**, if this ever becomes a priority:
- **Screen OCR** of the Tab scoreboard (pure read, no injection → Vanguard-safe, but
  fragile: stylised fonts, colour-dependent, needs per-resolution calibration).
- **Overwolf GEP** if we ever ship an Overwolf build alongside the Tauri app.

Until then: the in-game widget shows the real live lobby (ranks, peak, party grouping,
ACS/KD/win%/HS% act-wide, last-24h record) sorted by ACS, plus a real
performance-over-time curve built from completed ranked matches. Nothing on the widget
may be labelled as "this match".
