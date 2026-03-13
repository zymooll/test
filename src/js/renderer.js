/* ═══════════════════════════════════════════
   Melodix – Renderer Process
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── State ── */
  const state = {
    library: { folders: [], tracks: [] },
    playlists: [],
    currentView: 'library',
    currentPlaylistId: null,
    queue: [],          // array of track objects
    queueIndex: -1,
    isPlaying: false,
    shuffle: false,
    repeat: 'off',      // 'off' | 'all' | 'one'
    lyrics: [],          // parsed [{time, text}]
    activeLyricIndex: -1,
  };

  /* ── DOM refs ── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const audio = $('#audio-element');

  const dom = {
    // title bar
    btnMin: $('#btn-min'), btnMax: $('#btn-max'), btnClose: $('#btn-close'),
    // sidebar
    navItems: $$('.nav-item'),
    playlistList: $('#playlist-list'),
    folderList: $('#folder-list'),
    btnAddFolder: $('#btn-add-folder'),
    btnNewPlaylist: $('#btn-new-playlist'),
    // views
    viewLibrary: $('#view-library'),
    viewPlaylists: $('#view-playlists'),
    libraryTracks: $('#library-tracks'),
    libraryEmpty: $('#library-empty'),
    librarySearch: $('#library-search'),
    // playlist view
    playlistGrid: $('#playlist-grid'),
    playlistDetail: $('#playlist-detail'),
    playlistDetailName: $('#playlist-detail-name'),
    playlistTracks: $('#playlist-tracks'),
    btnBackPlaylists: $('#btn-back-playlists'),
    btnCreatePlaylist: $('#btn-create-playlist'),
    btnDeletePlaylist: $('#btn-delete-playlist'),
    playlistViewTitle: $('#playlist-view-title'),
    // player bar
    playerBar: $('#player-bar'),
    playerCover: $('#player-cover'),
    playerTitle: $('#player-title'),
    playerArtist: $('#player-artist'),
    btnPlay: $('#btn-play'), btnPrev: $('#btn-prev'), btnNext: $('#btn-next'),
    btnShuffle: $('#btn-shuffle'), btnRepeat: $('#btn-repeat'),
    btnImmersive: $('#btn-immersive'),
    seekBar: $('#player-seek'),
    currentTime: $('#player-current-time'),
    totalTime: $('#player-total-time'),
    volumeBar: $('#player-volume'),
    btnVolumeIcon: $('#btn-volume-icon'),
    // immersive
    immersiveOverlay: $('#immersive-overlay'),
    immersiveBg: $('#immersive-bg'),
    immersiveCover: $('#immersive-cover'),
    immersiveTitle: $('#immersive-title'),
    immersiveArtist: $('#immersive-artist'),
    immersiveAlbum: $('#immersive-album'),
    immersiveLyrics: $('#immersive-lyrics'),
    btnExitImmersive: $('#btn-exit-immersive'),
    immSeek: $('#imm-seek'),
    immCurrentTime: $('#imm-current-time'),
    immTotalTime: $('#imm-total-time'),
    immPlay: $('#imm-play'), immPrev: $('#imm-prev'), immNext: $('#imm-next'),
    immShuffle: $('#imm-shuffle'), immRepeat: $('#imm-repeat'),
    // modal
    modalAdd: $('#modal-add-to-playlist'),
    modalPlaylistList: $('#modal-playlist-list'),
  };

  const DEFAULT_COVER = 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#1a1a28"/>
      <text x="100" y="108" text-anchor="middle" fill="#606078" font-size="64">♫</text>
    </svg>`);

  /* ═══════ Initialization ═══════ */
  async function init() {
    state.library = await window.api.getLibrary();
    state.playlists = await window.api.getPlaylists();
    audio.volume = 0.8;
    renderAll();
    bindEvents();
  }

  /* ═══════ Rendering ═══════ */
  function renderAll() {
    renderFolders();
    renderSidebarPlaylists();
    renderLibrary();
    renderPlaylistGrid();
  }

  function renderFolders() {
    dom.folderList.innerHTML = state.library.folders.map((f) => {
      const name = f.split(/[\\/]/).pop();
      return `<li data-folder="${escapeHtml(f)}" title="${escapeHtml(f)}">
        <span>📁 ${escapeHtml(name)}</span>
        <button class="folder-remove" data-folder="${escapeHtml(f)}">✕</button>
      </li>`;
    }).join('');
  }

  function renderSidebarPlaylists() {
    dom.playlistList.innerHTML = state.playlists.map((p) =>
      `<li data-id="${p.id}" class="${state.currentPlaylistId === p.id ? 'active' : ''}">
        🎵 ${escapeHtml(p.name)}
      </li>`
    ).join('');
  }

  function renderLibrary(filter = '') {
    const tracks = filter
      ? state.library.tracks.filter((t) =>
          t.title.toLowerCase().includes(filter) ||
          t.artist.toLowerCase().includes(filter) ||
          t.album.toLowerCase().includes(filter))
      : state.library.tracks;

    if (tracks.length === 0) {
      dom.libraryTracks.innerHTML = '';
      dom.libraryEmpty.classList.remove('hidden');
      return;
    }
    dom.libraryEmpty.classList.add('hidden');
    dom.libraryTracks.innerHTML = tracks.map((t, i) => trackRow(t, i + 1, true)).join('');
  }

  function trackRow(track, num, showAddBtn) {
    const isPlaying = state.queue[state.queueIndex]?.id === track.id;
    const numDisplay = isPlaying
      ? `<div class="playing-indicator"><span></span><span></span><span></span></div>`
      : num;
    return `<div class="track-row ${isPlaying ? 'playing' : ''}" data-id="${track.id}" data-path="${escapeHtml(track.filePath)}">
      <span class="track-num">${numDisplay}</span>
      <div class="track-title-cell">
        <img class="track-thumb" src="${track.cover || DEFAULT_COVER}" alt="" />
        <span class="track-title">${escapeHtml(track.title)}</span>
      </div>
      <span class="track-artist">${escapeHtml(track.artist)}</span>
      <span class="track-album">${escapeHtml(track.album)}</span>
      <span class="track-duration">${formatTime(track.duration)}</span>
      <span class="track-actions">
        ${showAddBtn ? `<button class="btn-add-to-playlist" data-id="${track.id}" title="Add to playlist">＋</button>` :
          `<button class="btn-remove-from-playlist" data-id="${track.id}" title="Remove">✕</button>`}
      </span>
    </div>`;
  }

  function renderPlaylistGrid() {
    dom.playlistGrid.innerHTML = state.playlists.map((p) =>
      `<div class="playlist-card" data-id="${p.id}">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${p.trackIds.length} track${p.trackIds.length !== 1 ? 's' : ''}</p>
      </div>`
    ).join('');
  }

  function renderPlaylistDetail() {
    const pl = state.playlists.find((p) => p.id === state.currentPlaylistId);
    if (!pl) return;
    dom.playlistDetailName.textContent = pl.name;
    const tracks = pl.trackIds
      .map((id) => state.library.tracks.find((t) => t.id === id))
      .filter(Boolean);
    dom.playlistTracks.innerHTML = tracks.map((t, i) => trackRow(t, i + 1, false)).join('');
  }

  /* ═══════ Navigation ═══════ */
  function switchView(view) {
    state.currentView = view;
    $$('.view').forEach((el) => el.classList.remove('active'));
    dom.navItems.forEach((el) => el.classList.toggle('active', el.dataset.view === view));
    $(`#view-${view}`)?.classList.add('active');

    if (view === 'playlists') {
      dom.playlistGrid.classList.remove('hidden');
      dom.playlistDetail.classList.add('hidden');
      state.currentPlaylistId = null;
      renderPlaylistGrid();
    }
  }

  function openPlaylistDetail(id) {
    state.currentPlaylistId = id;
    dom.playlistGrid.classList.add('hidden');
    dom.playlistDetail.classList.remove('hidden');
    renderSidebarPlaylists();
    renderPlaylistDetail();
  }

  /* ═══════ Playback ═══════ */
  async function playTrack(track, queue, index) {
    state.queue = queue;
    state.queueIndex = index;
    state.isPlaying = true;

    const url = await window.api.getFileUrl(track.filePath);
    audio.src = url;
    audio.play();

    // Update UI
    dom.playerBar.classList.remove('hidden');
    document.body.classList.add('player-visible');
    dom.playerCover.src = track.cover || DEFAULT_COVER;
    dom.playerTitle.textContent = track.title;
    dom.playerArtist.textContent = track.artist;
    updatePlayButton(true);

    // Immersive
    dom.immersiveCover.src = track.cover || DEFAULT_COVER;
    dom.immersiveBg.style.backgroundImage = `url(${track.cover || DEFAULT_COVER})`;
    dom.immersiveTitle.textContent = track.title;
    dom.immersiveArtist.textContent = track.artist;
    dom.immersiveAlbum.textContent = track.album;

    // Load lyrics
    const lrcText = await window.api.loadLyrics(track.filePath);
    state.lyrics = lrcText ? parseLRC(lrcText) : [];
    state.activeLyricIndex = -1;
    renderLyrics();

    // Re-render track lists to show playing state
    refreshTrackLists();

    // Generate particles
    generateParticles();
  }

  function togglePlay() {
    if (!audio.src) return;
    if (audio.paused) {
      audio.play();
      state.isPlaying = true;
    } else {
      audio.pause();
      state.isPlaying = false;
    }
    updatePlayButton(state.isPlaying);
  }

  function playNext() {
    if (state.queue.length === 0) return;
    if (state.repeat === 'one') {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    let next = state.queueIndex + 1;
    if (state.shuffle) {
      next = Math.floor(Math.random() * state.queue.length);
    } else if (next >= state.queue.length) {
      if (state.repeat === 'all') next = 0;
      else return;
    }
    playTrack(state.queue[next], state.queue, next);
  }

  function playPrev() {
    if (state.queue.length === 0) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let prev = state.queueIndex - 1;
    if (prev < 0) prev = state.repeat === 'all' ? state.queue.length - 1 : 0;
    playTrack(state.queue[prev], state.queue, prev);
  }

  function updatePlayButton(playing) {
    const icon = playing ? '⏸' : '▶';
    dom.btnPlay.textContent = icon;
    dom.immPlay.textContent = icon;
  }

  function refreshTrackLists() {
    if (state.currentView === 'library') {
      renderLibrary(dom.librarySearch.value.toLowerCase());
    }
    if (state.currentPlaylistId) renderPlaylistDetail();
  }

  /* ═══════ Lyrics ═══════ */
  function parseLRC(text) {
    const lines = [];
    const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    for (const line of text.split('\n')) {
      let match;
      const times = [];
      let lastIndex = 0;
      while ((match = regex.exec(line)) !== null) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
        times.push(min * 60 + sec + ms / 1000);
        lastIndex = match.index + match[0].length;
      }
      regex.lastIndex = 0;
      const content = line.slice(lastIndex).trim();
      for (const t of times) {
        if (content) lines.push({ time: t, text: content });
      }
    }
    lines.sort((a, b) => a.time - b.time);
    return lines;
  }

  function renderLyrics() {
    if (state.lyrics.length === 0) {
      dom.immersiveLyrics.innerHTML = '<div class="lyrics-placeholder">♫ No lyrics available</div>';
      return;
    }
    dom.immersiveLyrics.innerHTML = state.lyrics.map((l, i) =>
      `<div class="lyric-line" data-index="${i}">${escapeHtml(l.text)}</div>`
    ).join('');
  }

  function updateLyrics(currentTime) {
    if (state.lyrics.length === 0) return;
    let idx = -1;
    for (let i = state.lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= state.lyrics[i].time - 0.1) { idx = i; break; }
    }
    if (idx === state.activeLyricIndex) return;
    state.activeLyricIndex = idx;

    const lines = dom.immersiveLyrics.querySelectorAll('.lyric-line');
    lines.forEach((el, i) => {
      el.classList.toggle('active', i === idx);
      el.classList.toggle('past', i < idx);
    });

    // Scroll lyrics
    if (idx >= 0 && lines[idx]) {
      const container = dom.immersiveLyrics;
      const lineEl = lines[idx];
      const offset = lineEl.offsetTop - container.parentElement.clientHeight / 2 + lineEl.clientHeight / 2;
      container.style.transform = `translateY(-${Math.max(0, offset)}px)`;
    }
  }

  /* ═══════ Particles ═══════ */
  function generateParticles() {
    const existing = document.querySelectorAll('.particle');
    existing.forEach((p) => p.remove());

    const container = dom.immersiveOverlay.querySelector('.immersive-content');
    for (let i = 0; i < 12; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const size = Math.random() * 8 + 3;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.bottom = `${Math.random() * 30}%`;
      particle.style.animationDelay = `${Math.random() * 4}s`;
      particle.style.animationDuration = `${3 + Math.random() * 4}s`;
      container.appendChild(particle);
    }
  }

  /* ═══════ Event Binding ═══════ */
  function bindEvents() {
    // Window controls
    dom.btnMin.addEventListener('click', () => window.api.minimize());
    dom.btnMax.addEventListener('click', () => window.api.maximize());
    dom.btnClose.addEventListener('click', () => window.api.close());

    // Navigation
    dom.navItems.forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));

    // Add folder
    dom.btnAddFolder.addEventListener('click', async () => {
      const folder = await window.api.openFolderDialog();
      if (folder) {
        state.library = await window.api.scanFolder(folder);
        renderAll();
      }
    });

    // Remove folder
    dom.folderList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.folder-remove');
      if (btn) {
        state.library = await window.api.removeFolder(btn.dataset.folder);
        renderAll();
        refreshTrackLists();
      }
    });

    // Library search
    dom.librarySearch.addEventListener('input', (e) => {
      renderLibrary(e.target.value.toLowerCase());
    });

    // Track double-click to play
    dom.libraryTracks.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.track-row');
      if (!row) return;
      const id = row.dataset.id;
      const trackIndex = state.library.tracks.findIndex((t) => t.id === id);
      if (trackIndex >= 0) playTrack(state.library.tracks[trackIndex], [...state.library.tracks], trackIndex);
    });

    dom.playlistTracks.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.track-row');
      if (!row) return;
      const pl = state.playlists.find((p) => p.id === state.currentPlaylistId);
      if (!pl) return;
      const plTracks = pl.trackIds.map((id) => state.library.tracks.find((t) => t.id === id)).filter(Boolean);
      const idx = plTracks.findIndex((t) => t.id === row.dataset.id);
      if (idx >= 0) playTrack(plTracks[idx], plTracks, idx);
    });

    // Add to playlist button
    dom.libraryTracks.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-add-to-playlist');
      if (btn) showAddToPlaylistModal(btn.dataset.id);
    });

    // Remove from playlist
    dom.playlistTracks.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-remove-from-playlist');
      if (btn && state.currentPlaylistId) {
        state.playlists = await window.api.removeTrackFromPlaylist(state.currentPlaylistId, btn.dataset.id);
        renderPlaylistDetail();
        renderSidebarPlaylists();
      }
    });

    // Playlist creation
    dom.btnNewPlaylist.addEventListener('click', createPlaylist);
    dom.btnCreatePlaylist.addEventListener('click', createPlaylist);

    // Playlist grid click
    dom.playlistGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.playlist-card');
      if (card) openPlaylistDetail(card.dataset.id);
    });

    // Sidebar playlist click
    dom.playlistList.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (li) {
        switchView('playlists');
        openPlaylistDetail(li.dataset.id);
      }
    });

    // Back from playlist detail
    dom.btnBackPlaylists.addEventListener('click', () => {
      state.currentPlaylistId = null;
      dom.playlistGrid.classList.remove('hidden');
      dom.playlistDetail.classList.add('hidden');
      renderPlaylistGrid();
      renderSidebarPlaylists();
    });

    // Delete playlist
    dom.btnDeletePlaylist.addEventListener('click', async () => {
      if (state.currentPlaylistId) {
        state.playlists = await window.api.deletePlaylist(state.currentPlaylistId);
        state.currentPlaylistId = null;
        dom.playlistGrid.classList.remove('hidden');
        dom.playlistDetail.classList.add('hidden');
        renderPlaylistGrid();
        renderSidebarPlaylists();
      }
    });

    // Player controls
    dom.btnPlay.addEventListener('click', togglePlay);
    dom.btnPrev.addEventListener('click', playPrev);
    dom.btnNext.addEventListener('click', playNext);
    dom.immPlay.addEventListener('click', togglePlay);
    dom.immPrev.addEventListener('click', playPrev);
    dom.immNext.addEventListener('click', playNext);

    dom.btnShuffle.addEventListener('click', () => {
      state.shuffle = !state.shuffle;
      dom.btnShuffle.classList.toggle('active', state.shuffle);
      dom.immShuffle.classList.toggle('active', state.shuffle);
    });
    dom.immShuffle.addEventListener('click', () => dom.btnShuffle.click());

    dom.btnRepeat.addEventListener('click', cycleRepeat);
    dom.immRepeat.addEventListener('click', cycleRepeat);

    // Seek
    dom.seekBar.addEventListener('input', (e) => {
      if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    });
    dom.immSeek.addEventListener('input', (e) => {
      if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    });

    // Volume
    dom.volumeBar.addEventListener('input', (e) => {
      audio.volume = e.target.value / 100;
      dom.btnVolumeIcon.textContent = audio.volume === 0 ? '🔇' : audio.volume < 0.5 ? '🔉' : '🔊';
    });

    // Audio events
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      dom.seekBar.value = pct;
      dom.immSeek.value = pct;
      dom.currentTime.textContent = formatTime(audio.currentTime);
      dom.immCurrentTime.textContent = formatTime(audio.currentTime);
      updateLyrics(audio.currentTime);
    });
    audio.addEventListener('loadedmetadata', () => {
      dom.totalTime.textContent = formatTime(audio.duration);
      dom.immTotalTime.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('ended', playNext);
    audio.addEventListener('play', () => updatePlayButton(true));
    audio.addEventListener('pause', () => updatePlayButton(false));

    // Immersive mode
    dom.btnImmersive.addEventListener('click', () => {
      dom.immersiveOverlay.classList.remove('hidden');
      dom.immersiveOverlay.classList.add('show');
      generateParticles();
    });
    dom.btnExitImmersive.addEventListener('click', () => {
      dom.immersiveOverlay.classList.add('hidden');
      dom.immersiveOverlay.classList.remove('show');
    });

    // Modal
    dom.modalAdd.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    dom.modalAdd.querySelector('.modal-cancel').addEventListener('click', closeModal);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight' && e.ctrlKey) playNext();
      if (e.code === 'ArrowLeft' && e.ctrlKey) playPrev();
      if (e.code === 'Escape') {
        dom.immersiveOverlay.classList.add('hidden');
        dom.immersiveOverlay.classList.remove('show');
        closeModal();
      }
    });
  }

  /* ═══════ Helpers ═══════ */
  function cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    const icons = ['🔁', '🔁', '🔂'];
    const idx = (modes.indexOf(state.repeat) + 1) % modes.length;
    state.repeat = modes[idx];
    dom.btnRepeat.textContent = icons[idx];
    dom.immRepeat.textContent = icons[idx];
    dom.btnRepeat.classList.toggle('active', state.repeat !== 'off');
    dom.immRepeat.classList.toggle('active', state.repeat !== 'off');
  }

  async function createPlaylist() {
    const name = prompt('Playlist name:');
    if (!name || !name.trim()) return;
    state.playlists = await window.api.createPlaylist(name.trim());
    renderSidebarPlaylists();
    renderPlaylistGrid();
  }

  let pendingTrackId = null;
  function showAddToPlaylistModal(trackId) {
    pendingTrackId = trackId;
    dom.modalPlaylistList.innerHTML = state.playlists.map((p) =>
      `<li data-id="${p.id}">🎵 ${escapeHtml(p.name)}</li>`
    ).join('');
    if (state.playlists.length === 0) {
      dom.modalPlaylistList.innerHTML = '<li style="color:var(--text-muted);cursor:default">No playlists yet</li>';
    }
    dom.modalAdd.classList.remove('hidden');

    dom.modalPlaylistList.onclick = async (e) => {
      const li = e.target.closest('li[data-id]');
      if (li && pendingTrackId) {
        state.playlists = await window.api.addTrackToPlaylist(li.dataset.id, pendingTrackId);
        closeModal();
        renderSidebarPlaylists();
        if (state.currentPlaylistId) renderPlaylistDetail();
      }
    };
  }

  function closeModal() {
    dom.modalAdd.classList.add('hidden');
    pendingTrackId = null;
  }

  function formatTime(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Start ── */
  init();
})();
