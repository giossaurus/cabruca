import Phaser from 'phaser';
import { applyAccessibilitySettings, announce } from '../accessibility';
import {
  ACTION_LABEL,
  Button,
  FocusList,
  Panel,
  Slider,
  Toggle,
  UI,
  keyLabel,
  loadSettings,
  normalizeKeyCode,
  resetKeyBindings,
  saveSettings,
  type ActionId,
  type ColorFilter,
  type DisplayMode,
  type FocusItem,
  type Settings,
} from '../ui';
import { DISPLAY_MODE_LABEL, RESOLUTIONS, applyDisplaySettings, resolutionOption } from '../display';
import * as audio from '../audio';

interface OptionsData {
  /** Cena que abriu as opções; é pausada enquanto o modal está aberto. */
  parent: string;
  activeTab: Tab;
}

type Tab = 'comandos' | 'graficos' | 'acessibilidade' | 'sons';

const TAB_ORDER: readonly Tab[] = ['comandos', 'graficos', 'acessibilidade', 'sons'];

const TAB_LABEL: Record<Tab, string> = {
  comandos: 'Comandos',
  graficos: 'Gráficos',
  acessibilidade: 'Acessibilidade',
  sons: 'Sons',
};

const COLOR_FILTERS: ReadonlyArray<{ key: ColorFilter; label: string }> = [
  { key: 'none', label: 'Sem filtro' },
  { key: 'protanopia', label: 'Protanopia' },
  { key: 'deuteranopia', label: 'Deuteranopia' },
  { key: 'tritanopia', label: 'Tritanopia' },
  { key: 'highContrast', label: 'Alto contraste' },
];

const REMAP_ACTIONS: readonly ActionId[] = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'interact',
  'sleep',
  'sell',
  'replant',
  'pause',
];

/** Opções em abas: Comandos, Acessibilidade e Sons. */
export class OptionsScene extends Phaser.Scene {
  private parent = 'MenuScene';
  private settings!: Settings;
  private content!: Phaser.GameObjects.Container;
  private activeTab: Tab = 'comandos';
  private waitingForKey: ActionId | undefined;

  constructor() {
    super('OptionsScene');
  }

  init(data: Partial<OptionsData>): void {
    this.parent = data.parent ?? 'MenuScene';
    this.activeTab = data.activeTab ?? 'comandos';
  }

  create(): void {
    this.settings = loadSettings();
    this.sound.volume = this.settings.volume;
    applyAccessibilitySettings(this.settings);
    announce(this.settings, `Opções, aba ${this.tabLabel(this.activeTab)}.`);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const panel = new Panel(this, { width: 740, height: 560, title: 'Opções' });
    panel.setDepth(3000);

    const focusItems: FocusItem[] = [];
    const tabFocusItems: Array<{ key: Tab; item: FocusItem }> = [];
    const tabs: Array<{ key: Tab; label: string; x: number; w: number }> = TAB_ORDER.map(
      (key, i) => ({ key, label: TAB_LABEL[key], x: cx + (i - 1.5) * 178, w: 168 }),
    );
    for (const tab of tabs) {
      const button = new Button(this, {
        x: tab.x,
        y: cy - 190,
        width: tab.w,
        height: 38,
        label: tab.label,
        fontSize: UI.size.body,
        variant: tab.key === this.activeTab ? 'primary' : 'default',
        onClick: () => this.setTab(tab.key),
      }).setDepth(3001);
      tabFocusItems.push({ key: tab.key, item: {
        label: `Aba ${tab.label}`,
        onFocus: (v) => button.setFocused(v),
        onActivate: () => button.activate(),
        onLeft: () => this.setTab(this.nextTab(tab.key, -1)),
        onRight: () => this.setTab(this.nextTab(tab.key, 1)),
      } });
    }

    this.content = this.add.container(cx, cy + 8).setDepth(3001);
    const activeTabItem = tabFocusItems.find((tab) => tab.key === this.activeTab)?.item;
    if (activeTabItem) focusItems.push(activeTabItem);
    focusItems.push(...this.renderTab());
    focusItems.push(...tabFocusItems.filter((tab) => tab.key !== this.activeTab).map((tab) => tab.item));

    const back = new Button(this, {
      x: cx, y: cy + 235, width: 200, height: 44,
      label: 'Voltar [ESC]', variant: 'primary',
      onClick: () => this.close(),
    }).setDepth(3001);
    focusItems.push({
      label: 'Voltar',
      onFocus: (v) => back.setFocused(v),
      onActivate: () => back.activate(),
    });

    new FocusList(this, focusItems, (message) => announce(loadSettings(), message), 0);
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.waitingForKey) this.close();
    });
  }

  private setTab(tab: Tab): void {
    this.scene.restart({ parent: this.parent, activeTab: tab });
  }

  private renderTab(): FocusItem[] {
    this.content.removeAll(true);
    if (this.activeTab === 'comandos') return this.renderCommands();
    if (this.activeTab === 'graficos') return this.renderGraphics();
    if (this.activeTab === 'acessibilidade') return this.renderAccessibility();
    return this.renderSounds();
  }

  private renderCommands(): FocusItem[] {
    const focusItems: FocusItem[] = [];
    this.content.add(this.add.text(0, -146, 'Setas sempre funcionam nos menus. No jogo, setas continuam como fallback de movimento.', {
      fontFamily: UI.font,
      fontSize: UI.size.small,
      color: UI.text.muted,
      align: 'center',
      wordWrap: { width: 620 },
    }).setOrigin(0.5));

    const mouse = new Toggle(this, {
      x: -310, y: -104, label: 'Mouse no jogo',
      value: this.settings.mouseEnabled,
      onChange: (v) => {
        this.settings.mouseEnabled = v;
        this.persist(`Mouse ${v ? 'ativado' : 'desativado'}.`);
      },
    });
    this.content.add(mouse);
    focusItems.push({
      label: 'Mouse no jogo',
      onFocus: (v) => mouse.setFocused(v),
      onActivate: () => mouse.toggle(),
    });

    this.content.add(this.add.text(72, -104, 'Sensibilidade', {
      fontFamily: UI.font, fontSize: UI.size.small, color: UI.text.soft,
    }).setOrigin(0, 0.5));
    const sensitivity = new Slider(this, {
      x: 226, y: -104, width: 160, value: this.settings.mouseSensitivity,
      onChange: (v) => {
        this.settings.mouseSensitivity = v;
        this.persist('Sensibilidade ajustada.');
      },
    });
    this.content.add(sensitivity);
    focusItems.push({
      label: 'Sensibilidade do mouse',
      onFocus: (v) => sensitivity.setFocused(v),
      onLeft: () => sensitivity.nudge(-0.05),
      onRight: () => sensitivity.nudge(0.05),
    });

    REMAP_ACTIONS.forEach((action, i) => {
      const col = i < 5 ? -310 : 40;
      const row = i % 5;
      const y = -54 + row * 34;
      this.content.add(this.add.text(col, y, ACTION_LABEL[action], {
        fontFamily: UI.font,
        fontSize: UI.size.small,
        color: UI.text.muted,
      }).setOrigin(0, 0.5));
      const button = new Button(this, {
        x: col + 238,
        y,
        width: 96,
        height: 28,
        label: keyLabel(this.settings.keyBindings[action]),
        fontSize: UI.size.small,
        onClick: () => this.captureKey(action, button),
      });
      this.content.add(button);
      focusItems.push({
        label: `${ACTION_LABEL[action]}: ${keyLabel(this.settings.keyBindings[action])}`,
        onFocus: (v) => button.setFocused(v),
        onActivate: () => button.activate(),
      });
    });

    const reset = new Button(this, {
      x: 0,
      y: 142,
      width: 230,
      height: 34,
      label: 'Restaurar comandos',
      fontSize: UI.size.body,
      onClick: () => {
        this.settings = resetKeyBindings(this.settings);
        this.persist('Comandos restaurados.');
        this.setTab('comandos');
      },
    });
    this.content.add(reset);
    focusItems.push({
      label: 'Restaurar comandos',
      onFocus: (v) => reset.setFocused(v),
      onActivate: () => reset.activate(),
    });

    return focusItems;
  }

  private renderGraphics(): FocusItem[] {
    const focusItems: FocusItem[] = [];

    const fullscreen = new Toggle(this, {
      x: -310, y: -104, label: 'Tela cheia',
      value: this.scale.isFullscreen,
      onChange: () => {
        this.scale.toggleFullscreen();
        announce(this.settings, this.scale.isFullscreen ? 'Tela cheia ativada.' : 'Tela cheia desativada.');
      },
    });
    this.content.add(fullscreen);
    focusItems.push({
      label: 'Tela cheia',
      onFocus: (v) => fullscreen.setFocused(v),
      onActivate: () => fullscreen.toggle(),
    });

    this.content.add(this.add.text(-310, -46, 'Modo de exibição', {
      fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.soft,
    }).setOrigin(0, 0.5));
    const mode = new Button(this, {
      x: 40, y: -46, width: 300, height: 36,
      label: this.displayModeLabel(), fontSize: UI.size.body,
      onClick: () => { this.cycleDisplayMode(1); mode.setLabel(this.displayModeLabel()); },
    });
    this.content.add(mode);
    focusItems.push({
      label: `Modo de exibição: ${this.displayModeLabel()}`,
      onFocus: (v) => mode.setFocused(v),
      onActivate: () => { this.cycleDisplayMode(1); mode.setLabel(this.displayModeLabel()); },
      onLeft: () => { this.cycleDisplayMode(-1); mode.setLabel(this.displayModeLabel()); },
      onRight: () => { this.cycleDisplayMode(1); mode.setLabel(this.displayModeLabel()); },
    });

    this.content.add(this.add.text(-310, 12, 'Resolução', {
      fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.soft,
    }).setOrigin(0, 0.5));
    const resolution = new Button(this, {
      x: 40, y: 12, width: 300, height: 36,
      label: this.resolutionLabel(), fontSize: UI.size.body,
      onClick: () => { this.cycleResolution(1); resolution.setLabel(this.resolutionLabel()); },
    });
    this.content.add(resolution);
    focusItems.push({
      label: `Resolução: ${this.resolutionLabel()}`,
      onFocus: (v) => resolution.setFocused(v),
      onActivate: () => { this.cycleResolution(1); resolution.setLabel(this.resolutionLabel()); },
      onLeft: () => { this.cycleResolution(-1); resolution.setLabel(this.resolutionLabel()); },
      onRight: () => { this.cycleResolution(1); resolution.setLabel(this.resolutionLabel()); },
    });

    this.content.add(this.add.text(0, 96,
      'Ajustar mantém a proporção com barras nas laterais; Preencher ocupa a janela inteira. ' +
      'No navegador, a resolução limita o tamanho do jogo (fundo preto em volta); empacotado em ' +
      'desktop (Electron), redimensiona a janela do sistema.',
      {
        fontFamily: UI.font,
        fontSize: UI.size.small,
        color: UI.text.soft,
        align: 'center',
        wordWrap: { width: 620 },
        lineSpacing: 6,
      }).setOrigin(0.5));

    return focusItems;
  }

  private renderAccessibility(): FocusItem[] {
    const focusItems: FocusItem[] = [];
    const tips = new Toggle(this, {
      x: -310, y: -104, label: 'Mostrar dicas contextuais',
      value: this.settings.showTips,
      onChange: (v) => {
        this.settings.showTips = v;
        this.persist(`Dicas ${v ? 'ativadas' : 'desativadas'}.`);
      },
    });
    this.content.add(tips);
    focusItems.push({
      label: 'Mostrar dicas contextuais',
      onFocus: (v) => tips.setFocused(v),
      onActivate: () => tips.toggle(),
    });

    const screenReader = new Toggle(this, {
      x: -310, y: -58, label: 'VoiceOver / leitor de tela',
      value: this.settings.screenReader,
      onChange: (v) => {
        this.settings.screenReader = v;
        this.persist(`Leitor de tela ${v ? 'ativado' : 'desativado'}.`);
      },
    });
    this.content.add(screenReader);
    focusItems.push({
      label: 'VoiceOver e leitores de tela',
      onFocus: (v) => screenReader.setFocused(v),
      onActivate: () => screenReader.toggle(),
    });

    this.content.add(this.add.text(-310, -6, 'Filtro visual', {
      fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.soft,
    }).setOrigin(0, 0.5));
    const filter = new Button(this, {
      x: 40,
      y: -6,
      width: 260,
      height: 36,
      label: this.colorFilterLabel(),
      fontSize: UI.size.body,
      onClick: () => {
        this.cycleColorFilter(1);
        filter.setLabel(this.colorFilterLabel());
      },
    });
    this.content.add(filter);
    focusItems.push({
      label: `Filtro visual: ${this.colorFilterLabel()}`,
      onFocus: (v) => filter.setFocused(v),
      onActivate: () => filter.activate(),
      onLeft: () => {
        this.cycleColorFilter(-1);
        filter.setLabel(this.colorFilterLabel());
      },
      onRight: () => {
        this.cycleColorFilter(1);
        filter.setLabel(this.colorFilterLabel());
      },
    });

    this.content.add(this.add.text(0, 84,
      'O modo leitor de tela cria anúncios fora do canvas para VoiceOver, NVDA e JAWS. Filtros visuais são aplicados ao jogo inteiro.',
      {
        fontFamily: UI.font,
        fontSize: UI.size.small,
        color: UI.text.soft,
        align: 'center',
        wordWrap: { width: 620 },
        lineSpacing: 6,
      }).setOrigin(0.5));

    return focusItems;
  }

  private renderSounds(): FocusItem[] {
    const focusItems: FocusItem[] = [];
    const addVolume = (label: string, y: number, value: number, set: (s: Settings, v: number) => void): void => {
      this.content.add(this.add.text(-250, y, label, {
        fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.soft,
      }).setOrigin(0, 0.5));
      const slider = new Slider(this, {
        x: -70, y, width: 300, value,
        onChange: (v) => {
          set(this.settings, v);
          saveSettings(this.settings);
          audio.applySettings(this);
          announce(this.settings, `${label} ${Math.round(v * 100)}%.`);
        },
      });
      this.content.add(slider);
      focusItems.push({
        label,
        onFocus: (v) => slider.setFocused(v),
        onLeft: () => slider.nudge(-0.05),
        onRight: () => slider.nudge(0.05),
      });
    };

    addVolume('Volume', -82, this.settings.volume, (s, v) => { s.volume = v; });
    addVolume('Música', -20, this.settings.musicVolume, (s, v) => { s.musicVolume = v; });
    addVolume('Ambiente', 42, this.settings.ambienceVolume, (s, v) => { s.ambienceVolume = v; });
    return focusItems;
  }

  private captureKey(action: ActionId, button: Button): void {
    if (this.waitingForKey) return;
    this.waitingForKey = action;
    button.setLabel('...');
    announce(this.settings, `Pressione a nova tecla para ${ACTION_LABEL[action]}.`);
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      const code = normalizeKeyCode(e);
      this.settings.keyBindings[action] = code;
      this.waitingForKey = undefined;
      button.setLabel(keyLabel(code));
      this.persist(`${ACTION_LABEL[action]} definido como ${keyLabel(code)}.`);
    };
    document.addEventListener('keydown', handler, { capture: true, once: true });
  }

  private cycleColorFilter(delta: number): void {
    const i = COLOR_FILTERS.findIndex((f) => f.key === this.settings.colorFilter);
    const next = Phaser.Math.Wrap(i + delta, 0, COLOR_FILTERS.length);
    const filter = COLOR_FILTERS[next] ?? COLOR_FILTERS[0]!;
    this.settings.colorFilter = filter.key;
    this.persist(`Filtro visual: ${filter.label}.`);
  }

  private colorFilterLabel(): string {
    return COLOR_FILTERS.find((f) => f.key === this.settings.colorFilter)?.label ?? COLOR_FILTERS[0]!.label;
  }

  private cycleDisplayMode(delta: number): void {
    const modes: DisplayMode[] = ['fit', 'fill'];
    const i = modes.indexOf(this.settings.displayMode);
    this.settings.displayMode = modes[Phaser.Math.Wrap(i + delta, 0, modes.length)]!;
    this.applyDisplay(`Modo de exibição: ${this.displayModeLabel()}.`);
  }

  private displayModeLabel(): string {
    return DISPLAY_MODE_LABEL[this.settings.displayMode];
  }

  private cycleResolution(delta: number): void {
    const i = RESOLUTIONS.findIndex((r) => r.id === this.settings.resolution);
    const next = Phaser.Math.Wrap((i < 0 ? 0 : i) + delta, 0, RESOLUTIONS.length);
    this.settings.resolution = RESOLUTIONS[next]!.id;
    this.applyDisplay(`Resolução: ${this.resolutionLabel()}.`);
  }

  private resolutionLabel(): string {
    return resolutionOption(this.settings.resolution).label;
  }

  private applyDisplay(message: string): void {
    saveSettings(this.settings);
    applyDisplaySettings(this.game, this.settings);
    announce(this.settings, message);
  }

  private tabLabel(tab: Tab): string {
    return TAB_LABEL[tab];
  }

  private nextTab(tab: Tab, delta: number): Tab {
    const index = TAB_ORDER.indexOf(tab);
    return TAB_ORDER[Phaser.Math.Wrap(index + delta, 0, TAB_ORDER.length)]!;
  }

  private persist(message: string): void {
    saveSettings(this.settings);
    applyAccessibilitySettings(this.settings);
    announce(this.settings, message);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.parent);
  }
}
