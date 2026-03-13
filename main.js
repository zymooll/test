const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { parseFile } = require('music-metadata');

let mainWindow;
const SUPPORTED_FORMATS = ['.mp3', '.flac', '.wav', '.ogg', '.aac', '.m4a', '.wma', '.opus'];

function getUserDataPath(filename) {
  const dir = path.join(app.getPath('userData'), 'melodix-data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

function loadJSON(filename, defaultValue) {
  const p = getUserDataPath(filename);
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { /* ignore parse errors */ }
  return defaultValue;
}

function saveJSON(filename, data) {
  fs.writeFileSync(getUserDataPath(filename), JSON.stringify(data, null, 2), 'utf-8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      // When packaged, preload.js is unpacked from the ASAR so Electron can load it as a file.
      // asarUnpack in package.json ensures it ends up at resources/app.asar.unpacked/preload.js.
      preload: app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'preload.js')
        : path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

/* ── protocol: serve local audio files ── */
app.whenReady().then(() => {
  protocol.registerFileProtocol('local-audio', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-audio://', ''));
    callback({ path: filePath });
  });
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

/* ── IPC: Window controls ── */
ipcMain.on('win:minimize', () => mainWindow?.minimize());
ipcMain.on('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('win:close', () => mainWindow?.close());

/* ── IPC: Folder picker ── */
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

/* ── IPC: Scan folder for audio files ── */
async function scanDirectory(dirPath) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await scanDirectory(fullPath)));
    } else if (SUPPORTED_FORMATS.includes(path.extname(entry.name).toLowerCase())) {
      try {
        const metadata = await parseFile(fullPath);
        const common = metadata.common;
        let coverDataUrl = null;
        if (common.picture && common.picture.length > 0) {
          const pic = common.picture[0];
          coverDataUrl = `data:${pic.format};base64,${pic.data.toString('base64')}`;
        }
        results.push({
          id: Buffer.from(fullPath).toString('base64url'),
          filePath: fullPath,
          title: common.title || path.basename(fullPath, path.extname(fullPath)),
          artist: common.artist || 'Unknown Artist',
          album: common.album || 'Unknown Album',
          duration: metadata.format.duration || 0,
          cover: coverDataUrl,
          genre: common.genre ? common.genre.join(', ') : '',
          year: common.year || null,
          track: common.track?.no || null,
        });
      } catch {
        results.push({
          id: Buffer.from(fullPath).toString('base64url'),
          filePath: fullPath,
          title: path.basename(fullPath, path.extname(fullPath)),
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          duration: 0,
          cover: null,
          genre: '',
          year: null,
          track: null,
        });
      }
    }
  }
  return results;
}

ipcMain.handle('library:scanFolder', async (_event, folderPath) => {
  const tracks = await scanDirectory(folderPath);
  const library = loadJSON('library.json', { folders: [], tracks: [] });
  if (!library.folders.includes(folderPath)) library.folders.push(folderPath);
  // Merge tracks (avoid duplicates by filePath)
  const existingPaths = new Set(library.tracks.map((t) => t.filePath));
  for (const t of tracks) {
    if (!existingPaths.has(t.filePath)) {
      library.tracks.push(t);
      existingPaths.add(t.filePath);
    }
  }
  saveJSON('library.json', library);
  return library;
});

ipcMain.handle('library:get', () => loadJSON('library.json', { folders: [], tracks: [] }));

ipcMain.handle('library:removeFolder', (_event, folderPath) => {
  const library = loadJSON('library.json', { folders: [], tracks: [] });
  library.folders = library.folders.filter((f) => f !== folderPath);
  library.tracks = library.tracks.filter((t) => !t.filePath.startsWith(folderPath));
  saveJSON('library.json', library);
  return library;
});

/* ── IPC: Playlists ── */
ipcMain.handle('playlists:get', () => loadJSON('playlists.json', []));

ipcMain.handle('playlists:create', (_event, name) => {
  const playlists = loadJSON('playlists.json', []);
  const pl = { id: Date.now().toString(36), name, trackIds: [], createdAt: Date.now() };
  playlists.push(pl);
  saveJSON('playlists.json', playlists);
  return playlists;
});

ipcMain.handle('playlists:delete', (_event, playlistId) => {
  let playlists = loadJSON('playlists.json', []);
  playlists = playlists.filter((p) => p.id !== playlistId);
  saveJSON('playlists.json', playlists);
  return playlists;
});

ipcMain.handle('playlists:addTrack', (_event, playlistId, trackId) => {
  const playlists = loadJSON('playlists.json', []);
  const pl = playlists.find((p) => p.id === playlistId);
  if (pl && !pl.trackIds.includes(trackId)) pl.trackIds.push(trackId);
  saveJSON('playlists.json', playlists);
  return playlists;
});

ipcMain.handle('playlists:removeTrack', (_event, playlistId, trackId) => {
  const playlists = loadJSON('playlists.json', []);
  const pl = playlists.find((p) => p.id === playlistId);
  if (pl) pl.trackIds = pl.trackIds.filter((id) => id !== trackId);
  saveJSON('playlists.json', playlists);
  return playlists;
});

ipcMain.handle('playlists:rename', (_event, playlistId, newName) => {
  const playlists = loadJSON('playlists.json', []);
  const pl = playlists.find((p) => p.id === playlistId);
  if (pl) pl.name = newName;
  saveJSON('playlists.json', playlists);
  return playlists;
});

/* ── IPC: Get audio file URL for playback ── */
ipcMain.handle('audio:getFileUrl', (_event, filePath) => {
  return `local-audio://${encodeURIComponent(filePath)}`;
});

/* ── IPC: Read LRC lyrics file ── */
ipcMain.handle('lyrics:load', (_event, audioFilePath) => {
  const dir = path.dirname(audioFilePath);
  const base = path.basename(audioFilePath, path.extname(audioFilePath));
  const lrcPath = path.join(dir, `${base}.lrc`);
  try {
    if (fs.existsSync(lrcPath)) {
      return fs.readFileSync(lrcPath, 'utf-8');
    }
  } catch { /* ignore */ }
  return null;
});
