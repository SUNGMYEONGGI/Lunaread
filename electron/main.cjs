// Desktop shell: runs the same Node server in-process on a free local port
// and opens the built web app in a window.
const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function createWindow() {
  const { start } = await import(pathToFileURL(path.join(__dirname, '..', 'dist-server', 'server.js')).href);
  const port = await start(0);
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: 'Lunaread',
    backgroundColor: '#FAFAFA',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  const origin = `http://127.0.0.1:${port}`;
  // External links (paper sources, Semantic Scholar) open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(origin)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  win.loadURL(`${origin}/library/`);
  win.webContents.once('did-finish-load', () => checkForUpdate(win));
}

// Unsigned builds cannot self-update on macOS, so the app only points to the newer release.
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
async function checkForUpdate(win) {
  try {
    const r = await fetch('https://api.github.com/repos/SUNGMYEONGGI/Lunaread/releases/latest', { headers: { accept: 'application/vnd.github+json' } });
    if (!r.ok) return;
    const { tag_name: tag, html_url: url } = await r.json();
    const latest = String(tag || '').replace(/^v/, '');
    if (!newer(latest, app.getVersion())) return;
    const { response } = await dialog.showMessageBox(win, { type: 'info', message: `Lunaread ${latest} is available`, detail: `You have ${app.getVersion()}.`, buttons: ['Download', 'Later'], defaultId: 0, cancelId: 1 });
    if (response === 0 && /^https:\/\/github\.com\//.test(url)) shell.openExternal(url);
  } catch { /* offline */ }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
