/* ============================================================
   PvpCombatScene — reproducción de la batalla determinista que
   computó el servidor (BattleResult). Sprites animados, barras de
   HP y log ronda a ronda. No decide nada: solo visualiza.
   ============================================================ */
import Phaser from 'phaser';
import { COLORS, GAME_W, PAD, CONTENT_W } from '../ui/theme.ts';
import { headerBar, retroButton, retroPanel, titleText, bodyText, portrait, hpBar, affinityColor } from '../ui/widgets.ts';
import { loadUserData } from '../state.ts';
import type { BattleResult, BattleRound } from '../../shared/types/index.ts';

interface CombatData {
  battleResult: BattleResult;
  rewards: { goldEarned: number; scoreEarned: number };
  // Escena a la que volver al terminar (por defecto 'Home').
  returnScene?: string;
  // Nota a mostrar en lugar de la línea de recompensa (p. ej. combate diario:
  // la recompensa se reclama aparte en Eventos).
  note?: string;
}

export class PvpCombatScene extends Phaser.Scene {
  private battle!: BattleResult;
  private rewards!: { goldEarned: number; scoreEarned: number };
  private returnScene = 'Home';
  private note?: string;
  private idx = -1;
  private maxA = 100;
  private maxB = 100;
  private setHpA!: (p: number) => void;
  private setHpB!: (p: number) => void;
  private blue!: Phaser.GameObjects.Sprite;
  private red!: Phaser.GameObjects.Sprite;
  private logText!: Phaser.GameObjects.Text;
  private controls?: Phaser.GameObjects.Container;
  private finished = false;

  constructor() {
    super('PvpCombat');
  }

  init(data: CombatData): void {
    this.battle = data.battleResult;
    this.rewards = data.rewards || { goldEarned: 0, scoreEarned: 0 };
    this.returnScene = data.returnScene || 'Home';
    this.note = data.note;
    this.idx = -1;
    this.finished = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.screen);
    const cx = GAME_W / 2;
    headerBar(this, cx, 92, CONTENT_W, '⚔️ Combate ⚔️', 15);

    const a = this.battle.generalA;
    const b = this.battle.generalB;
    this.maxA = 100 + a.stats.def * 3 + a.stats.man * 2;
    this.maxB = 100 + b.stats.def * 3 + b.stats.man * 2;

    // Atacante (columna izquierda, azul)
    titleText(this, cx - 160, 176, a.name, 14, COLORS.cream);
    portrait(this, cx - 160, 270, a.id, 96, affinityColor('OFE'));
    this.blue = this.add.sprite(cx - 150, 500, 'warriorBlue').setOrigin(0.5, 1).setScale(0.7).play('warriorBlue_idle');
    const barA = hpBar(this, PAD + 6, 540, 296, 1);
    this.setHpA = barA.set;

    // Defensor (columna derecha, rojo)
    titleText(this, cx + 160, 176, b.name, 14, COLORS.cream);
    portrait(this, cx + 160, 270, b.id, 96, affinityColor('DEF'));
    this.red = this.add.sprite(cx + 150, 500, 'warriorRed').setOrigin(0.5, 1).setScale(0.7).setFlipX(true).play('warriorRed_idle');
    const barB = hpBar(this, cx + 18, 540, 296, 1);
    this.setHpB = barB.set;

    titleText(this, cx, 362, 'VS', 30, COLORS.danger);

    // Log + controles
    retroPanel(this, cx, 700, CONTENT_W, 180);
    this.logText = bodyText(this, cx, 700, 'Comienza la batalla. Iniciativa según Mando...', 14, COLORS.ink)
      .setWordWrapWidth(CONTENT_W - 60)
      .setAlign('center');

    this.buildControls();
  }

  private buildControls(): void {
    this.controls?.destroy();
    const c = this.add.container(0, 0);
    this.controls = c;
    const cx = GAME_W / 2;
    const total = this.battle.rounds.length;
    c.add(titleText(this, cx, 838, `Ronda ${Math.max(0, this.idx + 1)} / ${total}`, 12, COLORS.cream));

    if (!this.finished) {
      c.add(
        retroButton(this, cx - 162, 924, '▶ SIGUIENTE', {
          width: 300,
          height: 76,
          fontSize: 14,
          onClick: () => this.nextRound(),
        })
      );
      c.add(
        retroButton(this, cx + 162, 924, '⏩ AUTO', {
          variant: 'grey',
          width: 300,
          height: 76,
          fontSize: 14,
          onClick: () => this.autoplay(),
        })
      );
    }
  }

  private applyRound(round: BattleRound): void {
    const isAttackerA = round.attackerId === this.battle.generalA.id;
    const hpA = isAttackerA ? round.attackerHpAfter : round.defenderHpAfter;
    const hpB = isAttackerA ? round.defenderHpAfter : round.attackerHpAfter;
    this.setHpA(hpA / this.maxA);
    this.setHpB(hpB / this.maxB);
    this.logText.setText(round.log);

    // Lunge del atacante + flash en el defensor
    const attacker = isAttackerA ? this.blue : this.red;
    const dir = isAttackerA ? 1 : -1;
    this.tweens.add({ targets: attacker, x: attacker.x + dir * 60, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    const fx = this.add
      .image(isAttackerA ? GAME_W / 2 + 150 : GAME_W / 2 - 150, 430, 'explosion')
      .setScale(0.8)
      .setAlpha(0.95);
    this.tweens.add({ targets: fx, alpha: 0, scale: 1.3, duration: 350, onComplete: () => fx.destroy() });
  }

  private nextRound(): void {
    const next = this.idx + 1;
    if (next < this.battle.rounds.length) {
      this.idx = next;
      this.applyRound(this.battle.rounds[next]);
      this.buildControls();
    } else {
      this.finish();
    }
  }

  private autoplay(): void {
    this.time.addEvent({
      delay: 900,
      repeat: this.battle.rounds.length - this.idx - 1,
      callback: () => this.nextRound(),
    });
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.buildControls();
    void loadUserData();

    const cx = GAME_W / 2;
    const attackerWon = this.battle.winnerId === this.battle.generalA.id;
    const panel = this.add.container(0, 0).setDepth(50);
    panel.add(retroPanel(this, cx, 1085, CONTENT_W, 250, attackerWon ? 0xd8f0d8 : COLORS.card));
    panel.add(
      titleText(this, cx, 1010, attackerWon ? '🏆 ¡VICTORIA!' : '💀 DERROTA', 18, attackerWon ? 0x2e6b2e : COLORS.danger)
    );
    panel.add(
      bodyText(
        this,
        cx,
        1068,
        this.note ?? `Recompensa: +${this.rewards.goldEarned} oro  ·  +${this.rewards.scoreEarned} pts`,
        14,
        COLORS.ink
      )
        .setWordWrapWidth(CONTENT_W - 60)
        .setAlign('center')
    );
    panel.add(
      retroButton(this, cx, 1158, this.returnScene === 'Home' ? 'IR AL INICIO' : 'VOLVER', {
        width: 380,
        height: 64,
        fontSize: 14,
        onClick: () => this.scene.start(this.returnScene),
      })
    );
  }
}
