/* ============================================================
   RunPlayScene — campaña de entrenamiento de 8 turnos.
   Layout calcado del mockup `mockups/run.md` (LIVE FEED del
   campamento, deck de asesores, energía/ánimo y 3 tarjetas de
   entrenamiento al fondo).

   Paridad cliente/servidor: el servidor re-simula desde el
   actionLog usando SOLO seed + deckSnapshot + actionLog. Por eso
   ENERGÍA y ÁNIMO son flavor cosmético del cliente: dan feel al
   bucle de turnos pero NUNCA tocan las stats que se acuñan. La
   decisión real del turno es la afinidad (OFE/DEF/MAN); cada
   tarjeta entrena con el mejor consejero del deck para esa stat.
   ============================================================ */
import Phaser from 'phaser';
import { COLORS, GAME_W, PAD, CONTENT_W } from '../ui/theme.ts';
import {
  screenTopbar,
  retroButton,
  retroPanel,
  titleText,
  bodyText,
  portrait,
  affinityColor,
  loadingOverlay,
  toast,
} from '../ui/widgets.ts';
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

/** Coste de energía por entrenamiento y máximos de los recursos de flavor. */
const TRAIN_COST = 20;
const ENERGY_MAX = 100;
const MOOD_MAX = 1.5;

/** Paleta de cada tarjeta de stat (OFE rojo, DEF verde, MAN azul). */
const STAT_PALETTE: Record<Affinity, { fill: number; top: number; edge: number; text: number }> = {
  OFE: { fill: 0x9a3b34, top: 0xb85048, edge: 0x5e211c, text: COLORS.cream },
  DEF: { fill: COLORS.lime, top: COLORS.limeTop, edge: COLORS.limeEdge, text: COLORS.ink },
  MAN: { fill: 0x2f6aa3, top: 0x4a86c0, edge: 0x1c466b, text: COLORS.cream },
};

const STAT_KEY: Record<Affinity, keyof GeneralStats> = { OFE: 'ofe', DEF: 'def', MAN: 'man' };

export class RunPlayScene extends Phaser.Scene {
  private run!: RunData;
  private turn = 0;
  private stats: GeneralStats = { ofe: BASE_STAT, def: BASE_STAT, man: BASE_STAT };
  private actionLog: ActionLog = [];
  private eventLog: { turn: number; name: string }[] = [];
  private energy = ENERGY_MAX;
  private mood = 1.0;
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
    this.energy = ENERGY_MAX;
    this.mood = 1.0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.screen);
    screenTopbar(this, `Campamento: ${this.run.name}`, () => this.scene.start('Home'));
    // Engranaje decorativo (opciones) arriba-derecha, como en el mockup.
    this.add.image(GAME_W - PAD - 22, 52, 'icon_gear').setDisplaySize(40, 40).setAlpha(0.9);
    this.render();
  }

  private render(): void {
    this.dyn?.destroy();
    const c = this.add.container(0, 0);
    this.dyn = c;

    this.turnEnergyHeader(c);
    this.advisorDeck(c);
    this.liveFeed(c);
    if (this.turn < 8) {
      this.recovery(c);
      this.trainingCards(c);
    } else {
      this.completion(c);
    }
  }

  /* ---- 1. Estado de turno + energía ---------------------------- */
  private turnEnergyHeader(c: Phaser.GameObjects.Container): void {
    const cx = GAME_W / 2;

    // Panel de turno (izquierda).
    const turnW = 416;
    const turnX = PAD + turnW / 2;
    c.add(retroPanel(this, turnX, 150, turnW, 88, COLORS.card));
    c.add(titleText(this, turnX, 132, 'TURNO ACTUAL', 12, COLORS.ink));
    c.add(titleText(this, turnX, 164, `${String(this.turn).padStart(2, '0')} / 08`, 24, COLORS.ink));

    // Panel de ánimo (derecha).
    const moodW = CONTENT_W - turnW - 16;
    const moodX = GAME_W - PAD - moodW / 2;
    c.add(retroPanel(this, moodX, 150, moodW, 88, COLORS.card));
    c.add(titleText(this, moodX, 132, 'ANIMO', 11, COLORS.ink));
    c.add(bodyText(this, moodX, 166, `:)  x${this.mood.toFixed(1)}`, 18, COLORS.ink));

    // Barra de energía.
    const pct = this.energy / ENERGY_MAX;
    const col = this.energy > 60 ? COLORS.lime : this.energy > 30 ? COLORS.gold : COLORS.danger;
    c.add(bodyText(this, PAD, 212, 'ENERGIA', 15, COLORS.cream).setOrigin(0, 0.5));
    c.add(bodyText(this, GAME_W - PAD, 212, `${Math.round(this.energy)}%`, 15, col).setOrigin(1, 0.5));
    c.add(this.add.rectangle(PAD, 248, CONTENT_W, 28, 0x3a2f22).setOrigin(0, 0.5).setStrokeStyle(3, COLORS.border));
    c.add(
      this.add
        .rectangle(PAD + 3, 248, Math.max(2, (CONTENT_W - 6) * pct), 20, col)
        .setOrigin(0, 0.5)
    );
  }

  /* ---- 2. Estado de asesores (deck de 4) ----------------------- */
  private advisorDeck(c: Phaser.GameObjects.Container): void {
    c.add(bodyText(this, PAD, 292, 'ESTADO DE ASESORES', 14, COLORS.cream).setOrigin(0, 0.5));
    c.add(bodyText(this, GAME_W - PAD, 292, '* ACTIVOS', 12, COLORS.gold).setOrigin(1, 0.5));

    const slotW = 150;
    const slotH = 132;
    for (let i = 0; i < 4; i++) {
      const x = PAD + slotW / 2 + i * (slotW + 16);
      const adv = this.run.advisors[i];
      c.add(this.advisorSlot(adv ?? null, x, 374, slotW, slotH));
    }
  }

  private advisorSlot(
    adv: Consejero | null,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.Container {
    const slot = this.add.container(x, y);
    const tint = adv ? affinityColor(adv.affinity) : COLORS.cardLo;
    slot.add(this.add.rectangle(0, 0, w, h, adv ? COLORS.card2 : 0x3a342c).setStrokeStyle(3, adv ? tint : COLORS.border));

    if (!adv) {
      slot.add(bodyText(this, 0, 0, 'vacío', 14, COLORS.cardLo));
      return slot;
    }

    slot.add(portrait(this, 0, -12, adv.id, 78, tint));
    // Badge de nivel arriba-derecha.
    slot.add(this.add.rectangle(w / 2 - 28, -h / 2 + 16, 50, 24, COLORS.panelDark).setStrokeStyle(2, COLORS.border));
    slot.add(titleText(this, w / 2 - 28, -h / 2 + 16, `LV.${adv.level}`, 10, COLORS.cream));
    // Nombre + marca de activo (todos los del loadout están activos).
    slot.add(bodyText(this, 0, h / 2 - 18, `* ${adv.name.split(' ')[0]}`, 13, COLORS.gold));
    return slot;
  }

  /* ---- 3. Recuperación ----------------------------------------- */
  private recovery(c: Phaser.GameObjects.Container): void {
    c.add(bodyText(this, PAD, 462, 'RECUPERACIÓN', 14, COLORS.cream).setOrigin(0, 0.5));
    c.add(
      retroButton(this, GAME_W / 2, 510, 'DESCANSO REPARADOR   +50 ENRG', {
        variant: 'grey',
        width: CONTENT_W,
        height: 56,
        fontSize: 14,
        enabled: this.energy < ENERGY_MAX,
        onClick: () => this.rest(50, 0),
      })
    );
    c.add(
      retroButton(this, GAME_W / 2, 574, '<)) ARENGA MILITAR   +10 ENRG', {
        variant: 'grey',
        width: CONTENT_W,
        height: 56,
        fontSize: 14,
        enabled: this.mood < MOOD_MAX || this.energy < ENERGY_MAX,
        onClick: () => this.rest(10, 0.1),
      })
    );
  }

  /* ---- 4. LIVE FEED -------------------------------------------- */
  private liveFeed(c: Phaser.GameObjects.Container): void {
    const cx = GAME_W / 2;
    const py = 792;
    const ph = 286;

    c.add(bodyText(this, PAD, 630, '* LIVE FEED', 14, COLORS.gold).setOrigin(0, 0.5));
    // Marco + "pantalla" de campo.
    c.add(this.add.rectangle(cx, py, CONTENT_W, ph, COLORS.panelDark).setStrokeStyle(3, COLORS.border));
    c.add(this.add.rectangle(cx, py, CONTENT_W - 16, ph - 16, COLORS.grassDark).setStrokeStyle(2, 0x2c2319));

    // Edificios del campamento a los lados.
    c.add(this.add.image(cx - 218, py - 18, 'tower').setDisplaySize(120, 120));
    c.add(this.add.image(cx + 214, py + 6, 'barracks').setDisplaySize(150, 120));
    // Reclutas en idle.
    c.add(this.add.sprite(cx - 150, py + 86, 'warriorBlue').setDisplaySize(80, 80).play('warriorBlue_idle'));
    c.add(this.add.sprite(cx + 130, py + 92, 'warriorBlue').setDisplaySize(80, 80).play('warriorBlue_idle'));

    // Retrato del general (centro, encima de todo).
    c.add(portrait(this, cx, py - 12, this.run.name, 112, COLORS.gold));
    c.add(bodyText(this, cx, py + 62, 'RETRATO GENERAL', 12, COLORS.cream));
    c.add(bodyText(this, cx, py + ph / 2 - 18, 'SECTOR 7G // TRAINING GROUND', 11, 0xcfe3a8).setAlpha(0.85));
  }

  /* ---- 5. Tarjetas de entrenamiento (la decisión) -------------- */
  private trainingCards(c: Phaser.GameObjects.Container): void {
    const cx = GAME_W / 2;
    const hasEnergy = this.energy >= TRAIN_COST;
    c.add(titleText(this, cx, 962, 'ENTRENAMIENTO', 14, COLORS.cream));
    if (!hasEnergy) {
      c.add(bodyText(this, cx, 992, 'Sin energía — usa RECUPERACIÓN', 12, COLORS.danger));
    }
    (['OFE', 'DEF', 'MAN'] as Affinity[]).forEach((choice, j) => {
      c.add(this.statCard(choice, cx + (j - 1) * 214, 1108, hasEnergy));
    });
  }

  private statCard(choice: Affinity, x: number, y: number, enabled: boolean): Phaser.GameObjects.Container {
    const W = 200;
    const H = 200;
    const pal = STAT_PALETTE[choice];
    const card = this.add.container(x, y);
    const shadow = this.add.rectangle(5, 5, W, H, 0x000000, 0.4);
    const body = this.add.rectangle(0, 0, W, H, enabled ? pal.fill : 0x6c675c).setStrokeStyle(4, COLORS.border);
    const top = this.add.rectangle(0, -H / 2 + 4, W - 8, 5, enabled ? pal.top : 0x8b857a);
    const bottom = this.add.rectangle(0, H / 2 - 5, W - 8, 6, enabled ? pal.edge : 0x4a463e);
    const txtCol = enabled ? pal.text : 0x46423a;
    const name = titleText(this, 0, -58, choice, 22, txtCol);
    const val = titleText(this, 0, 2, String(this.stats[STAT_KEY[choice]]), 30, txtCol);
    const gain = bodyText(this, 0, 58, `+${this.projectedGain(choice)}`, 18, txtCol);
    const press = this.add.container(0, 0, [body, top, bottom, name, val, gain]);
    card.add([shadow, press]);
    card.setSize(W, H);

    if (enabled) {
      card.setInteractive(new Phaser.Geom.Rectangle(-W / 2, -H / 2, W, H), Phaser.Geom.Rectangle.Contains);
      if (card.input) card.input.cursor = 'pointer';
      card.on('pointerdown', () => {
        press.setPosition(3, 3);
        shadow.setVisible(false);
      });
      card.on('pointerout', () => {
        press.setPosition(0, 0);
        shadow.setVisible(true);
      });
      card.on('pointerup', () => {
        press.setPosition(0, 0);
        shadow.setVisible(true);
        this.train(choice);
      });
    } else {
      card.setAlpha(0.85);
    }
    return card;
  }

  /* ---- Estado final: acuñar ------------------------------------ */
  private completion(c: Phaser.GameObjects.Container): void {
    const cx = GAME_W / 2;
    c.add(titleText(this, cx, 502, 'ENTRENAMIENTO COMPLETO', 18, COLORS.gold));
    c.add(
      bodyText(this, cx, 556, 'Tu recluta terminó los 8 turnos. Acuña la unidad\ninmutable para enviarla al combate.', 14, COLORS.cream).setAlign(
        'center'
      )
    );
    c.add(titleText(this, cx, 962, `PODER  ${calculatePower(this.stats)}`, 18, COLORS.cream));
    c.add(
      retroButton(this, cx, 1108, '🎖️ ACUÑAR GENERAL', {
        width: CONTENT_W,
        height: 96,
        fontSize: 18,
        onClick: () => this.submit(),
      })
    );
  }

  /* ---- Lógica ------------------------------------------------- */

  /** Mejor consejero del deck para la afinidad pedida (match > nivel). */
  private bestAdvisorFor(choice: Affinity): Consejero {
    const pool = this.run.advisors;
    const matches = pool.filter((a) => a.affinity === choice);
    const candidates = matches.length ? matches : pool;
    return candidates.reduce((best, a) => (a.level > best.level ? a : best), candidates[0]);
  }

  /** Ganancia base proyectada (parte determinista, sin eventos). */
  private projectedGain(choice: Affinity): number {
    const adv = this.bestAdvisorFor(choice);
    return 5 + (adv.affinity === choice ? 3 : 0) + adv.level;
  }

  private rest(energy: number, moodDelta: number): void {
    this.energy = Math.min(ENERGY_MAX, this.energy + energy);
    this.mood = Math.min(MOOD_MAX, this.mood + moodDelta);
    this.render();
  }

  private train(choice: Affinity): void {
    if (this.turn >= 8 || this.energy < TRAIN_COST) return;
    const adv = this.bestAdvisorFor(choice);
    this.energy = Math.max(0, this.energy - TRAIN_COST);

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
        toast(this, `Evento: ${ev.name}`, COLORS.gold);
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
