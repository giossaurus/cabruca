import Phaser from 'phaser';
import { Farm, ITEM_CACAU_FRESCO, type IndicatorKey } from '../../domain';
import { TILE, TextureKey, cacaoTextureKey } from '../assets';
import { Player } from '../Player';
import { Dog } from '../Dog';
import { FOREST_FLAT_KEYS, FOREST_PROP_KEYS } from '../forest';
import { GRID_DEBUG } from '../debug';
import { applyAccessibilitySettings, announce } from '../accessibility';
import { UI, StatBar, Panel, Button, FocusList, exemplaryFarmer, keyLabel, loadProfile, loadSettings, masterTitle, normalizeKeyCode, phaserKeyName, prosperousTitle, type Settings } from '../ui';
import { clearSave, loadFarm, writeSave } from '../save';
import { DEPTH } from '../depths';
import {
  GRID_OX, GRID_OY, WORLD_H, WORLD_W,
  footRect, treeTrunkRect, type PlotRect,
} from '../world/geometry';
import { FogOfWar, buildFarmWorld } from '../world/buildFarmWorld';
import { Hotbar, type Tool } from '../farm/Hotbar';
import * as audio from '../audio';

/** Intervalo do autosave periódico (rede de segurança além do save ao dormir). */
const AUTOSAVE_MS = 60_000;

/**
 * Cena principal (ADAPTER — Phaser). Guarda uma instância de `Farm` (o domínio),
 * traduz input em ações e redesenha a partir de `farm.snapshot()`.
 * NENHUMA regra de jogo mora aqui (ADR 0002).
 *
 * Interação cozy: o jogador ANDA pela fazenda (WASD/setas) e age no tile onde
 * pisa (E/Espaço) ou interage com locais físicos (casa/banca). Ferramentas
 * ficam numa hotbar inferior; a status bar (dia, energia, indicadores) é uma
 * faixa integrada no topo, sobre o mundo; o cacau colhido aparece como contador
 * no próprio slot Cacau da hotbar.
 */

const INDICATOR_META: ReadonlyArray<{ key: IndicatorKey; label: string; color: number }> = [
  { key: 'biodiversidade', label: 'Biodiversidade', color: UI.color.biodiversidade },
  { key: 'economia', label: 'Economia', color: UI.color.economia },
  { key: 'comunidade', label: 'Comunidade', color: UI.color.comunidade },
];

interface MoveKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export class FarmScene extends Phaser.Scene {
  private farm!: Farm;
  private plot!: PlotRect;
  private settings!: Settings;
  private tool: Tool = 'tree';
  private player!: Player;
  private dog!: Dog;
  private moveKeys: MoveKeys[] = [];
  private mouseTarget: Phaser.Math.Vector2 | undefined;

  private plantLayer!: Phaser.GameObjects.Container;
  /** Nativas (mudas/maduras) renderizadas fora do plantLayer para ordenar por Y
   * com o jogador. Recriadas a cada redraw; guardadas aqui p/ limpeza. */
  private treeSprites: Phaser.GameObjects.Image[] = [];
  private shadeGfx!: Phaser.GameObjects.Graphics;
  private markerGfx!: Phaser.GameObjects.Graphics;

  private fog!: FogOfWar;
  private obstacles: Phaser.Geom.Rectangle[] = [];
  private doorZone!: Phaser.Geom.Rectangle;
  private saleZone!: Phaser.Geom.Rectangle;
  private transitioning = false;

  private dayText!: Phaser.GameObjects.Text;
  private energyBar!: StatBar;
  private indicatorBars!: Map<IndicatorKey, StatBar>;
  private hudLayer!: Phaser.GameObjects.Container;
  private hotbar!: Hotbar;
  private endOverlay: Phaser.GameObjects.Container | undefined;
  private helpOverlay: Phaser.GameObjects.Container | undefined;
  private helpStep = 0;
  private renderHelpStep: (() => void) | undefined;
  private saleOverlay: Phaser.GameObjects.Container | undefined;
  private saleFocus: FocusList | undefined;
  private interactionHint!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;

  constructor() {
    super('FarmScene');
  }

  create(data?: { load?: boolean }): void {
    // `load` (vindo do "Carregar jogo" do menu) tenta restaurar o save; se ele
    // for inválido/ausente, cai para uma partida nova sem quebrar o fluxo.
    const restored = data?.load ? loadFarm() : null;
    this.farm = restored ?? new Farm();
    this.settings = loadSettings();
    applyAccessibilitySettings(this.settings);
    this.tool = 'tree';
    this.indicatorBars = new Map();
    this.endOverlay = undefined;
    this.helpOverlay = undefined;
    this.helpStep = 0;
    this.renderHelpStep = undefined;
    this.saleOverlay = undefined;
    this.saleFocus?.destroy();
    this.saleFocus = undefined;
    this.obstacles = [];
    this.transitioning = false;

    // Trilhas: música (com duck) + ambiente natural. Ao sair do gameplay (voltar
    // ao menu ou reiniciar via PauseScene) paramos o ambiente; a música segue.
    audio.enterGame(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopAmbience());

    // Autosave: grava já o estado inicial (assim o slot reflete SEMPRE a sessão
    // atual, mesmo numa partida nova) e repete por timer como rede de segurança.
    // O save principal acontece ao dormir (ver enterHouse). O timer é destruído
    // automaticamente no shutdown/restart da cena.
    this.autosave();
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: () => this.autosave() });

    // Câmera segue o jogador dentro dos limites do mundo.
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.plot = { ox: GRID_OX, oy: GRID_OY, cols: this.farm.grid.width, rows: this.farm.grid.height };

    const farmWorld = buildFarmWorld(this, this.plot);
    this.obstacles = farmWorld.obstacles;
    this.doorZone = farmWorld.doorZone;
    this.saleZone = farmWorld.saleZone;
    this.shadeGfx = this.add.graphics().setDepth(-10);
    this.plantLayer = this.add.container(0, 0).setDepth(0);
    this.markerGfx = this.add.graphics().setDepth(1);

    // Jogador anda por TODO o mundo; interage só quando pisa no talhão.
    const world = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
    this.player = new Player(this, this.farm, this.plot, world, this.obstacles);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    // Cão de estimação: brinca pelo cenário e segue o dono (pura ambientação).
    this.dog = new Dog(this, world, this.plot, this.player.worldX + 74, this.player.worldY + 34);

    this.fog = new FogOfWar(this);
    this.fog.revealPlotStart(this.plot);
    this.buildHud();
    this.buildHelpButton();
    this.buildInteractionText();
    this.hotbar = new Hotbar(this, {
      isUiLocked: () => Boolean(this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning),
      onToolSelected: (t) => this.setTool(t),
      onSleep: () => this.doSleep(),
      onSell: () => this.doSell(),
    });
    this.bindInput();
    this.redraw();
    announce(this.settings, 'Jogo iniciado. Use as teclas configuradas, setas como fallback, ou clique no chão para mover.');

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.settings = loadSettings();
      applyAccessibilitySettings(this.settings);
      this.rebuildMoveKeys();
    });
    // A ajuda "Como jogar" não abre mais sozinha — a carta de intro (IntroScene)
    // faz a apresentação. O modal segue disponível pelo botão "?".
  }

  override update(_time: number, deltaMs: number): void {
    // Congela em overlays e durante a transição de dia (entrar na casa).
    if (this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning) return;
    this.player.update(deltaMs, this.readDir(), this.moveSpeedScale());
    this.dog.update(deltaMs, this.player.worldX, this.player.worldY);
    this.fog.reveal(this.player.worldX, this.player.worldY);
    this.updateInteractionText();
    this.drawMarker();
    this.fadeBarsUnderPlayer();
  }

  /**
   * As barras de UI (topo e hotbar) ficam fixas à câmera com depth acima do
   * jogador, então o escondem quando ele anda nas bordas da tela. Em vez de
   * mudar a ordem de desenho, deixamos a barra sobreposta semitransparente para
   * o personagem aparecer por baixo.
   */
  private fadeBarsUnderPlayer(): void {
    const cam = this.cameras.main;
    const b = this.player.sprite.getBounds();
    // Bounds do jogador em coordenadas de TELA (sem zoom/rotação na câmera).
    const screen = new Phaser.Geom.Rectangle(b.x - cam.scrollX, b.y - cam.scrollY, b.width, b.height);
    const hudRect = new Phaser.Geom.Rectangle(0, 0, this.scale.width, 38);
    this.hudLayer.setAlpha(Phaser.Geom.Rectangle.Overlaps(screen, hudRect) ? 0.5 : 1);
    this.hotbar.setAlpha(Phaser.Geom.Rectangle.Overlaps(screen, this.hotbar.bounds) ? 0.5 : 1);
  }

  // ─── Locais interativos ────────────────────────────────────────────────────

  private nearDoor(): boolean {
    return this.doorZone.contains(this.player.worldX, this.player.worldY);
  }

  private nearMarket(): boolean {
    return this.saleZone.contains(this.player.worldX, this.player.worldY);
  }

  private updateInteractionText(): void {
    let text = '';
    if (this.nearDoor()) text = 'E / Espaço: dormir na casa';
    else if (this.nearMarket()) text = 'E / V: abrir vendas';
    else if (this.player.onPlot) text = this.tileActionHint();
    this.interactionHint.setText(text);
    this.interactionHint.setVisible(text.length > 0 && this.toastText.alpha <= 0.01);
  }

  private tileActionHint(): string {
    const tile = this.currentTileView();
    if (!tile) return '';
    if (tile.cacao?.harvestable) return this.tool === 'harvest' ? 'E: colher cacau maduro' : '3: selecionar colheita';
    if (tile.cacao?.dead) return 'Cacau morto: plante outro tile';
    if (tile.cacao) return `Cacau ${tile.cacao.stage}: durma para crescer`;
    if (this.tool === 'tree') {
      const target = this.treeTargetTileView();
      if (!target) return 'Olhe para um tile do talhão para plantar';
      return target.kind === 'empty' ? 'E: plantar nativa à frente' : 'Tile à frente ocupado';
    }
    if (this.tool === 'cacao') {
      if (tile.kind !== 'empty') return 'Tile ocupado';
      if (tile.shadeStatus === 'ideal') return 'E: plantar cacau (sombra ideal)';
      if (tile.shadeStatus === 'sol_pleno') return 'E: plantar cacau (sol pleno: arriscado)';
      return 'E: plantar cacau (mata fechada: cresce lento)';
    }
    if (this.tool === 'harvest') {
      return 'Sem cacau para colher';
    }
    if (this.tool === 'prune') {
      if (tile.kind === 'tree' && tile.matureTree && !tile.pruned) return 'E: podar nativa madura';
      if (tile.kind === 'tree' && tile.pruned) return 'Nativa ja podada';
      return 'Sem nativa madura para podar';
    }
    return '';
  }

  private currentTileView(): ReturnType<Farm['snapshot']>['tiles'][number] | undefined {
    if (!this.player.onPlot) return undefined;
    const c = this.player.tileCoord;
    return this.tileViewAt(c);
  }

  private tileViewAt(c: { x: number; y: number }): ReturnType<Farm['snapshot']>['tiles'][number] | undefined {
    return this.farm.snapshot().tiles.find((t) => t.x === c.x && t.y === c.y);
  }

  private sameCoord(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    return a.x === b.x && a.y === b.y;
  }

  private treeTargetCoord(): { x: number; y: number } | undefined {
    if (!this.player.onPlot) return undefined;
    const c = this.player.tileCoord;
    const d = this.player.lookDir;
    const target = { x: c.x + d.x, y: c.y + d.y };
    if (target.x < 0 || target.y < 0 || target.x >= this.farm.grid.width || target.y >= this.farm.grid.height) {
      return undefined;
    }
    return target;
  }

  private treeTargetTileView(): ReturnType<Farm['snapshot']>['tiles'][number] | undefined {
    const c = this.treeTargetCoord();
    if (!c) return undefined;
    return this.farm.snapshot().tiles.find((t) => t.x === c.x && t.y === c.y);
  }

  /** Entrar na casa = dormir: tela noturna opaca, avanço de dia e amanhecer. */
  private enterHouse(): void {
    if (this.transitioning || this.endOverlay) return;
    this.transitioning = true;
    const w = this.scale.width;
    const h = this.scale.height;
    const overlay = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.transition);
    const background = this.add.image(w / 2, h / 2, TextureKey.SleepBackgroundStarry);
    const scale = Math.max(w / background.width, h / background.height) * 1.03;
    background.setScale(scale);
    const nightTint = this.add.rectangle(w / 2, h / 2, w, h, 0x07120d, 0.18);
    const msg = this.add.text(w / 2, h / 2 + 116, 'Boa noite...', {
      fontFamily: UI.font,
      fontSize: UI.size.heading,
      color: '#fff7df',
    }).setOrigin(0.5).setAlpha(0).setShadow(2, 3, '#132319', 0, true, true);
    overlay.add([background, nightTint, msg]);

    this.tweens.add({
      targets: background,
      x: background.x + 7,
      duration: 2600,
      ease: 'Sine.inOut',
    });
    this.tweens.add({ targets: msg, alpha: 1, duration: 320, ease: 'Sine.inOut' });

    this.time.delayedCall(700, () => {
      msg.setText('Descansando...');
      this.farm.sleep();
      this.redraw();
      this.autosave(); // checkpoint natural de fim de dia
      // Sai pela porta: reposiciona logo abaixo dela p/ não reentrar em loop.
      this.player.moveTo(this.doorZone.centerX, this.doorZone.bottom + 30);
    });

    this.time.delayedCall(1750, () => {
      msg.setText('Amanhecendo...');
      this.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 650,
        ease: 'Sine.inOut',
        onComplete: () => {
          this.tweens.killTweensOf(background);
          overlay.destroy();
          this.transitioning = false;
        },
      });
    });
  }

  /**
   * Status bar INTEGRADA: faixa translúcida no topo, sobre o mundo (não é um
   * painel lateral). Uma linha: dia · energia · três indicadores compactos.
   */
  private buildHud(): void {
    const hud = this.add.container(0, 0).setDepth(DEPTH.hud).setScrollFactor(0);
    this.hudLayer = hud;
    hud.add(this.add.rectangle(0, 0, this.scale.width, 38, UI.color.overlay, 0.62).setOrigin(0, 0));

    this.dayText = this.add
      .text(14, 19, '', { fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.primary })
      .setOrigin(0, 0.5);
    hud.add(this.dayText);

    this.energyBar = new StatBar(this, { x: 132, y: 13, width: 96, height: 12, color: UI.color.energy, caption: 'Energia' });
    hud.add(this.energyBar);

    const short: Record<IndicatorKey, string> = { biodiversidade: 'Bio', economia: 'Eco', comunidade: 'Com' };
    let x = 330;
    for (const meta of INDICATOR_META) {
      const bar = new StatBar(this, { x, y: 13, width: 72, height: 12, color: meta.color, caption: short[meta.key] });
      hud.add(bar);
      this.indicatorBars.set(meta.key, bar);
      x += 128;
    }
  }

  /** Botão compacto "?" no topo-direita que abre a ajuda como modal sob demanda
   * (em vez de um bloco de texto fixo ocupando a tela). */
  private buildHelpButton(): void {
    new Button(this, {
      x: this.scale.width - 26, y: 19, width: 30, height: 26,
      label: '?', fontSize: UI.size.body,
      onClick: () => this.toggleHelp(),
    }).setDepth(DEPTH.help).setScrollFactor(0);
  }

  private buildInteractionText(): void {
    const y = this.scale.height - Hotbar.BAR_H - 22;
    this.interactionHint = this.add.text(this.scale.width / 2, y, '', {
      fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.primary,
      backgroundColor: '#05100a',
    }).setOrigin(0.5).setPadding(8, 4, 8, 4).setScrollFactor(0).setDepth(DEPTH.help).setVisible(false);
    this.toastText = this.add.text(this.scale.width / 2, y - 34, '', {
      fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft,
      backgroundColor: '#05100a',
      wordWrap: { width: Math.min(520, this.scale.width - 48) },
      align: 'center',
    }).setOrigin(0.5).setPadding(8, 4, 8, 4).setScrollFactor(0).setDepth(DEPTH.help).setAlpha(0);
  }

  /** Páginas do tutorial "Como jogar" (título + corpo), navegadas com setas. */
  private helpPages(): { title: string; body: string }[] {
    const keys = this.settings.keyBindings;
    return [
      {
        title: 'Controles',
        body:
          `${keyLabel(keys.moveUp)}${keyLabel(keys.moveLeft)}${keyLabel(keys.moveDown)}${keyLabel(keys.moveRight)} / setas: andar\n` +
          `${keyLabel(keys.interact)} / Espaço: usar ferramenta, dormir na porta ou vender na banca\n` +
          '1-6: escolher item na hotbar\n' +
          `${keyLabel(keys.replant)}: replantar/undo de nativa recém-plantada (custa 2 energia)\n` +
          `${keyLabel(keys.pause)} / ESC: pausar/fechar\n` +
          'Mouse: clique no chão para andar; clique nos botões e slots',
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

  /** Abre/fecha o tutorial "Como jogar" (páginas com setas). Congela o mundo. */
  private toggleHelp(): void {
    if (this.endOverlay || this.saleOverlay) return;
    if (this.helpOverlay) {
      this.helpOverlay.destroy();
      this.helpOverlay = undefined;
      this.renderHelpStep = undefined;
      return;
    }
    this.helpStep = 0;
    const panelW = Math.min(560, this.scale.width - 40);
    const panelH = Math.min(430, this.scale.height - 48);
    const panel = new Panel(this, { width: panelW, height: panelH, title: 'Como jogar' });
    const pages = this.helpPages();

    const blocker = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0.001)
      .setInteractive();
    blocker.on('pointerdown', () => this.toggleHelp()); // clicar fora fecha

    const subtitle = this.add.text(0, -panelH / 2 + 74, '', {
      fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.accent,
    }).setOrigin(0.5);
    const body = this.add.text(0, -6, '', {
      fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft,
      align: 'left', lineSpacing: 7, wordWrap: { width: panelW - 108 },
    }).setOrigin(0.5);
    const indicator = this.add.text(0, panelH / 2 - 54, '', {
      fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.muted,
    }).setOrigin(0.5);

    const prev = new Button(this, {
      x: -panelW / 2 + 30, y: 0, width: 40, height: 52, label: '◀',
      fontSize: UI.size.heading, onClick: () => this.stepHelp(-1),
    });
    const next = new Button(this, {
      x: panelW / 2 - 30, y: 0, width: 40, height: 52, label: '▶',
      fontSize: UI.size.heading, onClick: () => this.stepHelp(1),
    });

    this.renderHelpStep = () => {
      const p = pages[this.helpStep];
      if (!p) return;
      subtitle.setText(p.title);
      body.setText(p.body);
      indicator.setText(`${this.helpStep + 1} / ${pages.length}`);
      prev.setEnabled(this.helpStep > 0);
      next.setEnabled(this.helpStep < pages.length - 1);
    };

    panel.addContent(
      blocker, subtitle, body, indicator, prev, next,
      this.add.text(0, panelH / 2 - 30, 'Setas para navegar • clique fora ou ESC para fechar', {
        fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.muted,
      }).setOrigin(0.5),
    );
    panel.setScrollFactor(0);
    this.helpOverlay = panel;
    this.renderHelpStep();
  }

  /** Avança (+1) ou retrocede (-1) uma página do tutorial. */
  private stepHelp(delta: number): void {
    if (!this.helpOverlay) return;
    const total = this.helpPages().length;
    const next = Phaser.Math.Clamp(this.helpStep + delta, 0, total - 1);
    if (next === this.helpStep) return;
    this.helpStep = next;
    this.renderHelpStep?.();
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    this.rebuildMoveKeys();

    kb.on('keydown', (event: KeyboardEvent) => {
      if (event.repeat) return;
      const code = normalizeKeyCode(event);
      const keys = this.settings.keyBindings;
      // Com o tutorial aberto, as setas ←/→ navegam entre as páginas.
      if (this.helpOverlay && (code === 'LEFT' || code === 'RIGHT')) {
        this.stepHelp(code === 'RIGHT' ? 1 : -1);
        return;
      }
      if (code === keys.interact || code === 'SPACE') this.doAction();
      else if (code === keys.sleep) this.doSleep();
      else if (code === keys.sell) this.doSell();
      else if (code === keys.replant) this.doReplant();
      else if (code === keys.pause || code === 'ESC') {
        if (this.helpOverlay) this.toggleHelp();
        else if (this.saleOverlay) this.toggleSales();
        else this.pauseGame();
      }
    });

    // Slots 1-9 (estilo Minecraft): seleciona ferramenta ou dispara a ação.
    const numKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
    numKeys.forEach((k, i) => kb.on(`keydown-${k}`, () => this.hotbar.choose(i)));

    kb.on('keydown-R', () => this.restart());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.settings.mouseEnabled) return;
      if (this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning) return;
      if (pointer.y > this.scale.height - Hotbar.BAR_H - 16 || pointer.y < 42) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.mouseTarget = new Phaser.Math.Vector2(world.x, world.y);
    });
  }

  private rebuildMoveKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    const cursors = kb.createCursorKeys();
    const keys = this.settings.keyBindings;
    const remapped = kb.addKeys({
      up: phaserKeyName(keys.moveUp),
      down: phaserKeyName(keys.moveDown),
      left: phaserKeyName(keys.moveLeft),
      right: phaserKeyName(keys.moveRight),
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.moveKeys = [
      { up: cursors.up!, down: cursors.down!, left: cursors.left!, right: cursors.right! },
      { up: remapped.up!, down: remapped.down!, left: remapped.left!, right: remapped.right! },
    ];
  }

  private readDir(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const k of this.moveKeys) {
      if (k.left.isDown) x -= 1;
      if (k.right.isDown) x += 1;
      if (k.up.isDown) y -= 1;
      if (k.down.isDown) y += 1;
    }
    if (x !== 0 || y !== 0) {
      this.mouseTarget = undefined;
      return { x: Phaser.Math.Clamp(x, -1, 1), y: Phaser.Math.Clamp(y, -1, 1) };
    }
    if (this.mouseTarget) {
      const dx = this.mouseTarget.x - this.player.worldX;
      const dy = this.mouseTarget.y - this.player.worldY;
      if (Math.hypot(dx, dy) < 10) {
        this.mouseTarget = undefined;
        return { x: 0, y: 0 };
      }
      return { x: dx, y: dy };
    }
    return { x: Phaser.Math.Clamp(x, -1, 1), y: Phaser.Math.Clamp(y, -1, 1) };
  }

  private moveSpeedScale(): number {
    return 0.65 + this.settings.mouseSensitivity * 0.75;
  }

  // ─── Ações do adapter ───────────────────────────────────────────────────────

  private doAction(): void {
    if (this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning) return;
    if (this.nearDoor()) {
      this.enterHouse();
      return;
    }
    if (this.nearMarket()) {
      this.toggleSales();
      return;
    }
    if (!this.player.onPlot) return; // fora do talhão não há tile p/ agir
    const c = this.tool === 'tree' ? this.treeTargetCoord() : this.player.tileCoord;
    if (!c) {
      this.showToast('Olhe para um tile do talhão para plantar nativa.');
      return;
    }
    if (this.tool === 'tree' && this.sameCoord(c, this.player.tileCoord)) {
      this.showToast('Saia desse tile ou olhe para um tile vizinho para plantar a nativa.');
      return;
    }
    const before = this.tileViewAt(c);
    let ok = false;
    switch (this.tool) {
      case 'tree':
        ok = this.farm.plantTree(c);
        if (ok) this.nudgePlayerAwayFromTree(c);
        break;
      case 'cacao': ok = this.farm.plantCacao(c); break;
      case 'harvest': ok = this.farm.harvest(c); break;
      case 'prune': ok = this.farm.prune(c); break;
    }
    this.redraw();
    this.showActionFeedback(ok, before);
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.hotbar.setTool(tool);
  }

  private doReplant(): void {
    if (this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning) return;
    const c = this.findReplantCandidate();
    if (!c) {
      this.showToast('Nenhuma nativa recém-plantada por perto para replantar.');
      return;
    }
    if (this.farm.replantTree(c)) {
      this.redraw();
      this.showToast('Nativa replantada/desfeita. Energia -2.');
    } else {
      this.showToast('Replantar custa 2 de energia e só vale para nativa jovem.');
    }
  }

  private nudgePlayerAwayFromTree(c: { x: number; y: number }): void {
    const foot = footRect(this.player.worldX, this.player.worldY);
    const trunk = treeTrunkRect(this.plot, c, false);
    if (!Phaser.Geom.Rectangle.Overlaps(foot, trunk)) return;

    const current = this.player.tileCoord;
    const safeX = GRID_OX + current.x * TILE + TILE / 2;
    const safeY = GRID_OY + current.y * TILE + TILE / 2;
    this.player.moveTo(safeX, safeY);
  }

  private doSleep(): void {
    if (this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning) return;
    if (!this.nearDoor()) {
      this.showToast('Vá até a porta da casa para dormir.');
      return;
    }
    this.enterHouse();
  }

  private doSell(): void {
    if (this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning) return;
    if (!this.nearMarket()) {
      this.showToast('Vá até a banca para vender cacau.');
      return;
    }
    this.toggleSales();
  }

  private pauseGame(): void {
    if (this.endOverlay || this.transitioning) return;
    this.scene.pause();
    this.scene.launch('PauseScene');
  }

  /**
   * Grava a partida enquanto está em andamento; ao terminar (vitória/derrota)
   * apaga o save para que "Carregar jogo" não reabra uma partida encerrada.
   */
  private autosave(): void {
    if (this.farm.phase === 'jogando') writeSave(this.farm);
    else clearSave();
  }

  private restart(): void {
    this.endOverlay?.destroy();
    this.endOverlay = undefined;
    clearSave(); // reiniciar = nova partida; o create() gravará o novo estado.
    this.scene.restart();
  }

  private findReplantCandidate(): { x: number; y: number } | undefined {
    if (!this.player.onPlot) return undefined;
    const c = this.player.tileCoord;
    const candidates = [
      c,
      { x: c.x, y: c.y - 1 },
      { x: c.x + 1, y: c.y },
      { x: c.x, y: c.y + 1 },
      { x: c.x - 1, y: c.y },
    ];
    for (const v of candidates) {
      if (v.x < 0 || v.y < 0 || v.x >= this.farm.grid.width || v.y >= this.farm.grid.height) continue;
      const tile = this.farm.grid.tileAt(v);
      if (tile.kind === 'tree' && !this.farm.grid.isMatureTree(v)) return v;
    }
    return undefined;
  }

  // ─── Vendas (modal da banca) ────────────────────────────────────────────────

  private toggleSales(): void {
    if (this.endOverlay) return;
    if (this.saleOverlay) {
      this.closeSales();
      return;
    }
    this.saleOverlay = this.buildSalesMenu();
  }

  private closeSales(): void {
    this.saleFocus?.destroy();
    this.saleFocus = undefined;
    this.saleOverlay?.destroy();
    this.saleOverlay = undefined;
  }

  private buildSalesMenu(): Phaser.GameObjects.Container {
    const qty = this.farm.inventory.count(ITEM_CACAU_FRESCO);
    const panelW = Math.min(420, this.scale.width - 40);
    const panel = new Panel(this, { width: panelW, height: 300, title: 'Banca de vendas' });
    panel.setScrollFactor(0);

    const blocker = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0.001)
      .setInteractive();
    blocker.on('pointerdown', () => this.toggleSales());
    panel.addContent(blocker);

    panel.addContent(
      this.add.image(-92, -36, TextureKey.IconCacao).setDisplaySize(48, 48),
      this.add.text(-44, -46, 'Cacau fresco', {
        fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.primary,
      }).setOrigin(0, 0.5),
      this.add.text(-44, -20, `Disponivel: x${qty}`, {
        fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft,
      }).setOrigin(0, 0.5),
      this.add.text(0, 26, 'Cada unidade aumenta Economia e Comunidade.', {
        fontFamily: UI.font,
        fontSize: UI.size.small,
        color: UI.text.muted,
        align: 'center',
        wordWrap: { width: panelW - 64 },
      }).setOrigin(0.5),
    );

    const sellButton = new Button(this, {
      x: 0, y: 84, width: 220, height: 44,
      label: 'Vender tudo',
      variant: 'primary',
      onClick: () => {
        const sold = this.farm.sell(ITEM_CACAU_FRESCO, this.farm.inventory.count(ITEM_CACAU_FRESCO));
        this.closeSales();
        this.time.delayedCall(0, () => {
          this.redraw();
          this.showToast(sold > 0 ? `Vendido: ${sold} cacau. Ciclo completo!` : 'Sem cacau para vender.');
        });
      },
    }).setEnabled(qty > 0);
    const closeButton = new Button(this, {
      x: 0, y: 136, width: 180, height: 36,
      label: 'Fechar [ESC]',
      fontSize: UI.size.body,
      onClick: () => this.toggleSales(),
    });
    panel.addContent(sellButton, closeButton);
    this.saleFocus = new FocusList(this, [
      {
        label: qty > 0 ? 'Vender tudo' : 'Vender tudo indisponível',
        enabled: () => sellButton.enabled,
        onFocus: (v) => sellButton.setFocused(v),
        onActivate: () => sellButton.activate(),
      },
      { label: 'Fechar vendas', onFocus: (v) => closeButton.setFocused(v), onActivate: () => closeButton.activate() },
    ], (message) => announce(this.settings, message));
    announce(this.settings, 'Banca de vendas aberta. Use setas, Enter ou Espaço.');
    return panel;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  private drawMarker(): void {
    this.markerGfx.clear();
    if (!this.player.onPlot) return; // sem tile-alvo fora do talhão
    const c = this.tool === 'tree' ? this.treeTargetCoord() : this.player.tileCoord;
    if (!c) return;
    const px = GRID_OX + c.x * TILE;
    const py = GRID_OY + c.y * TILE;
    this.markerGfx.lineStyle(2, 0xffffff, 0.65).strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
  }

  private redraw(): void {
    const s = this.farm.snapshot();

    this.plantLayer.removeAll(true);
    this.treeSprites.forEach((sp) => sp.destroy());
    this.treeSprites = [];
    this.shadeGfx.clear();

    for (const t of s.tiles) {
      const px = GRID_OX + t.x * TILE;
      const py = GRID_OY + t.y * TILE;
      // Ordenação por Y da base (ancorada em py + TILE) com o jogador, sob o fog.
      const baseDepth = Math.min(Math.round(py + TILE), DEPTH.fog - 10);

      // Visualização da grade de sombra (tint ideal / mata fechada): só QA.
      if (GRID_DEBUG && t.kind !== 'tree') {
        if (t.shadeStatus === 'ideal') this.shadeGfx.fillStyle(0x8fffa0, 0.16).fillRect(px, py, TILE, TILE);
        else if (t.shadeStatus === 'mata_fechada') this.shadeGfx.fillStyle(0x08160d, 0.4).fillRect(px, py, TILE, TILE);
      }

      if (t.kind === 'tree') {
        if (t.matureTree) {
          // Árvore nativa madura (dá sombra). Ancorada na base do tile; copa
          // sobe ~2,3 tiles. Aspecto do PNG mantido (111×168 ≈ 0,66). Fora do
          // plantLayer → ordena por Y com o jogador (passa atrás/na frente).
          const tree = this.add
            .image(px + TILE / 2, py + TILE, TextureKey.TreeMature)
            .setOrigin(0.5, 1)
            .setDisplaySize(TILE * 1.5, TILE * 2.3)
            .setDepth(baseDepth);
          if (t.pruned) tree.setTint(0xbfa25a); // podada: copa ressecada (não gera sombra)
          this.treeSprites.push(tree);
        } else {
          // Muda recém-plantada = mudinha no buraco (ainda não gera sombra).
          const sap = this.add
            .image(px + TILE / 2, py + TILE * 0.95, TextureKey.Seedling)
            .setOrigin(0.5, 1)
            .setDisplaySize(TILE * 0.42, TILE * 1.1)
            .setDepth(baseDepth);
          this.treeSprites.push(sap);
        }
      } else if (t.kind === 'cacao' && t.cacao) {
        // Canteiro arado (pack) sob o cacaueiro.
        this.plantLayer.add(this.add.image(px, py, TextureKey.Bed).setOrigin(0, 0).setDisplaySize(TILE, TILE));
        this.plantLayer.add(this.add.image(px, py, cacaoTextureKey(t.cacao.stage, t.cacao.dead)).setOrigin(0, 0));
        // Aviso de sol pleno = visualização da grade de sombra (só QA).
        if (GRID_DEBUG && !t.cacao.dead && t.shadeStatus === 'sol_pleno') {
          this.shadeGfx.lineStyle(3, 0xff5a3c, 0.9).strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        }
        if (t.cacao.harvestable) {
          this.shadeGfx.lineStyle(3, 0xffd34a, 0.95).strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        }
      }
    }

    this.dayText.setText(`Dia ${Math.min(s.day, s.totalDays)} / ${s.totalDays}`);
    this.hotbar.setCacaoCount(this.farm.inventory.count(ITEM_CACAU_FRESCO));
    this.energyBar.set(s.energy / s.maxEnergy, `${s.energy}/${s.maxEnergy}`);
    for (const meta of INDICATOR_META) {
      const v = s.indicators[meta.key];
      this.indicatorBars.get(meta.key)!.set(v / 100, String(Math.round(v)));
    }

    if (s.phase !== 'jogando') this.showEnd(s.phase, s.indicators);
  }

  private showEnd(phase: 'vitoria' | 'vitoria_mestre' | 'derrota', indicators: Record<IndicatorKey, number>): void {
    if (this.endOverlay) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const pronoun = loadProfile().pronoun;
    // Três finais: derrota, vitória padrão (Próspero) e Mestre (100% do potencial).
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
    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x05100a, 0.85);
    const title = this.add.text(w / 2, h / 2 - 90, titleText, {
      fontFamily: 'monospace', fontSize: UI.size.title, color: titleColor,
    }).setOrigin(0.5);
    const sub = this.add.text(w / 2, h / 2 - 34, subText, {
        fontFamily: 'monospace', fontSize: UI.size.body, color: '#cfe3cf',
        align: 'center', wordWrap: { width: Math.min(560, w - 64) },
      }).setOrigin(0.5);
    const stats = INDICATOR_META
      .map((m) => `${m.label}: ${Math.round(indicators[m.key])}`)
      .join('\n');
    const statsText = this.add.text(w / 2, h / 2 + 6, stats, {
      fontFamily: 'monospace', fontSize: UI.size.small, color: '#a9c9ac', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
    const btn = this.add.text(w / 2, h / 2 + 70, '  Reiniciar [R]  ', {
      fontFamily: 'monospace', fontSize: '20px', color: '#0d1f13', backgroundColor: '#7bd06a',
    }).setOrigin(0.5).setPadding(8).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.restart());
    this.endOverlay = this.add.container(0, 0, [bg, title, sub, statsText, btn]).setDepth(DEPTH.end).setScrollFactor(0);
    announce(this.settings, `${titleText}. ${subText}. Pressione R para reiniciar.`);
  }

  // ─── Helpers de UI ──────────────────────────────────────────────────────────

  private showActionFeedback(ok: boolean, before: ReturnType<Farm['snapshot']>['tiles'][number] | undefined): void {
    if (ok) {
      switch (this.tool) {
        case 'tree':
          this.showToast('Nativa plantada. Ela amadurece com os dias.');
          return;
        case 'cacao':
          this.showToast('Cacau plantado. Durma alguns dias e volte para colher.');
          return;
        case 'harvest':
          this.showToast(`Cacau colhido: x${this.farm.inventory.count(ITEM_CACAU_FRESCO)}.`);
          return;
        case 'prune':
          this.showToast('Nativa podada: menos sombra, mais produtividade ao redor.');
          return;
      }
    }

    if (this.farm.energy <= 0) {
      this.showToast('Sem energia. Va dormir na casa.');
      return;
    }
    if (!before) return;
    if ((this.tool === 'tree' || this.tool === 'cacao') && before.kind !== 'empty') {
      this.showToast('Esse tile ja esta ocupado.');
      return;
    }
    if (this.tool === 'harvest') {
      if (before.cacao?.dead) this.showToast('Esse cacau morreu. Plante outro sob sombra ideal.');
      else if (before.cacao) this.showToast('Esse cacau ainda nao esta maduro. Durma mais um dia.');
      else this.showToast('Nao ha cacau para colher aqui.');
      return;
    }
    if (this.tool === 'prune') {
      this.showToast('So nativas maduras podem ser podadas.');
    }
  }

  private showToast(message: string): void {
    announce(this.settings, message);
    this.interactionHint.setVisible(false);
    this.toastText.setText(message).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      duration: 350,
      delay: 1500,
      onComplete: () => this.updateInteractionText(),
    });
  }
}
