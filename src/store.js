/**
 * Memeforge — local `.meme` project store. Pure Node (no Electron imports)
 * so it is testable and reusable. Unlike a single per-user data file, a
 * meme project is a file the user names and picks a location for, so the
 * API takes an explicit file path rather than a userData directory.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const EXTENSION = '.meme';

function defaultProject() {
  return {
    schema: SCHEMA_VERSION,
    app: 'memeforge',
    image: null,               // path (or data URL) of the base image
    canvas: { width: 800, height: 600 },
    layers: [],                // see normalizeLayer() for the shape
    createdAt: null,
    updatedAt: null,
  };
}

function defaultLayer() {
  return {
    id: '',
    type: 'text',
    text: '',
    band: null,                // 'top' | 'bottom' | null (free-floating)
    x: 0,
    y: 0,
    width: 200,
    height: 60,
    fontSize: 48,
    fontFamily: 'Impact, "Anton", sans-serif',
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 6,
    align: 'center',
    autoFit: true,
  };
}

function normalizeLayer(l, i) {
  const d = defaultLayer();
  if (!l || typeof l !== 'object') return { ...d, id: 'layer-' + i };
  return {
    id: l.id ? String(l.id) : 'layer-' + i,
    type: 'text',
    text: String(l.text || ''),
    band: l.band === 'top' || l.band === 'bottom' ? l.band : null,
    x: Number.isFinite(l.x) ? l.x : d.x,
    y: Number.isFinite(l.y) ? l.y : d.y,
    width: Number.isFinite(l.width) && l.width > 0 ? l.width : d.width,
    height: Number.isFinite(l.height) && l.height > 0 ? l.height : d.height,
    fontSize: Number.isFinite(l.fontSize) && l.fontSize > 0 ? l.fontSize : d.fontSize,
    fontFamily: l.fontFamily ? String(l.fontFamily) : d.fontFamily,
    fill: l.fill ? String(l.fill) : d.fill,
    stroke: l.stroke ? String(l.stroke) : d.stroke,
    strokeWidth: Number.isFinite(l.strokeWidth) ? l.strokeWidth : d.strokeWidth,
    align: ['left', 'center', 'right'].includes(l.align) ? l.align : d.align,
    autoFit: l.autoFit !== false,
  };
}

/** Coerce arbitrary parsed JSON into a valid project shape. Throws if hopeless. */
function normalize(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Not a Memeforge project object');
  const d = defaultProject();
  d.image = obj.image ? String(obj.image) : null;
  if (obj.canvas && typeof obj.canvas === 'object') {
    d.canvas = {
      width: Number.isFinite(obj.canvas.width) && obj.canvas.width > 0 ? obj.canvas.width : d.canvas.width,
      height: Number.isFinite(obj.canvas.height) && obj.canvas.height > 0 ? obj.canvas.height : d.canvas.height,
    };
  }
  d.layers = Array.isArray(obj.layers) ? obj.layers.map(normalizeLayer) : [];
  d.createdAt = obj.createdAt || null;
  d.updatedAt = obj.updatedAt || null;
  return d;
}

function withExtension(filePath) {
  return filePath.toLowerCase().endsWith(EXTENSION) ? filePath : filePath + EXTENSION;
}

/** Load and normalize a project file. Corrupt files are backed up aside and
 * recovered to a safe default rather than throwing and losing the session. */
function load(filePath) {
  if (!fs.existsSync(filePath)) return defaultProject();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return normalize(JSON.parse(raw));
  } catch (err) {
    try { fs.copyFileSync(filePath, filePath + '.corrupt-' + Date.now()); } catch (_) {}
    return defaultProject();
  }
}

/** Atomic write: write to a temp file in the same directory, then rename over the target. */
function save(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const normalized = normalize(data);
  normalized.updatedAt = new Date().toISOString();
  if (!normalized.createdAt) normalized.createdAt = normalized.updatedAt;
  const tmp = filePath + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
  return { filePath, data: normalized };
}

module.exports = {
  SCHEMA_VERSION,
  EXTENSION,
  defaultProject,
  defaultLayer,
  normalize,
  normalizeLayer,
  withExtension,
  load,
  save,
};
