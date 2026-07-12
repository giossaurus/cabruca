import Phaser from 'phaser';
import { TextureKey } from '../assets';
import { noteGamepadUse } from '../gamepad';
import { UI } from '../ui';

/** Splash pré-menu: logo Scienza → equipe → menu. */
export class SplashScene extends Phaser.Scene {
  private skipped = false;

  constructor() {
    super('SplashScene');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, UI.color.bgMenu);

    const logo = this.add.image(w / 2, h / 2 - 12, TextureKey.ScienzaLogo)
      .setOrigin(0.5)
      .setDisplaySize(420, 252)
      .setAlpha(0);
    const team = this.add.text(w / 2, h / 2 - 8, 'Equipe:\nFabrine Vitoria\nMaria Clara Barros\nGiovanni Della Dea', {
      fontFamily: '"RoadPixel", monospace',
      fontSize: UI.size.heading,
      color: UI.text.primary,
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setAlpha(0);

    this.input.keyboard?.once('keydown', () => this.skip());
    this.input.once('pointerdown', () => this.skip());
    this.input.gamepad?.once('down', (pad: Phaser.Input.Gamepad.Gamepad) => {
      noteGamepadUse(pad);
      this.skip();
    });

    this.tweens.add({
      targets: logo,
      alpha: 1,
      duration: 650,
      onComplete: () => {
        this.time.delayedCall(900, () => {
          if (this.skipped) return;
          this.tweens.add({
            targets: logo,
            alpha: 0,
            duration: 550,
            onComplete: () => this.showTeam(team),
          });
        });
      },
    });
  }

  private showTeam(team: Phaser.GameObjects.Text): void {
    this.tweens.add({
      targets: team,
      alpha: 1,
      duration: 600,
      onComplete: () => {
        this.time.delayedCall(1100, () => {
          if (this.skipped) return;
          this.tweens.add({
            targets: team,
            alpha: 0,
            duration: 550,
            onComplete: () => this.scene.start('MenuScene'),
          });
        });
      },
    });
  }

  private skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    this.time.delayedCall(50, () => this.scene.start('MenuScene'));
  }
}
