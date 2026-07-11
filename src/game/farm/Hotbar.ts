import Phaser from 'phaser';
import { TextureKey } from '../assets';
import { DEPTH } from '../depths';

/** Ferramenta ativa do jogador (aplicada no tile com E/Espaço). */
export type Tool = 'tree' | 'cacao' | 'harvest' | 'prune';

/** Medidas da hotbar pixel UI própria (sem PNG externo). */
const SLOT_SIZE = 56;
const SLOT_GAP = 4;
const SLOT_PAD = 8;
const SLOT_COUNT = 6;
const SLOT_BAR_W = SLOT_COUNT * SLOT_SIZE + (SLOT_COUNT - 1) * SLOT_GAP + SLOT_PAD * 2;
const SLOT_BAR_H = SLOT_SIZE + SLOT_PAD * 2;
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

/** O que a hotbar precisa da cena: guardas e despacho das ações. A cena continua
 * dona da ferramenta ativa e da lógica; aqui só se renderiza e despacha. */
export interface HotbarHooks {
  isUiLocked(): boolean;
  onToolSelected(tool: Tool): void;
  onSleep(): void;
  onSell(): void;
}

/** Hotbar pixel UI própria (estilo Minecraft): 6 slots de ferramentas/ações. */
export class Hotbar {
  static readonly BAR_H = SLOT_BAR_H;
  /** Retângulo da barra em coordenadas de TELA (para oclusão com o jogador). */
  readonly bounds: Phaser.Geom.Rectangle;

  private readonly layer: Phaser.GameObjects.Container;
  private readonly slots: SlotUI[] = [];
  private cacauBadge!: Phaser.GameObjects.Text;
  private tool: Tool = 'tree';

  constructor(private readonly scene: Phaser.Scene, private readonly hooks: HotbarHooks) {
    const barW = SLOT_BAR_W; // largura fixa (não acompanha o talhão largo)
    const barH = SLOT_BAR_H;
    const barX = (scene.scale.width - barW) / 2; // centralizada
    const barY = scene.scale.height - barH - 10; // fixa no rodapé da VIEWPORT

    // Container fixo à câmera (a câmera segue o jogador) e acima da névoa.
    const layer = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.slotbar);
    this.layer = layer;
    this.bounds = new Phaser.Geom.Rectangle(barX, barY, barW, barH);
    layer.add(scene.add.rectangle(barX, barY, barW, barH, 0x2a1a10).setOrigin(0, 0));
    layer.add(scene.add.rectangle(barX + 3, barY + 3, barW - 6, barH - 6, 0x7b4a27).setOrigin(0, 0));
    layer.add(scene.add.rectangle(barX + 6, barY + 6, barW - 12, barH - 12, 0x3a2418).setOrigin(0, 0));

    const defs = this.slotDefs();
    const cy = barY + SLOT_PAD + SLOT_SIZE / 2;
    defs.forEach((def, i) => {
      const sx = barX + SLOT_PAD + i * (SLOT_SIZE + SLOT_GAP);
      const sy = barY + SLOT_PAD;
      const cx = sx + SLOT_SIZE / 2;
      layer.add(scene.add.rectangle(sx, sy, SLOT_SIZE, SLOT_SIZE, 0xd1a184).setOrigin(0, 0));
      layer.add(scene.add.rectangle(sx + 4, sy + 4, SLOT_SIZE - 8, SLOT_SIZE - 8, 0x5a3822).setOrigin(0, 0));
      layer.add(scene.add.rectangle(sx + 6, sy + 6, SLOT_SIZE - 12, SLOT_SIZE - 12, 0xe2b79e).setOrigin(0, 0).setAlpha(0.82));

      let icon: Phaser.GameObjects.Image | undefined;
      if (def.icon) {
        icon = scene.add.image(cx, cy, def.icon).setDisplaySize(def.iconW ?? SLOT_ICON, def.iconH ?? SLOT_ICON);
        layer.add(icon);
      } else if (def.kind !== 'empty') {
        layer.add(scene.add.text(cx, cy, def.key, {
          fontFamily: 'monospace', fontSize: '11px', color: '#f2e6cf', align: 'center',
        }).setOrigin(0.5));
      }
      // número do slot (canto superior esquerdo)
      layer.add(scene.add.text(cx - SLOT_ICON / 2, cy - SLOT_ICON / 2 - 6, String(i + 1), {
        fontFamily: 'monospace', fontSize: '10px', color: '#3a2a17',
      }).setOrigin(0, 0));

      // Contador de cacau colhido (substitui o inventário): badge no slot Cacau.
      if (def.tool === 'cacao') {
        this.cacauBadge = scene.add
          .text(sx + SLOT_SIZE - 3, sy + SLOT_SIZE - 3, 'x0', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ffd34a',
            backgroundColor: '#2a1a10cc',
          })
          .setOrigin(1, 1)
          .setPadding(3, 1, 3, 1);
        layer.add(this.cacauBadge);
      }

      const selector = scene.add
        .rectangle(cx, cy, SLOT_SIZE - 4, SLOT_SIZE - 4)
        .setStrokeStyle(3, 0xffffff, 0.95).setVisible(false);
      layer.add(selector);

      const ui: SlotUI = { def, cx, cy, selector, icon, hovered: false };
      this.slots.push(ui);

      // hitbox transparente clicável cobrindo o slot
      const hit = scene.add
        .rectangle(cx, cy, SLOT_SIZE, SLOT_SIZE, 0xffffff, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: def.kind !== 'empty' });
      hit.on('pointerover', () => { ui.hovered = true; this.refresh(); });
      hit.on('pointerout', () => { ui.hovered = false; this.refresh(); });
      hit.on('pointerdown', () => this.choose(i));
      layer.add(hit);
    });
  }

  private slotDefs(): SlotDef[] {
    return [
      { key: 'Nativa', kind: 'tool', tool: 'tree', icon: TextureKey.Seedling, iconW: 22, iconH: 44 },
      { key: 'Cacau', kind: 'tool', tool: 'cacao', icon: TextureKey.IconCacao },
      { key: 'Colher', kind: 'tool', tool: 'harvest', icon: TextureKey.IconHarvest },
      { key: 'Podar', kind: 'tool', tool: 'prune', icon: TextureKey.IconPrune },
      { key: 'Dormir', kind: 'action', run: () => this.hooks.onSleep(), icon: TextureKey.CottageClosed, iconW: 40, iconH: 42 },
      { key: 'Vender', kind: 'action', run: () => this.hooks.onSell(), icon: TextureKey.IconSell },
    ];
  }

  /** Escolhe um slot: ferramenta vira ativa; ação imediata executa na hora. */
  choose(i: number): void {
    if (this.hooks.isUiLocked()) return;
    const def = this.slots[i]?.def;
    if (!def) return;
    if (def.kind === 'tool' && def.tool) this.hooks.onToolSelected(def.tool);
    else if (def.kind === 'action' && def.run) def.run();
  }

  /** Espelha a ferramenta ativa da cena no realce dos slots. */
  setTool(tool: Tool): void {
    this.tool = tool;
    this.refresh();
  }

  /** Atualiza o badge do slot Cacau (chamado a cada redraw da cena). */
  setCacaoCount(n: number): void {
    this.cacauBadge.setText(`x${n}`);
    this.refresh();
  }

  /** Semitransparência quando o jogador anda por trás da barra. */
  setAlpha(a: number): void {
    this.layer.setAlpha(a);
  }

  /** Atualiza o realce do slot ativo e os estados visuais dos ícones. */
  private refresh(): void {
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
