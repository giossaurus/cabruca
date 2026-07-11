// Forest Ground Details Pack (Pocket Cozy Pixels), 32×32 top-down. Detalhes de
// chão espalhados no cenário FORA do talhão de cacau — pura ambientação.
// Carregado no BootScene; posicionado em FarmScene.scatterForestDetails.
//
// Duas famílias de comportamento:
//  - FLAT: manchas que deitam no chão (terra/lama/folhas). Origin no centro,
//    depth logo acima da grama, sem colisão.
//  - PROP: pequenos volumes em pé (tufos, cogumelos, flores, troncos, tocos).
//    Origin na base, ordenados por Y, sem colisão (o jogador anda por cima).

// Vite resolve cada PNG da pasta para uma URL servível.
const urlByPath = import.meta.glob('../assets/farm-life/forest/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

function keyFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return `forest_${file.replace(/\.png$/, '')}`;
}

/** { key, url } de todos os detalhes de floresta, para o loader do BootScene. */
export const FOREST_ASSETS: ReadonlyArray<{ key: string; url: string }> = Object.entries(urlByPath)
  .map(([path, url]) => ({ key: keyFromPath(path), url }))
  .sort((a, b) => a.key.localeCompare(b.key));

/** Manchas de chão (deitadas, sem volume). */
export const FOREST_FLAT_KEYS: readonly string[] = [
  'forest_dirt_patch',
  'forest_mud_patch',
  'forest_leaf_pile',
  'forest_grass_dirt_1',
  'forest_grass_dirt_2',
  'forest_grass_dirt_3',
  'forest_grass_dirt_4',
];

/** Volumes em pé (ordenados por profundidade com o jogador). */
export const FOREST_PROP_KEYS: readonly string[] = [
  'forest_grass_tuft_1',
  'forest_grass_tuft_2',
  'forest_tall_grass_1',
  'forest_tall_grass_2',
  'forest_flower_1',
  'forest_flower_2',
  'forest_flower_3',
  'forest_flower_4',
  'forest_mushroom_1',
  'forest_mushroom_2',
  'forest_log_1',
  'forest_log_2',
  'forest_stump_1',
  'forest_stump_2',
  'forest_stump_3',
];
