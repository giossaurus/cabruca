import Phaser from 'phaser';
import { announce } from '../accessibility';
import { Button, FocusList, UI, loadSettings } from '../ui';

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
    announce(loadSettings(), 'Jogo pausado. Use setas para navegar.');

    const resume = new Button(this, { x: w / 2, y: h / 2 - 60, label: 'Retomar [ESC]', variant: 'primary', onClick: () => this.resumeGame() });
    const options = new Button(this, { x: w / 2, y: h / 2 - 4, label: 'Opções', onClick: () => this.openOptions() });
    const restart = new Button(this, { x: w / 2, y: h / 2 + 52, label: 'Reiniciar', onClick: () => {
      this.scene.stop();
      this.scene.stop('FarmScene');
      this.scene.start('FarmScene');
    } });
    const menu = new Button(this, { x: w / 2, y: h / 2 + 108, label: 'Voltar ao menu', onClick: () => {
      this.scene.stop();
      this.scene.stop('FarmScene');
      this.scene.start('MenuScene');
    } });

    new FocusList(this, [
      { label: 'Retomar', onFocus: (v) => resume.setFocused(v), onActivate: () => resume.activate() },
      { label: 'Opções', onFocus: (v) => options.setFocused(v), onActivate: () => options.activate() },
      { label: 'Reiniciar', onFocus: (v) => restart.setFocused(v), onActivate: () => restart.activate() },
      { label: 'Voltar ao menu', onFocus: (v) => menu.setFocused(v), onActivate: () => menu.activate() },
    ], (message) => announce(loadSettings(), message), 0, () => this.resumeGame());

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
