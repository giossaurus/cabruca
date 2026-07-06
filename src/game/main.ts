// Camada ADAPTER (Phaser). Só aqui se importa 'phaser'.
// Responsabilidade: render + input. Toda regra vem do núcleo em src/domain.
// Esta camada NÃO é testada por unidade (ver docs/arquitetura.md) — cobrir com
// QA exploratória manual.
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { FarmScene } from './scenes/FarmScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  pixelArt: true,
  backgroundColor: '#1e3a24',
  scene: [BootScene, FarmScene],
  scale: {
    parent: 'app',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
