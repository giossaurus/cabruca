import Phaser from 'phaser';
import { Farm, ITEM_CACAU_FRESCO, type IndicatorKey } from '../../domain';
import { TextureKey } from '../assets';
import { announce } from '../accessibility';
import {
  Button,
  FocusList,
  Panel,
  UI,
  exemplaryFarmer,
  keyLabel,
  loadProfile,
  masterTitle,
  prosperousTitle,
  type Settings,
} from '../ui';
import { PAD, activeDevice, activePadKind, buttonGlyph } from '../gamepad';
import { DEPTH } from '../depths';
import { INDICATOR_META } from './FarmHud';

/**
 * Modais da FarmScene (ADAPTER — Phaser): ajuda "Como jogar", banca de vendas e
 * tela de fim. A cena guarda os campos de estado e faz os toggles/guards; aqui
 * só mora a construção/render de cada overlay, incluindo os prompts adaptativos
 * ao dispositivo ativo (teclado × gamepad). Sem regra de jogo (ADR 0002).
 */

// ─── Ajuda "Como jogar" ──────────────────────────────────────────────────────

/** Corpo da página "Controles" quando o último input veio de um gamepad. */
function gamepadControlsBody(): string {
  const g = (b: number) => buttonGlyph(activePadKind(), b);
  return (
    'Analógico esquerdo / ✚ direcional: andar\n' +
    `${g(PAD.south)}: usar ferramenta, dormir na porta ou vender na banca\n` +
    `${g(PAD.lb)}/${g(PAD.rb)}: trocar a ferramenta da hotbar\n` +
    `${g(PAD.north)}: dormir  ·  ${g(PAD.west)}: vender  ·  ${g(PAD.lt)}: replantar/undo\n` +
    `${g(PAD.start)}: pausar  ·  ${g(PAD.select)}: esta ajuda  ·  ${g(PAD.east)}: fechar janelas\n` +
    'Teclado e mouse continuam funcionando em paralelo'
  );
}

/** Páginas do tutorial "Como jogar" (título + corpo), navegadas com setas. */
function helpPages(settings: Settings): { title: string; body: string }[] {
  const keys = settings.keyBindings;
  const keyboardBody =
    `${keyLabel(keys.moveUp)}${keyLabel(keys.moveLeft)}${keyLabel(keys.moveDown)}${keyLabel(keys.moveRight)} / setas: andar\n` +
    `${keyLabel(keys.interact)} / Espaço: usar ferramenta, dormir na porta ou vender na banca\n` +
    '1-6: escolher item na hotbar\n' +
    `${keyLabel(keys.replant)}: replantar/undo de nativa recém-plantada (custa 2 energia)\n` +
    `${keyLabel(keys.pause)} / ESC: pausar/fechar\n` +
    'Mouse: clique no chão para andar; clique nos botões e slots';
  return [
    {
      title: 'Controles',
      body: activeDevice() === 'gamepad' ? gamepadControlsBody() : keyboardBody,
    },
    {
      title: 'Lugares da fazenda',
      body:
        'Casa: fica ao norte e passa o dia — durma para recuperar energia.\n' +
        'Banca: abre o menu de venda de cacau.',
    },
    {
      title: 'Cacau e sombra',
      body:
        'Nativas maduras dão sombra aos 8 vizinhos.\n' +
        'Cacau: sombra 1 é ideal; sol pleno mata; mata fechada atrasa.\n' +
        'Podar troca biodiversidade por produtividade.',
    },
  ];
}

/** Rodapé de navegação da ajuda, adaptado ao último dispositivo usado. */
function helpNavigationHint(): string {
  if (activeDevice() !== 'gamepad') return 'Setas para navegar • clique fora ou ESC para fechar';
  const kind = activePadKind();
  return (
    `${buttonGlyph(kind, PAD.dpadLeft)}/${buttonGlyph(kind, PAD.dpadRight)}: navegar • ` +
    `${buttonGlyph(kind, PAD.east)} ou ${buttonGlyph(kind, PAD.start)}: fechar`
  );
}

export interface HelpOverlay {
  readonly container: Phaser.GameObjects.Container;
  /** Avança (+1) ou retrocede (-1) uma página do tutorial. */
  step(delta: number): void;
  /** Redesenha a página atual (ex.: ao trocar teclado↔gamepad). */
  rerender(): void;
  destroy(): void;
}

/**
 * Abre o tutorial "Como jogar" (páginas com setas). O `step` corrente vive aqui
 * dentro; a cena só congela o mundo e chama `step`/`rerender`/`destroy`.
 * `onClose` é disparado ao clicar fora (a cena decide fechar).
 */
export function openHelpOverlay(scene: Phaser.Scene, settings: Settings, onClose: () => void): HelpOverlay {
  let step = 0;
  const panelW = Math.min(560, scene.scale.width - 40);
  const panelH = Math.min(430, scene.scale.height - 48);
  const panel = new Panel(scene, { width: panelW, height: panelH, title: 'Como jogar' });
  const pages = helpPages(settings);

  const blocker = scene.add
    .rectangle(0, 0, scene.scale.width, scene.scale.height, 0xffffff, 0.001)
    .setInteractive();
  blocker.on('pointerdown', () => onClose()); // clicar fora fecha

  const subtitle = scene.add.text(0, -panelH / 2 + 74, '', {
    fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.accent,
  }).setOrigin(0.5);
  const body = scene.add.text(0, -6, '', {
    fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft,
    align: 'left', lineSpacing: 7, wordWrap: { width: panelW - 108 },
  }).setOrigin(0.5);
  const indicator = scene.add.text(0, panelH / 2 - 54, '', {
    fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.muted,
  }).setOrigin(0.5);
  const navHint = scene.add.text(0, panelH / 2 - 30, '', {
    fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.muted,
  }).setOrigin(0.5);

  const rerender = (): void => {
    const p = pages[step];
    if (!p) return;
    subtitle.setText(p.title);
    body.setText(p.body);
    indicator.setText(`${step + 1} / ${pages.length}`);
    navHint.setText(helpNavigationHint());
    prev.setEnabled(step > 0);
    next.setEnabled(step < pages.length - 1);
  };

  const doStep = (delta: number): void => {
    const target = Phaser.Math.Clamp(step + delta, 0, pages.length - 1);
    if (target === step) return;
    step = target;
    rerender();
  };

  const prev = new Button(scene, {
    x: -panelW / 2 + 30, y: 0, width: 40, height: 52, label: '◀',
    fontSize: UI.size.heading, onClick: () => doStep(-1),
  });
  const next = new Button(scene, {
    x: panelW / 2 - 30, y: 0, width: 40, height: 52, label: '▶',
    fontSize: UI.size.heading, onClick: () => doStep(1),
  });

  panel.addContent(blocker, subtitle, body, indicator, prev, next, navHint);
  panel.setScrollFactor(0);
  rerender();

  return {
    container: panel,
    step: doStep,
    rerender,
    destroy: () => panel.destroy(),
  };
}

// ─── Banca de vendas ─────────────────────────────────────────────────────────

/** Dica de navegação da banca, adaptada ao dispositivo ativo. */
function salesNavigationHint(): string {
  if (activeDevice() !== 'gamepad') return 'Use setas, Enter ou Espaço.';
  const kind = activePadKind();
  return (
    `${buttonGlyph(kind, PAD.dpadUp)}/${buttonGlyph(kind, PAD.dpadDown)} navega • ` +
    `${buttonGlyph(kind, PAD.south)} confirma • ${buttonGlyph(kind, PAD.east)} volta`
  );
}

export interface SalesOverlayOptions {
  readonly settings: Settings;
  /** Fechar sem vender (clicar fora, botão Fechar, ESC/voltar do pad). */
  readonly onClose: () => void;
  /** Vendeu `sold` unidades (a cena fecha o modal, redesenha e mostra o toast). */
  readonly onSold: (sold: number) => void;
}

export interface SalesOverlay {
  readonly container: Phaser.GameObjects.Container;
  destroy(): void;
}

/** Abre a banca de vendas de cacau. Navega por FocusList (autodestruído aqui). */
export function openSalesOverlay(scene: Phaser.Scene, farm: Farm, opts: SalesOverlayOptions): SalesOverlay {
  const { settings, onClose, onSold } = opts;
  const qty = farm.inventory.count(ITEM_CACAU_FRESCO);
  const panelW = Math.min(420, scene.scale.width - 40);
  const panel = new Panel(scene, { width: panelW, height: 300, title: 'Banca de vendas' });
  panel.setScrollFactor(0);

  const blocker = scene.add
    .rectangle(0, 0, scene.scale.width, scene.scale.height, 0xffffff, 0.001)
    .setInteractive();
  blocker.on('pointerdown', () => onClose());
  panel.addContent(blocker);

  panel.addContent(
    scene.add.image(-92, -36, TextureKey.IconCacao).setDisplaySize(48, 48),
    scene.add.text(-44, -46, 'Cacau fresco', {
      fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.primary,
    }).setOrigin(0, 0.5),
    scene.add.text(-44, -20, `Disponivel: x${qty}`, {
      fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft,
    }).setOrigin(0, 0.5),
    scene.add.text(0, 26, 'Cada unidade aumenta Economia e Comunidade.', {
      fontFamily: UI.font,
      fontSize: UI.size.small,
      color: UI.text.muted,
      align: 'center',
      wordWrap: { width: panelW - 64 },
    }).setOrigin(0.5),
  );

  const sellButton = new Button(scene, {
    x: 0, y: 84, width: 220, height: 44,
    label: 'Vender tudo',
    variant: 'primary',
    onClick: () => {
      const sold = farm.sell(ITEM_CACAU_FRESCO, farm.inventory.count(ITEM_CACAU_FRESCO));
      onSold(sold);
    },
  }).setEnabled(qty > 0);
  const closeButton = new Button(scene, {
    x: 0, y: 136, width: 180, height: 36,
    label: 'Fechar',
    fontSize: UI.size.body,
    onClick: () => onClose(),
  });
  panel.addContent(sellButton, closeButton);

  const focus = new FocusList(
    scene,
    [
      {
        label: qty > 0 ? 'Vender tudo' : 'Vender tudo indisponível',
        enabled: () => sellButton.enabled,
        onFocus: (v) => sellButton.setFocused(v),
        onActivate: () => sellButton.activate(),
      },
      { label: 'Fechar vendas', onFocus: (v) => closeButton.setFocused(v), onActivate: () => closeButton.activate() },
    ],
    (message) => announce(settings, message),
    0,
    () => onClose(),
  );
  announce(settings, `Banca de vendas aberta. ${salesNavigationHint()}`);

  return {
    container: panel,
    destroy: () => {
      focus.destroy();
      panel.destroy();
    },
  };
}

// ─── Tela de fim ─────────────────────────────────────────────────────────────

export interface EndOverlayOptions {
  readonly phase: 'vitoria' | 'vitoria_mestre' | 'derrota';
  readonly indicators: Record<IndicatorKey, number>;
  readonly settings: Settings;
  readonly onRestart: () => void;
}

/** Tela de fim de jogo — três finais (derrota, Próspero e Mestre). */
export function showEndOverlay(scene: Phaser.Scene, opts: EndOverlayOptions): Phaser.GameObjects.Container {
  const { phase, indicators, settings, onRestart } = opts;
  const w = scene.scale.width;
  const h = scene.scale.height;
  const pronoun = loadProfile().pronoun;
  let titleText: string;
  let subText: string;
  let titleColor: string;
  switch (phase) {
    case 'derrota':
      titleText = 'DERROTA';
      subText = 'Você fez o possível, mas sua fazenda não resistiu aos desafios.';
      titleColor = '#ff6a4d';
      break;
    case 'vitoria':
      titleText = prosperousTitle(pronoun).toUpperCase();
      subText =
        'Sua fazenda prosperou. Você garantiu uma boa produção e uma vida estável, ' +
        'mas ainda há potencial para ir além.';
      titleColor = '#7be08a';
      break;
    case 'vitoria_mestre':
      titleText = masterTitle(pronoun).toUpperCase();
      subText =
        `Você se tornou ${exemplaryFarmer(pronoun)}. Sua propriedade é referência ` +
        'em produtividade, inovação e sustentabilidade!';
      titleColor = '#ffd34a';
      break;
  }
  const bg = scene.add.rectangle(w / 2, h / 2, w, h, 0x05100a, 0.85);
  const title = scene.add.text(w / 2, h / 2 - 90, titleText, {
    fontFamily: 'monospace', fontSize: UI.size.title, color: titleColor,
  }).setOrigin(0.5);
  const sub = scene.add.text(w / 2, h / 2 - 34, subText, {
    fontFamily: 'monospace', fontSize: UI.size.body, color: '#cfe3cf',
    align: 'center', wordWrap: { width: Math.min(560, w - 64) },
  }).setOrigin(0.5);
  const stats = INDICATOR_META
    .map((m) => `${m.label}: ${Math.round(indicators[m.key])}`)
    .join('\n');
  const statsText = scene.add.text(w / 2, h / 2 + 6, stats, {
    fontFamily: 'monospace', fontSize: UI.size.small, color: '#a9c9ac', align: 'center', lineSpacing: 4,
  }).setOrigin(0.5);
  const btn = scene.add.text(w / 2, h / 2 + 70, '  Reiniciar [R]  ', {
    fontFamily: 'monospace', fontSize: '20px', color: '#0d1f13', backgroundColor: '#7bd06a',
  }).setOrigin(0.5).setPadding(8).setInteractive({ useHandCursor: true });
  btn.on('pointerdown', () => onRestart());
  const container = scene.add.container(0, 0, [bg, title, sub, statsText, btn]).setDepth(DEPTH.end).setScrollFactor(0);
  announce(settings, `${titleText}. ${subText}. Pressione R para reiniciar.`);
  return container;
}
