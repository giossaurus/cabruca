// PRELOAD: ponte segura entre o renderer (jogo) e o processo principal.
// Expõe SOMENTE `window.cabruca` com a superfície mínima que src/game/display.ts
// consome — nada de Node/ipcRenderer cru no renderer (contextIsolation + sandbox).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cabruca', {
  /** Redimensiona a área de conteúdo da janela nativa (efeito de resolução). */
  setResolution(width, height) {
    ipcRenderer.send('cabruca:set-resolution', { width, height });
  },
  /** Liga/desliga tela cheia real do SO. */
  setFullscreen(on) {
    ipcRenderer.send('cabruca:set-fullscreen', on);
  },
});
