import Phaser from 'phaser';
import { Button, Panel, Slider, Toggle, UI, loadSettings, saveSettings, type Settings } from '../ui';
import * as audio from '../audio';

interface OptionsData {
  /** Cena que abriu as opções; é pausada enquanto o modal está aberto. */
  parent: string;
}

/**
 * Tela de Opções — modal sobreposto. A cena que abre (`parent`) fica PAUSADA
 * (sem input/update) enquanto este modal existe, evitando conflito de teclas.
 * Volume é aplicado ao mixer global do Phaser e persistido em localStorage.
 */
export class OptionsScene extends Phaser.Scene {
  private parent = 'MenuScene';
  private settings!: Settings;

  constructor() {
    super('OptionsScene');
  }

  init(data: Partial<OptionsData>): void {
    this.parent = data.parent ?? 'MenuScene';
  }

  create(): void {
    this.settings = loadSettings();
    this.sound.volume = this.settings.volume;

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const panel = new Panel(this, { width: 440, height: 400, title: 'Opções' });

    // Uma linha de volume: label à esquerda + slider. Cada mudança persiste e é
    // reaplicada pelo AudioManager, respeitando o contexto (menu/gameplay).
    const addVolume = (label: string, y: number, value: number, set: (s: Settings, v: number) => void): void => {
      this.add.text(cx - 180, y, label, {
        fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.soft,
      }).setOrigin(0, 0.5).setDepth(3001);
      new Slider(this, {
        x: cx - 60, y, width: 220, value,
        onChange: (v) => {
          set(this.settings, v);
          saveSettings(this.settings);
          audio.applySettings(this);
        },
      }).setDepth(3001);
    };

    addVolume('Volume', cy - 120, this.settings.volume, (s, v) => { s.volume = v; });
    addVolume('Música', cy - 74, this.settings.musicVolume, (s, v) => { s.musicVolume = v; });
    addVolume('Ambiente', cy - 28, this.settings.ambienceVolume, (s, v) => { s.ambienceVolume = v; });

    // Mostrar dicas
    const toggle = new Toggle(this, {
      x: cx - 180, y: cy + 24, label: 'Mostrar dicas na tela',
      value: this.settings.showTips,
      onChange: (v) => {
        this.settings.showTips = v;
        saveSettings(this.settings);
      },
    });
    toggle.setDepth(3001);

    new Button(this, {
      x: cx, y: cy + 120, width: 200, height: 44,
      label: 'Voltar [ESC]', variant: 'primary',
      onClick: () => this.close(),
    }).setDepth(3001);

    // Garante que o cartão do Panel fique atrás dos widgets acima.
    panel.setDepth(3000);

    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.parent);
  }
}
