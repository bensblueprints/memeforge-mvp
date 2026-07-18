# 🐸 Memeforge

## Demo



https://github.com/user-attachments/assets/542ecf6f-cd36-402b-92df-18a84ebceba2



[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**The desktop meme generator you buy once and own forever.** Canvas-based text editor with the classic Impact meme look, drag/resize text boxes, auto-fit-to-width sizing, batch CSV captioning for whole folders of images, and project files you can reopen and re-edit — 100% local, zero subscription, zero cloud, zero telemetry.

Kapwing Pro charges **$16/month, forever**, largely to remove a watermark and unlock export limits on what is, underneath, a simple caption tool. Memeforge is **$15 once**. Your memes are not a subscription.

![Memeforge screenshot](docs/screenshot.png)

## ☕ Skip the setup — get the 1-click installer

Don't want to touch a terminal? Grab the packaged Windows installer (and support development):

**→ [Get Memeforge on Whop](https://whop.com/benjisaiempire/memeforge-app)** — pay once, own it forever.

## Features

- 🖼️ **Canvas-based editor** — drop an image or open a file, add as many text boxes as you want, drag to move, drag the corner handle to resize
- 🔠 **Classic meme font** — Impact / Anton with a sans-serif fallback stack, fill + stroke color pickers, adjustable stroke width
- 📐 **Auto-fit-to-width sizing** — text automatically shrinks to the largest size that still fits its box, with real word-wrap (a documented glyph-width heuristic, tuned for bold caps display type, keeps it fast and dependency-free)
- 🎯 **Stroke-safe top/bottom bands** — one click adds a properly inset top or bottom caption band that won't clip against the canvas edge
- 🗂️ **Placeholder template pack** — six generated solid/gradient starter canvases with marked text bands (see [Template art](#template-art-honesty-note) below) — or just drop in your own image, which is the primary workflow
- 📋 **Batch mode** — point it at a CSV (`image, top, bottom` columns, quoted fields and commas-in-quotes supported) and caption an entire folder of images in one pass
- 💾 **Export PNG / JPG**, **copy straight to clipboard**, or **save to a chosen file**
- 📁 **`.meme` project files** — save your layers + image reference and reopen them later to keep editing, with atomic writes and corrupt-file recovery
- 🌑 Premium dark UI, drag-drop zone with hover state, fast and framework-free

## Template art — honesty note

Memeforge does **not** ship real, recognizable meme templates (Drake, Distracted Boyfriend, etc.) — that artwork is other people's licensed/trademarked imagery and isn't ours to redistribute. What ships in `templates/` is six small, honestly-generated solid-color and gradient placeholder canvases (built by `scripts/generate-templates.js`, zero image-library dependencies — it hand-writes PNG chunks and deflates with Node's built-in `zlib`) with the top/bottom text bands lightly marked, so there's something to caption immediately. For an actual meme, drag your own image onto the canvas — that's the app's first-class workflow, not a fallback.

## Quick start

```bash
git clone https://github.com/bensblueprints/memeforge
cd memeforge
npm i
npm start
```

Run the tests (layout engine + CSV parser + project store round-trip):

```bash
npm test
```

Regenerate the placeholder template pack:

```bash
npm run templates
```

Build the Windows installer:

```bash
npm run dist
```

## Memeforge vs Kapwing Pro

| | **Memeforge** | Kapwing Pro |
|---|---|---|
| Price | **$15 once** | $16/mo ($192/yr) |
| Cost after 1 year | **$15** | $192 |
| Cost after 3 years | **$15** (13x cheaper) | $576 |
| Your files live | **On your machine** | Their cloud |
| Works offline | **Always** | No |
| Account required | **No** | Yes |
| Watermark-free export | **Always** | Paid tier only |
| Batch captioning from CSV | **Yes** | No |
| Telemetry | **None** | Analytics SDKs |
| Reopen & re-edit a project | **`.meme` project files** | Cloud project only |
| Source code | **MIT, right here** | Closed |

**Pays for itself in well under 1 month** of Kapwing Pro — and every month after that is pure savings.

## Tech stack

- **Electron** — main + preload (context-isolated, sandboxed) + plain HTML/CSS/JS renderer, Canvas2D for drawing. No framework, no build step.
- **Pure layout engine** (`src/layout.js`) — zero dependencies, word-wrap + auto-fit-to-width font sizing + stroke-safe band positioning; runs identically in the renderer and under Node for tests.
- **Pure CSV engine** (`src/csv.js`) — zero-dependency batch-mode parser/serializer (quoted fields, commas-in-quotes, CRLF/LF).
- **Project store** (`src/store.js`) — atomic `.meme` project writes, corrupt-file recovery, schema normalization.
- **electron-builder** — Windows NSIS one-click installer.

## Data & privacy

Everything stays on your machine. Memeforge makes **no network calls at all**. Your projects are human-readable `.meme` JSON files you choose where to save — export them, version them, back them up yourself.

## License

[MIT](LICENSE) © 2026 Ben (bensblueprints)

## macOS build

See [MAC-BUILD.md](MAC-BUILD.md). Quickest path: GitHub **Actions** tab -> run the **Mac Build** (`mac-build.yml`) workflow to get a downloadable `.dmg` (unsigned - right-click -> Open on first launch).
