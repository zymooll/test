# 🎵 Melodix - Modern Music Player

A sleek, Electron-based music player with an immersive listening experience.

## Features

- **Library Scanner** – Automatically scans local folders for supported audio files (`.mp3`, `.flac`, `.wav`, `.ogg`, `.aac`, `.m4a`, `.wma`, `.opus`)
- **Playlist Management** – Create custom playlists from your music library
- **Immersive Player** – Full-screen mode with album art, blurred backgrounds, smooth animations, and synchronized lyrics
- **Modern UI** – Dark-themed interface with glassmorphism effects, fluid transitions, and responsive layout

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

### Install & Run

```bash
# Install dependencies
npm install

# Start the app
npm start
```

### Build

```bash
# Build distributable (platform-specific)
npm run build
```

## Usage

1. **Add Music** – Click the folder icon to select a music folder. Melodix scans it recursively for audio files.
2. **Browse Library** – View all discovered tracks with metadata (title, artist, album, duration).
3. **Create Playlists** – Click "+" in the Playlists section, name your playlist, then add songs from the library.
4. **Play Music** – Double-click any track to start playing. Use the bottom player bar for controls.
5. **Immersive Mode** – Click the expand button on the player bar to enter immersive full-screen view with dynamic lyrics and album art.

## Tech Stack

- **Electron** – Cross-platform desktop app framework
- **music-metadata** – Audio metadata parsing (ID3, Vorbis, etc.)
- **Vanilla JS/CSS** – Lightweight, no heavy UI frameworks

## License

MIT
