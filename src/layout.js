/**
 * Memeforge — pure text-layout engine.
 * No Electron, no Canvas, no I/O. Font-metric measurement in a real <canvas>
 * requires a browser context, so this module uses a documented glyph-width
 * heuristic instead: for bold condensed display faces like Impact/Anton set
 * in ALL CAPS (the classic meme look), average glyph advance width is well
 * approximated as a fixed fraction of the font size, because caps in those
 * faces are far more uniform in width than mixed-case text in a normal
 * typeface. That constant is GLYPH_WIDTH_RATIO below — tuned against Impact
 * at common sizes. It's an approximation, not real font metrics, but it's
 * good enough to pick a font size that won't overflow the box, and it's the
 * only option that works identically in the renderer AND under plain Node
 * (this file has zero dependencies so `test/smoke.js` can require() it
 * directly).
 */

'use strict';

const GLYPH_WIDTH_RATIO = 0.58; // average glyph advance as a fraction of font size
const LINE_HEIGHT_RATIO = 1.15; // line box height as a fraction of font size
const DEFAULT_MIN_FONT_SIZE = 10;
const DEFAULT_MAX_LINES = 4;

function estimateTextWidth(text, fontSize) {
  return text.length * fontSize * GLYPH_WIDTH_RATIO;
}

function lineHeightFor(fontSize) {
  return fontSize * LINE_HEIGHT_RATIO;
}

/**
 * Greedy word-wrap: fit as many words per line as possible without
 * exceeding maxWidth at the given font size. A single word longer than
 * maxWidth is hard-broken by characters so it never silently disappears.
 */
function wrapText(text, fontSize, maxWidth) {
  const words = String(text == null ? '' : text).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth || !current) {
      // Word alone still doesn't fit an empty line — hard-break it.
      if (!current && estimateTextWidth(word, fontSize) > maxWidth && word.length > 1) {
        const broken = hardBreak(word, fontSize, maxWidth);
        lines.push(...broken.slice(0, -1));
        current = broken[broken.length - 1];
      } else {
        current = candidate;
      }
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function hardBreak(word, fontSize, maxWidth) {
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * GLYPH_WIDTH_RATIO)));
  const parts = [];
  for (let i = 0; i < word.length; i += maxChars) {
    parts.push(word.slice(i, i + maxChars));
  }
  return parts.length ? parts : [word];
}

/**
 * Compute the largest font size (between minFontSize and startFontSize)
 * for which `text`, word-wrapped to box.width, fits within box.height —
 * and return the wrapped lines at that size.
 *
 * Options:
 *   startFontSize   — upper bound to try first (default box.height * 0.4)
 *   minFontSize     — floor; never shrink below this (default 10)
 *   maxLines        — give up wrapping past this many lines (default 4)
 */
function autoFitText(text, box, options) {
  const opts = options || {};
  const width = Math.max(1, box.width);
  const height = Math.max(1, box.height);
  const startFontSize = Math.max(1, opts.startFontSize || Math.floor(height * 0.4));
  const minFontSize = Math.max(1, opts.minFontSize || DEFAULT_MIN_FONT_SIZE);
  const maxLines = opts.maxLines || DEFAULT_MAX_LINES;

  let fontSize = startFontSize;
  let lines = wrapText(text, fontSize, width);

  while (fontSize > minFontSize) {
    lines = wrapText(text, fontSize, width);
    const fitsWidth = lines.every((l) => estimateTextWidth(l, fontSize) <= width);
    const fitsHeight = lines.length * lineHeightFor(fontSize) <= height;
    const fitsLineCount = lines.length <= maxLines;
    if (fitsWidth && fitsHeight && fitsLineCount) break;
    fontSize -= 1;
  }

  // Final pass at the settled size (fontSize may have bottomed out at minFontSize
  // without ever satisfying every constraint — that's expected for extreme inputs).
  lines = wrapText(text, fontSize, width);

  return {
    fontSize,
    lines,
    lineHeight: lineHeightFor(fontSize),
    totalHeight: lines.length * lineHeightFor(fontSize),
    overflowed: fontSize <= minFontSize && (
      lines.length > maxLines || lines.length * lineHeightFor(fontSize) > height
    ),
  };
}

/**
 * Stroke-safe positioning for the classic top/bottom meme text bands.
 * Returns a bounding box (inset from the canvas edges) each band's text
 * should be auto-fit and centered into, leaving room for the stroke outline
 * so it never gets clipped by the canvas edge.
 *
 * band: 'top' | 'bottom'
 */
function bandBox(canvas, band, options) {
  const opts = options || {};
  const sidePadding = opts.sidePadding != null ? opts.sidePadding : canvas.width * 0.04;
  const edgePadding = opts.edgePadding != null ? opts.edgePadding : canvas.height * 0.03;
  const bandHeight = opts.bandHeight != null ? opts.bandHeight : canvas.height * 0.28;

  const width = Math.max(1, canvas.width - sidePadding * 2);
  const height = Math.max(1, bandHeight);
  const x = sidePadding;
  const y = band === 'bottom' ? canvas.height - edgePadding - height : edgePadding;

  return { x, y, width, height, align: 'center', band };
}

const MemeforgeLayout = {
  GLYPH_WIDTH_RATIO,
  LINE_HEIGHT_RATIO,
  estimateTextWidth,
  lineHeightFor,
  wrapText,
  autoFitText,
  bandBox,
};

/* Works as a CommonJS module (main process, tests) and as a plain
   <script> in the sandboxed renderer (attaches to window). */
if (typeof module !== 'undefined' && module.exports) module.exports = MemeforgeLayout;
if (typeof window !== 'undefined') window.MemeforgeLayout = MemeforgeLayout;
