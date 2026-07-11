import { defineConfig } from 'vite';

// `base: './'` é o que torna o build carregável sob `file://` no Electron: sem
// isso o index.html referencia os assets por caminho absoluto (`/assets/...`),
// que quebra fora de um servidor HTTP (tela preta no app empacotado).
// No navegador (dev/preview) o caminho relativo funciona igual.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    // Alvo do Chromium embarcado no Electron — libera sintaxe moderna.
    target: 'chrome120',
    assetsInlineLimit: 0, // mantém a fonte/áudio como arquivos (streaming HTML5).
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
