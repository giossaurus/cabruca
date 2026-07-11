import Phaser from 'phaser';
import { announce } from '../accessibility';
import { Button, FocusList, Panel, UI, loadSettings } from '../ui';

/** Créditos de equipe e atribuição dos assets externos usados no projeto. */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  create(): void {
    const panel = new Panel(this, { width: 700, height: 520, title: 'Créditos' });
    panel.setScrollFactor(0);
    announce(loadSettings(), 'Créditos. Botão Voltar.');

    const credits =
      'Código e jogo\n' +
      'Fabrine Vitoria · Maria Clara Barros · Giovanni Della Dea\n\n' +
      'Assets visuais\n' +
      'Farm Life Pixel Art Pack – Animated Asset Pack, por sophi-x-x (itch.io)\n\n' +
      'Ícones e elementos de UI\n' +
      'Phaser PixUI, por skhoroshavin (itch.io)\n' +
      'skhoroshavin.itch.io/phaser-pixui\n\n' +
      'Músicas e som ambiente\n' +
      '"1 hour of comfy & relaxing songs | royalty free vlog music", por Stream Cafe\n' +
      'youtube.com/watch?v=4CmzL-cv-MI\n\n' +
      '"Free Nature Sounds - Nature Sounds Forest Birds (Free To Use Vlog Sound Effects)", por BurghRecords\n' +
      'youtube.com/watch?v=TQvXEza4fPc\n\n' +
      'Desenvolvido para o Game Jam da Scienza Studio.';

    panel.addContent(
      this.add.text(0, -6, credits, {
        fontFamily: UI.font,
        fontSize: UI.size.small,
        color: UI.text.soft,
        align: 'left',
        lineSpacing: 7,
        wordWrap: { width: 620 },
      }).setOrigin(0.5),
    );

    const back = new Button(this, {
      x: 0,
      y: 218,
      width: 220,
      height: 42,
      label: 'Voltar [ESC]',
      variant: 'primary',
      onClick: () => this.close(),
    });
    panel.addContent(back);

    new FocusList(this, [
      { label: 'Voltar', onFocus: (v) => back.setFocused(v), onActivate: () => back.activate() },
    ], (message) => announce(loadSettings(), message));

    this.input.keyboard?.once('keydown-ESC', () => this.close());
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('MenuScene');
  }
}
