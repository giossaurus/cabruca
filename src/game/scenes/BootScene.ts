import Phaser from 'phaser';
import {
  createPlaceholderTextures, TextureKey,
  PLAYER_FRAME_W, PLAYER_FRAME_H, PLAYER_IDLE_COLS, PLAYER_WALK_COLS,
  PlayerRow, playerAnim, type PlayerFacing,
  DOG_FRAME_W, DOG_FRAME_H, DOG_COLS, DogWalkRow, dogAnim, type DogFacing,
} from '../assets';
import { applyDisplaySettings } from '../display';
import { FOREST_ASSETS } from '../forest';
import { loadSettings } from '../ui';
// Assets do pack Farm Life (recortados) em src/assets/farm-life/ — o Vite
// resolve cada import para uma URL servível.
import grassUrl from '../../assets/farm-life/terrain/grass.png';
import bedUrl from '../../assets/farm-life/terrain/bed.png';
import treeUrl from '../../assets/farm-life/trees/tree.png';
import seedlingUrl from '../../assets/farm-life/trees/seedling.png';
import bushUrl from '../../assets/farm-life/decor/bush.png';
import flowerUrl from '../../assets/farm-life/decor/flower.png';
import stoneUrl from '../../assets/farm-life/decor/stone.png';
import houseUrl from '../../assets/farm-life/buildings/house.png';
import idleUrl from '../../assets/farm-life/character/idle.png';
import walkUrl from '../../assets/farm-life/character/walk.png';
import dogUrl from '../../assets/dogs/goldie.png';
import menuBackgroundUrl from '../../../Day-Sparse-Clouds-BG-Light-Green-FG.png';
import menuBackgroundSparseExtraLightUrl from '../../../Day-Sparse-Clouds-BG-Extra-Light-Green-FG.png';
import menuBackgroundLargeLightUrl from '../../../Day-Large-Clouds-BG-Light-Green-FG.png';
import menuBackgroundLargeExtraLightUrl from '../../../Day-Large-Clouds-BG-Extra-Light-Green-FG.png';
import sleepBackgroundStarryUrl from '../../../Night/Stary-BG-Light-Green-FG.png';
import scienzaLogoUrl from '../../../Logo Scienza PNG.png';
// Trilhas de fundo (OGG preferido, MP3 fallback). Tocadas em streaming HTML5;
// ver src/game/audio.ts e o bloco `audio` em main.ts.
import { AudioKey } from '../audio';
import musicOggUrl from '../../assets/audio/music_lofi.ogg';
import musicMp3Url from '../../assets/audio/music_lofi.mp3';
import ambienceOggUrl from '../../assets/audio/ambience_nature.ogg';
import ambienceMp3Url from '../../assets/audio/ambience_nature.mp3';

/**
 * Prepara os assets antes do jogo: carrega o pack Farm Life (chão, árvore, muda,
 * decorações, jogador animado), logo de splash e trilhas; gera texturas
 * procedurais de UI/cacau; cria as animações do jogador. As keys em `assets.ts`
 * são o contrato — o resto do código não sabe de onde a imagem veio.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Terreno (16px, ladrilhados ×4 no FarmScene).
    this.load.image(TextureKey.Grass, grassUrl);
    this.load.image(TextureKey.Bed, bedUrl);
    // Vegetação e decoração (imagens únicas).
    this.load.image(TextureKey.TreeMature, treeUrl);
    this.load.image(TextureKey.Seedling, seedlingUrl);
    this.load.image(TextureKey.DecorBush, bushUrl);
    this.load.image(TextureKey.DecorFlower, flowerUrl);
    this.load.image(TextureKey.DecorStone, stoneUrl);
    this.load.image(TextureKey.House, houseUrl);
    // Jogador: spritesheets direcionais (frame 80×112).
    const frame = { frameWidth: PLAYER_FRAME_W, frameHeight: PLAYER_FRAME_H };
    this.load.spritesheet(TextureKey.PlayerIdle, idleUrl, frame);
    this.load.spritesheet(TextureKey.PlayerWalk, walkUrl, frame);
    this.load.spritesheet(TextureKey.Dog, dogUrl, { frameWidth: DOG_FRAME_W, frameHeight: DOG_FRAME_H });
    this.load.image(TextureKey.MenuBackground, menuBackgroundUrl);
    this.load.image(TextureKey.MenuBackgroundSparseExtraLight, menuBackgroundSparseExtraLightUrl);
    this.load.image(TextureKey.MenuBackgroundLargeLight, menuBackgroundLargeLightUrl);
    this.load.image(TextureKey.MenuBackgroundLargeExtraLight, menuBackgroundLargeExtraLightUrl);
    this.load.image(TextureKey.SleepBackgroundStarry, sleepBackgroundStarryUrl);
    this.load.image(TextureKey.ScienzaLogo, scienzaLogoUrl);
    // Detalhes de chão de floresta (Pocket Cozy Pixels) — ambientação espalhada.
    for (const asset of FOREST_ASSETS) this.load.image(asset.key, asset.url);
    // Trilhas: array de fontes (Phaser escolhe o formato suportado). Em HTML5 o
    // loader completa por streaming, sem baixar os ~50 MB da música antes do jogo.
    this.load.audio(AudioKey.Music, [musicOggUrl, musicMp3Url]);
    this.load.audio(AudioKey.Ambience, [ambienceOggUrl, ambienceMp3Url]);
  }

  create(): void {
    applyDisplaySettings(this.game, loadSettings());
    createPlaceholderTextures(this);
    this.createPlayerAnims();
    this.createDogAnims();
    void this.startAfterFontsReady();
  }

  private async startAfterFontsReady(): Promise<void> {
    try {
      await document.fonts.load('64px RoadPixel');
      await document.fonts.ready;
    } catch {
      // Se a fonte falhar, o jogo ainda precisa seguir com o fallback.
    }
    this.scene.start('SplashScene');
  }

  /**
   * Cria idle/walk para as 3 direções do sheet (baixo/lado/cima). Cada linha do
   * sheet é uma direção; as colunas são os frames. Esquerda reusa a de lado com
   * flipX (feito no Player).
   */
  private createPlayerAnims(): void {
    const dirs: PlayerFacing[] = ['down', 'side', 'up'];
    for (const facing of dirs) {
      const row = PlayerRow[facing];
      const idleStart = row * PLAYER_IDLE_COLS;
      this.anims.create({
        key: playerAnim('idle', facing),
        frames: this.anims.generateFrameNumbers(TextureKey.PlayerIdle, {
          start: idleStart, end: idleStart + PLAYER_IDLE_COLS - 1,
        }),
        frameRate: 3,
        repeat: -1,
      });
      const walkStart = row * PLAYER_WALK_COLS;
      this.anims.create({
        key: playerAnim('walk', facing),
        frames: this.anims.generateFrameNumbers(TextureKey.PlayerWalk, {
          start: walkStart, end: walkStart + PLAYER_WALK_COLS - 1,
        }),
        frameRate: 12,
        repeat: -1,
      });
    }
  }

  /** Ciclos de caminhada do cão (baixo/cima/lado) — ver DogWalkRow em assets.ts. */
  private createDogAnims(): void {
    const dirs: DogFacing[] = ['down', 'up', 'side'];
    for (const facing of dirs) {
      const start = DogWalkRow[facing] * DOG_COLS;
      this.anims.create({
        key: dogAnim(facing),
        frames: this.anims.generateFrameNumbers(TextureKey.Dog, { start, end: start + DOG_COLS - 1 }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }
}
