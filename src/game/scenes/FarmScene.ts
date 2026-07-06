import Phaser from 'phaser';
import { Farm, ITEM_CACAU_FRESCO, type IndicatorKey } from '../../domain';
import { TILE, TextureKey, cacaoTextureKey } from '../assets';

/**
 * Cena principal (ADAPTER — Phaser). Guarda uma instância de `Farm` (o domínio),
 * traduz input em ações e redesenha a partir de `farm.snapshot()`.
 * NENHUMA regra de jogo mora aqui (ADR 0002).
 */

const GRID_OX = 24;
const GRID_OY = 96;

type Tool = 'tree' | 'cacao' | 'harvest';

const INDICATOR_META: ReadonlyArray<{ key: IndicatorKey; label: string; color: number }> = [
  { key: 'biodiversidade', label: 'Biodiversidade', color: 0x4e9e57 },
  { key: 'economia', label: 'Economia', color: 0xf2c14e },
  { key: 'comunidade', label: 'Comunidade', color: 0x4e8fd0 },
];

interface Bar {
  fill: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  width: number;
}

interface Button {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export class FarmScene extends Phaser.Scene {
  private farm!: Farm;
  private tool: Tool = 'tree';

  private plantLayer!: Phaser.GameObjects.Container;
  private shadeGfx!: Phaser.GameObjects.Graphics;

  private dayText!: Phaser.GameObjects.Text;
  private energyBar!: Bar;
  private indicatorBars!: Map<IndicatorKey, Bar>;
  private invText!: Phaser.GameObjects.Text;
  private toolButtons!: Map<Tool, Button>;
  private endOverlay: Phaser.GameObjects.Container | undefined;

  constructor() {
    super('FarmScene');
  }

  create(): void {
    this.farm = new Farm();
    this.tool = 'tree';
    this.indicatorBars = new Map();
    this.toolButtons = new Map();
    this.endOverlay = undefined;

    this.drawGrassBackground();
    this.shadeGfx = this.add.graphics();
    this.plantLayer = this.add.container(0, 0);

    this.buildHud();
    this.bindInput();
    this.redraw();
  }

  // ─── Setup estático ─────────────────────────────────────────────────────────

  private drawGrassBackground(): void {
    const s = this.farm.snapshot();
    for (const t of s.tiles) {
      this.add.image(GRID_OX + t.x * TILE, GRID_OY + t.y * TILE, TextureKey.Grass).setOrigin(0, 0);
    }
  }

  private buildHud(): void {
    const panelX = GRID_OX + 8 * TILE + 24;
    this.add.text(panelX, 20, 'CABRUCA', { fontFamily: 'monospace', fontSize: '26px', color: '#e8f3e6' });
    this.add.text(panelX, 50, 'Game Jam "Aqui é BR"', { fontFamily: 'monospace', fontSize: '12px', color: '#8fb593' });

    this.dayText = this.add.text(panelX, 86, '', { fontFamily: 'monospace', fontSize: '16px', color: '#e8f3e6' });

    // Energia
    this.add.text(panelX, 118, 'Energia', { fontFamily: 'monospace', fontSize: '13px', color: '#cfe3cf' });
    this.energyBar = this.makeBar(panelX, 136, 300, 16, 0xe6c34a);

    // Indicadores
    let y = 176;
    for (const meta of INDICATOR_META) {
      this.add.text(panelX, y, meta.label, { fontFamily: 'monospace', fontSize: '13px', color: '#cfe3cf' });
      this.indicatorBars.set(meta.key, this.makeBar(panelX, y + 18, 300, 18, meta.color));
      y += 54;
    }

    // Inventário
    this.invText = this.add.text(panelX, y + 4, '', { fontFamily: 'monospace', fontSize: '15px', color: '#e8f3e6' });

    // Ferramentas
    const toolY = y + 44;
    this.add.text(panelX, toolY - 22, 'Ferramenta (teclas 1/2/3):', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8fb593',
    });
    this.toolButtons.set('tree', this.makeButton(panelX + 48, toolY + 14, 96, 34, '1 Nativa', () => this.setTool('tree')));
    this.toolButtons.set('cacao', this.makeButton(panelX + 150, toolY + 14, 96, 34, '2 Cacau', () => this.setTool('cacao')));
    this.toolButtons.set('harvest', this.makeButton(panelX + 252, toolY + 14, 96, 34, '3 Colher', () => this.setTool('harvest')));

    // Ações
    this.makeButton(panelX + 74, toolY + 62, 148, 36, 'Vender cacau [V]', () => this.doSell());
    this.makeButton(panelX + 234, toolY + 62, 130, 36, 'Dormir [Espaço]', () => this.doSleep());

    this.add.text(panelX, toolY + 92,
      'Nativas maduras dão sombra aos\n8 vizinhos. Cacau: sombra 1 = ideal,\n0 = morre em 3 dias, 2+ = mais lento.',
      { fontFamily: 'monospace', fontSize: '11px', color: '#7ba081', lineSpacing: 3 });
  }

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.endOverlay) return;
      const x = Math.floor((p.x - GRID_OX) / TILE);
      const y = Math.floor((p.y - GRID_OY) / TILE);
      const c = { x, y };
      if (!this.farm.grid.inBounds(c)) return;
      switch (this.tool) {
        case 'tree': this.farm.plantTree(c); break;
        case 'cacao': this.farm.plantCacao(c); break;
        case 'harvest': this.farm.harvest(c); break;
      }
      this.redraw();
    });

    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-ONE', () => this.setTool('tree'));
    kb.on('keydown-TWO', () => this.setTool('cacao'));
    kb.on('keydown-THREE', () => this.setTool('harvest'));
    kb.on('keydown-SPACE', () => this.doSleep());
    kb.on('keydown-V', () => this.doSell());
    kb.on('keydown-R', () => this.restart());
  }

  // ─── Ações do adapter ───────────────────────────────────────────────────────

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.refreshToolHighlight();
  }

  private doSleep(): void {
    if (this.endOverlay) return;
    this.farm.sleep();
    this.redraw();
  }

  private doSell(): void {
    if (this.endOverlay) return;
    this.farm.sell(ITEM_CACAU_FRESCO, this.farm.inventory.count(ITEM_CACAU_FRESCO));
    this.redraw();
  }

  private restart(): void {
    this.endOverlay?.destroy();
    this.endOverlay = undefined;
    this.scene.restart();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  private redraw(): void {
    const s = this.farm.snapshot();

    this.plantLayer.removeAll(true);
    this.shadeGfx.clear();

    for (const t of s.tiles) {
      const px = GRID_OX + t.x * TILE;
      const py = GRID_OY + t.y * TILE;

      // Overlay de sombra (só onde não há árvore, para o jogador ler a zona).
      if (t.kind !== 'tree') {
        if (t.shadeStatus === 'ideal') this.shadeGfx.fillStyle(0x8fffa0, 0.16).fillRect(px, py, TILE, TILE);
        else if (t.shadeStatus === 'mata_fechada') this.shadeGfx.fillStyle(0x08160d, 0.4).fillRect(px, py, TILE, TILE);
      }

      if (t.kind === 'tree') {
        const key = t.matureTree ? TextureKey.TreeMature : TextureKey.TreeSapling;
        this.plantLayer.add(this.add.image(px, py, key).setOrigin(0, 0));
      } else if (t.kind === 'cacao' && t.cacao) {
        this.plantLayer.add(this.add.image(px, py, cacaoTextureKey(t.cacao.stage, t.cacao.dead)).setOrigin(0, 0));
        // Anel de alerta: cacau vivo em sol pleno (estresse).
        if (!t.cacao.dead && t.shadeStatus === 'sol_pleno') {
          this.shadeGfx.lineStyle(3, 0xff5a3c, 0.9).strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        }
        // Destaque de colhível.
        if (t.cacao.harvestable) {
          this.shadeGfx.lineStyle(3, 0xffd34a, 0.95).strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        }
      }
    }

    // HUD
    this.dayText.setText(`Dia ${Math.min(s.day, s.totalDays)} / ${s.totalDays}`);
    this.setBar(this.energyBar, s.energy / s.maxEnergy, `${s.energy}/${s.maxEnergy}`);
    for (const meta of INDICATOR_META) {
      const bar = this.indicatorBars.get(meta.key)!;
      const v = s.indicators[meta.key];
      this.setBar(bar, v / 100, String(Math.round(v)));
    }
    this.invText.setText(`Cacau fresco no inventário: ${this.farm.inventory.count(ITEM_CACAU_FRESCO)}`);
    this.refreshToolHighlight();

    if (s.phase !== 'jogando') this.showEnd(s.phase, s.indicators);
  }

  private showEnd(phase: 'vitoria' | 'derrota', indicators: Record<IndicatorKey, number>): void {
    if (this.endOverlay) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const won = phase === 'vitoria';
    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x05100a, 0.82);
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
    this.endOverlay = this.add.container(0, 0, [bg, title, sub, statsText, btn]);
  }

  // ─── Helpers de UI ──────────────────────────────────────────────────────────

  private makeBar(x: number, y: number, width: number, height: number, color: number): Bar {
    this.add.rectangle(x, y, width, height, 0x142519).setOrigin(0, 0).setStrokeStyle(1, 0x3a5a3f);
    const fill = this.add.rectangle(x, y, width, height, color).setOrigin(0, 0);
    const text = this.add.text(x + width + 8, y - 1, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8f3e6',
    });
    return { fill, text, width };
  }

  private setBar(bar: Bar, pct: number, label: string): void {
    bar.fill.width = Math.max(0, Math.min(1, pct)) * bar.width;
    bar.text.setText(label);
  }

  private makeButton(cx: number, cy: number, w: number, h: number, label: string, onClick: () => void): Button {
    const rect = this.add.rectangle(cx, cy, w, h, 0x1d3a24)
      .setStrokeStyle(2, 0x3f7a2e)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(cx, cy, label, {
      fontFamily: 'monospace', fontSize: '14px', color: '#dfeee0',
    }).setOrigin(0.5);
    rect.on('pointerdown', onClick);
    return { rect, text };
  }

  private refreshToolHighlight(): void {
    for (const [tool, btn] of this.toolButtons) {
      const active = tool === this.tool;
      btn.rect.setFillStyle(active ? 0x3f7a2e : 0x1d3a24);
      btn.text.setColor(active ? '#ffffff' : '#dfeee0');
    }
  }
}
