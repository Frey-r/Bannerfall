/* ============================================================
   RunPlayScene — campaña de entrenamiento de 8 turnos.
   Previsualiza stats/eventos con el PRNG sembrado (igual que el
   cliente React); el servidor re-simula desde el actionLog al
   acuñar. POST /api/run/submit -> Home.
   ============================================================ */
import Phaser from 'phaser';
import { COLORS, GAME_W } from '../ui/theme.ts';
import { screenTopbar, retroButton, retroPanel, titleText, bodyText, loadingOverlay, toast } from '../ui/widgets.ts';
import { PRNG, CAMPAIGN_EVENTS, BASE_STAT, calculatePower } from '../../shared/sim/index.ts';
import { loadUserData } from '../state.ts';
import { api } from '../api.ts';
import type { Affinity, ActionLog, Consejero, GeneralStats } from '../../shared/types/index.ts';

interface RunData {
  runId: string;
  seed: string;
  name: string;
  advisors: Consejero[];
}

export class RunPlayScene extends Phaser.Scene {
  private run!: RunData;
  private turn = 0;
  private stats: GeneralStats = { ofe: BASE_STAT, def: BASE_STAT, man: BASE_STAT };
  private actionLog: ActionLog = [];
  private eventLog: { turn: number; name: string }[] = [];
  private dyn?: Phaser.GameObjects.Container;

  constructor() {
    super('RunPlay');
  }

  init(data: RunData): void {
    this.run = data;
    this.turn = 0;
    this.stats = { ofe: BASE_STAT, def: BASE_STAT, man: BASE_STAT };
    this.actionLog = [];
    this.eventLog = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.screen);
    screenTopbar(this, `Campamento: ${this.run.name}`, () => this.scene.start('Home'));
    this.render();
  }

  private render(): void {
    this.dyn?.destroy();
    const c = this.add.container(0, 0);
    this.dyn = c;

    c.add(titleText(this, GAME_W - 130, 40, `Turno ${this.turn}/8`, 14, COLORS.gold));

    // Panel de elección (izquierda)
    const px = 440;
    c.add(retroPanel(this, px, 420, 720, 560, COLORS.card));

    if (this.turn < 8) {
      c.add(
        bodyText(this, px, 170, 'Elige una especialidad para entrenar este turno:', 15, COLORS.ink).setWordWrapWidth(
          660
        )
      );
      this.run.advisors.forEach((adv, i) => {
        const ry = 250 + i * 130;
        c.add(retroPanel(this, px, ry, 660, 110, COLORS.card2));
        c.add(bodyText(this, px - 290, ry - 18, `${adv.name.split(' ')[0]} (Lv${adv.level})`, 15, COLORS.ink).setOrigin(0, 0.5));
        c.add(bodyText(this, px - 290, ry + 12, `Afinidad: ${adv.affinity}`, 12, COLORS.ink).setOrigin(0, 0.5));
        (['OFE', 'DEF', 'MAN'] as Affinity[]).forEach((choice, j) => {
          c.add(
            retroButton(this, px + 60 + j * 130, ry, choice, {
              width: 120,
              height: 64,
              fontSize: 14,
              onClick: () => this.train(adv, choice),
            })
          );
        });
      });
    } else {
      c.add(titleText(this, px, 320, '¡Entrenamiento Terminado!', 18, COLORS.ink));
      c.add(
        bodyText(this, px, 390, 'Tu recluta completó los 8 turnos. Acuña la unidad inmutable\npara enviarla al combate.', 14, COLORS.ink).setAlign('center')
      );
      c.add(
        retroButton(this, px, 500, '🎖️ ACUÑAR GENERAL', {
          width: 420,
          height: 72,
          fontSize: 18,
          onClick: () => this.submit(),
        })
      );
    }

    // Panel de stats (derecha)
    const sx = GAME_W - 200;
    c.add(retroPanel(this, sx, 360, 320, 440, COLORS.card));
    c.add(titleText(this, sx, 180, 'Estadísticas', 14, COLORS.ink));
    c.add(bodyText(this, sx - 130, 240, `OFE: ${this.stats.ofe}`, 16, COLORS.ink).setOrigin(0, 0.5));
    c.add(bodyText(this, sx - 130, 280, `DEF: ${this.stats.def}`, 16, COLORS.ink).setOrigin(0, 0.5));
    c.add(bodyText(this, sx - 130, 320, `MAN: ${this.stats.man}`, 16, COLORS.ink).setOrigin(0, 0.5));
    c.add(bodyText(this, sx - 130, 370, `Poder: ${calculatePower(this.stats)}`, 16, 0x78242f).setOrigin(0, 0.5));

    c.add(bodyText(this, sx - 130, 420, 'EVENTOS:', 13, COLORS.ink).setOrigin(0, 0.5));
    this.eventLog.slice(-7).forEach((ev, i) => {
      c.add(bodyText(this, sx - 130, 450 + i * 26, `T${ev.turn}: ${ev.name}`, 11, 0x333333).setOrigin(0, 0.5));
    });
  }

  private train(adv: Consejero, choice: Affinity): void {
    const next = this.turn + 1;
    const gain = 5 + (adv.affinity === choice ? 3 : 0) + adv.level;
    const s = { ...this.stats };
    if (choice === 'OFE') s.ofe = Math.min(100, s.ofe + gain);
    if (choice === 'DEF') s.def = Math.min(100, s.def + gain);
    if (choice === 'MAN') s.man = Math.min(100, s.man + gain);

    // Evento determinista para este turno (PRNG sembrado).
    const prng = new PRNG(this.run.seed);
    for (let t = 0; t <= this.turn; t++) {
      const roll = prng.nextInt(0, 9);
      if (t === this.turn && roll < CAMPAIGN_EVENTS.length) {
        const ev = CAMPAIGN_EVENTS[roll];
        ev.effect(s, choice);
        this.eventLog.push({ turn: next, name: ev.name });
      }
    }
    s.ofe = Math.max(1, Math.min(100, s.ofe));
    s.def = Math.max(1, Math.min(100, s.def));
    s.man = Math.max(1, Math.min(100, s.man));

    this.stats = s;
    this.actionLog.push({ consejeroId: adv.id, choice });
    this.turn = next;
    this.render();
  }

  private async submit(): Promise<void> {
    const hide = loadingOverlay(this);
    try {
      await api.post('/api/run/submit', { runId: this.run.runId, actionLog: this.actionLog, name: this.run.name });
      await loadUserData();
      hide();
      this.scene.start('Home');
    } catch (err: any) {
      hide();
      toast(this, err.message || 'Error al acuñar', COLORS.danger);
    }
  }
}
