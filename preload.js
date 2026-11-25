'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('nexus', {
  bootstrap: () => invoke('bootstrap'),
  refresh: () => invoke('refresh'),
  getTeam: (id, force) => invoke('team:get', id, force),
  getPlayer: (id, force) => invoke('player:get', id, force),
  getMatch: (id, force) => invoke('match:get', id, force),
  getStreams: (id, force) => invoke('streams:get', id, force),
  getMajor: (force) => invoke('major:get', force),
  getMajorPicks: () => invoke('major:picks:get'),
  saveMajorPicks: (picks) => invoke('major:picks:set', picks),
  setFavorite: (id) => invoke('favorite:set', id),
  getSettings: () => invoke('settings:get'),
  setSettings: (patch) => invoke('settings:set', patch),
  resolveDemo: (id) => invoke('demo:resolve', id),
  downloadDemo: (id) => invoke('demo:download', id),
  listDemos: () => invoke('demo:list'),
  playDemo: (id) => invoke('demo:play', id),
  revealDemo: (id) => invoke('demo:reveal', id),
  openFolder: (which) => invoke('open-folder', which),
  detectCs2: () => invoke('detect-cs2'),
  openExternal: (url) => invoke('shell:open', url),
  minimize: () => invoke('window:minimize'),
  maximize: () => invoke('window:maximize'),
  close: () => invoke('window:close'),
  winState: () => invoke('window:state'),
  onSync: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('sync:progress', fn); return () => ipcRenderer.removeListener('sync:progress', fn); },
  onDataUpdate: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('data:update', fn); return () => ipcRenderer.removeListener('data:update', fn); },
  onAuto: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('data:auto', fn); return () => ipcRenderer.removeListener('data:auto', fn); },
  onDemoProgress: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('demo:progress', fn); return () => ipcRenderer.removeListener('demo:progress', fn); },
  onWinState: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('win:state', fn); return () => ipcRenderer.removeListener('win:state', fn); },
});
