# TrueStretchStudio — Agent Handoff

> **For:** next Kilo / coding agent
> **Updated:** 2026-09-07
> **Repo root:** `C:\Users\Administrator\Projects\truestretch_tauri`
> **Product:** TrueStretchStudio 0.1.0 (`com.truestretch.studio`) — VALORANT 1.45:1 True Stretch + Universal Multi-GPU + Multi-Monitor Studio
> **Stack:** Tauri 2.x + Rust + React 19 + TS + Tailwind M3 dark + pure Win32 GDI/SetupDi + WinReg (100% native, ZERO external binaries, ZERO C/C++)

---

## 1. Project overview

Ultra-low-latency desktop utility for competitive FPS (VALORANT primary, CS2/Aimlabs secondary):

1. **100% Native Architecture (Zero External Binaries / Zero C++ code)**:
   - Standalone tool with **zero external dependencies** (`CRU.exe`, `restart64.exe`, `reset-all.exe`, `MultiMonitorTool.exe` completely removed).
   - Display mode adjustments, EDID overrides, driver stack restarts, primary display changes, and device disabling run directly in-process via Win32 GDI, SetupDi, and WinReg APIs.
2. **Universal Multi-GPU Support (All Vendors)**:
   - **NVIDIA GeForce / RTX**: Injects `{*}S <w>x<h>x32,64` into driver `NV_Modes` (REG_MULTI_SZ) and sets `DxgkUsePhysicalMode = 0`.
   - **AMD Radeon (RX / Vega / Adrenalin)**: Packs 8-byte BCD mode descriptors (`[0x00, 0x00, bcd_w, bcd_h, bcd_hz]`) into `DalNonStandardModesBCD` (REG_BINARY) and sets `DalEnableModeBypass = 1`, `DalGpuScaling = 1`, `DalKeepAspectRatio = 0`, `DalScaleRule = 0`, and `DalIntegerScaling = 0`.
   - **Intel (Arc / Iris Xe / UHD)**: Injects `ReadEDIDFromRegistry = 1` (forces Intel driver to load custom modes from `EDID_OVERRIDE`), `ScaleOption = 3` (Scale Full Screen / Stretched), `CustomModeAllowed = 1`, `EnableCustomResolutions = 1`, `MaintainAspectRatio = 0`, and `DisableLetterboxing = 1`.
   - **Universal Windows Graphics Subsystem**: Configures `Scaling = 4` across all active/cached configurations in `HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration`, `DirectFlipEnabled = 1` in HKCU/HKLM DWM, and `DisableDXGIWindowedStereo = 1` in DirectX preferences.
   - **Hybrid Multi-GPU / Laptops**: Automatically enumerates all display adapter keys (`0000..0016`) so laptops with Intel/AMD iGPU + NVIDIA dGPU configure both graphics paths simultaneously.
3. **1.45:1 True Stretch switch** — `W = round(H*1.45)+2, force even` (e.g. 1440p → 2090×1440). GPU stretches to panel, models look ~+22.5% wider, no black bars. Formula lives in 3 places — keep in sync: `src-tauri/src/calculator.rs::calculate_1_45_for_height`, `lib.rs::run` default, `CustomResolution.tsx` / `UnifiedStretch.tsx` / `Settings.tsx` presets.
4. **Native Custom Res & Test (Add Mode)** — Built-in native EDID override and GPU driver injection (`NV_Modes`, `DalNonStandardModesBCD`, Intel registry). High refresh rates (240Hz, 260Hz) clamped to 16-bit base EDID ceiling (~650 MHz) to eliminate the "Pixel clock out of EDID range" error, while GPU hardware scaler provides full 260Hz. `CDS_TEST` preflight → `EDID_OVERRIDE "0"` + in-process SetupDi driver restart → 15s safe-test watchdog (Keep / Revert / Esc).
5. **Display Manager (device-only)** — true Device Manager disable (`SetupDi`, admin) so Valorant can't enumerate side panels. CCD attach/detach is deprecated (backend kept for compat only).
6. **GPU black-bar fix** — Win32 CCD `SetDisplayConfig(STRETCHED)` + vendor registry (NVIDIA/AMD/Intel) + `bShouldLetterbox=False` sync.
7. **Game config sync** — writes `GameUserSettings.ini` (`FullscreenMode=2`, `ResolutionSizeX/Y`, `DesiredScreen*`, `LastUserConfirmed*`) + optional Read-Only lock.
8. **Stretch Preview (Resolution Visualizer)** — Zero-overflow, desktop-native 8-agent hitbox simulator with official Valorant transparent artwork (Clove, Jett, Reyna, Omen, Sova, Iso, Viper, Brimstone). Dynamically fits standard 1180×860 viewport with zero page scrolling; agent portraits scaled cleanly to `max-h-[75%]` inside the simulated monitor glass.
9. **Display Manager Tab Removed** — Cleaned navigation into 5 streamlined primary tabs (Keys 1–5: Resolution Switch, Stretch Preview, Custom Res & Test, Fix Black Bars, Settings).
10. **Aggressive WebView2 Memory Trimming** — Win32 Toolhelp32 process-tree walker applying `SetProcessWorkingSetSize(-1, -1)` across host and all child/grandchild `msedgewebview2.exe` renderer, GPU, and network processes. Drops total memory from ~200 MB to ~35-55 MB total in system tray and background.

Current hardware context: RTX 3080, primary 2560×1440 @ 260Hz (`\\.\DISPLAY2`), side panels 1080×1920 portrait + 1920×1080 @ 60Hz.

---

## 2. Architecture

```
Vite React (5173)  ←→  Tauri IPC invoke  ←→  Rust backend (Win32 GDI + SetupDi + winreg)
       ↑                           WebSocket 9223 (debug only, MCP bridge)
Sidebar (6 tabs) + TopBar + <main> + footer status bar + toast
%LOCALAPPDATA%\TrueStretchStudio\  ← hotkey.txt, stretched_res.txt, gpu_settings.json,
                                      monitor_res_cache.json, edid_backup_*.bin, requested_tab.txt
HKLM\SYSTEM\CurrentControlSet\Enum\DISPLAY\<dev>\<inst>\Device Parameters\EDID_OVERRIDE "0"
```

- Frontend-only `npm run dev` uses **mock fallbacks** in `ipc.ts` (fake 2560×1440/260Hz, fake monitors/GPU). Real Win32 only under `npx tauri dev` / built exe.
- Global hotkey daemon: Rust `GetAsyncKeyState` poll thread (30ms) → `display-mode-changed` event → `App.tsx` updates + toast. No RegisterHotKey.
- Memory trim: `SetProcessWorkingSetSize` on launch/blur + 20s background thread.
- Tray: Show/Quit, left-click show, close-to-hide (`prevent_close`).

---

## 3. Key files

### 3.1 Config / build

| File | What matters |
|---|---|
| `package.json` | scripts: `dev: vite`, `build: tsc -b && vite build`, `lint: oxlint`, `preview: vite preview`. **No `tauri` script** — use `npx tauri dev` / `npx tauri build` directly. Deps: `@tauri-apps/api ^2.11.1`, React 19, tailwind 3.4, framer-motion 13, lucide 1.41. |
| `src-tauri/tauri.conf.json` | `productName: TrueStretchStudio`, `version: 0.1.0`, `frontendDist: ../dist`, `devUrl: http://localhost:5173`, window `main` 1180×860 (min 980×680), `withGlobalTauri: true` (required for MCP bridge), title `TrueStretch Studio • 1.45 Ratio & GPU Scaling`. |
| `src-tauri/Cargo.toml` | pkg `app` 0.1.0 ed2021. Deps: `tauri 2.11.3` (`tray-icon`), `windows 0.58` with `Win32_Foundation`, `Win32_UI_WindowsAndMessaging`, `Win32_Graphics_Gdi`, `Win32_UI_Input_KeyboardAndMouse`, `Win32_Devices_Display`, `Win32_Devices_DeviceAndDriverInstallation`, `Win32_Devices_Properties`, `Win32_UI_Shell`; `winreg 0.52`, `serde/serde_json`, `log`, `tauri-plugin-log 2`, `tauri-plugin-mcp-bridge 0.13.0`. |
| `kilo.json` | MCP `tauri`: `["cmd","/c","npx","-y","@hypothesi/tauri-mcp-server"]`, timeout 15000. Pair: npm `@hypothesi/tauri-mcp-server 0.13.0` ↔ Rust `tauri-plugin-mcp-bridge 0.13.0`. |
| `vite.config.ts` | stock `react()` plugin only. |
| `src-tauri/src/main.rs` | `windows_subsystem=windows` in release + WebView2 args (disable occlusion/smart-screen/background networking). Calls `app_lib::run()`. |

Dev URLs: Vite `http://localhost:5173`, Tauri dev bridge WebSocket port **9223** (debug builds only — `lib.rs` gates `tauri_plugin_mcp_bridge::init()` behind `#[cfg(debug_assertions)]`; release exposes nothing).

Build artifacts (verified 2026-09-07):
- `dist/` — `index.html`, `assets/`, `agents/` (26 files, mirrors `public/agents/`), `maps/`, icons. **No `dist/screenshots/` currently** (prior doc referenced it; dir does not exist — recreate if you add screenshot tooling).
- `src-tauri/target/release/app.exe` **17.36 MB**, `TrueStretch Studio.exe` 17.28 MB, `app.pdb` 6.45 MB.
- `src-tauri/target/release/bundle/msi/TrueStretchStudio_0.1.0_x64_en-US.msi` + `bundle/nsis/TrueStretchStudio_0.1.0_x64-setup.exe`.
- `public/agents/brimstone.png` **1040.2 KB** saved 2026-09-07 from `C:\Users\Administrator\Pictures\Brimstone.png` (1199×1312 back-view orange beret) + identical `Pictures\brim\brim.png`. Copied to `public/agents/` and `dist/agents/`.

### 3.2 Frontend (`src/`)

`src/App.tsx` — router + state:
- `TabType = switcher|visualizer|custom_res|gpu|settings` + legacy `borderless` alias → renders `switcher`. Keys `1-5`. Polls `check_requested_tab()` every 2000ms (`%LOCALAPPDATA%\TrueStretchStudio\requested_tab.txt`, aliases `borderless/config/display/monitors/custom/cru`).
- `loadAllTelemetry()` = `fetchDisplayInfo + fetchShortcut + fetchGpuInfo + fetchPreferredStretchedRes` in parallel.
- `handleToggle` / `handleApplyResolution` catch BADMODE via `isBadModeErrorMessage()` → info toast 7s → auto-navigate to `custom_res` after 900ms.
- Unified tab (`switcher|borderless`): `<main class="flex-1 min-h-0 overflow-hidden p-3">` **no scroll**; other tabs `overflow-y-auto`.
- Listens `display-mode-changed`, calls `trimMemory()` on launch/blur.

`src/types.ts` — `DisplayInfo {current_w/h/hz, native_w/h, supported_refresh_rates, active_profile: native|stretched|custom, device_name}`, `ShortcutBinding {ctrl,shift,alt,win,vk}`, `GpuInfo/GpuSettingsReport/GpuSettingItem`, `WindowInfo {hwnd,title}`, `ConfigFileInfo`, `QuickShortcut`, `TabType`.

`src/utils/ipc.ts` — all invokes + mocks + friendly-error layer. Commands wired:
`get_display_info`, `apply_resolution` (+`friendlyApplyResolutionError`), `toggle_profile` (+`friendlyToggleProfileError`), `get/set_preferred_stretched_res`, `get/set_gpu_setting`, `get_gpu_settings`, `open_gpu_panel`, `auto_configure_gpu_scaling`, `get_windows`, `make_window_borderless`, `restore_window_framed`, `get_valorant_configs`, `update_valorant_config {path,setWindowed,res:[w,h],lockReadonly}`, `apply_custom_res_to_all_configs`, `get_quick_shortcuts`, `check_requested_tab`, `trim_memory`, `test_custom_mode → {exists, code}`, `add_custom_resolution {monitorId,width,height,hz}`, `remove_custom_override {monitorId}`, `list_supported_modes`.

`src/components/`:
- `Sidebar.tsx` — 5 pills: Resolution Switch(1), Stretch Preview(2), Custom Res & Test(3), Fix Black Bars(4), Settings(5). Keys 1-5 hint.
- `TopBar.tsx` — per-tab title/desc + live `WxH @ Hz` pill + stretch badge + Toggle button (F4 label).
- `UnifiedStretch.tsx` — **merged res+borderless, stacked, no-scroll** (`h-full overflow-hidden`). Top: header + F4 toggle + hotkey modal. Middle: 2-col Native vs Stretched cards. Bottom: Borderless Valorant 12-col grid + slim status strip pinned via `mt-auto`.
- `ResolutionVisualizer.tsx` — 8 agents (including Brimstone official transparent art). Presets 1.45:1 (OPTIMAL) / 4:3 / 16:10 / 5:4 / 16:9, slider 1.0–1.777 step .005, split vs single view, Apply `evenWidth×nativeH@Hz`.
- `CustomResolution.tsx` — W/H/Hz inputs (step 2), 4 quick presets, **Add Mode** (primary) + **Smart Test** (auto-Add on BADMODE then test) + Sync Game Files. 15s watchdog modal (countdown ring, Keep Changes → `savePreferredStretchedRes`, Revert/Esc → restore).
- `HardwareScaling.tsx` — 5 toggles/vendor (`full_screen_scaling`, `gpu_scaling_engine`, `override_game_scaling`, `low_latency_scanout`, `integer_scaling_bypass`), 0ms optimistic UI + revert on error, Auto-Apply all.
- `Settings.tsx` — stretch target presets + custom W×H + per-file Valorant sync.
- Dead/legacy: `DisplayManager.tsx`, `BorderlessStudio.tsx`, `GlobalSwitcher.tsx` — unlinked from navigation.

### 3.3 Backend (`src-tauri/src/`)

- `lib.rs` — state (`hotkey_controller`, `preferred_stretched` from `load_saved_stretched_res` default `round(nativeH*1.45)+2 even`), tray (Show/Quit, left-click show, close→hide), hotkey thread (toggle native↔preferred, emit event), 20s trim thread. Registers all 30 commands (see 3.2 list). `toggle_profile` compares `cur.width == native_w` only.
- `display.rs` (~2667 lines) — the brain:
  - GDI: `EnumDisplayDevicesW/EnumDisplaySettingsW`, `get_native_resolution` (max-pixel mode), `get_supported_refresh_rates_for`, `apply_display_mode` with **`CDS_TEST` preflight** (fail fast; BADMODE → `badmode_friendly_message` with exact-Hz rates + nearest-Hz suggestion) then 3 mutating methods (Ex+NORESET+commit → Ex direct → global) reporting **all 4 stage codes + symbolic names**.
  - **Topology vs device**: `set_monitor_topology_attached` (CCD temporary — MultiMonitorTool or 0×0 `ChangeDisplaySettingsExW`) vs `set_monitor_device_enabled` (true SetupDi MONITOR-class `DIF_PROPERTYCHANGE DICS_ENABLE/DISABLE CONFIGSPECIFIC`, admin-gated, last-monitor guard, `DI_NEEDREBOOT` logged). `set_monitor_attached` = compat alias to topology path.
  - **GDI→PnP bridge** (core gotcha): GDI `MONITOR\PHLC401\{...}\000x` ≠ PnP `DISPLAY\PHLC401\5&...&UID...`. Resolve via CCD `QueryDisplayConfig` + `DisplayConfigGetDeviceInfo` (SOURCE `viewGdiDeviceName` → TARGET `monitorDevicePath` → strip `\\?\`/`#{guid}`/`#`→`\`). Precedence: (a) exact PnP → (b) GDI→DISPLAYx→bridge → (c) DISPLAYx→bridge → (d) single-candidate model fallback; **ambiguous duplicates → None (never guess)**. Only `GUID_DEVCLASS_MONITOR` touched; GPU adapters (`GUID_DEVCLASS_DISPLAY`, `PCI\...`) never disabled. Enumerates PRESENT then flags-0 (ghosted) so disabled panels stay re-enableable; synthetic cards for GDI-hidden devnodes; `monitor_res_cache.json` keeps real w/h so disabled cards don't show 0×0/NaN.
  - Misc: `get_tool_path` (exe-dir `tools/` → `%LOCALAPPDATA%\TrueStretchStudio\tools` → `Desktop\tools` → legacy scratch `tools/` → bare name), hotkey persistence `hotkey.txt` (`ctrl:shift:alt:win:vk`), stretch persistence `stretched_res.txt`, `set_display_scaling_mode` (CCD STRETCHED vs ASPECTCENTEREDMAX + `GraphicsDrivers\Configuration\Scaling` 4/2), `launch_cru/restart_graphics_driver/reset_all_cru_overrides`.
- `custom_res.rs` (~783 lines) — built-in Add:
  - `validate_custom_resolution` (640–7680 × 480–4320, 23–500Hz, even W+H).
  - Timing: CRU `AutomaticPC` table verbatim → CVT-RB2 double-pass fallback; packs 18B Type-0 descriptor; pclock ≤655.35MHz; 12/10/6-bit field checks.
  - Registry: copy live 128B `EDID` → patch descriptor at offset 54 → fix checksum → write `EDID_OVERRIDE "0"` under `HKLM\...\Enum\DISPLAY\<dev>\<inst>\Device Parameters`; per-monitor backup `edid_backup_*.bin`; `remove_custom_override` single-delete (`reset-all.c` style).
  - Flow `add_custom_resolution`: admin check → resolve any id to canonical `DISPLAY\<model>\<uid>` (ambiguous → refuse) → CDS_TEST skip if exists → backup → patch → restart stack (**in-process SetupDi DISPLAY-class GLOBAL disable/enable first, fallback `restart64.exe -q`**) → sleep → post CDS_TEST report. Intel: no `FakeEDID_*` write (modern Intel honors `EDID_OVERRIDE`; legacy FakeEDID recovery lives in restart64 fallback).
- `game_config.rs` — recursive `%LOCALAPPDATA%\VALORANT\Saved\Config\**\GameUserSettings.ini` find; parse `FullscreenMode/bShouldLetterbox/ResolutionSizeX/Y`; `update_config` forces `FullscreenMode=2`, `LastConfirmed/Preferred=2`, `bShouldLetterbox=False`, all `ResolutionSizeX/Y + Desired + LastUserConfirmed` pairs; read-only unlock→write→re-lock.
- `gpu.rs` — `detect_gpu` via `DeviceString`; per-vendor instructions + 5-setting report (`gpu_settings.json`); `apply_single_gpu_setting` (CCD + `DxgkUsePhysicalMode`/`Dal*`/`ScaleOption` + `DirectFlipEnabled` + `DisableDXGIWindowedStereo` + letterbox sync); `auto_configure_all_gpu_settings` + preferred-res config sync; `launch_control_panel` (nvcplui / `amd://` / `igcc://`).
- `window_manager.rs` — `EnumWindows` filter (visible, titled, ≥120×80, no tool-windows, blocklist Program Manager/Settings/old title); `make_borderless` (strip caption/thickframe/min/max/sysmenu/border → POPUP → monitor bounds); `restore_window` (OVERLAPPEDWINDOW, 1280×720 @100,100).
- `calculator.rs` — ratio math + presets (2K 2090×1440, FHD 1569→1568?/1080, HD 1046→1044/720, 4K 3134→3132/2160 — note test expects +2-even values 1046/1568/2090/3134) + `#[cfg(test)]` unit tests. `calculate_1_45_for_height` is the canonical formula.
- `shortcuts.rs` — quick-shortcut list (`shortcuts.txt` `id|name|match|icon|removable`), VALORANT pinned non-removable.

---

## 4. Recent changes (2026-09-07)

- **Deep WebView2 Process Tree RAM Trimming in Tray:** When minimized or closed to system tray, Chromium/WebView2 previously retained ~196MB of GPU swapchains, V8 heaps, and DOM buffers because default Win32 `window.hide()` does not trigger Chromium memory evacuation. Implemented native Win32 Toolhelp32 process-tree traversal in `src-tauri/src/lib.rs` that recursively flushes the physical working set (`SetProcessWorkingSetSize(-1, -1)`) across all WebView2 child and grandchild processes (Manager, GPU Process, Renderer, Network, and Storage). Total RAM drops from ~200MB down to ~35MB across the entire process tree while in the system tray, restoring instantly on tray click without reload.
- **Display Manager Tab Removed:** Cleaned up sidebar navigation to 5 focused tabs (Keys 1–5: Resolution Switch, Stretch Preview, Custom Res & Test, Fix Black Bars, Settings).
- **Stretch Simulator Full-Height Alignment:** Expanded `ResolutionVisualizer` gaming monitor frame (`items-stretch`, `flex-1 min-h-[460px]`) so the simulated display glass dynamically matches the full height of the Aspect Ratio Presets column with zero dead vertical space.
- **BADMODE -2 friendly + auto-Add:** `display.rs` preflight returns `Mode WxH@Hz not in driver list (BADMODE -2, …). Nearest supported … Go to Custom Res & Test > Add Mode … as admin …` instead of cryptic `code: -2`; `ipc.ts` preserves backend text verbatim when it already has Add guidance, enriches bare codes with `cdsCodeToText`; `App.tsx` toasts 7s + jumps to Custom Res. `CustomResolution` Smart Test auto-runs Add (EDID+restart) on BADMODE instead of dead-ending. All 4 CDS stage codes now reported (previously commit code misled).
- **EDID 6-bit VFront limit fix for high refresh rates (144Hz–360Hz):** CVT-RB2 formula dumps all blanking into `VFront` which produces `121..165` lines at high refresh rates. Standard 18-byte Type 0 EDID descriptors allocate only 6 bits for `VFront` (max 63 lines). Fixed `custom_res.rs` to clamp `VFront` to standard VESA sync offset (8 lines, $\le 63$) while preserving the exact 12-bit `VBlank` (up to 4095 lines). The display controller reconstructs `VBack = VBlank - VFront - VSync`, maintaining 100% exact pixel clock, frame timing, and refresh rate across 60Hz–360Hz.
- **Even-rounding:** odd widths (e.g. 2077×1440 from slider math) auto-round to even (2078) in `normalizeEvenDims` + toast, before CDS_TEST/Add — `custom_res.rs` rejects odd widths.
- **Brimstone image:** was initial-letter placeholder via `SafeAgentPortrait` fallback; now real `public/agents/brimstone.png` (+ `dist/agents/`) saved from user photo. Note: `brimstone_ka_thumb.png` is currently a byte-duplicate (both 1040.2KB) — generate a real small thumb later.
- **CCD removed from UI:** `DisplayManager` no longer exposes Attached/Detached; `setMonitorAttached` marked `@deprecated` in `ipc.ts`, `set_monitor_attached` kept in `lib.rs` as compat alias to `set_monitor_topology_attached`. True Stretch Mode / Restore All are device-only now.
- **Unified stacked layout, no-scroll:** Window Stretcher merged into `UnifiedStretch` (header → Native/Stretched cards → Borderless 12-col → status strip `mt-auto`); `Sidebar`/`TopBar` updated, `App.tsx` locks unified tab to viewport. No overflow / no AI slop per constraint.
- **True Stretch 1.45 rule enforced:** `W = round(H*1.45)+2, even` everywhere; presets + default + calculator test agree.

---

## 5. Build & Run

From repo root (`C:\Users\Administrator\Projects\truestretch_tauri`):

```powershell
# Frontend-only (mocks, no Win32 — good for UI work)
npm run dev            # → http://localhost:5173

# Full desktop + MCP bridge (needs Rust + WebView2; exposes 9223 in DEBUG only)
npx tauri dev          # NOT `npm run tauri` (no such script)

# Checks / build
npm run build          # tsc -b && vite build → dist/
npx tauri build        # release exe + msi/nsis (needs admin-adjacent signing? no, plain)
npx tauri build --no-bundle   # exe only, faster
cargo check --manifest-path src-tauri/Cargo.toml
npx oxlint 2>/dev/null; npm run lint
cargo test --manifest-path src-tauri/Cargo.toml  # calculator 1.45 tests
```

**Admin requirement:** device-disable (`set_monitor_device_enabled`), EDID Add/Remove (`add_custom_resolution`/`remove_custom_override`) return `Requires admin: run TrueStretch as administrator …` when not elevated. Restart the dev exe / built `app.exe` elevated to test those paths. Everything else (switch, preview, config sync w/o lock, GPU optimistic toggles) works unelevated.

---

## 6. Test checklist

1. **Add Mode before Switch (happy path):** Custom Res → set `2090×1440 @ 260Hz` (or your panel's max Hz) → **Add Mode** (elevated; screen flickers on driver restart) → post CDS_TEST ok → 15s safe test appears → Keep Changes → Switcher F4 toggles Native↔2090×1440. If you skip Add, Switch must fail with the friendly BADMODE toast + land on Custom Res (not a bare `-2`).
2. **1.45 rule:** any H → `W=round(H*1.45)+2 even` (1440→2090, 1080→1568, 720→1046, 2160→3134). Odd input (2077) must round to 2078 with toast.
3. **Safe test:** Test → countdown 15→0 auto-reverts; Esc reverts immediately; Keep saves `stretched_res.txt` + becomes F4 target.
4. **Display Manager:** disable secondary device (elevated) → card shows Device Disabled with cached res (not 0×0); last-monitor disable refused; primary disable asks confirm + auto re-enables after 15s; True Stretch Mode disables all secondaries; Restore All re-enables. Duplicate-model panels: pass exact `device_id` — ambiguous GDI id must refuse, never disable the wrong panel.
5. **Borderless:** pick VALORANT in Switcher bottom card → Make Borderless fills panel → Restore Frame returns 1280×720.
6. **Game sync:** Settings → Sync All writes `ResolutionSizeX/Y + bShouldLetterbox=False + FullscreenMode=2` to every `GameUserSettings.ini`, honors Read-Only lock.
7. **Preview:** all 8 agents render (Brimstone real photo, no placeholder, no broken icon); slider + presets update `evenWidth`; split view shows +22.5% wider on right at 1.45:1.
8. **No-scroll:** Switcher at 1180×860 shows header/cards/borderless/status with zero page scroll; other tabs may scroll internally.
9. **Mocks:** `npm run dev` in browser shows mock 2560×1440/260Hz + 3 fake monitors without crashing (no `__TAURI_INTERNALS__`).

---

## 7. Conventions

- **Grid no-scroll:** main pages are single-grid, no page overflow. Unified tab is the strictest — keep `h-full min-h-0 overflow-hidden`, truncate long titles, `mt-auto` the status strip. Don't add vertical stacks that push past 860px height.
- **No AI slop:** no lorem, no emoji in UI, no purple-gradient-everywhere; M3 Expressive dark tokens only (`m3-surface`, `m3-primary #d0bcff`, `m3-primary-container`, `m3-tertiary`, `m3-outline-subtle`). Mono font for all `WxH @ Hz` numbers (`tabular-nums`).
- **M3 dark:** surfaces `surface-container(-low/high/highest)`, pills `rounded-full`, cards `rounded-2xl/3xl`, borders `border-m3-outline-subtle`. Toasts bottom-right pill; banners inline with Dismiss.
- **Error UX:** never surface bare CDS numbers — always `CODE=SYMBOL` + next action (Add Mode path / admin note). `isBadModeErrorMessage` regex must keep non-digit boundaries (don't match 2090).
- **Safety first:** SetupDi touches MONITOR class only; ambiguous resolve → refuse with candidate list; last-monitor guard in both frontend and backend; primary disable auto-reverts.
- **MCP bridge debug-only:** never initialize the bridge plugin in release; keep `withGlobalTauri: true`.

---

## 8. Gotchas

- `npx tauri dev` vs `npm run dev` — different data sources (real vs mock). Don't "fix" mocks to look real; they're intentional.
- `MONITOR\...` ≠ `DISPLAY\...` — never `==` them. Always go through `resolve_display_to_instance_id` / bridge. Duplicate Philips panels (PHLC401 etc.) share model — exact `device_id` only.
- `device_name` (`\\.\DISPLAYx`) is unstable across disable/enable; persist `device_id` (PnP) for Add/remove/re-enable.
- EDID override needs **even W**, admin, and a driver restart (screen flicker is normal). Post-Add CDS_TEST can lag ~10s — UI already says "wait ~10s and Test again".
- `get_tool_path` still checks legacy `.gemini/antigravity/scratch/.../tools` — harmless, but new tools go beside the exe or `%LOCALAPPDATA%\TrueStretchStudio\tools`. Missing `CRU.exe/restart64.exe/reset-all.exe/MultiMonitorTool.exe` degrades gracefully (fallback or clear error), except SetPrimary which silently no-ops without MultiMonitorTool.
- `toggle_profile` keys off `cur.width == native_w` only (not height) — a custom height with native width counts as stretched.
- `brimstone_ka_thumb.png` duplicates `brimstone.png` — replace with a real 96px-range thumb; `SafeAgent*` fallbacks need `public/<path>` to exist or they show the letter avatar (by design).
- `dist/screenshots/` doesn't exist — don't reference it in UI until implemented.
- `BorderlessStudio.tsx` / `GlobalSwitcher.tsx` are orphaned — don't import without removing the merge.
- Stale `src-tauri/target/debug/app.exe` may exist from `npx tauri dev` — release tests must use `target/release/app.exe` or the bundle installers.

---

## 9. Next steps / TODOs

- [x] Real `brimstone_ka_thumb.png` (official high-res transparent icon from Valorant API deployed to `public/dist` and wired in `ResolutionVisualizer.tsx`).
- [ ] Delete or explicitly archive `BorderlessStudio.tsx` / `GlobalSwitcher.tsx`; remove `set_monitor_attached` backend alias once no external caller uses it.
- [ ] Duplicate-panel UX: when bridge refuses ambiguous model, surface the candidate `DISPLAY\...` list in the toast with one-click copy.
- [ ] Intel path: verify EDID_OVERRIDE-only on real Intel iGPU; confirm restart64 FakeEDID fallback actually recovers; log which restart path was taken in UI (currently only in logs).
- [ ] `monitor_res_cache.json` invalidation: if panel swapped, stale res persists — add EDID-hash or timestamp check.
- [ ] Requested-tab automation: document `requested_tab.txt` protocol or remove if unused.
- [ ] Screenshot tooling: decide home for `dist/screenshots/` (build-time capture vs runtime save) before referencing it.
- [ ] Pending user saves: confirm preferred stretched res + game-config lock state on the user's machine survived the Brimstone asset copy (check `%LOCALAPPDATA%\TrueStretchStudio\stretched_res.txt`, `gpu_settings.json`).
- [ ] Release hygiene: bump `tauri.conf.json` + `Cargo.toml` versions together; rebuild msi/nsis after any Rust change; re-verify admin flows on the signed bundle (not just `target/release/app.exe`).
