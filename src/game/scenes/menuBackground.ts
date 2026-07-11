import Phaser from 'phaser';
import { TextureKey } from '../assets';

const MENU_BACKGROUND_KEYS: readonly string[] = [
  TextureKey.MenuBackground,
  TextureKey.MenuBackgroundSparseExtraLight,
  TextureKey.MenuBackgroundLargeLight,
  TextureKey.MenuBackgroundLargeExtraLight,
];

/**
 * Diorama do menu: céu em perspectiva que faz pan suave e cicla entre 4
 * variações de nuvem. Compartilhado entre `MenuScene` e `IntroScene` para que a
 * intro apareça sobre exatamente o mesmo fundo do menu principal.
 */
export function drawMenuBackground(scene: Phaser.Scene): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const centerX = w / 2;
  const background = scene.add.image(centerX, h / 2, MENU_BACKGROUND_KEYS[0] ?? TextureKey.MenuBackground);

  const fitBackground = (): void => {
    const scale = Math.max(w / background.width, h / background.height) * 1.04;
    background.setScale(scale).setScrollFactor(0);
  };
  const panBackground = (direction: 1 | -1): void => {
    scene.tweens.killTweensOf(background);
    background.setX(centerX - direction * 5);
    scene.tweens.add({
      targets: background,
      x: centerX + direction * 9,
      duration: 8200,
      ease: 'Sine.inOut',
    });
  };

  fitBackground();
  panBackground(1);
  scene.add.rectangle(w / 2, h / 2, w, h, 0x24442d, 0.12).setScrollFactor(0);
  const cycleVeil = scene.add.rectangle(w / 2, h / 2, w, h, 0xffe2a3, 0).setScrollFactor(0);
  let current = 0;
  scene.time.addEvent({
    delay: 8200,
    loop: true,
    callback: () => {
      const next = (current + 1) % MENU_BACKGROUND_KEYS.length;
      scene.tweens.add({
        targets: cycleVeil,
        alpha: 0.16,
        duration: 520,
        ease: 'Sine.inOut',
        yoyo: true,
        hold: 90,
        onYoyo: () => {
          current = next;
          background.setTexture(MENU_BACKGROUND_KEYS[current] ?? TextureKey.MenuBackground);
          fitBackground();
          panBackground(current % 2 === 0 ? 1 : -1);
        },
      });
    },
  });
}
