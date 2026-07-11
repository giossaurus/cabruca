import Phaser from 'phaser';
import { Farm, ITEM_CACAU_FRESCO, type IndicatorKey } from '../../domain';
import { PLAYER_W, TILE, TextureKey, cacaoTextureKey } from '../assets';
import { Player } from '../Player';
import { Dog } from '../Dog';
import { FOREST_FLAT_KEYS, FOREST_PROP_KEYS } from '../forest';
import { GRID_DEBUG } from '../debug';
import { applyAccessibilitySettings, announce } from '../accessibility';
import { UI, StatBar, Panel, Button, FocusList, exemplaryFarmer, keyLabel, loadProfile, loadSettings, masterTitle, normalizeKeyCode, phaserKeyName, prosperousTitle, type Settings } from '../ui';
import { clearSave, loadFarm, writeSave } from '../save';
import { DEPTH } from '../depths';
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

// Mundo maior que a tela (960×640): a câmera segue o jogador e o mapa vai sendo
// revelado (fog). O talhão 13×8 (13*64=832 × 8*64=512) fica centralizado na
// horizontal e na metade inferior, deixando o norte para a casa e o cenário.
const WORLD_W = 1920;
const WORLD_H = 1408;
const GRID_OX = Math.round((WORLD_W - 13 * 64) / 2); // 544
const GRID_OY = 768; // espaço ao norte para casa/cenário
/** Medidas da hotbar pixel UI própria (sem PNG externo). */
const SLOT_SIZE = 56;
const SLOT_GAP = 4;
const SLOT_PAD = 8;
const SLOT_COUNT = 6;
const SLOT_BAR_W = SLOT_COUNT * SLOT_SIZE + (SLOT_COUNT - 1) * SLOT_GAP + SLOT_PAD * 2;
const SLOT_BAR_H = SLOT_SIZE + SLOT_PAD * 2;

/** Diâmetro do "pincel" que apaga a névoa ao redor do jogador (raio ~150px). */
const FOG_BRUSH = 300;
const PLAYER_FOOT_H = 14;

type Tool = 'tree' | 'cacao' | 'harvest' | 'prune';

const SLOT_ICON = 40; // px do ícone dentro do slot

/** Definição de um slot da hotbar (ação do jogador simbolizada por ícone/texto). */
interface SlotDef {
  readonly key: string; // rótulo curto (placeholder enquanto não há ícone)
  readonly kind: 'tool' | 'action' | 'empty';
  readonly tool?: Tool; // slots de ferramenta (aplicadas no tile com E/Espaço)
  readonly run?: () => void; // slots de ação imediata (dormir/vender)
  readonly icon?: string; // textura do ícone (estado normal)
  readonly iconSelected?: string; // textura quando selecionado/hover
  readonly iconW?: number;
  readonly iconH?: number;
}

interface SlotUI {
  readonly def: SlotDef;
  readonly cx: number;
  readonly cy: number;
  readonly selector: Phaser.GameObjects.Rectangle;
  readonly icon: Phaser.GameObjects.Image | undefined;
  hovered: boolean;
}

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

  private fog!: Phaser.GameObjects.RenderTexture;
  private obstacles: Phaser.Geom.Rectangle[] = [];
  private doorZone!: Phaser.Geom.Rectangle;
  private saleZone!: Phaser.Geom.Rectangle;
  private transitioning = false;

  private dayText!: Phaser.GameObjects.Text;
  private energyBar!: StatBar;
  private indicatorBars!: Map<IndicatorKey, StatBar>;
  private slots: SlotUI[] = [];
  private hudLayer!: Phaser.GameObjects.Container;
  private slotBarLayer!: Phaser.GameObjects.Container;
  private slotBarBounds!: Phaser.Geom.Rectangle;
  private cacauBadge!: Phaser.GameObjects.Text;
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
    this.slots = [];
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

    this.drawGrassBackground();
    this.drawPlantableGround();
    this.buildHouse();
    this.buildMarketStand();
    this.buildDecorations();
    this.scatterForestDetails();
    this.shadeGfx = this.add.graphics().setDepth(-10);
    this.plantLayer = this.add.container(0, 0).setDepth(0);
    this.markerGfx = this.add.graphics().setDepth(1);

    // Jogador anda por TODO o mundo; interage só quando pisa no talhão.
    const plot = { ox: GRID_OX, oy: GRID_OY, cols: this.farm.grid.width, rows: this.farm.grid.height };
    const world = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
    this.player = new Player(this, this.farm, plot, world, this.obstacles);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    // Cão de estimação: brinca pelo cenário e segue o dono (pura ambientação).
    this.dog = new Dog(this, world, plot, this.player.worldX + 74, this.player.worldY + 34);

    this.buildFog();
    this.buildHud();
    this.buildHelpButton();
    this.buildInteractionText();
    this.buildSlotBar();
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
    this.revealFog();
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
    this.slotBarLayer.setAlpha(Phaser.Geom.Rectangle.Overlaps(screen, this.slotBarBounds) ? 0.5 : 1);
  }

  // ─── Setup estático ─────────────────────────────────────────────────────────

  private drawGrassBackground(): void {
    // Grama do pack (tile 16px) cobrindo TODO o MUNDO, ladrilhada em passos de
    // TILE (upscale ×4, nearest-neighbor via pixelArt) — nítida e sem borda.
    const bg = this.add.container(0, 0).setDepth(-22);
    const cols = Math.ceil(WORLD_W / TILE);
    const rows = Math.ceil(WORLD_H / TILE);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        bg.add(
          this.add.image(x * TILE, y * TILE, TextureKey.Grass).setOrigin(0, 0).setDisplaySize(TILE, TILE),
        );
      }
    }
    // Contorno sutil do talhão jogável — parte da visualização da grade de
    // sombra (só QA, ver GRID_DEBUG); invisível no gameplay normal.
    if (GRID_DEBUG) {
      const w = this.farm.grid.width * TILE;
      const h = this.farm.grid.height * TILE;
      this.add.rectangle(GRID_OX + w / 2, GRID_OY + h / 2, w, h)
        .setStrokeStyle(2, 0x2a5d34, 0.5).setDepth(-19);
    }
  }

  /** Tiles plantáveis do talhão: visíveis, mas sem colisão. */
  private drawPlantableGround(): void {
    const layer = this.add.container(0, 0).setDepth(-18);
    for (let y = 0; y < this.farm.grid.height; y++) {
      for (let x = 0; x < this.farm.grid.width; x++) {
        const px = GRID_OX + x * TILE;
        const py = GRID_OY + y * TILE;
        const tile = this.add.image(px, py, TextureKey.Bed)
          .setOrigin(0, 0)
          .setDisplaySize(TILE, TILE)
          .setAlpha(0.34)
          .setTint(0xb6965d);
        layer.add(tile);
      }
    }
  }

  /**
   * Decoração de ambiente (pedras, arbustos, flores) espalhada pelo MUNDO, fora
   * do talhão, dando o que revelar ao explorar. Puramente cosmética. Posições
   * fixas (pseudo-aleatórias por semente) para leitura estável entre sessões.
   */
  private buildDecorations(): void {
    const plotL = GRID_OX;
    const plotR = GRID_OX + this.farm.grid.width * TILE;
    const plotT = GRID_OY;
    const plotB = GRID_OY + this.farm.grid.height * TILE;
    const insidePlot = (x: number, y: number): boolean =>
      x > plotL - 40 && x < plotR + 40 && y > plotT - 40 && y < plotB + 40;

    const keys = [TextureKey.DecorBush, TextureKey.DecorStone, TextureKey.DecorFlower];
    const reserved = [
      new Phaser.Geom.Rectangle(this.doorZone.x - 190, this.doorZone.y - 140, this.doorZone.width + 380, 330),
      new Phaser.Geom.Rectangle(this.saleZone.x - 130, this.saleZone.y - 120, this.saleZone.width + 260, 250),
    ];
    // Gerador determinístico (LCG) → mesmo cenário todo restart.
    let seed = 1337;
    const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 90; i++) {
      const x = 40 + rnd() * (WORLD_W - 80);
      const y = 60 + rnd() * (WORLD_H - 100);
      if (insidePlot(x, y)) continue; // não polui a área jogável
      const key = keys[Math.floor(rnd() * keys.length)]!;
      const scale = key === TextureKey.DecorFlower ? 2.6 + rnd() * 1.2 : 3 + rnd() * 1.4;
      const hitW = key === TextureKey.DecorBush ? 22 * scale : 18 * scale;
      const hitH = key === TextureKey.DecorBush ? 10 * scale : 9 * scale;
      const hit = new Phaser.Geom.Rectangle(x - hitW / 2, y - hitH, hitW, hitH);
      if (reserved.some((r) => Phaser.Geom.Rectangle.Overlaps(hit, r))) continue;
      if (key !== TextureKey.DecorFlower && this.obstacles.some((o) => Phaser.Geom.Rectangle.Overlaps(hit, o))) continue;
      // Flores são rasteiras (depth baixo fixo, sob o jogador); arbustos e pedras
      // são volumes e ordenam por Y com o jogador (base em y por causa do origin 1).
      const depth = key === TextureKey.DecorFlower ? -15 : Math.min(Math.round(y), DEPTH.fog - 10);
      this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth);
      if (key !== TextureKey.DecorFlower) this.obstacles.push(hit);
    }
  }

  /**
   * Detalhes de chão de floresta (Pocket Cozy Pixels) espalhados FORA do talhão:
   * manchas deitadas (FLAT, sob a decoração) e volumes em pé (PROP, ordenados por
   * Y com o jogador). Puramente cosmético, sem colisão. Semente própria para não
   * repetir as posições do decor; determinístico entre sessões.
   */
  private scatterForestDetails(): void {
    const plotL = GRID_OX;
    const plotR = GRID_OX + this.farm.grid.width * TILE;
    const plotT = GRID_OY;
    const plotB = GRID_OY + this.farm.grid.height * TILE;
    // Buffer maior que o decor: nada de detalhe encostando nos tiles de cacau.
    const insidePlot = (x: number, y: number): boolean =>
      x > plotL - 48 && x < plotR + 48 && y > plotT - 48 && y < plotB + 48;
    const reserved = [
      new Phaser.Geom.Rectangle(this.doorZone.x - 190, this.doorZone.y - 140, this.doorZone.width + 380, 330),
      new Phaser.Geom.Rectangle(this.saleZone.x - 130, this.saleZone.y - 120, this.saleZone.width + 260, 250),
    ];
    const blocked = (r: Phaser.Geom.Rectangle): boolean =>
      reserved.some((z) => Phaser.Geom.Rectangle.Overlaps(r, z));

    let seed = 90210;
    const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = (arr: readonly string[]): string => arr[Math.floor(rnd() * arr.length)]!;

    const place = (key: string, flat: boolean): void => {
      const x = 30 + rnd() * (WORLD_W - 60);
      const y = 50 + rnd() * (WORLD_H - 80);
      if (insidePlot(x, y)) return;
      const src = this.textures.get(key).getSourceImage();
      const targetH = flat ? 52 + rnd() * 28 : 40 + rnd() * 30;
      const s = targetH / src.height;
      const w = src.width * s;
      if (flat) {
        if (blocked(new Phaser.Geom.Rectangle(x - w / 2, y - targetH / 2, w, targetH))) return;
        this.add.image(x, y, key).setOrigin(0.5, 0.5).setScale(s).setDepth(-18).setAlpha(0.92);
      } else {
        if (blocked(new Phaser.Geom.Rectangle(x - w / 2, y - targetH, w, targetH))) return;
        // Ordena com o jogador, mas sempre sob o fog (DEPTH.fog = 1400).
        this.add.image(x, y, key).setOrigin(0.5, 1).setScale(s).setDepth(Math.min(Math.round(y), DEPTH.fog - 10));
      }
    };

    for (let i = 0; i < 30; i++) place(pick(FOREST_FLAT_KEYS), true);
    for (let i = 0; i < 64; i++) place(pick(FOREST_PROP_KEYS), false);
  }

  /**
   * Casa ao norte/nordeste do talhão. Corpo sólido (colisão) + uma "porta" na
   * base: estando nela, E/Espaço/Z dispara a transição de dia. Depth pela base
   * → o jogador passa na frente/atrás corretamente.
   */
  private buildHouse(): void {
    const src = this.textures.get(TextureKey.CottageClosed).getSourceImage();
    const dispH = 300;
    const dispW = dispH * (src.width / src.height);
    const baseX = GRID_OX + this.farm.grid.width * TILE * 0.72; // nordeste do talhão
    const baseY = GRID_OY - 210; // ao norte, com folga entre casa e talhão

    const g = this.add.graphics().setDepth(baseY - 2);
    g.fillStyle(0x07110a, 0.24).fillEllipse(baseX, baseY - 8, dispW * 0.72, 42);
    g.fillStyle(0x9b6b3f, 0.75).fillRoundedRect(baseX - 36, baseY - 76, 72, 92, 8);

    this.add.image(baseX, baseY, TextureKey.CottageClosed)
      .setOrigin(0.5, 1)
      .setDisplaySize(dispW, dispH)
      .setDepth(baseY);

    for (let y = baseY + 8; y < GRID_OY + 10; y += TILE) {
      this.add.image(baseX, y, TextureKey.Bed).setOrigin(0.5, 0.5).setDisplaySize(TILE, TILE * 0.62).setDepth(-14);
    }
    this.add.image(baseX - dispW * 0.36, baseY - 6, TextureKey.DecorBush).setOrigin(0.5, 1).setScale(2.6).setDepth(baseY + 1);
    this.add.image(baseX + dispW * 0.34, baseY - 6, TextureKey.DecorFlower).setOrigin(0.5, 1).setScale(3.2).setDepth(baseY + 1);

    // Corpo sólido: cobre paredes/telhado, deixando a base (porta + chão) livre.
    this.obstacles.push(new Phaser.Geom.Rectangle(
      baseX - dispW * 0.44, baseY - dispH * 0.86, dispW * 0.88, dispH * 0.62,
    ));
    // Porta: faixa estreita na base-central; pisar aqui entra na casa.
    this.doorZone = new Phaser.Geom.Rectangle(baseX - 36, baseY - dispH * 0.24, 72, dispH * 0.24 + 10);
  }

  /** Banca física de venda: aproxima, aperta E/V e abre o menu de vendas. */
  private buildMarketStand(): void {
    const baseX = GRID_OX + 112;
    const baseY = GRID_OY - 28;
    const standW = 118;
    const standH = 118;

    // Só uma sombra suave no chão (sem bloco de "terra" retangular, que criava
    // uma borda dura sobrepondo a grama/talhão).
    const g = this.add.graphics().setDepth(baseY - 3);
    g.fillStyle(0x07110a, 0.22).fillEllipse(baseX, baseY - 8, standW * 0.82, 26);
    this.add.image(baseX, baseY, TextureKey.MarketStand)
      .setOrigin(0.5, 1)
      .setDisplaySize(standW, standH)
      .setDepth(baseY);
    this.add.text(baseX, baseY - standH + 6, 'VENDA', {
      fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.primary,
      backgroundColor: '#5d3a22',
    }).setOrigin(0.5).setPadding(4, 2, 4, 2).setDepth(baseY + 1);

    this.obstacles.push(new Phaser.Geom.Rectangle(baseX - 48, baseY - 76, 96, 58));
    this.saleZone = new Phaser.Geom.Rectangle(baseX - 58, baseY - 20, 116, 70);
  }

  // ─── Névoa (fog of war) ─────────────────────────────────────────────────────

  /** Névoa cobrindo o mundo; o explorado é apagado (permanente). */
  private buildFog(): void {
    this.makeFogBrush();
    this.fog = this.add.renderTexture(0, 0, WORLD_W, WORLD_H).setOrigin(0, 0).setDepth(DEPTH.fog);
    this.fog.fill(0x0b130e, 1);
    // Revela o talhão + arredores de início (senão o jogador nasce "no escuro").
    const cx = GRID_OX + (this.farm.grid.width * TILE) / 2;
    const cy = GRID_OY + (this.farm.grid.height * TILE) / 2;
    const halfW = (this.farm.grid.width * TILE) / 2 + 130;
    const halfH = (this.farm.grid.height * TILE) / 2 + 130;
    for (let y = cy - halfH; y <= cy + halfH; y += 90) {
      for (let x = cx - halfW; x <= cx + halfW; x += 90) this.eraseFog(x, y);
    }
  }

  /** Pincel radial suave (opaco no centro, some na borda) gerado uma vez. */
  private makeFogBrush(): void {
    if (this.textures.exists('fog_brush')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const steps = 44;
    for (let i = 0; i < steps; i++) {
      const r = (FOG_BRUSH / 2) * (1 - i / steps);
      g.fillStyle(0xffffff, 0.07).fillCircle(FOG_BRUSH / 2, FOG_BRUSH / 2, r);
    }
    g.generateTexture('fog_brush', FOG_BRUSH, FOG_BRUSH);
    g.destroy();
  }

  /** Apaga a névoa (mundo-coords) centrando o pincel em (x,y). */
  private eraseFog(x: number, y: number): void {
    this.fog.erase('fog_brush', x - FOG_BRUSH / 2, y - FOG_BRUSH / 2);
  }

  private revealFog(): void {
    this.eraseFog(this.player.worldX, this.player.worldY);
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
    const y = this.scale.height - SLOT_BAR_H - 22;
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

  /** Hotbar pixel UI própria: 9 slots de ações sem PNG proprietário. */
  private buildSlotBar(): void {
    const barW = SLOT_BAR_W; // largura fixa (não acompanha o talhão largo)
    const barH = SLOT_BAR_H;
    const barX = (this.scale.width - barW) / 2; // centralizada
    const barY = this.scale.height - barH - 10; // fixa no rodapé da VIEWPORT

    // Container fixo à câmera (a câmera segue o jogador) e acima da névoa.
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.slotbar);
    this.slotBarLayer = layer;
    this.slotBarBounds = new Phaser.Geom.Rectangle(barX, barY, barW, barH);
    layer.add(this.add.rectangle(barX, barY, barW, barH, 0x2a1a10).setOrigin(0, 0));
    layer.add(this.add.rectangle(barX + 3, barY + 3, barW - 6, barH - 6, 0x7b4a27).setOrigin(0, 0));
    layer.add(this.add.rectangle(barX + 6, barY + 6, barW - 12, barH - 12, 0x3a2418).setOrigin(0, 0));

    const defs = this.slotDefs();
    const cy = barY + SLOT_PAD + SLOT_SIZE / 2;
    defs.forEach((def, i) => {
      const sx = barX + SLOT_PAD + i * (SLOT_SIZE + SLOT_GAP);
      const sy = barY + SLOT_PAD;
      const cx = sx + SLOT_SIZE / 2;
      layer.add(this.add.rectangle(sx, sy, SLOT_SIZE, SLOT_SIZE, 0xd1a184).setOrigin(0, 0));
      layer.add(this.add.rectangle(sx + 4, sy + 4, SLOT_SIZE - 8, SLOT_SIZE - 8, 0x5a3822).setOrigin(0, 0));
      layer.add(this.add.rectangle(sx + 6, sy + 6, SLOT_SIZE - 12, SLOT_SIZE - 12, 0xe2b79e).setOrigin(0, 0).setAlpha(0.82));

      let icon: Phaser.GameObjects.Image | undefined;
      if (def.icon) {
        icon = this.add.image(cx, cy, def.icon).setDisplaySize(def.iconW ?? SLOT_ICON, def.iconH ?? SLOT_ICON);
        layer.add(icon);
      } else if (def.kind !== 'empty') {
        layer.add(this.add.text(cx, cy, def.key, {
          fontFamily: 'monospace', fontSize: '11px', color: '#f2e6cf', align: 'center',
        }).setOrigin(0.5));
      }
      // número do slot (canto superior esquerdo)
      layer.add(this.add.text(cx - SLOT_ICON / 2, cy - SLOT_ICON / 2 - 6, String(i + 1), {
        fontFamily: 'monospace', fontSize: '10px', color: '#3a2a17',
      }).setOrigin(0, 0));

      // Contador de cacau colhido (substitui o inventário): badge no slot Cacau.
      if (def.tool === 'cacao') {
        this.cacauBadge = this.add
          .text(sx + SLOT_SIZE - 3, sy + SLOT_SIZE - 3, 'x0', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ffd34a',
            backgroundColor: '#2a1a10cc',
          })
          .setOrigin(1, 1)
          .setPadding(3, 1, 3, 1);
        layer.add(this.cacauBadge);
      }

      const selector = this.add
        .rectangle(cx, cy, SLOT_SIZE - 4, SLOT_SIZE - 4)
        .setStrokeStyle(3, 0xffffff, 0.95).setVisible(false);
      layer.add(selector);

      const ui: SlotUI = { def, cx, cy, selector, icon, hovered: false };
      this.slots.push(ui);

      // hitbox transparente clicável cobrindo o slot
      const hit = this.add
        .rectangle(cx, cy, SLOT_SIZE, SLOT_SIZE, 0xffffff, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: def.kind !== 'empty' });
      hit.on('pointerover', () => { ui.hovered = true; this.refreshSlots(); });
      hit.on('pointerout', () => { ui.hovered = false; this.refreshSlots(); });
      hit.on('pointerdown', () => this.chooseSlot(i));
      layer.add(hit);
    });
  }

  private slotDefs(): SlotDef[] {
    return [
      { key: 'Nativa', kind: 'tool', tool: 'tree', icon: TextureKey.Seedling, iconW: 22, iconH: 44 },
      { key: 'Cacau', kind: 'tool', tool: 'cacao', icon: TextureKey.IconCacao },
      { key: 'Colher', kind: 'tool', tool: 'harvest', icon: TextureKey.IconHarvest },
      { key: 'Podar', kind: 'tool', tool: 'prune', icon: TextureKey.IconPrune },
      { key: 'Dormir', kind: 'action', run: () => this.doSleep(), icon: TextureKey.CottageClosed, iconW: 40, iconH: 42 },
      { key: 'Vender', kind: 'action', run: () => this.doSell(), icon: TextureKey.IconSell },
    ];
  }

  /** Escolhe um slot: ferramenta vira ativa; ação imediata executa na hora. */
  private chooseSlot(i: number): void {
    if (this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning) return;
    const def = this.slots[i]?.def;
    if (!def) return;
    if (def.kind === 'tool' && def.tool) this.setTool(def.tool);
    else if (def.kind === 'action' && def.run) def.run();
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
    numKeys.forEach((k, i) => kb.on(`keydown-${k}`, () => this.chooseSlot(i)));

    kb.on('keydown-R', () => this.restart());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.settings.mouseEnabled) return;
      if (this.endOverlay || this.helpOverlay || this.saleOverlay || this.transitioning) return;
      if (pointer.y > this.scale.height - SLOT_BAR_H - 16 || pointer.y < 42) return;
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
    this.refreshSlots();
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
    const foot = new Phaser.Geom.Rectangle(
      this.player.worldX - PLAYER_W / 2,
      this.player.worldY - PLAYER_FOOT_H,
      PLAYER_W,
      PLAYER_FOOT_H,
    );
    const trunk = this.treeTrunkRect(c, false);
    if (!Phaser.Geom.Rectangle.Overlaps(foot, trunk)) return;

    const current = this.player.tileCoord;
    const safeX = GRID_OX + current.x * TILE + TILE / 2;
    const safeY = GRID_OY + current.y * TILE + TILE / 2;
    this.player.moveTo(safeX, safeY);
  }

  private treeTrunkRect(c: { x: number; y: number }, mature: boolean): Phaser.Geom.Rectangle {
    const trunkW = mature ? 28 : 18;
    const trunkH = mature ? 22 : 12;
    return new Phaser.Geom.Rectangle(
      GRID_OX + c.x * TILE + TILE / 2 - trunkW / 2,
      GRID_OY + c.y * TILE + TILE - trunkH,
      trunkW,
      trunkH,
    );
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
    this.cacauBadge.setText(`x${this.farm.inventory.count(ITEM_CACAU_FRESCO)}`);
    this.energyBar.set(s.energy / s.maxEnergy, `${s.energy}/${s.maxEnergy}`);
    for (const meta of INDICATOR_META) {
      const v = s.indicators[meta.key];
      this.indicatorBars.get(meta.key)!.set(v / 100, String(Math.round(v)));
    }
    this.refreshSlots();

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

  /** Atualiza o realce do slot ativo e os estados visuais dos ícones. */
  private refreshSlots(): void {
    for (const s of this.slots) {
      const selected = s.def.kind === 'tool' && s.def.tool === this.tool;
      s.selector.setVisible(selected);
      if (s.icon && s.def.icon) {
        const useSelected = selected || s.hovered;
        s.icon.setTexture(useSelected && s.def.iconSelected ? s.def.iconSelected : s.def.icon);
        s.icon.setDisplaySize(s.def.iconW ?? SLOT_ICON, s.def.iconH ?? SLOT_ICON);
        s.icon.setAlpha(s.def.kind === 'empty' ? 0.35 : 1);
      }
    }
  }
}
