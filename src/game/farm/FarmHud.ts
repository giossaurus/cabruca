import Phaser from 'phaser';
import type { Farm, IndicatorKey } from '../../domain';
import { announce } from '../accessibility';
import { Button, StatBar, UI, type Settings } from '../ui';
import { DEPTH } from '../depths';

/** Metadados de exibição dos 3 indicadores (rótulo e cor das barras). */
export const INDICATOR_META: ReadonlyArray<{ key: IndicatorKey; label: string; color: number }> = [
  { key: 'biodiversidade', label: 'Biodiversidade', color: UI.color.biodiversidade },
  { key: 'economia', label: 'Economia', color: UI.color.economia },
  { key: 'comunidade', label: 'Comunidade', color: UI.color.comunidade },
];

export interface FarmHudOptions {
  /** Settings sempre atuais (a cena recarrega no RESUME; ler sob demanda). */
  getSettings(): Settings;
  /** Y (tela) do hint de interação; o toast fica 34px acima. */
  hintY: number;
  /** Clique no botão "?" (a cena decide abrir/fechar a ajuda). */
  onHelp(): void;
}

/**
 * HUD da fazenda: status bar integrada no topo (dia · energia · indicadores),
 * botão "?" de ajuda, hint de interação e toast. O acoplamento hint↔toast
 * (toast esconde o hint e o reapresenta ao fim do tween) é interno daqui.
 */
export class FarmHud {
  /** Faixa do topo em coordenadas de TELA (para oclusão com o jogador). */
  readonly topBarRect: Phaser.Geom.Rectangle;

  private readonly topLayer: Phaser.GameObjects.Container;
  private readonly dayText: Phaser.GameObjects.Text;
  private readonly energyBar: StatBar;
  private readonly indicatorBars = new Map<IndicatorKey, StatBar>();
  private readonly interactionHint: Phaser.GameObjects.Text;
  private readonly toastText: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene, private readonly opts: FarmHudOptions) {
    // Status bar INTEGRADA: faixa translúcida no topo, sobre o mundo (não é um
    // painel lateral). Uma linha: dia · energia · três indicadores compactos.
    const hud = scene.add.container(0, 0).setDepth(DEPTH.hud).setScrollFactor(0);
    this.topLayer = hud;
    this.topBarRect = new Phaser.Geom.Rectangle(0, 0, scene.scale.width, 38);
    hud.add(scene.add.rectangle(0, 0, scene.scale.width, 38, UI.color.overlay, 0.62).setOrigin(0, 0));

    this.dayText = scene.add
      .text(14, 19, '', { fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.primary })
      .setOrigin(0, 0.5);
    hud.add(this.dayText);

    this.energyBar = new StatBar(scene, { x: 132, y: 13, width: 96, height: 12, color: UI.color.energy, caption: 'Energia' });
    hud.add(this.energyBar);

    const short: Record<IndicatorKey, string> = { biodiversidade: 'Bio', economia: 'Eco', comunidade: 'Com' };
    let x = 330;
    for (const meta of INDICATOR_META) {
      const bar = new StatBar(scene, { x, y: 13, width: 72, height: 12, color: meta.color, caption: short[meta.key] });
      hud.add(bar);
      this.indicatorBars.set(meta.key, bar);
      x += 128;
    }

    // Botão compacto "?" no topo-direita que abre a ajuda como modal sob demanda
    // (em vez de um bloco de texto fixo ocupando a tela).
    new Button(scene, {
      x: scene.scale.width - 26, y: 19, width: 30, height: 26,
      label: '?', fontSize: UI.size.body,
      onClick: () => this.opts.onHelp(),
    }).setDepth(DEPTH.help).setScrollFactor(0);

    const y = opts.hintY;
    this.interactionHint = scene.add.text(scene.scale.width / 2, y, '', {
      fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.primary,
      backgroundColor: '#05100a',
    }).setOrigin(0.5).setPadding(8, 4, 8, 4).setScrollFactor(0).setDepth(DEPTH.help).setVisible(false);
    this.toastText = scene.add.text(scene.scale.width / 2, y - 34, '', {
      fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft,
      backgroundColor: '#05100a',
      wordWrap: { width: Math.min(520, scene.scale.width - 48) },
      align: 'center',
    }).setOrigin(0.5).setPadding(8, 4, 8, 4).setScrollFactor(0).setDepth(DEPTH.help).setAlpha(0);
  }

  /** Redesenha a status bar a partir do snapshot do domínio. */
  updateStats(s: ReturnType<Farm['snapshot']>): void {
    this.dayText.setText(`Dia ${Math.min(s.day, s.totalDays)} / ${s.totalDays}`);
    this.energyBar.set(s.energy / s.maxEnergy, `${s.energy}/${s.maxEnergy}`);
    for (const meta of INDICATOR_META) {
      const v = s.indicators[meta.key];
      this.indicatorBars.get(meta.key)!.set(v / 100, String(Math.round(v)));
    }
  }

  /** Hint de interação contextual (vazio esconde); toast ativo tem prioridade. */
  setHint(text: string): void {
    this.interactionHint.setText(text);
    this.interactionHint.setVisible(text.length > 0 && this.toastText.alpha <= 0.01);
  }

  showToast(message: string): void {
    announce(this.opts.getSettings(), message);
    this.interactionHint.setVisible(false);
    this.toastText.setText(message).setAlpha(1);
    this.scene.tweens.killTweensOf(this.toastText);
    this.scene.tweens.add({
      targets: this.toastText,
      alpha: 0,
      duration: 350,
      delay: 1500,
      onComplete: () => this.setHint(this.interactionHint.text),
    });
  }

  /** Semitransparência quando o jogador anda por trás da faixa do topo. */
  setTopAlpha(a: number): void {
    this.topLayer.setAlpha(a);
  }
}
