# Product Hunt Launch — Memeforge

## Name
Memeforge

## Tagline (60 chars)
Put text on a picture. Own it forever. No subscription.

## Description (260 chars)
Memeforge is a local-first desktop meme generator: drag/resize Impact-style text with auto-fit sizing, stroke-safe top/bottom bands, batch CSV captioning for whole folders, and reopenable `.meme` project files. $15 once instead of $16/month. No cloud, no watermark tax.

## Full description

Memeforge is a desktop meme generator for people who are tired of paying a monthly fee to put text on a picture.

**Why another meme tool?** Because Kapwing and its peers gate the basics — watermark-free export, no ads, decent limits — behind a $16/month Pro plan. Memeforge is $15 once, MIT-licensed, and runs entirely on your machine.

**What it actually does:**
- Canvas editor: drop any image, add as many text boxes as you want, drag to move, drag the corner to resize
- Classic Impact/Anton meme font, fill + stroke color pickers, adjustable stroke width
- Auto-fit-to-width: text shrinks to the largest size that still fits its box — no manually eyeballing font sizes
- One-click stroke-safe top/bottom caption bands, inset so nothing clips at the edge
- Batch mode: point it at a CSV (`image, top, bottom`) and caption a whole folder in one pass
- Export PNG/JPG, copy straight to clipboard, or save to a chosen file
- `.meme` project files so you can reopen and keep editing later

No account. No telemetry. No network calls. No watermark. Pay once. Own it forever.

## Maker first comment

Hey PH 👋

I needed to caption a batch of product images for an ad campaign and realized the "free" meme tool I was using wanted $16/month to export without a watermark. For putting text on a picture. So I built Memeforge — a local desktop app, one-time $15, that does the two things I actually needed: a real drag/resize canvas editor with proper auto-fit text sizing, and a batch mode that reads a CSV and captions a whole folder of images unattended.

The layout math (auto-fit font sizing, word-wrap, stroke-safe band positioning) is a pure, dependency-free module with a real unit-test suite — happy to talk through the glyph-width heuristic if anyone's curious how it stays fast without loading real font metrics.

Being upfront: it doesn't ship licensed meme template art (Drake, etc.) — that's not mine to redistribute — but the whole point is you drop in your own image anyway. There's a small placeholder template pack (solid/gradient canvases) to get started immediately.

$15 once. That's it. Would love feedback, especially on the batch CSV workflow.

## Gallery shots (5)

1. **Hero — canvas editor**: dark UI, an image loaded with a top and bottom text band selected (dashed outline + resize handle visible), color pickers open in the layer panel. Caption: "Drag, resize, done."
2. **Auto-fit in action**: two side-by-side frames — a short caption at large font size vs. a long caption auto-shrunk to fit the same box. Caption: "Text that always fits, automatically."
3. **Batch mode**: the batch modal with a CSV loaded, a table of image/top/bottom rows, some rows marked "done" with green status. Caption: "Caption 200 images in one pass."
4. **Export options**: the export toolbar — Export PNG / Export JPG / Copy Image buttons highlighted. Caption: "PNG, JPG, or straight to clipboard."
5. **Price comparison card**: "Kapwing Pro: $192/year vs Memeforge: $15 once" side by side. Caption: "Your memes are not a subscription."
