import Phaser from 'phaser';
import {
  createPlaceholderTextures, TextureKey,
  PLAYER_FRAME_W, PLAYER_FRAME_H, PLAYER_IDLE_COLS, PLAYER_WALK_COLS,
  PlayerRow, playerAnim, type PlayerFacing,
} from '../assets';
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
// UI custom já existente.
import slotBarUrl from '../../assets/slot_bar.png';
import podarPrataUrl from '../../assets/podar_prata.png';
import podarPretoUrl from '../../assets/podar_preto.png';
// Trilhas de fundo (OGG preferido, MP3 fallback). Tocadas em streaming HTML5;
// ver src/game/audio.ts e o bloco `audio` em main.ts.
import { AudioKey } from '../audio';
import musicOggUrl from '../../assets/audio/music_lofi.ogg';
import musicMp3Url from '../../assets/audio/music_lofi.mp3';
import ambienceOggUrl from '../../assets/audio/ambience_nature.ogg';
import ambienceMp3Url from '../../assets/audio/ambience_nature.mp3';

/**
 * Prepara os assets antes do jogo: carrega o pack Farm Life (chão, árvore, muda,
 * decorações, jogador animado), a UI custom e as trilhas; gera o cacau por
 * código; cria as animações do jogador. As keys em `assets.ts` são o contrato —
 * o resto do código não sabe de onde a imagem veio.
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
    // UI.
    this.load.image(TextureKey.SlotBar, slotBarUrl);
    this.load.image(TextureKey.PodarPrata, podarPrataUrl);
    this.load.image(TextureKey.PodarPreto, podarPretoUrl);
    // Trilhas: array de fontes (Phaser escolhe o formato suportado). Em HTML5 o
    // loader completa por streaming, sem baixar os ~50 MB da música antes do jogo.
    this.load.audio(AudioKey.Music, [musicOggUrl, musicMp3Url]);
    this.load.audio(AudioKey.Ambience, [ambienceOggUrl, ambienceMp3Url]);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.createPlayerAnims();
    this.scene.start('MenuScene');
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
}
