# Recon — Official Website & Landing Page

Official responsive landing page for **Recon**, the Esport-Grade Stretched Resolution & Real-Time Scout Utility for Valorant.

🌐 **Live URL**: [https://recon.qd.je](https://recon.qd.je) (or [https://youssefvdel.github.io/recon-website](https://youssefvdel.github.io/recon-website))  
⚡ **App Repository**: [https://github.com/youssefvdel/Recon](https://github.com/youssefvdel/Recon)

---

## 🚀 Features

- **Cyber/Esports Visual Identity**: Deep space violet `#0c0714`, Material Design 3 tokens, glassmorphic HUD overlays, and glowing accent highlights.
- **Interactive Stretched Simulator**: Real-time slider demonstrating target expansion under 16:10 and 4:3 stretched aspect ratios.
- **Interactive Live Preview Tabs**: Real app previews of the Material 3 Collection & Arsenal, transparent In-Game Scout HUD, and True Stretched display scaling.
- **100% Vanguard Safety Section**: Technical breakdown addressing anti-cheat compliance, zero memory injection, and official Riot Client loopback API usage.
- **Automated Deployment**: GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys directly to GitHub Pages on every push to `main`.
- **Instant Confetti Download CTA**: Directly downloads signed `Recon_0.3.2_x64-setup.exe` from GitHub Releases.

---

## 🛠️ Local Development

Built with **Vite**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Framer Motion**.

```bash
# 1. Install dependencies
bun install

# 2. Run local dev server
bun run dev

# 3. Production build
bun run build
```

---

## 🌐 Custom Domain Setup (`recon.qd.je`)

This site uses a free domain from [DigitalPlat FreeDomain](https://github.com/DigitalPlatDev/FreeDomain).

### Step-by-Step Configuration

1. **Claim the Domain**:
   - Go to [DigitalPlat FreeDomain Dashboard](https://dash.domain.digitalplat.org/).
   - Register the subdomain: `recon.qd.je`.

2. **Configure DNS Records**:
   - In your DigitalPlat DNS Manager (or Cloudflare if using custom nameservers):
     - **Record Type**: `CNAME`
     - **Host / Name**: `@` (or `recon`)
     - **Target**: `youssefvdel.github.io`
     - **TTL**: Automatic (or 300)

3. **Verify in GitHub Pages**:
   - The repository includes a `CNAME` file pointing to `recon.qd.je`.
   - In repository **Settings → Pages**:
     - Custom domain: `recon.qd.je`
     - Check **Enforce HTTPS** (issued automatically by Let's Encrypt).
