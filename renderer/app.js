'use strict';

/* Memeforge renderer. Plain JS, no framework. Uses window.MemeforgeLayout
 * (src/layout.js, loaded as a plain <script>) for wrap/auto-fit/band math,
 * and window.memeforge (preload.js contextBridge) for all file I/O. */

const canvasEl = document.getElementById('canvas');
const ctx = canvasEl.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const dropHint = document.getElementById('drop-hint');
const layerListEl = document.getElementById('layer-list');
const layerEmptyHint = document.getElementById('layer-empty-hint');
const templateGrid = document.getElementById('template-grid');
const toastEl = document.getElementById('toast');

let idCounter = 1;

const state = {
  image: null,          // { dataURL, path, el }
  layers: [],            // see src/store.js normalizeLayer() shape
  selectedLayerId: null,
};

let drag = null; // { mode: 'move'|'resize', layerId, startX, startY, orig }

// ---------- toast ----------

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2400);
}

// ---------- image loading ----------

function loadImageFromDataURL(dataURL, sourcePath) {
  const img = new Image();
  img.onload = () => {
    state.image = { dataURL, path: sourcePath || null, el: img };
    canvasEl.width = img.naturalWidth || 800;
    canvasEl.height = img.naturalHeight || 600;
    render();
  };
  img.onerror = () => showToast('Could not load that image.');
  img.src = dataURL;
}

async function openImageDialog() {
  const res = await window.memeforge.openImageDialog();
  if (!res || res.canceled) return;
  if (!res.ok) { showToast('Failed to open image: ' + res.error); return; }
  loadImageFromDataURL(res.dataURL, res.path);
}

document.getElementById('btn-open-image').addEventListener('click', openImageDialog);

// drag-and-drop onto the canvas shell
['dragenter', 'dragover'].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
});
['dragleave', 'dragend'].forEach((evt) => {
  dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'));
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) { showToast('Drop an image file.'); return; }
  const reader = new FileReader();
  reader.onload = () => loadImageFromDataURL(reader.result, file.name);
  reader.readAsDataURL(file);
});

// ---------- templates ----------

async function loadTemplateGrid() {
  const paths = await window.memeforge.listTemplates();
  templateGrid.innerHTML = '';
  for (const p of paths) {
    const res = await window.memeforge.readImagePath(p);
    if (!res.ok) continue;
    const thumb = document.createElement('div');
    thumb.className = 'template-thumb';
    thumb.style.backgroundImage = `url("${res.dataURL}")`;
    thumb.title = p.split(/[\\/]/).pop();
    thumb.addEventListener('click', () => loadImageFromDataURL(res.dataURL, p));
    templateGrid.appendChild(thumb);
  }
}
loadTemplateGrid();

// ---------- layers ----------

function addLayer(band) {
  const rect = band
    ? window.MemeforgeLayout.bandBox({ width: canvasEl.width, height: canvasEl.height }, band)
    : {
        x: canvasEl.width * 0.15,
        y: canvasEl.height * 0.4,
        width: canvasEl.width * 0.7,
        height: canvasEl.height * 0.2,
      };
  const layer = {
    id: 'layer-' + idCounter++,
    type: 'text',
    text: band === 'top' ? 'TOP TEXT' : band === 'bottom' ? 'BOTTOM TEXT' : 'Your text here',
    band: band || null,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    fontSize: 48,
    fontFamily: 'Impact, "Anton", sans-serif',
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 6,
    align: 'center',
    autoFit: true,
  };
  state.layers.push(layer);
  state.selectedLayerId = layer.id;
  render();
  renderLayerList();
}

document.getElementById('btn-add-top').addEventListener('click', () => addLayer('top'));
document.getElementById('btn-add-bottom').addEventListener('click', () => addLayer('bottom'));
document.getElementById('btn-add-free').addEventListener('click', () => addLayer(null));

function getLayer(id) { return state.layers.find((l) => l.id === id); }

function deleteLayer(id) {
  state.layers = state.layers.filter((l) => l.id !== id);
  if (state.selectedLayerId === id) state.selectedLayerId = null;
  render();
  renderLayerList();
}

function renderLayerList() {
  layerListEl.innerHTML = '';
  layerEmptyHint.style.display = state.layers.length ? 'none' : 'block';

  state.layers.forEach((layer, index) => {
    const card = document.createElement('div');
    card.className = 'layer-card' + (layer.id === state.selectedLayerId ? ' selected' : '');
    card.dataset.id = layer.id;

    const bandLabel = layer.band ? (layer.band === 'top' ? 'Top band' : 'Bottom band') : 'Free box';

    card.innerHTML = `
      <div class="layer-card-row">
        <span class="layer-title">#${index + 1} · ${bandLabel}</span>
        <button class="btn small danger btn-del" title="Delete layer">Delete</button>
      </div>
      <textarea class="f-text" placeholder="Text...">${escapeHtml(layer.text)}</textarea>
      <div class="layer-card-row">
        <label>Fill <input type="color" class="f-fill" value="${layer.fill}"></label>
        <label>Stroke <input type="color" class="f-stroke" value="${layer.stroke}"></label>
        <label>Width <input type="number" class="f-strokewidth" min="0" max="30" value="${layer.strokeWidth}"></label>
      </div>
      <div class="layer-card-row">
        <label><input type="checkbox" class="f-autofit" ${layer.autoFit ? 'checked' : ''}> Auto-fit</label>
        <label>Size <input type="number" class="f-fontsize" min="8" max="200" value="${Math.round(layer.fontSize)}" ${layer.autoFit ? 'disabled' : ''}></label>
      </div>
      <div class="layer-card-row">
        <label>Align
          <select class="f-align">
            <option value="left" ${layer.align === 'left' ? 'selected' : ''}>Left</option>
            <option value="center" ${layer.align === 'center' ? 'selected' : ''}>Center</option>
            <option value="right" ${layer.align === 'right' ? 'selected' : ''}>Right</option>
          </select>
        </label>
      </div>
    `;

    card.addEventListener('mousedown', () => selectLayer(layer.id));

    card.querySelector('.btn-del').addEventListener('click', (e) => { e.stopPropagation(); deleteLayer(layer.id); });
    card.querySelector('.f-text').addEventListener('input', (e) => { layer.text = e.target.value; render(); });
    card.querySelector('.f-fill').addEventListener('input', (e) => { layer.fill = e.target.value; render(); });
    card.querySelector('.f-stroke').addEventListener('input', (e) => { layer.stroke = e.target.value; render(); });
    card.querySelector('.f-strokewidth').addEventListener('input', (e) => { layer.strokeWidth = Number(e.target.value) || 0; render(); });
    card.querySelector('.f-autofit').addEventListener('change', (e) => { layer.autoFit = e.target.checked; render(); renderLayerList(); });
    card.querySelector('.f-fontsize').addEventListener('input', (e) => { layer.fontSize = Number(e.target.value) || 48; render(); });
    card.querySelector('.f-align').addEventListener('change', (e) => { layer.align = e.target.value; render(); });

    layerListEl.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function selectLayer(id) {
  state.selectedLayerId = id;
  render();
  renderLayerList();
}

// ---------- canvas drawing ----------

function drawTextLayer(context, layer) {
  const text = layer.text || '';
  const box = { width: layer.width, height: layer.height };
  let fontSize, lines;

  if (layer.autoFit) {
    const fit = window.MemeforgeLayout.autoFitText(text, box, {
      startFontSize: Math.max(10, Math.floor(layer.height * 0.6)),
      minFontSize: 10,
    });
    fontSize = fit.fontSize;
    lines = fit.lines;
    layer.fontSize = fontSize; // keep the model in sync for save/export
  } else {
    fontSize = layer.fontSize;
    lines = window.MemeforgeLayout.wrapText(text, fontSize, layer.width);
  }

  const lineHeight = window.MemeforgeLayout.lineHeightFor(fontSize);
  const totalHeight = lines.length * lineHeight;
  const startBaselineY = layer.y + Math.max(0, (layer.height - totalHeight) / 2) + lineHeight * 0.82;

  let cx;
  if (layer.align === 'left') cx = layer.x;
  else if (layer.align === 'right') cx = layer.x + layer.width;
  else cx = layer.x + layer.width / 2;

  context.font = `${fontSize}px ${layer.fontFamily}`;
  context.textAlign = layer.align;
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.miterLimit = 2;

  lines.forEach((line, i) => {
    const ly = startBaselineY + i * lineHeight;
    if (layer.strokeWidth > 0) {
      context.strokeStyle = layer.stroke;
      context.lineWidth = layer.strokeWidth;
      context.strokeText(line, cx, ly);
    }
    context.fillStyle = layer.fill;
    context.fillText(line, cx, ly);
  });
}

function drawSelectionOverlay(context, layer) {
  context.save();
  context.strokeStyle = '#57c26a';
  context.lineWidth = 2;
  context.setLineDash([6, 4]);
  context.strokeRect(layer.x, layer.y, layer.width, layer.height);
  context.setLineDash([]);
  context.fillStyle = '#57c26a';
  const hs = HANDLE_SIZE;
  context.fillRect(layer.x + layer.width - hs / 2, layer.y + layer.height - hs / 2, hs, hs);
  context.restore();
}

const HANDLE_SIZE = 14;

function render() {
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.fillStyle = '#1a1e26';
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
  if (state.image && state.image.el) {
    ctx.drawImage(state.image.el, 0, 0, canvasEl.width, canvasEl.height);
  }
  for (const layer of state.layers) drawTextLayer(ctx, layer);
  const selected = getLayer(state.selectedLayerId);
  if (selected) drawSelectionOverlay(ctx, selected);
  dropHint.classList.toggle('hidden', !!state.image);
}

// ---------- pointer interaction (move / resize) ----------

function toCanvasCoords(clientX, clientY) {
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function hitTestHandle(layer, x, y) {
  const hs = HANDLE_SIZE * 1.4; // slightly generous hit box
  const hx = layer.x + layer.width;
  const hy = layer.y + layer.height;
  return Math.abs(x - hx) <= hs / 2 && Math.abs(y - hy) <= hs / 2;
}

function hitTestBody(layer, x, y) {
  return x >= layer.x && x <= layer.x + layer.width && y >= layer.y && y <= layer.y + layer.height;
}

canvasEl.addEventListener('mousedown', (e) => {
  const { x, y } = toCanvasCoords(e.clientX, e.clientY);
  const selected = getLayer(state.selectedLayerId);

  if (selected && hitTestHandle(selected, x, y)) {
    drag = { mode: 'resize', layerId: selected.id, startX: x, startY: y, orig: { ...selected } };
    return;
  }

  // topmost layer wins
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const layer = state.layers[i];
    if (hitTestBody(layer, x, y)) {
      state.selectedLayerId = layer.id;
      drag = { mode: 'move', layerId: layer.id, startX: x, startY: y, orig: { ...layer } };
      render();
      renderLayerList();
      return;
    }
  }

  state.selectedLayerId = null;
  render();
  renderLayerList();
});

window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const layer = getLayer(drag.layerId);
  if (!layer) return;
  const { x, y } = toCanvasCoords(e.clientX, e.clientY);
  const dx = x - drag.startX;
  const dy = y - drag.startY;

  if (drag.mode === 'move') {
    layer.x = clamp(drag.orig.x + dx, -layer.width * 0.5, canvasEl.width - layer.width * 0.5);
    layer.y = clamp(drag.orig.y + dy, -layer.height * 0.5, canvasEl.height - layer.height * 0.5);
  } else if (drag.mode === 'resize') {
    layer.width = Math.max(40, drag.orig.width + dx);
    layer.height = Math.max(24, drag.orig.height + dy);
  }
  render();
});

window.addEventListener('mouseup', () => {
  if (drag) { drag = null; renderLayerList(); }
});

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ---------- project save / load ----------

function layerForSave(layer) {
  const { _rendered, ...rest } = layer;
  return rest;
}

document.getElementById('btn-save-project').addEventListener('click', async () => {
  const project = {
    image: state.image ? (state.image.path || state.image.dataURL) : null,
    canvas: { width: canvasEl.width, height: canvasEl.height },
    layers: state.layers.map(layerForSave),
  };
  const res = await window.memeforge.saveProjectDialog(project);
  if (!res || res.canceled) return;
  if (!res.ok) { showToast('Save failed: ' + res.error); return; }
  showToast('Project saved: ' + res.path.split(/[\\/]/).pop());
});

document.getElementById('btn-open-project').addEventListener('click', async () => {
  const res = await window.memeforge.openProjectDialog();
  if (!res || res.canceled) return;
  if (!res.ok) { showToast('Open failed: ' + res.error); return; }
  const data = res.data;

  state.layers = data.layers.map((l) => ({ ...l }));
  state.selectedLayerId = null;
  idCounter = 1 + state.layers.reduce((max, l) => {
    const n = parseInt(String(l.id).replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);

  if (data.image) {
    if (String(data.image).startsWith('data:')) {
      loadImageFromDataURL(data.image);
    } else {
      const imgRes = await window.memeforge.readImagePath(data.image);
      if (imgRes.ok) loadImageFromDataURL(imgRes.dataURL, data.image);
      else {
        state.image = null;
        canvasEl.width = data.canvas.width;
        canvasEl.height = data.canvas.height;
        showToast('Project loaded, but the original image could not be found: ' + data.image);
      }
    }
  } else {
    state.image = null;
    canvasEl.width = data.canvas.width;
    canvasEl.height = data.canvas.height;
  }

  render();
  renderLayerList();
});

// ---------- export ----------

function currentDataURL(mime) {
  return canvasEl.toDataURL(mime, 0.92);
}

document.getElementById('btn-export-png').addEventListener('click', async () => {
  const res = await window.memeforge.exportSaveDialog(currentDataURL('image/png'), 'meme.png');
  if (!res || res.canceled) return;
  if (!res.ok) { showToast('Export failed: ' + res.error); return; }
  showToast('Exported: ' + res.path.split(/[\\/]/).pop());
});

document.getElementById('btn-export-jpg').addEventListener('click', async () => {
  const res = await window.memeforge.exportSaveDialog(currentDataURL('image/jpeg'), 'meme.jpg');
  if (!res || res.canceled) return;
  if (!res.ok) { showToast('Export failed: ' + res.error); return; }
  showToast('Exported: ' + res.path.split(/[\\/]/).pop());
});

document.getElementById('btn-copy').addEventListener('click', async () => {
  const res = await window.memeforge.copyToClipboard(currentDataURL('image/png'));
  showToast(res.ok ? 'Copied to clipboard.' : 'Copy failed: ' + res.error);
});

// ---------- batch mode ----------

const batchModal = document.getElementById('batch-modal');
const batchTbody = document.getElementById('batch-tbody');
const batchCsvPathEl = document.getElementById('batch-csv-path');
const batchOutputPathEl = document.getElementById('batch-output-path');

const batchState = { csvPath: null, csvDir: null, outputFolder: null, jobs: [] };

document.getElementById('btn-batch').addEventListener('click', () => batchModal.classList.remove('hidden'));
document.getElementById('btn-batch-close').addEventListener('click', () => batchModal.classList.add('hidden'));

function dirOf(p) {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i === -1 ? '' : p.slice(0, i);
}
function joinPath(dir, file) {
  if (!dir) return file;
  if (/^[a-zA-Z]:[\\/]/.test(file) || file.startsWith('/')) return file; // already absolute
  const sep = dir.includes('\\') ? '\\' : '/';
  return dir.replace(/[\\/]+$/, '') + sep + file;
}

function renderBatchTable() {
  batchTbody.innerHTML = '';
  batchState.jobs.forEach((job, i) => {
    const tr = document.createElement('tr');
    const statusClass = job.status === 'ok' ? 'status-ok' : job.status === 'error' ? 'status-err' : 'status-pending';
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td title="${escapeHtml(job.image)}">${escapeHtml(job.image)}</td>
      <td title="${escapeHtml(job.top)}">${escapeHtml(job.top)}</td>
      <td title="${escapeHtml(job.bottom)}">${escapeHtml(job.bottom)}</td>
      <td class="${statusClass}">${job.statusText || 'pending'}</td>
    `;
    batchTbody.appendChild(tr);
  });
}

document.getElementById('btn-batch-open-csv').addEventListener('click', async () => {
  const res = await window.memeforge.batchOpenCSV();
  if (!res || res.canceled) return;
  if (!res.ok) { showToast('Could not read CSV: ' + res.error); return; }
  batchState.csvPath = res.path;
  batchState.csvDir = dirOf(res.path);
  batchState.jobs = res.jobs.map((j) => ({ ...j, status: 'pending', statusText: 'pending' }));
  batchCsvPathEl.textContent = res.path.split(/[\\/]/).pop() + ` (${res.jobs.length} rows)`;
  renderBatchTable();
});

document.getElementById('btn-batch-output').addEventListener('click', async () => {
  const res = await window.memeforge.batchSelectOutputFolder();
  if (!res || res.canceled) return;
  if (!res.ok) return;
  batchState.outputFolder = res.folder;
  batchOutputPathEl.textContent = res.folder;
});

function renderBatchJobToDataURL(imgEl, top, bottom) {
  const off = document.createElement('canvas');
  off.width = imgEl.naturalWidth || 800;
  off.height = imgEl.naturalHeight || 600;
  const octx = off.getContext('2d');
  octx.fillStyle = '#1a1e26';
  octx.fillRect(0, 0, off.width, off.height);
  octx.drawImage(imgEl, 0, 0, off.width, off.height);

  const style = {
    fontFamily: 'Impact, "Anton", sans-serif',
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: Math.max(3, Math.round(off.width * 0.008)),
    align: 'center',
  };

  for (const [text, band] of [[top, 'top'], [bottom, 'bottom']]) {
    if (!text) continue;
    const rect = window.MemeforgeLayout.bandBox({ width: off.width, height: off.height }, band);
    const layer = { ...style, x: rect.x, y: rect.y, width: rect.width, height: rect.height, autoFit: true, text };
    drawTextLayer(octx, layer);
  }

  return off.toDataURL('image/png');
}

function loadImageEl(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataURL;
  });
}

document.getElementById('btn-batch-run').addEventListener('click', async () => {
  if (!batchState.jobs.length) { showToast('Open a CSV first.'); return; }
  if (!batchState.outputFolder) { showToast('Choose an output folder first.'); return; }

  for (let i = 0; i < batchState.jobs.length; i++) {
    const job = batchState.jobs[i];
    job.status = 'running';
    job.statusText = 'working…';
    renderBatchTable();

    try {
      const resolvedPath = joinPath(batchState.csvDir, job.image);
      const imgRes = await window.memeforge.readImagePath(resolvedPath);
      if (!imgRes.ok) throw new Error(imgRes.error || 'image not found');
      const imgEl = await loadImageEl(imgRes.dataURL);
      const dataURL = renderBatchJobToDataURL(imgEl, job.top, job.bottom);
      const base = job.image.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
      const filename = `${String(i + 1).padStart(3, '0')}-${base || 'meme'}.png`;
      const saveRes = await window.memeforge.batchSaveImage(batchState.outputFolder, filename, dataURL);
      if (!saveRes.ok) throw new Error(saveRes.error || 'save failed');
      job.status = 'ok';
      job.statusText = 'done';
    } catch (err) {
      job.status = 'error';
      job.statusText = 'error: ' + err.message;
    }
    renderBatchTable();
  }
  showToast('Batch complete.');
});

// ---------- initial paint ----------

render();
renderLayerList();
