import { defineConfig } from 'vitest/config';

// O core de domínio é TS puro (sem Phaser), então roda em ambiente Node.
// Só arquivos *.test.ts do domínio são incluídos — a camada Phaser (adapter)
// não é testada por unidade (ver docs/arquitetura.md).
export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
