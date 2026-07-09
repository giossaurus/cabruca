// Camada ADAPTER (Phaser). Orquestra as trilhas de fundo do jogo.
//
// Duas trilhas em loop contínuo, tocadas pelo mixer HTML5 (streaming — ver
// `audio: { disableWebAudio: true }` em main.ts):
//   - música (lofi, ~1h): começa no menu e segue no gameplay;
//   - ambiente (natureza): só no gameplay.
//
// No gameplay a música faz "duck" (abaixa) para equilibrar com o ambiente.
//
// Os sons são criados no Sound Manager GLOBAL do Phaser (nível de jogo), que
// persiste entre trocas de cena. Guardamos as referências neste singleton de
// módulo para não recriar/reiniciar as trilhas a cada `create()`.
import Phaser from 'phaser';
import { loadSettings } from './ui';

export const AudioKey = {
  Music: 'music',
  Ambience: 'ambience',
} as const;

/** Quanto a música abaixa no gameplay, para dar espaço ao ambiente. */
const MUSIC_DUCK = 0.5;

let music: Phaser.Sound.BaseSound | null = null;
let ambience: Phaser.Sound.BaseSound | null = null;
/** Fator de contexto da música: 1.0 no menu, MUSIC_DUCK no gameplay. */
let musicCtx = 1.0;

function getMusic(scene: Phaser.Scene): Phaser.Sound.BaseSound {
  if (!music) music = scene.sound.add(AudioKey.Music, { loop: true });
  return music;
}

function getAmbience(scene: Phaser.Scene): Phaser.Sound.BaseSound {
  if (!ambience) ambience = scene.sound.add(AudioKey.Ambience, { loop: true });
  return ambience;
}

function setVolume(sound: Phaser.Sound.BaseSound, v: number): void {
  // Sob disableWebAudio as instâncias são HTML5AudioSound; BaseSound não tipa setVolume.
  (sound as Phaser.Sound.HTML5AudioSound).setVolume(v);
}

/**
 * Reaplica todos os volumes a partir das preferências salvas, respeitando o
 * contexto atual (menu/gameplay). Efetivo = mestre × por-trilha × contexto.
 */
function applyVolumes(scene: Phaser.Scene): void {
  const s = loadSettings();
  scene.sound.volume = s.volume; // mestre (multiplicador global)
  if (music) setVolume(music, s.musicVolume * musicCtx);
  if (ambience) setVolume(ambience, s.ambienceVolume);
}

/** Menu: garante a música tocando (sem duck) e para o ambiente. */
export function enterMenu(scene: Phaser.Scene): void {
  musicCtx = 1.0;
  const m = getMusic(scene);
  if (!m.isPlaying) m.play();
  stopAmbience();
  applyVolumes(scene);
}

/** Gameplay: garante música (com duck) + ambiente tocando. */
export function enterGame(scene: Phaser.Scene): void {
  musicCtx = MUSIC_DUCK;
  const m = getMusic(scene);
  if (!m.isPlaying) m.play();
  const a = getAmbience(scene);
  if (!a.isPlaying) a.play();
  applyVolumes(scene);
}

/** Para o ambiente (ao sair do gameplay). A música continua. */
export function stopAmbience(): void {
  if (ambience && ambience.isPlaying) ambience.stop();
}

/** Reaplica volumes após alteração nas Opções, mantendo o contexto atual. */
export function applySettings(scene: Phaser.Scene): void {
  applyVolumes(scene);
}
