const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Flags de Aceleração de Hardware Nativa no Windows (Zero-Copy + GPU Rasterization + DirectComposition)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,PlatformHEVCDecoderSupport');
app.commandLine.appendSwitch('enable-blink-features', 'AudioVideoTracks');

let mainWindow = null;
let serverProcess = null;

function startLocalExpressServer() {
  const serverScript = path.join(__dirname, '..', 'server', 'index.js');
  serverProcess = spawn(process.execPath, [serverScript], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: '4150' },
    stdio: 'ignore',
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 980,
    minHeight: 620,
    frame: false, // Janela sem bordas para renderizar a titlebar Cyberpunk customizada do NextPlay
    backgroundColor: '#090d11',
    title: 'NextPlay — Desktop Media & Streaming Engine',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Permite reprodução direta de streams IPTV locais/remotos sem bloqueio CORS no Desktop
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  mainWindow.loadURL(devUrl).catch(() => {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Controles da janela nativa Windows API via IPC
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  startLocalExpressServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

