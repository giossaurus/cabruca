import Phaser from 'phaser';
import { announce } from '../accessibility';
import { Button, Panel, UI, focusButtons, loadSettings } from '../ui';

/** Créditos de equipe e atribuição dos assets externos usados no projeto. */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  create(): void {
    announce(loadSettings(), 'Créditos. Botão Voltar.');

    const credits =
      'Código e jogo\n' +
      'Fabrine Vitoria · Maria Clara Barros · Giovanni Della Dea\n\n' +
      'Assets visuais\n' +
      'Farm Life Pixel Art Pack – Animated Asset Pack, por sophi-x-x (itch.io)\n' +
      'Forest Ground Details Pack, por MutterPixel Studio (itch.io)\n' +
      'Adopt Goldie for Free, por Ellie. B (itch.io)\n\n' +
      'Ícones e elementos de UI\n' +
      'Phaser PixUI, por skhoroshavin (itch.io)\n' +
      'skhoroshavin.itch.io/phaser-pixui\n' +
      'Paper Themed GUI Pack, por CurlyBug Games (itch.io)\n' +
      'curlybuggames.itch.io/paper-themed-gui-pack\n\n' +
      'Músicas e som ambiente\n' +
      '"1 hour of comfy & relaxing songs | royalty free vlog music", por Stream Cafe\n' +
      'youtube.com/watch?v=4CmzL-cv-MI\n\n' +
      '"Free Nature Sounds - Nature Sounds Forest Birds (Free To Use Vlog Sound Effects)", por BurghRecords\n' +
      'youtube.com/watch?v=TQvXEza4fPc\n\n' +
      'Desenvolvido para o Game Jam da Scienza Studio.';

    // Ancorado pelo topo e medido em runtime: o botão é posicionado logo abaixo
    // da altura real do texto e o painel é dimensionado a partir dela, então nada
    // fica escondido, independente de quantas linhas de crédito existirem.
    const text = this.add.text(0, 0, credits, {
      fontFamily: UI.font,
      fontSize: UI.size.small,
      color: UI.text.soft,
      align: 'left',
      lineSpacing: 6,
      wordWrap: { width: 620 },
    }).setOrigin(0.5, 0);

    const topPad = 64; // espaço abaixo do título até o início do texto
    const gap = 26; // folga entre o texto e o botão
    const btnH = 42;
    const bottomPad = 30;
    const panelH = topPad + text.height + gap + btnH + bottomPad;

    const panel = new Panel(this, { width: 700, height: panelH, title: 'Créditos' });
    panel.setScrollFactor(0);

    const textTopY = -panelH / 2 + topPad;
    text.setPosition(0, textTopY);
    panel.addContent(text);

    const back = new Button(this, {
      x: 0,
      y: textTopY + text.height + gap + btnH / 2,
      width: 220,
      height: btnH,
      label: 'Voltar [ESC]',
      variant: 'primary',
      onClick: () => this.close(),
    });
    panel.addContent(back);

    focusButtons(this, [
      { button: back, label: 'Voltar' },
    ], (message) => announce(loadSettings(), message), 0, () => this.close());

    this.input.keyboard?.once('keydown-ESC', () => this.close());
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('MenuScene');
  }
}
