# Cosvault — Desktop App (Tauri)

This folder contains everything needed to build Cosvault as a **real native desktop application** with an installer, not just a PWA. Built on [Tauri 2](https://tauri.app) — Rust shell + your existing Next.js frontend.

The result is a single `.dmg` (macOS), `.msi`/`.exe` (Windows), or `.deb`/`.AppImage` (Linux) that users install like any normal desktop program. It opens in its own window with no browser chrome, has its own taskbar/dock icon, and runs entirely locally.

## What you get

- **Standalone binary** — no Node.js, no browser, no dev server needed at runtime
- **Native installer** — `.dmg` / `.msi` / `.deb` with app icon, signed if you provide a cert
- **Same UI** — your existing Next.js UI is embedded into the Rust binary at build time
- **Persistent local storage** — IndexedDB still works inside Tauri's webview, so your library survives restarts
- **File System Access API works** — Tauri's webview (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) supports the API natively, so folder watching works the same as in Chrome

## Prerequisites (one-time setup on your machine)

1. **Rust toolchain** — install from <https://rustup.rs>
   ```bash
   # macOS / Linux
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   # Windows: download rustup-init.exe from the website
   ```
2. **System dependencies** (Tauri 2 requirements):
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Linux (Ubuntu/Debian)**:
     ```bash
     sudo apt update
     sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
       libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```
   - **Windows**: Microsoft Visual Studio C++ Build Tools (or full Visual Studio with "Desktop development with C++" workload). WebView2 is preinstalled on Windows 10/11.
3. The project already has the Tauri CLI installed (`@tauri-apps/cli`), Tauri JS API, and dialog/fs plugins via `bun add`.

## Build the desktop app

From the project root:

```bash
# First-time only: regenerate Tauri-format icons from your source PNG
bunx tauri icon ./public/icon-512.png

# Build a production installer (creates .dmg / .msi / .deb in src-tauri/target/release/bundle/)
bun run tauri:build

# Or run in dev mode (hot reload — opens a Tauri window pointing at your dev server)
bun run tauri:dev
```

That's it. The first build takes ~5 minutes (Rust compilation). Subsequent builds are much faster (~30s).

## Output location

After `bun run tauri:build`:

- **macOS**: `src-tauri/target/release/bundle/dmg/Cosvault_0.1.0_<arch>.dmg`
- **macOS app bundle**: `src-tauri/target/release/bundle/macos/Cosvault.app`
- **Windows**: `src-tauri/target/release/bundle/msi/Cosvault_0.1.0_<arch>_en-US.msi` (and an `.exe` NSIS installer)
- **Linux**: `src-tauri/target/release/bundle/deb/cosvault_0.1.0_<arch>.deb` and `.AppImage`

## How the integration works

- `tauri.conf.json` is the main config — app identifier, window size, icon paths, build commands.
- `Cargo.toml` declares Rust dependencies (`tauri`, `tauri-plugin-dialog`, `tauri-plugin-fs`).
- `src/main.rs` + `src/lib.rs` are the Rust entry points. The `tauri::Builder` loads the bundled frontend assets.
- `capabilities/default.json` declares what the webview is allowed to do (window management, dialogs, file system).
- `next.config.ts` switches to `output: "export"` when `TAURI_BUILD=1` is set, producing a fully static export in `out/` that Tauri embeds.
- The `beforeBuildCommand` in `tauri.conf.json` runs `TAURI_BUILD=1 bun run build` automatically, so you don't have to remember the env var.

## Web version still works

The desktop app and the web version are the same codebase. Running `bun run dev` and opening the preview URL in your browser gives you the web version with no changes. Tauri is just an additional build target — your users can pick whether they want the installable desktop app or the web URL.

## Optional: code-signing the installer

Unsigned installers will show "unidentified developer" warnings on macOS / SmartScreen on Windows. To sign:

- **macOS**: enroll in Apple Developer Program ($99/yr), get a "Developer ID Application" certificate, then in `tauri.conf.json` add `"macOS": { "signingIdentity": "Developer ID Application: Your Name (TEAMID)" }`.
- **Windows**: buy an EV Code Signing certificate (Sectigo / DigiCert), install it in Windows certificate store, then `"windows": { "certificateThumbprint": "...", "digestAlgorithm": "sha256" }` in the bundle config.
- **Linux**: not required.

## Distribution checklist

- [ ] Test build: `bun run tauri:build` succeeds locally
- [ ] Open the resulting installer, install, launch — verify your library persists
- [ ] Test on a clean machine (no Rust installed) to confirm the binary is self-contained
- [ ] Sign the installer (optional, recommended for distribution)
- [ ] Notarize macOS build (`xcrun notarytool submit ... --key-chain-profile ...`)
- [ ] Upload to GitHub Releases / your own server
