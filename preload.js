'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('memeforge', {
  openImageDialog: () => ipcRenderer.invoke('image:openDialog'),
  readImagePath: (filePath) => ipcRenderer.invoke('image:readPath', filePath),
  listTemplates: () => ipcRenderer.invoke('templates:list'),

  saveProjectDialog: (data) => ipcRenderer.invoke('project:saveDialog', data),
  openProjectDialog: () => ipcRenderer.invoke('project:openDialog'),

  exportSaveDialog: (dataURL, defaultName) => ipcRenderer.invoke('export:saveDialog', { dataURL, defaultName }),
  copyToClipboard: (dataURL) => ipcRenderer.invoke('export:copyToClipboard', dataURL),

  batchOpenCSV: () => ipcRenderer.invoke('batch:openCSV'),
  batchSelectOutputFolder: () => ipcRenderer.invoke('batch:selectOutputFolder'),
  batchSaveImage: (folder, filename, dataURL) => ipcRenderer.invoke('batch:saveImage', { folder, filename, dataURL }),
});
