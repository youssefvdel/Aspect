# Aspect

<div align="center">
  <img src="src-tauri/icons/icon.png" width="96" height="96" alt="Aspect Logo" />
  <h3>Competitive Stretched Resolution & Esports Display Utility</h3>
  <p>Engineered for VALORANT, Counter-Strike 2, and competitive FPS titles.</p>

  [![GitHub Release](https://img.shields.io/github/v/release/youssefvdel/Aspect?style=flat-square&color=d0bcff)](https://github.com/youssefvdel/Aspect/releases)
  [![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-blue?style=flat-square)](https://github.com/youssefvdel/Aspect)
  [![Tauri](https://img.shields.io/badge/tauri-v2-orange?style=flat-square)](https://tauri.app)
  [![TypeScript](https://img.shields.io/badge/typescript-100%25-3178c6?style=flat-square)](https://www.typescriptlang.org)
  [![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
</div>

---

## Overview

**Aspect** is a standalone, hardware-accelerated desktop utility that unlocks true stretched resolution in modern competitive FPS engines without letterboxing or pillarboxing black bars. 

Built strictly with **100% TypeScript**, **React 19**, **Google Material Design 3 Expressive**, and a **Rust / Win32 backend** with zero external C/C++ dependencies or external wrappers.

---

## Features

* **Zero-Letterbox True Stretch (1.45:1)**: Unlocks the game engine's true aspect ratio floor (29:20 / 1.45:1), expanding horizontal model width by **+22.5%** while preserving 100% vertical field of view.
* **Two-Way Sensitivity Matcher**: Live bidirectional sensitivity converter and native eDPI synchronizer. Automatically compensates for horizontal FOV expansion (`stretch_sens = native_sens / 1.225`) to keep horizontal crosshair feel identical to 16:9.
* **Auto-Borderless Game Hook**: Strips Windows borders and synchronizes game viewport geometry automatically upon resolution toggle.
* **Hardware GPU Scaling Lock**: Automatically locks NVIDIA (`nvlddmkm`) and AMD Display Driver settings to Full-Screen Stretched across resolution switches.
* **Display Mode Lab & Safe Tester**: Hardware EDID override injector with an automatic **15-second watchdog timer**, Escape-key rollback, and emergency driver reset.
* **In-App GitHub Auto-Updater**: Native update checks with changelog previews and one-click upgrades.

---

## The Mathematics of True Stretch

### 1. The Aspect Ratio Floor (29:20)
Modern tactical shooters (such as VALORANT) lock horizontal FOV to 103° and enforce pillarbox black bars if the rendered aspect ratio drops below **29:20** ($1.45:1$).

$$\text{Min Width} = \text{Height} \times \frac{29}{20} = \text{Height} \times 1.45$$

| Native Display | Native 16:9 | Optimal 1.45:1 Stretched | Hitbox Expansion |
| :--- | :--- | :--- | :--- |
| **1440p** | $2560 \times 1440$ | **$2090 \times 1440$** | **+22.5% wider** |
| **1080p** | $1920 \times 1080$ | **$1568 \times 1080$** | **+22.5% wider** |

### 2. Sensitivity Velocity Compensation
Because horizontal pixels span a wider visual angle per monitor millimeter:

$$k = \frac{\text{Width}_{\text{native}}}{\text{Width}_{\text{stretched}}} \approx 1.225$$

$$\text{Compensated Sens} = \frac{\text{Native Sens}}{k}$$

---

## Getting Started

### Download
Grab the latest release from the [Releases Page](https://github.com/youssefvdel/Aspect/releases):
* **Portable (`Aspect_v0.1.0_Portable_x64.exe`)**: Zero-install standalone binary.
* **Installer (`Aspect_0.1.0_x64-setup.exe`)**: Standard Windows Setup with start menu and desktop shortcuts.
* **MSI (`Aspect_0.1.0_x64_en-US.msi`)**: Windows Installer package.

### Development & Building

#### Prerequisites
* [Node.js](https://nodejs.org) (v20+)
* [Rust](https://rustup.rs) (stable-x86_64-pc-windows-msvc)
* [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/downloads/) with C++ desktop workload

#### Installation
```bash
# Clone the repository
git clone https://github.com/youssefvdel/Aspect.git
cd Aspect

# Install dependencies
npm install

# Run in development mode (hot-reloading)
npm run dev

# Run Tauri development desktop window
npx tauri dev
```

#### Production Build
```bash
# Compile full standalone Windows release
npm run build
npx tauri build
```
The compiled binary will be generated at `src-tauri/target/release/aspect.exe` and in `src-tauri/target/release/bundle/`.

---

## Tech Stack

* **Frontend**: 100% TypeScript, React 19, Tailwind CSS, Framer Motion, Lucide Icons
* **Design System**: Google Material Design 3 Expressive (Dark theme)
* **Backend**: Rust, Tauri v2, Win32 API (`windows-rs`), native `winreg`
* **Display Engine**: Win32 Connecting and Configuring Displays (CCD) + GDI Display Settings

---

## License

MIT License © 2026 Youssef Adel
