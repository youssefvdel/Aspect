# Releasing Recon

The in-app updater is **not** a GitHub download link. It uses Tauri's signed
updater: the app fetches `latest.json` from the newest GitHub release, downloads
the payload, verifies it against the **minisign public key** in
`src-tauri/tauri.conf.json`, installs quietly in place, and relaunches itself.

**If the signature does not verify, the update is refused.** That is the point.

---

## One-time setup (already done on this machine)

A signing keypair was generated with `tauri signer generate`:

| File | Where | Secret? |
| --- | --- | --- |
| `recon.key` — private, signs every release | `%LOCALAPPDATA%\Recon\signing\recon.key` | **YES — never commit, never share, never lose** |
| `recon.key.pub` — public, ships in the app | copy is inlined in `tauri.conf.json` → `plugins.updater.pubkey` | safe to publish |

> ⚠️ **Back the private key up somewhere safe.** If it is lost, no future release
> can be signed and every installed app will refuse updates — the fix would be a
> manual reinstall for every user.

---

## Cutting a release

### 1. Bump the version

```bash
bun run bump -- 0.4.0
```

The bump script writes **both** `package.json` and `src-tauri/Cargo.toml`. They must
match:

- `Cargo.toml` → `env!("CARGO_PKG_VERSION")` is what the app reports as *current*.
- `package.json` → the bundled app version (`tauri.conf.json` sets `"version": "../package.json"`).

If they drift, the updater compares against the wrong "current" version and either
never offers an update or offers one forever.

### 2. Build, signed

```bash
export TAURI_SIGNING_PRIVATE_KEY_PATH="$LOCALAPPDATA/Recon/signing/recon.key"
bun run tauri build
```

Outputs under `src-tauri/target/release/bundle/`:

| Artifact | Purpose |
| --- | --- |
| `nsis/Recon_<v>_x64-setup.exe` | normal manual installer |
| `nsis/Recon_<v>_x64-setup.exe.sig` | its signature |
| `nsis/Recon_<v>_x64-setup.nsis.zip` | **the updater payload** |
| `nsis/Recon_<v>_x64-setup.nsis.zip.sig` | **its signature** |
| `msi/Recon_<v>_x64_en-US.msi` | enterprise install |

If `.sig` files are missing, the build was not signed — do not publish it.

### 3. Generate `latest.json`

The updater endpoint is
`https://github.com/youssefvdel/Recon/releases/latest/download/latest.json`, so this
file must be attached to the release. It is not produced automatically outside CI:

```bash
V=0.4.0
ZIP="src-tauri/target/release/bundle/nsis/Recon_${V}_x64-setup.nsis.zip"
cat > /tmp/latest.json <<EOF
{
  "version": "${V}",
  "notes": "See the release page for details.",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "windows-x86_64": {
      "signature": "$(cat "${ZIP}.sig")",
      "url": "https://github.com/youssefvdel/Recon/releases/download/v${V}/Recon_${V}_x64-setup.nsis.zip"
    }
  }
}
EOF
```

(The signature must be the **contents** of the `.sig` file, not a path.)

### 4. Publish the release

```bash
V=0.4.0
gh release create "v${V}" \
  "src-tauri/target/release/bundle/nsis/Recon_${V}_x64-setup.exe" \
  "src-tauri/target/release/bundle/nsis/Recon_${V}_x64-setup.nsis.zip" \
  "src-tauri/target/release/bundle/nsis/Recon_${V}_x64-setup.nsis.zip.sig" \
  "src-tauri/target/release/bundle/msi/Recon_${V}_x64_en-US.msi" \
  /tmp/latest.json \
  --title "Recon v${V}" --notes "..." --latest
```

Two rules:

- **Do not mark it a prerelease or draft.** `/releases/latest` skips both, so the
  updater would never see it.
- The tag must be higher than the running build (`v0.4.0` > `0.3.0`).

### 5. Verify before telling anyone

```bash
curl -sL https://github.com/youssefvdel/Recon/releases/latest/download/latest.json | head -20
```

Then in an older install: **Settings → Check for updates** should offer the new
version and install it with a progress bar, no browser, and a self-restart.

---

## Why the app can't just replace its own .exe

Windows will not let a running process overwrite its own executable, and Recon
keeps a WebView2 runtime and an overlay window alive. Every serious Windows app
therefore hands off to a signed installer or an updater helper; the "silent
in-place" experience is the installer running with `/S` and no UI while the app
exits and relaunches. That is what the plugin does here — the difference from the
old flow is verification, a real manifest, progress and an automatic restart.

## Legacy

`src-tauri/src/updater.rs` (`check_app_updates` / `install_app_update`) is the old
GitHub-API flow: it guessed an asset by file extension, downloaded it to `%TEMP%`
and shell-executed it, with no signature check. It is no longer wired into the UI
and should be deleted once no build still calls it.
