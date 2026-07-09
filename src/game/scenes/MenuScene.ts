import Phaser from 'phaser';
import { Button, UI } from '../ui';
import * as audio from '../audio';

/**
 * Menu inicial. Título + botão "Jogar" + ajuda de controles, montado com os
 * widgets nativos de `src/game/ui`.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Música do menu (sem duck) + para o ambiente; também aplica os volumes salvos
    // ao mixer. O navegador só libera o áudio no 1º gesto (clique/tecla do menu).
    audio.enterMenu(this);

    this.add.rectangle(w / 2, h / 2, w, h, UI.color.bgMenu);

    this.add.text(w / 2, h / 2 - 150, 'CABRUCA', {
      fontFamily: UI.font, fontSize: UI.size.title, color: UI.text.primary,
    }).setOrigin(0.5);
    this.add.text(w / 2, h / 2 - 100, 'Game Jam "Aqui é BR" — cozy farming na Mata Atlântica', {
      fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.secondary,
    }).setOrigin(0.5);

    new Button(this, {
      x: w / 2, y: h / 2 - 20, width: 220, height: 52,
      label: 'Jogar', variant: 'primary', fontSize: '28px',
      onClick: () => this.start(),
    });

    new Button(this, {
      x: w / 2, y: h / 2 + 44, width: 220, height: 42,
      label: 'Opções',
      onClick: () => {
        this.scene.pause();
        this.scene.launch('OptionsScene', { parent: 'MenuScene' });
      },
    });

    this.add.text(w / 2, h / 2 + 92,
      'Mover: WASD / setas    Usar ferramenta: E / Espaço\n' +
      'Ferramenta: 1 Nativa · 2 Cacau · 3 Colher    Dormir: Z    Vender: V\n' +
      'Inventário: I    Pausar: ESC',
      { fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.help, align: 'center', lineSpacing: 6 },
    ).setOrigin(0.5);

    this.add.text(w / 2, h - 40, 'Enter / Espaço / clique para começar', {
      fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft,
    }).setOrigin(0.5);

    const kb = this.input.keyboard;
    kb?.once('keydown-ENTER', () => this.start());
    kb?.once('keydown-SPACE', () => this.start());
  }

  private start(): void {
    this.scene.start('FarmScene');
  }
}
