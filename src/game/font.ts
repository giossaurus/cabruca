// Camada ADAPTER. Registra a fonte do jogo via @font-face injetado por JS.
//
// Por que não no index.html: lá o `url()` seria um caminho fixo que o Vite não
// reescreve, quebrando sob `file://` no Electron. Importando o .ttf aqui, o Vite
// gera uma URL relativa fingerprintada que funciona tanto no navegador quanto no
// app empacotado. O BootScene espera esta família pronta (document.fonts.ready).
import roadPixelUrl from '../../RoadPixel.ttf';

export function installFonts(): void {
  const style = document.createElement('style');
  style.textContent = `@font-face {
    font-family: 'RoadPixel';
    src: url('${roadPixelUrl}') format('truetype');
    font-display: swap;
  }`;
  document.head.appendChild(style);
}
