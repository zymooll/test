const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /* Window controls */
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),

  /* Dialogs */
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  /* Library */
  scanFolder: (folderPath) => ipcRenderer.invoke('library:scanFolder', folderPath),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  removeFolder: (folderPath) => ipcRenderer.invoke('library:removeFolder', folderPath),

  /* Playlists */
  getPlaylists: () => ipcRenderer.invoke('playlists:get'),
  createPlaylist: (name) => ipcRenderer.invoke('playlists:create', name),
  deletePlaylist: (id) => ipcRenderer.invoke('playlists:delete', id),
  addTrackToPlaylist: (playlistId, trackId) => ipcRenderer.invoke('playlists:addTrack', playlistId, trackId),
  removeTrackFromPlaylist: (playlistId, trackId) => ipcRenderer.invoke('playlists:removeTrack', playlistId, trackId),
  renamePlaylist: (id, name) => ipcRenderer.invoke('playlists:rename', id, name),

  /* Audio */
  getFileUrl: (filePath) => ipcRenderer.invoke('audio:getFileUrl', filePath),

  /* Lyrics */
  loadLyrics: (filePath) => ipcRenderer.invoke('lyrics:load', filePath),
});
