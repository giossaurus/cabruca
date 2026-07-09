import Phaser from 'phaser';
import { Button, UI } from '../ui';

/**
 * Menu de pause — lançado POR CIMA da FarmScene (que fica pausada).
 * Retomar / Opções / Reiniciar / Voltar ao menu.
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, UI.color.overlay, 0.72);
    this.add.text(w / 2, h / 2 - 150, 'PAUSA', {
      fontFamily: UI.font, fontSize: UI.size.title, color: UI.text.primary,
    }).setOrigin(0.5);

    new Button(this, { x: w / 2, y: h / 2 - 60, label: 'Retomar [ESC]', variant: 'primary', onClick: () => this.resumeGame() });
    new Button(this, { x: w / 2, y: h / 2 - 4, label: 'Opções', onClick: () => this.openOptions() });
    new Button(this, { x: w / 2, y: h / 2 + 52, label: 'Reiniciar', onClick: () => {
      this.scene.stop();
      this.scene.stop('FarmScene');
      this.scene.start('FarmScene');
    } });
    new Button(this, { x: w / 2, y: h / 2 + 108, label: 'Voltar ao menu', onClick: () => {
      this.scene.stop();
      this.scene.stop('FarmScene');
      this.scene.start('MenuScene');
    } });

    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());
  }

  private openOptions(): void {
    this.scene.pause();
    this.scene.launch('OptionsScene', { parent: 'PauseScene' });
  }

  private resumeGame(): void {
    this.scene.stop();
    this.scene.resume('FarmScene');
  }
}
