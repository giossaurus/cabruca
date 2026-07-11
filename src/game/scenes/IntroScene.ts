import Phaser from 'phaser';
import { applyAccessibilitySettings, announce } from '../accessibility';
import { TextureKey } from '../assets';
import {
  Button,
  Panel,
  TextInput,
  UI,
  loadProfile,
  loadSettings,
  masterTitle,
  prosperousTitle,
  saveProfile,
  type Pronoun,
} from '../ui';
import { drawMenuBackground } from './menuBackground';
import * as audio from '../audio';
import { DEPTH } from '../depths';

const PRONOUNS: ReadonlyArray<{ id: Pronoun; label: string }> = [
  { id: 'ele', label: 'Ele' },
  { id: 'ela', label: 'Ela' },
  { id: 'elu', label: 'Elu' },
];

/**
 * Intro entre o menu e o jogo: sobre o MESMO fundo do menu, pergunta apelido +
 * pronome e entrega a carta do programa +CABRUCA (papel `paper-panel`),
 * personalizada. Confirmar a carta inicia a `FarmScene`.
 */
export class IntroScene extends Phaser.Scene {
  private pronoun: Pronoun = 'elu';
  private nameInput!: TextInput;
  private continueBtn!: Button;
  private card!: Panel;
  private chips: Array<{ id: Pronoun; bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = [];
  private pronounHandler: ((e: KeyboardEvent) => void) | undefined;

  constructor() {
    super('IntroScene');
  }

  create(): void {
    const settings = loadSettings();
    applyAccessibilitySettings(settings);
    audio.enterMenu(this);
    drawMenuBackground(this);

    // Pré-preenche com a última identidade usada (apelido some, pronome fica).
    const saved = loadProfile();
    this.pronoun = saved.pronoun;
    this.chips = [];

    announce(settings, 'Antes de começar, digite como quer ser chamade e escolha seu pronome. Use as setas para o pronome e Enter para continuar.');
    this.buildIdentityCard();
  }

  private buildIdentityCard(): void {
    const panelW = 540;
    const panelH = 400;
    this.card = new Panel(this, { width: panelW, height: panelH, title: 'Antes de começar…' });

    const label = (y: number, text: string): Phaser.GameObjects.Text =>
      this.add.text(0, y, text, {
        fontFamily: UI.font,
        fontSize: UI.size.body,
        color: UI.text.soft,
      }).setOrigin(0.5);

    this.nameInput = new TextInput(this, {
      x: 0,
      y: -56,
      width: 380,
      maxLength: 16,
      placeholder: 'Seu apelido…',
      onChange: (v) => this.continueBtn.setEnabled(v.trim().length > 0),
      onSubmit: () => this.tryContinue(),
    });

    this.continueBtn = new Button(this, {
      x: 0,
      y: 128,
      width: 220,
      height: 48,
      label: 'Continuar',
      variant: 'primary',
      onClick: () => this.tryContinue(),
    }).setEnabled(false);

    this.card.addContent(
      label(-100, 'Como você quer ser chamade?'),
      this.nameInput,
      label(4, 'Qual seu pronome?'),
      ...this.buildPronounChips(48),
      this.continueBtn,
    );

    this.bindPronounKeys();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unbindPronounKeys());
  }

  /** Chips de pronome (Ele/Ela/Elu) — seleção mútua, clicáveis, coords do cartão. */
  private buildPronounChips(y: number): Phaser.GameObjects.GameObject[] {
    const chipW = 100;
    const chipH = 40;
    const gap = 12;
    const step = chipW + gap;
    const objs: Phaser.GameObjects.GameObject[] = [];
    PRONOUNS.forEach((p, i) => {
      const cx = (i - 1) * step; // centraliza os 3 em torno de 0
      const bg = this.add.rectangle(cx, y, chipW, chipH, UI.color.panel).setStrokeStyle(2, UI.color.stroke);
      const text = this.add.text(cx, y, p.label, {
        fontFamily: UI.font,
        fontSize: UI.size.button,
        color: UI.text.primary,
      }).setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.selectPronoun(p.id));
      this.chips.push({ id: p.id, bg, text });
      objs.push(bg, text);
    });
    this.paintPronouns();
    return objs;
  }

  private selectPronoun(id: Pronoun): void {
    this.pronoun = id;
    this.paintPronouns();
    announce(loadSettings(), `Pronome ${id} selecionado.`);
  }

  private paintPronouns(): void {
    for (const chip of this.chips) {
      const selected = chip.id === this.pronoun;
      chip.bg.setFillStyle(selected ? UI.color.primary : UI.color.panel);
      chip.bg.setStrokeStyle(selected ? 3 : 2, selected ? UI.color.primaryHover : UI.color.stroke);
      chip.text.setColor(selected ? UI.text.onPrimary : UI.text.primary);
    }
  }

  /** Setas ←/→ ciclam o pronome (o TextInput ignora setas de propósito). */
  private bindPronounKeys(): void {
    if (typeof document === 'undefined') return;
    this.pronounHandler = (e: KeyboardEvent) => {
      if (!this.scene.isActive('IntroScene')) return;
      const dir = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0;
      if (dir === 0) return;
      e.preventDefault();
      const idx = PRONOUNS.findIndex((p) => p.id === this.pronoun);
      const next = PRONOUNS[Phaser.Math.Wrap(idx + dir, 0, PRONOUNS.length)];
      if (next) this.selectPronoun(next.id);
    };
    document.addEventListener('keydown', this.pronounHandler, true);
  }

  private unbindPronounKeys(): void {
    if (this.pronounHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.pronounHandler, true);
    }
    this.pronounHandler = undefined;
  }

  private tryContinue(): void {
    const nickname = this.nameInput.getValue().trim();
    if (nickname.length === 0) return;
    saveProfile({ nickname, pronoun: this.pronoun });
    this.unbindPronounKeys();
    this.card.destroy();
    this.chips = [];
    this.showLetter(nickname, this.pronoun);
  }

  private showLetter(nickname: string, pronoun: Pronoun): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const layer = this.add.container(0, 0).setDepth(DEPTH.modal);

    const overlay = this.add
      .rectangle(cx, cy, this.scale.width, this.scale.height, UI.color.overlay, 0.8)
      .setInteractive();
    layer.add(overlay);

    const paperW = 640;
    const paperH = 560; // mais alta que a carta original: lista os 3 destinos
    // NineSlice: cantos de madeira (~34px) preservados; centro de pergaminho estica.
    const paper = this.add.nineslice(cx, cy, TextureKey.PaperPanel, undefined, paperW, paperH, 34, 34, 34, 34);
    layer.add(paper);

    const title = this.add.text(cx, cy - paperH / 2 + 64, '+CABRUCA', {
      fontFamily: '"RoadPixel", monospace',
      fontSize: '40px',
      color: '#5a3212',
    }).setOrigin(0.5);
    layer.add(title);

    const body =
      `Parabéns, ${nickname}! Sua propriedade foi inscrita no programa +CABRUCA, ` +
      'uma iniciativa que apoia propriedades com potencial para unir produção de cacau, ' +
      'conservação da floresta e desenvolvimento para a comunidade.\n\n' +
      'Você tem 12 dias para cuidar da sua terra, use-a com sabedoria! ' +
      'Fortaleça a floresta, produza um cacau de qualidade e mantenha o equilíbrio.\n\n' +
      'Ao fim do programa, sua história terá um de três destinos:\n' +
      '• Derrota — a fazenda não resiste aos desafios;\n' +
      `• ${prosperousTitle(pronoun)} — boa produção e uma vida estável;\n` +
      `• ${masterTitle(pronoun)} — 100% do potencial: referência em produtividade, ` +
      'inovação e sustentabilidade!';

    const text = this.add.text(cx, cy - paperH / 2 + 104, body, {
      fontFamily: UI.font,
      fontSize: UI.size.body,
      color: '#3a2418',
      align: 'left',
      lineSpacing: 6,
      wordWrap: { width: paperW - 150 },
    }).setOrigin(0.5, 0);
    layer.add(text);

    const start = new Button(this, {
      x: cx,
      y: cy + paperH / 2 - 44,
      width: 200,
      height: 48,
      label: 'Começar',
      variant: 'primary',
      onClick: () => this.scene.start('FarmScene'),
    });
    layer.add(start);

    announce(loadSettings(), `Carta do programa mais CABRUCA. ${body} Pressione Começar para iniciar.`);
  }
}
