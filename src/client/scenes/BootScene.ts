/* ============================================================
   BootScene — precarga de assets y registro de animaciones.
   Reutiliza el registro de URLs de assets.ts (Vite las hashea),
   las alimenta al loader de Phaser y arranca HomeScene.
   ============================================================ */
import Phaser from 'phaser';
import { COLORS, hex, GAME_W, GAME_H } from '../ui/theme.ts';
import { ICON, SPRITE, AVATARS, PANEL } from '../assets.ts';
import splashUrl from '../assets/bannerfall_splash.png';

// Spritesheets animados (frames horizontales). Tamaños reales del pack:
// warrior 1536x192 (8x192), archer 1152x192 (6x192), lancer 3840x320 (12x320).
const SHEETS: Record<string, { url: string; frameWidth: number; frameHeight: number; frames: number }> = {
  warriorBlue: { url: SPRITE.warriorBlue, frameWidth: 192, frameHeight: 192, frames: 8 },
  warriorRed: { url: SPRITE.warriorRed, frameWidth: 192, frameHeight: 192, frames: 8 },
  archerBlue: { url: SPRITE.archerBlue, frameWidth: 192, frameHeight: 192, frames: 6 },
  lancerBlue: { url: SPRITE.lancerBlue, frameWidth: 320, frameHeight: 320, frames: 12 },
};

// Imágenes estáticas del campo / decoración.
const IMAGES: Record<string, string> = {
  castle: SPRITE.castle,
  barracks: SPRITE.barracks,
  tower: SPRITE.tower,
  goldResource: SPRITE.goldResource,
  cloud1: SPRITE.cloud1,
  cloud2: SPRITE.cloud2,
  explosion: SPRITE.explosion,
  splash: splashUrl,
  paper: PANEL.paper,
  paperSpecial: PANEL.paperSpecial,
  banner: PANEL.banner,
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.drawLoadingBar();

    for (const [key, sheet] of Object.entries(SHEETS)) {
      this.load.spritesheet(key, sheet.url, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    for (const [key, url] of Object.entries(IMAGES)) {
      this.load.image(key, url);
    }
    // Iconos UI: clave 'icon_<nombre>'.
    for (const [name, url] of Object.entries(ICON)) {
      this.load.image(`icon_${name}`, url);
    }
    // Avatares: clave 'avatar_<n>' (ver avatarKeyFor).
    AVATARS.forEach((url, i) => this.load.image(`avatar_${i}`, url));
  }

  create(): void {
    for (const [key, sheet] of Object.entries(SHEETS)) {
      this.anims.create({
        key: `${key}_idle`,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: sheet.frames - 1 }),
        frameRate: sheet.frames === 12 ? 10 : 8,
        repeat: -1,
      });
    }
    this.scene.start('Home');
  }

  private drawLoadingBar(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    this.add
      .text(cx, cy - 60, 'TINY TACTICIANS', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '28px',
        color: hex(COLORS.lime),
      })
      .setOrigin(0.5);

    const barW = 420;
    const barH = 26;
    this.add.rectangle(cx, cy, barW + 8, barH + 8, COLORS.panelDark).setStrokeStyle(3, COLORS.border);
    const fill = this.add.rectangle(cx - barW / 2, cy, 1, barH, COLORS.lime).setOrigin(0, 0.5);
    const pct = this.add
      .text(cx, cy + 44, '0%', { fontFamily: '"Press Start 2P", monospace', fontSize: '14px', color: hex(COLORS.cream) })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = Math.max(1, barW * value);
      pct.setText(`${Math.round(value * 100)}%`);
    });
  }
}
