import Phaser from 'phaser';
import { applyAccessibilitySettings, announce } from '../accessibility';
import { Button, focusButtons, loadSettings } from '../ui';
import { hasSave } from '../save';
import { drawMenuBackground } from './menuBackground';
import * as audio from '../audio';

/**
 * Menu inicial enxuto: diorama em perspectiva feito com primitivas Phaser e
 * apenas as entradas principais pedidas.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    const w = this.scale.width;
    const settings = loadSettings();

    applyAccessibilitySettings(settings);
    audio.enterMenu(this);
    drawMenuBackground(this);
    announce(settings, 'Menu principal. Use setas para escolher Iniciar jogo, Carregar jogo, Opções ou Créditos.');

    this.add.text(w / 2, 120, 'CABRUCA', {
      fontFamily: '"RoadPixel", monospace',
      fontSize: '112px',
      color: '#ffe2a3',
    }).setOrigin(0.5).setShadow(6, 7, '#34502d', 0, true, true);

    const x = w / 2;
    const startY = 248;
    const canLoad = hasSave();
    const start = new Button(this, {
      x, y: startY, width: 280, height: 52,
      label: 'Iniciar jogo', variant: 'primary', fontSize: '24px',
      onClick: () => this.start(),
    });
    const load = new Button(this, {
      x, y: startY + 62, width: 280, height: 46,
      label: 'Carregar jogo',
      onClick: () => this.loadGame(),
    }).setEnabled(canLoad);
    const options = new Button(this, {
      x, y: startY + 118, width: 280, height: 46,
      label: 'Opções',
      onClick: () => {
        this.scene.pause();
        this.scene.launch('OptionsScene', { parent: 'MenuScene' });
      },
    });
    const credits = new Button(this, {
      x, y: startY + 174, width: 280, height: 46,
      label: 'Créditos',
      onClick: () => {
        this.scene.pause();
        this.scene.launch('CreditsScene');
      },
    });

    focusButtons(this, [
      { button: start, label: 'Iniciar jogo' },
      { button: load, label: 'Carregar jogo', disabledLabel: 'Carregar jogo indisponível' },
      { button: options, label: 'Opções' },
      { button: credits, label: 'Créditos' },
    ], (message) => announce(loadSettings(), message));
  }

  private start(): void {
    announce(loadSettings(), 'Iniciando jogo.');
    this.scene.start('IntroScene');
  }

  /** Carrega direto na fazenda (pula a intro), restaurando o save. */
  private loadGame(): void {
    announce(loadSettings(), 'Carregando jogo salvo.');
    this.scene.start('FarmScene', { load: true });
  }
}
