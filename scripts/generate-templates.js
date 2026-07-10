#!/usr/bin/env node
'use strict';

/**
 * Generates a small set of placeholder "template" PNGs into templates/.
 *
 * IMPORTANT — asset provenance: Memeforge does NOT ship real meme template
 * art (no Drake, no Distracted Boyfriend, etc. — that's licensed/trademarked
 * imagery we don't have rights to redistribute). What this script generates
 * is a handful of honest solid-color / gradient placeholder canvases with
 * pre-marked top/bottom text bands, so the app has *something* to drop text
 * on out of the box. For real memes, use "Open Image" / drag-drop to load
 * your own picture — that's the primary, first-class workflow.
 *
 * Zero external dependencies: builds raw RGB scanlines, deflates them with
 * Node's built-in zlib, and hand-assembles the PNG chunk format (IHDR/IDAT/
 * IEND with CRC32), so no `canvas`/`sharp`/`pngjs` package is required.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'templates');
const WIDTH = 800;
const HEIGHT = 600;

// ---------- minimal PNG encoder ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** pixelFn(x, y) -> [r, g, b] */
function encodePNG(width, height, pixelFn) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- placeholder generators ----------

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function gradient(colorA, colorB, direction) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return (x, y) => {
    const t = direction === 'vertical' ? y / (HEIGHT - 1) : x / (WIDTH - 1);
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  };
}

// Draw a thin marker line so the top/bottom text bands are visibly indicated
// on the placeholder (a light band overlay near top and bottom edges).
function withBandHint(basePixelFn) {
  const bandHeight = Math.round(HEIGHT * 0.18);
  return (x, y) => {
    const [r, g, b] = basePixelFn(x, y);
    const inTopBand = y < bandHeight;
    const inBottomBand = y > HEIGHT - bandHeight;
    if (inTopBand || inBottomBand) {
      return [lerp(r, 0, 0.18), lerp(g, 0, 0.18), lerp(b, 0, 0.18)];
    }
    return [r, g, b];
  };
}

const TEMPLATES = [
  { name: 'blank-charcoal', fn: () => [30, 33, 38] },
  { name: 'blank-white', fn: () => [245, 245, 247] },
  { name: 'gradient-sunset', fn: gradient('#ff6a3d', '#8b2fc9', 'horizontal') },
  { name: 'gradient-ocean', fn: gradient('#0f2027', '#2c5364', 'vertical') },
  { name: 'gradient-frog', fn: gradient('#0f5132', '#57c26a', 'vertical') },
  { name: 'solid-yellow-classic', fn: () => [255, 221, 51] },
];

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const t of TEMPLATES) {
    const png = encodePNG(WIDTH, HEIGHT, withBandHint(t.fn));
    const outPath = path.join(OUT_DIR, t.name + '.png');
    fs.writeFileSync(outPath, png);
    console.log('wrote ' + outPath + ' (' + png.length + ' bytes)');
  }
  console.log(`\n${TEMPLATES.length} placeholder templates generated in ${OUT_DIR}`);
}

if (require.main === module) main();

module.exports = { encodePNG, TEMPLATES, OUT_DIR };
