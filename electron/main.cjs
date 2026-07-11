// Processo PRINCIPAL do Electron (Node). Cria a janela e traduz a bridge
// `window.cabruca` (ver src/game/display.ts) em chamadas nativas do SO.
// CommonJS (.cjs) de propósito: o package.json é "type":"module", e main/preload
// do Electron rodam mais previsíveis em CJS (sem __dirname/ESM loader).
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');

// Injetada pelos scripts de dev (electron:dev). Ausente no app empacotado.
const DEV_URL = process.env.VITE_DEV_SERVER_URL;

/** Base 3:2 do jogo (960×640), numa janela confortável mas redimensionável. */
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 853;

/** @type {BrowserWindow | null} */
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: 640,
    minHeight: 427,
    backgroundColor: '#000000', // combina com o letterbox da página (index.html).
    show: false, // evita flash branco; mostramos em 'ready-to-show'.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win?.show());

  if (DEV_URL) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.on('closed', () => {
    win = null;
  });
}

// Sem menu nativo — é um jogo em tela cheia/janela; ESC/pausa vêm do Phaser.
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();
  // macOS: recria a janela ao clicar no dock sem janelas abertas.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Win/Linux: sair ao fechar a última janela. macOS mantém o app vivo (convenção).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Bridge window.cabruca → SO ──────────────────────────────────────────────
// setResolution: efeito real de resolução = tamanho da ÁREA DE CONTEÚDO. O
// Phaser (Scale.FIT) reflui dentro dela. Centraliza para não fugir da tela.
ipcMain.on('cabruca:set-resolution', (_e, size) => {
  if (!win || win.isFullScreen()) return;
  const width = Math.round(Number(size?.width));
  const height = Math.round(Number(size?.height));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  win.setContentSize(width, height);
  win.center();
});

ipcMain.on('cabruca:set-fullscreen', (_e, on) => {
  win?.setFullScreen(Boolean(on));
});
