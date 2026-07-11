import Phaser from 'phaser';
import { applyAccessibilitySettings, announce } from '../accessibility';
import { TextureKey } from '../assets';
import { Button, FocusList, UI, loadSettings } from '../ui';
import * as audio from '../audio';

const MENU_BACKGROUND_KEYS: readonly string[] = [
  TextureKey.MenuBackground,
  TextureKey.MenuBackgroundSparseExtraLight,
  TextureKey.MenuBackgroundLargeLight,
  TextureKey.MenuBackgroundLargeExtraLight,
];

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
    const h = this.scale.height;
    const settings = loadSettings();

    applyAccessibilitySettings(settings);
    audio.enterMenu(this);
    this.drawBackground(w, h);
    announce(settings, 'Menu principal. Use setas para escolher Iniciar jogo, Carregar jogo, Opções ou Créditos.');

    this.add.text(w / 2, 120, 'CABRUCA', {
      fontFamily: '"RoadPixel", monospace',
      fontSize: '112px',
      color: '#ffe2a3',
    }).setOrigin(0.5).setShadow(6, 7, '#34502d', 0, true, true);

    const x = w / 2;
    const startY = 248;
    const start = new Button(this, {
      x, y: startY, width: 280, height: 52,
      label: 'Iniciar jogo', variant: 'primary', fontSize: '24px',
      onClick: () => this.start(),
    });
    const load = new Button(this, {
      x, y: startY + 62, width: 280, height: 46,
      label: 'Carregar jogo',
      onClick: () => undefined,
    }).setEnabled(false);
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

    new FocusList(this, [
      { label: 'Iniciar jogo', onFocus: (v) => start.setFocused(v), onActivate: () => start.activate() },
      { label: 'Carregar jogo indisponível', enabled: () => load.enabled, onFocus: (v) => load.setFocused(v), onActivate: () => load.activate() },
      { label: 'Opções', onFocus: (v) => options.setFocused(v), onActivate: () => options.activate() },
      { label: 'Créditos', onFocus: (v) => credits.setFocused(v), onActivate: () => credits.activate() },
    ], (message) => announce(loadSettings(), message));
  }

  private drawBackground(w: number, h: number): void {
    const centerX = w / 2;
    const background = this.add.image(centerX, h / 2, MENU_BACKGROUND_KEYS[0] ?? TextureKey.MenuBackground);
    const fitBackground = (): void => {
      const scale = Math.max(w / background.width, h / background.height) * 1.04;
      background.setScale(scale).setScrollFactor(0);
    };
    const panBackground = (direction: 1 | -1): void => {
      this.tweens.killTweensOf(background);
      background.setX(centerX - direction * 5);
      this.tweens.add({
        targets: background,
        x: centerX + direction * 9,
        duration: 8200,
        ease: 'Sine.inOut',
      });
    };

    fitBackground();
    panBackground(1);
    this.add.rectangle(w / 2, h / 2, w, h, 0x24442d, 0.12).setScrollFactor(0);
    const cycleVeil = this.add.rectangle(w / 2, h / 2, w, h, 0xffe2a3, 0)
      .setScrollFactor(0);
    let current = 0;
    this.time.addEvent({
      delay: 8200,
      loop: true,
      callback: () => {
        const next = (current + 1) % MENU_BACKGROUND_KEYS.length;
        this.tweens.add({
          targets: cycleVeil,
          alpha: 0.16,
          duration: 520,
          ease: 'Sine.inOut',
          yoyo: true,
          hold: 90,
          onYoyo: () => {
            current = next;
            background.setTexture(MENU_BACKGROUND_KEYS[current] ?? TextureKey.MenuBackground);
            fitBackground();
            panBackground(current % 2 === 0 ? 1 : -1);
          },
        });
      },
    });
  }

  private start(): void {
    announce(loadSettings(), 'Iniciando jogo.');
    this.scene.start('FarmScene');
  }
}
