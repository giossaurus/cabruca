import Phaser from 'phaser';
import { Farm, ITEM_CACAU_FRESCO, type IndicatorKey } from '../../domain';
import { TILE, TextureKey, cacaoTextureKey } from '../assets';
import { Player } from '../Player';
import { GRID_DEBUG } from '../debug';
import { UI, StatBar, Panel, Button, loadSettings } from '../ui';
import * as audio from '../audio';

/**
 * Cena principal (ADAPTER — Phaser). Guarda uma instância de `Farm` (o domínio),
 * traduz input em ações e redesenha a partir de `farm.snapshot()`.
 * NENHUMA regra de jogo mora aqui (ADR 0002).
 *
 * Interação cozy: o jogador ANDA pela fazenda (WASD/setas) e age no tile onde
 * pisa (E/Espaço). Ferramentas ficam numa hotbar inferior; a status bar (dia,
 * energia, indicadores) é uma faixa integrada no topo, sobre o mundo; o
 * inventário é um modal (tecla I).
 */

// Mundo maior que a tela (960×640): a câmera segue o jogador e o mapa vai sendo
// revelado (fog). O talhão 13×8 (13*64=832 × 8*64=512) fica centralizado na
// horizontal e na metade inferior, deixando o norte para a casa e o cenário.
const WORLD_W = 1920;
const WORLD_H = 1408;
const GRID_OX = Math.round((WORLD_W - 13 * 64) / 2); // 544
const GRID_OY = 768; // espaço ao norte para casa/cenário
/** Largura fixa da hotbar (independente da largura do talhão). */
const SLOT_BAR_W = 512;

// Faixas de profundidade. O fog cobre TODO o mundo (acima de plantas/jogador,
// cujo depth vai até ~WORLD_H); a UI fica acima do fog; overlays acima de tudo.
const DEPTH_FOG = 1400;
const DEPTH_HUD = 1500;
const DEPTH_SLOTBAR = 1450;
const DEPTH_HELP = 1600;
const DEPTH_TRANSITION = 5000;
/** Diâmetro do "pincel" que apaga a névoa ao redor do jogador (raio ~150px). */
const FOG_BRUSH = 300;

/** Rótulos amigáveis de itens do inventário (itemId → texto exibido). */
const ITEM_LABEL: Record<string, string> = {
  [ITEM_CACAU_FRESCO]: 'Cacau',
};

/** A ajuda auto-abre uma vez por sessão (não a cada reinício). */
let helpAutoShown = false;

type Tool = 'tree' | 'cacao' | 'harvest' | 'prune';

/**
 * Centros-X dos 9 slots como fração da largura da slot_bar (a moldura de madeira
 * faz os slots NÃO serem largura/9). Medidos do PNG; ajuste fino a olho.
 */
const SLOT_FRACS = [0.065, 0.173, 0.282, 0.39, 0.498, 0.607, 0.716, 0.824, 0.934] as const;
const SLOT_BAR_RATIO = 750 / 5250; // altura / largura do PNG
const SLOT_ICON = 40; // px do ícone dentro do slot

/** Definição de um slot da hotbar (ação do jogador simbolizada por ícone/texto). */
interface SlotDef {
  readonly key: string; // rótulo curto (placeholder enquanto não há ícone)
  readonly kind: 'tool' | 'action' | 'empty';
  readonly tool?: Tool; // slots de ferramenta (aplicadas no tile com E/Espaço)
  readonly run?: () => void; // slots de ação imediata (dormir/vender)
  readonly icon?: string; // textura do ícone (estado normal)
  readonly iconSelected?: string; // textura quando selecionado/hover
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
  { key: 'biodiversidade', label: 'Biodiversidade', color: 0x4e9e57 },
  { key: 'economia', label: 'Economia', color: 0xf2c14e },
  { key: 'comunidade', label: 'Comunidade', color: 0x4e8fd0 },
];

interface MoveKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export class FarmScene extends Phaser.Scene {
  private farm!: Farm;
  private tool: Tool = 'tree';
  private player!: Player;
  private moveKeys: MoveKeys[] = [];

  private plantLayer!: Phaser.GameObjects.Container;
  private shadeGfx!: Phaser.GameObjects.Graphics;
  private markerGfx!: Phaser.GameObjects.Graphics;

  private fog!: Phaser.GameObjects.RenderTexture;
  private obstacles: Phaser.Geom.Rectangle[] = [];
  private doorZone!: Phaser.Geom.Rectangle;
  private transitioning = false;

  private dayText!: Phaser.GameObjects.Text;
  private energyBar!: StatBar;
  private indicatorBars!: Map<IndicatorKey, StatBar>;
  private slots: SlotUI[] = [];
  private endOverlay: Phaser.GameObjects.Container | undefined;
  private invOverlay: Phaser.GameObjects.Container | undefined;
  private helpOverlay: Phaser.GameObjects.Container | undefined;

  constructor() {
    super('FarmScene');
  }

  create(): void {
    this.farm = new Farm();
    this.tool = 'tree';
    this.indicatorBars = new Map();
    this.slots = [];
    this.endOverlay = undefined;
    this.invOverlay = undefined;
    this.helpOverlay = undefined;
    this.obstacles = [];
    this.transitioning = false;

    // Trilhas: música (com duck) + ambiente natural. Ao sair do gameplay (voltar
    // ao menu ou reiniciar via PauseScene) paramos o ambiente; a música segue.
    audio.enterGame(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopAmbience());

    // Câmera segue o jogador dentro dos limites do mundo.
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    this.drawGrassBackground();
    this.buildDecorations();
    this.buildHouse();
    this.shadeGfx = this.add.graphics().setDepth(-10);
    this.plantLayer = this.add.container(0, 0).setDepth(0);
    this.markerGfx = this.add.graphics().setDepth(1);

    // Jogador anda por TODO o mundo; interage só quando pisa no talhão.
    const plot = { ox: GRID_OX, oy: GRID_OY, cols: this.farm.grid.width, rows: this.farm.grid.height };
    const world = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
    this.player = new Player(this, this.farm, plot, world, this.obstacles);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    this.buildFog();
    this.buildHud();
    this.buildHelpButton();
    this.buildSlotBar();
    this.bindInput();
    this.redraw();

    // Mostra a ajuda automaticamente na primeira vez da sessão (se "Mostrar dicas" ligado).
    if (!helpAutoShown && loadSettings().showTips) {
      helpAutoShown = true;
      this.toggleHelp();
    }
  }

  override update(_time: number, deltaMs: number): void {
    // Congela em overlays e durante a transição de dia (entrar na casa).
    if (this.endOverlay || this.invOverlay || this.helpOverlay || this.transitioning) return;
    this.player.update(deltaMs, this.readDir());
    this.revealFog();
    this.checkDoor();
    this.drawMarker();
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
    const layer = this.add.container(0, 0).setDepth(-15); // acima da grama, abaixo das plantas
    // Gerador determinístico (LCG) → mesmo cenário todo restart.
    let seed = 1337;
    const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 90; i++) {
      const x = 40 + rnd() * (WORLD_W - 80);
      const y = 60 + rnd() * (WORLD_H - 100);
      if (insidePlot(x, y)) continue; // não polui a área jogável
      const key = keys[Math.floor(rnd() * keys.length)]!;
      const scale = key === TextureKey.DecorFlower ? 2.6 + rnd() * 1.2 : 3 + rnd() * 1.4;
      layer.add(this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(-15));
    }
  }

  /**
   * Casa ao norte/nordeste do talhão. Corpo sólido (colisão) + uma "porta" na
   * base: pisar na porta dispara a transição de dia (ver `enterHouse`). Depth
   * pela base → o jogador passa na frente/atrás corretamente.
   */
  private buildHouse(): void {
    const src = this.textures.get(TextureKey.House).getSourceImage();
    const dispH = 360;
    const dispW = dispH * (src.width / src.height);
    const baseX = GRID_OX + this.farm.grid.width * TILE * 0.72; // nordeste do talhão
    const baseY = GRID_OY - 210; // ao norte, com folga entre casa e talhão

    this.add.image(baseX, baseY, TextureKey.House)
      .setOrigin(0.5, 1)
      .setDisplaySize(dispW, dispH)
      .setDepth(baseY);

    // Corpo sólido: cobre paredes/telhado, deixando a base (porta + chão) livre.
    this.obstacles.push(new Phaser.Geom.Rectangle(
      baseX - dispW * 0.42, baseY - dispH * 0.92, dispW * 0.84, dispH * 0.7,
    ));
    // Porta: faixa estreita na base-central; pisar aqui entra na casa.
    this.doorZone = new Phaser.Geom.Rectangle(baseX - 34, baseY - dispH * 0.22, 68, dispH * 0.22 + 8);
  }

  // ─── Névoa (fog of war) ─────────────────────────────────────────────────────

  /** Névoa cobrindo o mundo; o explorado é apagado (permanente). */
  private buildFog(): void {
    this.makeFogBrush();
    this.fog = this.add.renderTexture(0, 0, WORLD_W, WORLD_H).setOrigin(0, 0).setDepth(DEPTH_FOG);
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

  // ─── Casa (transição de dia) ────────────────────────────────────────────────

  /** Pisou na porta → entra na casa (transição de dia). */
  private checkDoor(): void {
    if (this.doorZone.contains(this.player.worldX, this.player.worldY)) this.enterHouse();
  }

  /**
   * Entrar na casa = dormir: a tela escurece, aparece "No dia seguinte..." nas
   * fontes pixelizadas, o dia avança (`farm.sleep`) e clareia de volta.
   */
  private enterHouse(): void {
    if (this.transitioning || this.endOverlay) return;
    this.transitioning = true;
    const w = this.scale.width;
    const h = this.scale.height;
    const black = this.add.rectangle(0, 0, w, h, 0x000000, 1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH_TRANSITION).setAlpha(0);
    const msg = this.add.text(w / 2, h / 2, 'No dia seguinte...', {
      fontFamily: UI.font, fontSize: UI.size.heading, color: UI.text.primary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_TRANSITION + 1).setAlpha(0);

    this.tweens.add({
      targets: black, alpha: 1, duration: 450,
      onComplete: () => {
        this.tweens.add({ targets: msg, alpha: 1, duration: 300 });
        this.farm.sleep(); // avança o dia com a tela preta
        this.redraw();
        // Sai pela porta: reposiciona logo abaixo dela p/ não reentrar em loop.
        this.player.moveTo(this.doorZone.centerX, this.doorZone.bottom + 30);
        this.time.delayedCall(1300, () => {
          this.tweens.add({
            targets: [msg, black], alpha: 0, duration: 450,
            onComplete: () => { msg.destroy(); black.destroy(); this.transitioning = false; },
          });
        });
      },
    });
  }

  /**
   * Status bar INTEGRADA: faixa translúcida no topo, sobre o mundo (não é um
   * painel lateral). Uma linha: dia · energia · três indicadores compactos.
   */
  private buildHud(): void {
    const hud = this.add.container(0, 0).setDepth(1500).setScrollFactor(0);
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
    }).setDepth(DEPTH_HELP).setScrollFactor(0);
  }

  /** Abre/fecha o modal de ajuda (controles + mecânicas). Congela o mundo. */
  private toggleHelp(): void {
    if (this.endOverlay) return;
    if (this.helpOverlay) {
      this.helpOverlay.destroy();
      this.helpOverlay = undefined;
      return;
    }
    const panel = new Panel(this, { width: 460, height: 360, title: 'Como jogar' });
    const blocker = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0.001)
      .setInteractive();
    blocker.on('pointerdown', () => this.toggleHelp()); // clicar fora fecha
    panel.addContent(
      blocker,
      this.add.text(0, -24,
        'WASD / setas: andar (a câmera segue você)\n' +
        'E / Espaço: usar a ferramenta no tile do talhão\n' +
        '1-6: escolher skill na hotbar\n' +
        'Z: dormir   V: vender   I: inventário   ESC: pausar\n\n' +
        'Explore: o mapa se revela nas bordas.\n' +
        'Entre na casa (ao norte) para passar o dia.\n' +
        'Nativas maduras dão sombra aos 8 vizinhos.\n' +
        'Cacau: sombra 1 = ideal · 0 = morre em 3 dias · 2+ = mais lento.\n' +
        'Podar: a nativa para de dar sombra — −biodiversidade, +produtividade.',
        { fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft, align: 'center', lineSpacing: 6, wordWrap: { width: 430 } },
      ).setOrigin(0.5),
      this.add.text(0, 146, 'Clique fora ou ESC para fechar', { fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.muted }).setOrigin(0.5),
    );
    panel.setScrollFactor(0);
    this.helpOverlay = panel;
  }

  /** Hotbar estilo Minecraft: 9 slots de skills na moldura de `slot_bar.png`. */
  private buildSlotBar(): void {
    const barW = SLOT_BAR_W; // largura fixa (não acompanha o talhão largo)
    const barH = barW * SLOT_BAR_RATIO; // ~73
    const barX = (this.scale.width - barW) / 2; // centralizada
    const barY = this.scale.height - barH - 10; // fixa no rodapé da VIEWPORT

    // Container fixo à câmera (a câmera segue o jogador) e acima da névoa.
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH_SLOTBAR);
    layer.add(this.add.image(barX, barY, TextureKey.SlotBar).setOrigin(0, 0).setDisplaySize(barW, barH));

    const defs = this.slotDefs();
    const cy = barY + barH / 2;
    defs.forEach((def, i) => {
      const cx = barX + SLOT_FRACS[i]! * barW;

      let icon: Phaser.GameObjects.Image | undefined;
      if (def.icon) {
        icon = this.add.image(cx, cy, def.icon).setDisplaySize(SLOT_ICON, SLOT_ICON);
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

      const selector = this.add
        .rectangle(cx, cy, SLOT_ICON + 12, SLOT_ICON + 12)
        .setStrokeStyle(3, 0xffffff, 0.95).setVisible(false);
      layer.add(selector);

      const ui: SlotUI = { def, cx, cy, selector, icon, hovered: false };
      this.slots.push(ui);

      // hitbox transparente clicável cobrindo o slot
      const hit = this.add
        .rectangle(cx, cy, SLOT_ICON + 16, barH * 0.9, 0xffffff, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: def.kind !== 'empty' });
      hit.on('pointerover', () => { ui.hovered = true; this.refreshSlots(); });
      hit.on('pointerout', () => { ui.hovered = false; this.refreshSlots(); });
      hit.on('pointerdown', () => this.chooseSlot(i));
      layer.add(hit);
    });
  }

  private slotDefs(): SlotDef[] {
    return [
      { key: 'Nativa', kind: 'tool', tool: 'tree' },
      { key: 'Cacau', kind: 'tool', tool: 'cacao' },
      { key: 'Colher', kind: 'tool', tool: 'harvest' },
      { key: 'Podar', kind: 'tool', tool: 'prune', icon: TextureKey.PodarPrata, iconSelected: TextureKey.PodarPreto },
      { key: 'Dormir', kind: 'action', run: () => this.doSleep() },
      { key: 'Vender', kind: 'action', run: () => this.doSell() },
      { key: '', kind: 'empty' },
      { key: '', kind: 'empty' },
      { key: '', kind: 'empty' },
    ];
  }

  /** Escolhe um slot: ferramenta vira ativa; ação imediata executa na hora. */
  private chooseSlot(i: number): void {
    if (this.endOverlay || this.invOverlay || this.helpOverlay || this.transitioning) return;
    const def = this.slots[i]?.def;
    if (!def) return;
    if (def.kind === 'tool' && def.tool) this.setTool(def.tool);
    else if (def.kind === 'action' && def.run) def.run();
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    // Movimento: setas + WASD (dois conjuntos de teclas).
    const cursors = kb.createCursorKeys();
    const wasd = kb.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.moveKeys = [
      { up: cursors.up!, down: cursors.down!, left: cursors.left!, right: cursors.right! },
      { up: wasd.up!, down: wasd.down!, left: wasd.left!, right: wasd.right! },
    ];

    // Usar ferramenta no tile onde pisa.
    kb.on('keydown-E', () => this.doAction());
    kb.on('keydown-SPACE', () => this.doAction());
    // Slots 1-9 (estilo Minecraft): seleciona ferramenta ou dispara a ação.
    const numKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    numKeys.forEach((k, i) => kb.on(`keydown-${k}`, () => this.chooseSlot(i)));
    // Atalhos diretos das ações imediatas.
    kb.on('keydown-Z', () => this.doSleep());
    kb.on('keydown-V', () => this.doSell());
    kb.on('keydown-R', () => this.restart());
    // Inventário (modal).
    kb.on('keydown-I', () => this.toggleInventory());
    // ESC fecha overlays abertos (inventário/ajuda); senão pausa.
    kb.on('keydown-ESC', () => {
      if (this.invOverlay) this.toggleInventory();
      else if (this.helpOverlay) this.toggleHelp();
      else this.pauseGame();
    });
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
    return { x: Phaser.Math.Clamp(x, -1, 1), y: Phaser.Math.Clamp(y, -1, 1) };
  }

  // ─── Ações do adapter ───────────────────────────────────────────────────────

  private doAction(): void {
    if (this.endOverlay || this.invOverlay || this.helpOverlay || this.transitioning) return;
    if (!this.player.onPlot) return; // fora do talhão não há tile p/ agir
    const c = this.player.tileCoord;
    switch (this.tool) {
      case 'tree': this.farm.plantTree(c); break;
      case 'cacao': this.farm.plantCacao(c); break;
      case 'harvest': this.farm.harvest(c); break;
      case 'prune': this.farm.prune(c); break;
    }
    this.redraw();
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.refreshSlots();
  }

  private doSleep(): void {
    if (this.endOverlay || this.invOverlay || this.helpOverlay || this.transitioning) return;
    this.farm.sleep();
    this.redraw();
  }

  private doSell(): void {
    if (this.endOverlay || this.invOverlay || this.helpOverlay || this.transitioning) return;
    this.farm.sell(ITEM_CACAU_FRESCO, this.farm.inventory.count(ITEM_CACAU_FRESCO));
    this.redraw();
  }

  private pauseGame(): void {
    if (this.endOverlay || this.transitioning) return;
    this.scene.pause();
    this.scene.launch('PauseScene');
  }

  private restart(): void {
    this.endOverlay?.destroy();
    this.endOverlay = undefined;
    this.scene.restart();
  }

  // ─── Inventário (modal) ───────────────────────────────────────────────────────

  /** Abre/fecha o inventário. Enquanto aberto, o mundo fica congelado. */
  private toggleInventory(): void {
    if (this.endOverlay) return;
    if (this.invOverlay) {
      this.invOverlay.destroy();
      this.invOverlay = undefined;
      return;
    }
    this.invOverlay = this.buildInventory();
  }

  /** Modal com a grade de slots do inventário, lida de `farm.snapshot()`. */
  private buildInventory(): Phaser.GameObjects.Container {
    const inv = this.farm.snapshot().inventory;
    const panel = new Panel(this, { width: 340, height: 380, title: 'Inventário' });
    panel.setScrollFactor(0);

    // Bloqueia cliques no mundo/hotbar atrás do modal.
    const blocker = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0.001)
      .setInteractive();
    panel.addContent(blocker);

    const cols = 3;
    const cell = 84;
    const gap = 8;
    const startX = -((cols - 1) * (cell + gap)) / 2;
    const startY = -70;
    inv.forEach((slot, i) => {
      const cx = startX + (i % cols) * (cell + gap);
      const cy = startY + Math.floor(i / cols) * (cell + gap);
      panel.addContent(
        this.add.rectangle(cx, cy, cell, cell, UI.color.panel).setStrokeStyle(2, UI.color.stroke),
      );
      if (slot) {
        const name = ITEM_LABEL[slot.itemId] ?? slot.itemId;
        panel.addContent(
          this.add.text(cx, cy - 10, name, { fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.primary }).setOrigin(0.5),
          this.add.text(cx, cy + 16, `x${slot.qty}`, { fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.accent }).setOrigin(0.5),
        );
      } else {
        panel.addContent(
          this.add.text(cx, cy, String(i + 1), { fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.muted }).setOrigin(0.5),
        );
      }
    });

    panel.addContent(
      this.add.text(0, 152, 'I / ESC para fechar', { fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft }).setOrigin(0.5),
    );
    return panel;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  private drawMarker(): void {
    this.markerGfx.clear();
    if (!this.player.onPlot) return; // sem tile-alvo fora do talhão
    const c = this.player.tileCoord;
    const px = GRID_OX + c.x * TILE;
    const py = GRID_OY + c.y * TILE;
    this.markerGfx.lineStyle(2, 0xffffff, 0.65).strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
  }

  private redraw(): void {
    const s = this.farm.snapshot();

    this.plantLayer.removeAll(true);
    this.shadeGfx.clear();

    for (const t of s.tiles) {
      const px = GRID_OX + t.x * TILE;
      const py = GRID_OY + t.y * TILE;

      // Visualização da grade de sombra (tint ideal / mata fechada): só QA.
      if (GRID_DEBUG && t.kind !== 'tree') {
        if (t.shadeStatus === 'ideal') this.shadeGfx.fillStyle(0x8fffa0, 0.16).fillRect(px, py, TILE, TILE);
        else if (t.shadeStatus === 'mata_fechada') this.shadeGfx.fillStyle(0x08160d, 0.4).fillRect(px, py, TILE, TILE);
      }

      if (t.kind === 'tree') {
        if (t.matureTree) {
          // Árvore nativa madura (dá sombra). Ancorada na base do tile; copa
          // sobe ~2,3 tiles. Aspecto do PNG mantido (111×168 ≈ 0,66).
          const tree = this.add
            .image(px + TILE / 2, py + TILE, TextureKey.TreeMature)
            .setOrigin(0.5, 1)
            .setDisplaySize(TILE * 1.5, TILE * 2.3);
          if (t.pruned) tree.setTint(0xbfa25a); // podada: copa ressecada (não gera sombra)
          this.plantLayer.add(tree);
        } else {
          // Muda recém-plantada = mudinha no buraco (ainda não gera sombra).
          const sap = this.add
            .image(px + TILE / 2, py + TILE * 0.95, TextureKey.Seedling)
            .setOrigin(0.5, 1)
            .setDisplaySize(TILE * 0.42, TILE * 1.1);
          this.plantLayer.add(sap);
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
    this.energyBar.set(s.energy / s.maxEnergy, `${s.energy}/${s.maxEnergy}`);
    for (const meta of INDICATOR_META) {
      const v = s.indicators[meta.key];
      this.indicatorBars.get(meta.key)!.set(v / 100, String(Math.round(v)));
    }
    this.refreshSlots();

    if (s.phase !== 'jogando') this.showEnd(s.phase, s.indicators);
  }

  private showEnd(phase: 'vitoria' | 'derrota', indicators: Record<IndicatorKey, number>): void {
    if (this.endOverlay) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const won = phase === 'vitoria';
    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x05100a, 0.85);
    const title = this.add.text(w / 2, h / 2 - 90, won ? 'VITÓRIA' : 'DERROTA', {
      fontFamily: 'monospace', fontSize: '52px', color: won ? '#7be08a' : '#ff6a4d',
    }).setOrigin(0.5);
    const sub = this.add.text(w / 2, h / 2 - 34,
      won ? 'Você prosperou mantendo o equilíbrio!' : 'O equilíbrio se rompeu.',
      { fontFamily: 'monospace', fontSize: '16px', color: '#cfe3cf' }).setOrigin(0.5);
    const stats = INDICATOR_META
      .map((m) => `${m.label}: ${Math.round(indicators[m.key])}`)
      .join('    ');
    const statsText = this.add.text(w / 2, h / 2 + 6, stats, {
      fontFamily: 'monospace', fontSize: '14px', color: '#a9c9ac',
    }).setOrigin(0.5);
    const btn = this.add.text(w / 2, h / 2 + 70, '  Reiniciar [R]  ', {
      fontFamily: 'monospace', fontSize: '20px', color: '#0d1f13', backgroundColor: '#7bd06a',
    }).setOrigin(0.5).setPadding(8).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.restart());
    this.endOverlay = this.add.container(0, 0, [bg, title, sub, statsText, btn]).setDepth(2000).setScrollFactor(0);
  }

  // ─── Helpers de UI ──────────────────────────────────────────────────────────

  /** Atualiza o realce do slot ativo e o ícone de estado (poda prata↔preto). */
  private refreshSlots(): void {
    for (const s of this.slots) {
      const selected = s.def.kind === 'tool' && s.def.tool === this.tool;
      s.selector.setVisible(selected);
      if (s.icon && s.def.icon) {
        const useSelected = selected || s.hovered;
        s.icon.setTexture(useSelected && s.def.iconSelected ? s.def.iconSelected : s.def.icon);
        s.icon.setDisplaySize(SLOT_ICON, SLOT_ICON);
      }
    }
  }
}
