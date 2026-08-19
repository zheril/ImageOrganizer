# Cosvault

A local-first desktop application for organizing large cosplay photo & video collections. Built around the hierarchy **Cosplayer → Character → Set → Media**, with tags / events / locations cutting across the spine.

All data stays on your device — never uploaded. Original files on disk are only **indexed** (read), never moved, renamed, or deleted.

## Features

- **Cosplayer → Character → Set → Media** hierarchy with bulk-assign workflow from the Inbox
- **Watched folders** via the File System Access API — drop photos in via your OS, they're auto-detected on next launch or rescan
- **Virtualized grid** that handles 50k+ items smoothly
- **Full-screen lightbox viewer** with keyboard navigation (← → Space Esc F H I Z) and immersive mode
- **Thumbnail caching** — multiple sizes (tiny / medium / large / video poster) as WebP blobs in IndexedDB
- **Tags, favorites, ratings, EXIF, search, smart filtering**
- **Edit dialogs** for cosplayer / character / set with cover-image picker
- **Two modes**: web preview (this repo runs as a Next.js app) AND a real native desktop installer via Tauri (no browser, no Node at runtime)

## Quick start (web preview)

The fastest way to try the app — runs in your browser at `http://localhost:3000`.

```bash
bun install
bun run dev
```

Open <http://localhost:3000> in **Chrome or Edge** (Firefox/Safari lack the File System Access API so folder-watching falls back to a file picker).

## Quick start (native desktop app)

Cosvault ships as a real native installer (`.dmg` / `.msi` / `.deb`) — not a PWA. Built with [Tauri 2](https://tauri.app).

### Prerequisites (one-time per machine)

1. **Rust toolchain** — install from <https://rustup.rs>
   ```bash
   # macOS / Linux
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   # Windows: download rustup-init.exe from the website
   ```
2. **System dependencies** (Tauri 2 requirements):
   - **macOS**: Xcode Command Line Tools
     ```bash
     xcode-select --install
     ```
   - **Linux (Ubuntu/Debian)**:
     ```bash
     sudo apt update
     sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
       libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```
   - **Windows**: Microsoft Visual Studio C++ Build Tools (or full Visual Studio with the "Desktop development with C++" workload). WebView2 is preinstalled on Windows 10/11.

### Build the installer

```bash
# From the project root:

# 1. (Optional, one-time) Regenerate Tauri icon formats from the source PNG
bunx tauri icon ./public/icon-512.png

# 2. Build the native installer
bun run tauri:build
```

The first build takes ~5 minutes (Rust compilation). Subsequent builds ~30s.

**Output** (in `src-tauri/target/release/bundle/`):

| Platform | Path |
|---|---|
| macOS | `dmg/Cosvault_0.1.0_<arch>.dmg` + `macos/Cosvault.app` |
| Windows | `msi/Cosvault_0.1.0_<arch>_en-US.msi` + NSIS `.exe` |
| Linux | `deb/cosvault_0.1.0_<arch>.deb` + `.AppImage` |

### Dev mode (desktop window with hot reload)

```bash
bun run tauri:dev
```

Opens a Tauri window pointing at your `bun run dev` server. Edits to React code hot-reload instantly.

## How the web + desktop versions coexist

- The **web version** is what runs when you do `bun run dev` and open the browser.
- The **desktop version** is the same React/Next.js codebase, statically exported via `output: "export"` (triggered by the `TAURI_BUILD=1` env var) and embedded into the Rust binary at build time.
- IndexedDB works inside Tauri's webview (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux), so your library persists in the desktop app the same way it does in the browser.
- The File System Access API is supported natively in Tauri's webview, so folder-watching works exactly the same as in Chrome.

## Core concepts

```
Cosplayer        e.g. "Hoshino Yuki"
└── Character    e.g. "2B" (franchise: NieR:Automata)
    └── Set      e.g. "Anime Expo 2026" (date, location, photographer)
        └── Media  photos + videos
```

Tags, events, locations, favorites, and ratings cut across this hierarchy for discovery.

## Tech stack

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind 4 + shadcn/ui
- **State**: Zustand (UI state) + Dexie (IndexedDB for the library database)
- **Virtualization**: @tanstack/react-virtual
- **Theming**: next-themes (light/dark)
- **Thumbnails**: generated client-side via Canvas + OffscreenCanvas, cached as WebP blobs in IndexedDB
- **File access**: File System Access API (Chrome/Edge + Tauri's webview), with `webkitdirectory` fallback for other browsers
- **Desktop**: Tauri 2 (Rust + WebView)

## Architecture

| Path | Purpose |
|---|---|
| `src/app/` | Next.js app router + the single-page UI |
| `src/lib/db/dexie.ts` | Dexie schema (cosplayers, characters, sets, media, folders, tags, thumbs) |
| `src/lib/fs/index.ts` | File System Access helpers (pick directory, scan folder, get file handle, etc.) |
| `src/lib/thumbs/index.ts` | Thumbnail generation + caching |
| `src/lib/store/ui.ts` | Zustand UI store (view, selection, density, viewer state) |
| `src/components/views/` | Cosplayers / Characters / Sets / Inbox / Folders / Tags / Settings |
| `src/components/dialogs/` | EditDialog, AssignDialog |
| `src/components/media/` | MediaGrid (virtualized), MediaThumbnail, MediaViewer (lightbox) |
| `src/components/layout/` | Sidebar, TopBar, TaskPanel |
| `src-tauri/` | Tauri 2 desktop app — see [src-tauri/README.md](./src-tauri/README.md) for build details |
| `public/manifest.json` | PWA manifest for the "Add to home screen" web fallback |
| `scripts/` | Icon generators (PWA + Tauri) |

## File-system safety

- Cosvault only **reads** your folders. It never moves, renames, or deletes original files on disk.
- Removing a folder from the library only removes its indexed entries — your photos stay where they are.
- Destructive actions (delete cosplayer / character / set, reset library) all require explicit `confirm()` dialogs.
- IndexedDB is per-browser/per-app — your library is tied to your specific browser profile or Tauri install.

## Distribution (for sharing the built app)

After `bun run tauri:build`, distribute the resulting `.dmg` / `.msi` / `.deb` to users. They install it like any normal desktop program — no Rust toolchain needed on their machine.

For public distribution, you'll want to **code-sign** the installer to avoid "unidentified developer" / SmartScreen warnings — see [src-tauri/README.md](./src-tauri/README.md) for signing instructions.

## License

Private project. All rights reserved.
