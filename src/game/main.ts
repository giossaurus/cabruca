// Camada ADAPTER (Phaser). Só aqui se importa 'phaser'.
// Responsabilidade: render + input. Toda regra vem do núcleo em src/domain.
// Esta camada NÃO é testada por unidade (ver docs/arquitetura.md) — cobrir com
// QA exploratória manual.
import Phaser from 'phaser';
import { installFonts } from './font';
import { initDeviceWatcher } from './gamepad';
import { BootScene } from './scenes/BootScene';
import { SplashScene } from './scenes/SplashScene';
import { MenuScene } from './scenes/MenuScene';
import { IntroScene } from './scenes/IntroScene';
import { FarmScene } from './scenes/FarmScene';
import { PauseScene } from './scenes/PauseScene';
import { OptionsScene } from './scenes/OptionsScene';
import { CreditsScene } from './scenes/CreditsScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  pixelArt: true,
  // No Phaser 4 o default de roundPixels virou false; este é um jogo pixel art.
  roundPixels: true,
  backgroundColor: '#1e3a24',
  // Força o mixer HTML5 (streaming). A música é um loop de ~1h: no Web Audio ela
  // seria decodificada inteira para PCM (~1 GB de RAM). Em HTML5 toca por streaming,
  // com RAM baixa independente da duração. Ver src/game/audio.ts.
  audio: { disableWebAudio: true },
  // Gamepad é opt-in no Phaser. Teclado continua sempre como fallback.
  input: { gamepad: true },
  // Boot → Splash → Menu → Intro → Farm; Pause/Options/Credits são sobreposições.
  scene: [BootScene, SplashScene, MenuScene, IntroScene, FarmScene, PauseScene, OptionsScene, CreditsScene],
  scale: {
    parent: 'app',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

installFonts();
initDeviceWatcher();
new Phaser.Game(config);
