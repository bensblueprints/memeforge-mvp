'use strict';

const { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./src/store');
const csv = require('./src/csv');

let win = null;

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b0f14',
    autoHideMenuBar: true,
    title: 'Memeforge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Boot verification hook (used by CI / smoke checks): MEMEFORGE_SMOKE=1 npm start
  // prints a JSON snapshot of the booted UI and exits.
  if (process.env.MEMEFORGE_SMOKE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const snap = await win.webContents.executeJavaScript(`({
            layoutEngine: typeof window.MemeforgeLayout,
            bridge: typeof window.memeforge,
            canvas: !!document.getElementById('canvas'),
            title: document.title,
          })`);
          console.log('SMOKE:' + JSON.stringify(snap));
        } catch (err) {
          console.log('SMOKE-ERROR:' + err.message);
        }
        app.exit(0);
      }, 1200);
    });
  }
}

// ---------- image loading ----------

ipcMain.handle('image:openDialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  return readImageAsDataURL(filePaths[0]);
});

ipcMain.handle('image:readPath', (_e, filePath) => readImageAsDataURL(filePath));

function readImageAsDataURL(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const buf = fs.readFileSync(filePath);
    return { ok: true, path: filePath, dataURL: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

ipcMain.handle('templates:list', () => {
  const dir = path.join(__dirname, 'templates');
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .map((f) => path.join(dir, f));
  } catch (_) {
    return [];
  }
});

// ---------- project (.meme) save/load ----------

ipcMain.handle('project:saveDialog', async (_e, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save Memeforge project',
    defaultPath: `meme-project${store.EXTENSION}`,
    filters: [{ name: 'Memeforge project', extensions: ['meme'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  const target = store.withExtension(filePath);
  const result = store.save(target, data);
  return { ok: true, path: result.filePath, data: result.data };
});

ipcMain.handle('project:openDialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open Memeforge project',
    filters: [{ name: 'Memeforge project', extensions: ['meme'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  const data = store.load(filePaths[0]);
  return { ok: true, path: filePaths[0], data };
});

// ---------- export ----------

function dataURLToBuffer(dataURL) {
  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/.exec(dataURL || '');
  if (!match) throw new Error('Invalid image data URL');
  return Buffer.from(match[2], 'base64');
}

ipcMain.handle('export:saveDialog', async (_e, { dataURL, defaultName }) => {
  const ext = /^data:image\/jpeg/.test(dataURL) ? 'jpg' : 'png';
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export meme',
    defaultPath: defaultName || `meme.${ext}`,
    filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, dataURLToBuffer(dataURL));
  return { ok: true, path: filePath };
});

ipcMain.handle('export:copyToClipboard', (_e, dataURL) => {
  try {
    const img = nativeImage.createFromDataURL(dataURL);
    clipboard.writeImage(img);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ---------- batch mode ----------

ipcMain.handle('batch:openCSV', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open batch CSV',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  try {
    const text = fs.readFileSync(filePaths[0], 'utf8');
    const jobs = csv.parseJobs(text);
    return { ok: true, path: filePaths[0], jobs };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('batch:selectOutputFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose an output folder for batch export',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  return { ok: true, folder: filePaths[0] };
});

ipcMain.handle('batch:saveImage', (_e, { folder, filename, dataURL }) => {
  try {
    const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
    const target = path.join(folder, safeName);
    fs.writeFileSync(target, dataURLToBuffer(dataURL));
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.bensblueprints.memeforge');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
