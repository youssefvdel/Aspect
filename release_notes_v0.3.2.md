## Recon v0.3.2

### Added
- **Starting Side (Attack / Defense) Safety Toggle**: Added a dedicated switch in Settings (Overlay & Notifications) and in the in-game HUD widget customizer to toggle the starting side badge in the Agent Select widget and scoreboard. Disabled by default for client visibility compliance.
- **Weapon Skin Names Baseline**: Equipped skin names are now displayed cleanly under each weapon card with automatic text truncation and hover tooltips for long skin titles.

### Improved & Fixed
- **Material 3 Loadout Viewer**: Modernized the live match loadout modal to full Material Design 3 tokens, surface elevations, and typography.
- **Full Player Card & Expressions Layout**: Fixed player card vertical proportions to full aspect ratio with a smooth bottom gradient fade overlay; placed enlarged 1:1 radial expressions/flex wheel directly beneath the player card.
- **Responsive Viewport Fitting**: Dynamically flexes all 5 collection columns with 1fr vertical distribution to fit standard 800p/768p displays without clipping.
- **Dev Mode Lockdown**: Completely stripped and gated developer tools and dashboards from release builds.
- **Installer Streamlining**: Switched to single-file signed setup executable (.exe) for gamers, removing MSI installer overhead.
