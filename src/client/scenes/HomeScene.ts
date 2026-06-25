/* ============================================================
   HomeScene — campo de entrenamiento (estado idle).
   Réplica en Phaser del Home de React: barra de estado,
   campo pixel-art animado y navegación inferior (JUGAR / etc).
   ============================================================ */
import Phaser from 'phaser';
import { COLORS, hex, GAME_W, GAME_H, PAD, CONTENT_W } from '../ui/theme.ts';
import { retroButton, headerBar, resourcePill, titleText, retroPanel } from '../ui/widgets.ts';
import { store, loadUserData } from '../state.ts';
import { getDevUserId } from '../api.ts';

export class HomeScene extends Phaser.Scene {
  private statusBar?: Phaser.GameObjects.Container;
  private jugarModal?: Phaser.GameObjects.Container;

  constructor() {
    super('Home');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.screen);
    this.buildField();
    this.buildNav();
    this.buildStatusBar();
    headerBar(this, GAME_W / 2, 168, CONTENT_W, 'Campo de Entrenamiento', 15);
    this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      await loadUserData();
    } catch {
      /* perfil aún no disponible: se muestran valores por defecto */
    }
    this.buildStatusBar();
  }

  private buildStatusBar(): void {
    this.statusBar?.destroy();
    const bar = this.add.container(0, 0);
    const gold = store.profile ? store.profile.gold : 120;
    const advisors = store.advisors.length;

    bar.add(resourcePill(this, PAD, 52, 'icon_gold', `${gold} oro`, COLORS.lime));
    bar.add(resourcePill(this, PAD, 104, 'icon_shield', `${advisors} consejeros`, COLORS.card));

    bar.add(
      this.add
        .text(GAME_W - PAD, 110, getDevUserId(), {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '12px',
          color: hex(0x6b6258),
        })
        .setOrigin(1, 0.5)
    );
    bar.add(
      retroButton(this, GAME_W - PAD - 30, 56, '⚙', { variant: 'grey', fontSize: 18, width: 60, height: 56 })
    );
    this.statusBar = bar;
  }

  private buildField(): void {
    const fx = PAD;
    const fy = 206;
    const fw = CONTENT_W;
    const fh = 720;
    const cx = fx + fw / 2;
    const groundY = fy + fh - 30;

    const field = this.add.container(0, 0);

    // Césped + cielo + franjas
    field.add(this.add.rectangle(fx, fy, fw, fh, COLORS.grass).setOrigin(0, 0));
    field.add(this.add.rectangle(fx, fy, fw, fh * 0.34, 0x3a4a63).setOrigin(0, 0).setAlpha(0.85));
    for (let y = fy + 6; y < fy + fh; y += 26) {
      field.add(this.add.rectangle(fx, y, fw, 2, COLORS.grassRow, 0.35).setOrigin(0, 0));
    }
    // Sendero de tierra
    field.add(this.add.rectangle(fx, fy + fh - 22, fw, 22, COLORS.dirt).setOrigin(0, 0));

    // Nubes animadas (clip al campo)
    const cloud1 = this.add.image(fx + 150, fy + 40, 'cloud1').setScale(0.6).setAlpha(0.7);
    const cloud2 = this.add.image(fx + 500, fy + 70, 'cloud2').setScale(0.5).setAlpha(0.6);
    field.add([cloud1, cloud2]);
    this.driftCloud(cloud1, fx - 60, fx + fw + 60, 26000);
    this.driftCloud(cloud2, fx - 60, fx + fw + 60, 34000);

    // Edificios de fondo
    this.placeBuilding(field, 'castle', fx + 120, groundY, 150);
    this.placeBuilding(field, 'tower', fx + 250, groundY, 130);
    this.placeBuilding(field, 'barracks', fx + fw - 120, groundY, 140);

    // Montones de oro
    field.add(this.add.image(fx + 170, groundY - 6, 'goldResource').setOrigin(0.5, 1).setScale(0.8));
    field.add(this.add.image(fx + fw - 170, groundY - 6, 'goldResource').setOrigin(0.5, 1).setScale(0.8));

    // Caballeros sparring (sprites animados reales)
    const blue = this.add.sprite(cx - 150, groundY, 'warriorBlue').setOrigin(0.5, 1).setScale(0.62).play('warriorBlue_idle');
    const red = this.add
      .sprite(cx + 150, groundY, 'warriorRed')
      .setOrigin(0.5, 1)
      .setScale(0.62)
      .setFlipX(true)
      .play('warriorRed_idle');
    field.add([blue, red]);

    // Máscara para recortar nubes/sprites al marco del campo
    const maskG = this.make.graphics({});
    maskG.fillStyle(0xffffff);
    maskG.fillRect(fx, fy, fw, fh);
    field.setMask(maskG.createGeometryMask());

    // Marco del campo (encima, sin máscara)
    this.add.rectangle(cx, fy + fh / 2, fw, fh, 0x000000, 0).setStrokeStyle(3, COLORS.border);
  }

  private placeBuilding(
    parent: Phaser.GameObjects.Container,
    key: string,
    x: number,
    y: number,
    targetH: number
  ): void {
    const img = this.add.image(x, y, key).setOrigin(0.5, 1);
    img.setScale(targetH / img.height);
    parent.add(img);
  }

  private driftCloud(img: Phaser.GameObjects.Image, from: number, to: number, duration: number): void {
    img.x = from + Math.random() * (to - from);
    this.tweens.add({
      targets: img,
      x: to,
      duration: duration * ((to - img.x) / (to - from)),
      onComplete: () => {
        img.x = from;
        this.tweens.add({ targets: img, x: to, duration, repeat: -1 });
      },
    });
  }

  private buildNav(): void {
    const cx = GAME_W / 2;
    // Navegación apilada full-width (objetivos táctiles grandes).
    retroButton(this, cx, 1012, '>> JUGAR', {
      width: CONTENT_W,
      height: 104,
      fontSize: 28,
      onClick: () => this.toggleJugarModal(true),
    });
    retroButton(this, cx, 1122, 'COLECCIÓN', {
      variant: 'grey',
      width: CONTENT_W,
      height: 80,
      fontSize: 18,
      onClick: () => this.scene.start('Collection'),
    });
    retroButton(this, cx, 1210, 'EVENTOS', {
      variant: 'grey',
      width: CONTENT_W,
      height: 80,
      fontSize: 18,
      onClick: () => this.scene.start('Eventos'),
    });
  }

  private toggleJugarModal(open: boolean): void {
    if (!open) {
      this.jugarModal?.destroy();
      this.jugarModal = undefined;
      return;
    }
    if (this.jugarModal) return;

    const modal = this.add.container(0, 0).setDepth(100);
    const backdrop = this.add
      .rectangle(0, 0, GAME_W, GAME_H, 0x0a0806, 0.72)
      .setOrigin(0, 0)
      .setInteractive();
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const panel = retroPanel(this, cx, cy, 620, 440, COLORS.panelDark);
    const title = titleText(this, cx, cy - 160, '¿Qué quieres hacer?', 18, COLORS.cream);
    const run = retroButton(this, cx, cy - 60, ')==> CORRER RUN', {
      variant: 'grey',
      width: 540,
      height: 76,
      fontSize: 16,
      onClick: () => {
        this.toggleJugarModal(false);
        this.scene.start('RunSetup');
      },
    });
    const pvp = retroButton(this, cx, cy + 40, '(D) PVP / ARENA', {
      variant: 'grey',
      width: 540,
      height: 76,
      fontSize: 16,
      onClick: () => {
        this.toggleJugarModal(false);
        this.scene.start('Pvp');
      },
    });
    const close = retroButton(this, cx, cy + 150, '[ x cerrar ]', {
      variant: 'maroon',
      width: 320,
      height: 60,
      fontSize: 13,
      onClick: () => this.toggleJugarModal(false),
    });
    modal.add([backdrop, panel, title, run, pvp, close]);
    this.jugarModal = modal;
  }
}
