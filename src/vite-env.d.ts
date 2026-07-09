/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** QA: liga a visualização da grade de sombra no FarmScene. Ver `.env.example`. */
  readonly VITE_GRID_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
