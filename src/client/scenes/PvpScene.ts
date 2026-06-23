/* ============================================================
   PvpScene — lobby de arena: elegir general, buscar rival
   (POST /api/pvp/battle) y leaderboard de temporada.
   ============================================================ */
import Phaser from 'phaser';
import { COLORS, GAME_W, GAME_H } from '../ui/theme.ts';
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
import { store, loadUserData } from '../state.ts';
import { api } from '../api.ts';
import { tierLetter } from '../util.ts';
import type { BattleResult } from '../../shared/types/index.ts';

interface LbRow {
  userId: string;
  name: string;
  score: number;
}

export class PvpScene extends Phaser.Scene {
  private lb: LbRow[] = [];
  private lbPage = 1;
  private dyn?: Phaser.GameObjects.Container;

  constructor() {
    super('Pvp');
  }

  init(data: { selectedGeneralId?: string }): void {
    if (data?.selectedGeneralId) store.selectedGeneralId = data.selectedGeneralId;
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor(COLORS.screen);
    screenTopbar(this, 'PvP / Arena', () => this.scene.start('Home'));
    if (store.generals.length === 0) {
      const hide = loadingOverlay(this, 'CARGANDO...');
      try {
        await loadUserData();
      } catch {
        /* ignore */
      }
      hide();
    }
    await this.fetchLeaderboard(1);
    this.render();
  }

  private async fetchLeaderboard(page: number): Promise<void> {
    try {
      const res = await api.get<{ leaderboard: LbRow[] }>(`/api/pvp/leaderboard?page=${page}&limit=8`);
      this.lb = res.leaderboard;
      this.lbPage = page;
    } catch {
      this.lb = [];
    }
  }

  private render(): void {
    this.dyn?.destroy();
    const c = this.add.container(0, 0);
    this.dyn = c;

    if (store.generals.length === 0) {
      c.add(retroPanel(this, GAME_W / 2, GAME_H / 2, 720, 320, COLORS.card));
      c.add(titleText(this, GAME_W / 2, GAME_H / 2 - 60, 'Sin generales todavía', 18, COLORS.ink));
      c.add(bodyText(this, GAME_W / 2, GAME_H / 2, 'Necesitas un comandante entrenado para entrar al PvP.', 14, COLORS.ink));
      c.add(
        retroButton(this, GAME_W / 2, GAME_H / 2 + 80, ')==> CORRER RUN', {
          width: 360,
          height: 64,
          fontSize: 16,
          onClick: () => this.scene.start('RunSetup'),
        })
      );
      return;
    }

    this.renderGeneralCard(c);
    this.renderLeaderboard(c);
  }

  private renderGeneralCard(c: Phaser.GameObjects.Container): void {
    const gens = store.generals;
    let i = gens.findIndex((g) => g.id === store.selectedGeneralId);
    if (i < 0) i = 0;
    const g = gens[i];

    const cx = 360;
    c.add(retroPanel(this, cx, 280, 600, 300, COLORS.card));
    c.add(titleText(this, cx, 160, 'Tu General', 16, COLORS.ink));
    c.add(portrait(this, cx - 200, 280, g.id, 110, affinityColor('OFE')));
    c.add(bodyText(this, cx - 110, 230, g.name, 18, COLORS.ink).setOrigin(0, 0.5));
    c.add(bodyText(this, cx - 110, 270, `Tier ${tierLetter(g.tier)}  ·  Poder ${g.power}`, 14, COLORS.ink).setOrigin(0, 0.5));
    c.add(
      bodyText(this, cx - 110, 310, `OFE ${g.stats.ofe} / DEF ${g.stats.def} / MAN ${g.stats.man}`, 13, COLORS.ink).setOrigin(0, 0.5)
    );

    // Cambiar general (ciclar)
    if (gens.length > 1) {
      c.add(
        retroButton(this, cx - 180, 410, '◀', {
          variant: 'grey',
          width: 70,
          fontSize: 16,
          onClick: () => this.cycle(-1),
        })
      );
      c.add(
        retroButton(this, cx - 80, 410, '▶', {
          variant: 'grey',
          width: 70,
          fontSize: 16,
          onClick: () => this.cycle(1),
        })
      );
      c.add(bodyText(this, cx + 60, 410, `${i + 1}/${gens.length}`, 13, COLORS.ink).setOrigin(0, 0.5));
    }

    c.add(
      retroButton(this, cx, 540, '(D) BUSCAR RIVAL', {
        width: 420,
        height: 72,
        fontSize: 18,
        onClick: () => this.startBattle(g.id),
      })
    );
  }

  private renderLeaderboard(c: Phaser.GameObjects.Container): void {
    const lx = GAME_W - 320;
    c.add(retroPanel(this, lx, 400, 560, 520, COLORS.card));
    c.add(titleText(this, lx, 160, '🏆 Leaderboard S1', 14, COLORS.ink));

    if (this.lb.length === 0) {
      c.add(bodyText(this, lx, 380, 'Sin clasificación todavía.', 13, COLORS.ink));
    } else {
      this.lb.forEach((row, idx) => {
        const rank = (this.lbPage - 1) * 8 + idx + 1;
        const mine = row.userId === (store.profile?.userId ?? '');
        const ry = 210 + idx * 48;
        c.add(bodyText(this, lx - 250, ry, `#${rank}  ${row.name.substring(0, 18)}`, 13, mine ? 0x2e6b2e : COLORS.ink).setOrigin(0, 0.5));
        c.add(bodyText(this, lx + 240, ry, `${row.score}`, 13, COLORS.ink).setOrigin(1, 0.5));
      });
    }

    // Paginación
    c.add(
      retroButton(this, lx - 80, 620, '◀', {
        variant: 'grey',
        width: 64,
        fontSize: 14,
        enabled: this.lbPage > 1,
        onClick: () => this.changePage(this.lbPage - 1),
      })
    );
    c.add(bodyText(this, lx, 620, `Pág ${this.lbPage}`, 13, COLORS.ink));
    c.add(
      retroButton(this, lx + 80, 620, '▶', {
        variant: 'grey',
        width: 64,
        fontSize: 14,
        enabled: this.lb.length >= 8,
        onClick: () => this.changePage(this.lbPage + 1),
      })
    );
  }

  private cycle(dir: number): void {
    const gens = store.generals;
    let i = gens.findIndex((g) => g.id === store.selectedGeneralId);
    if (i < 0) i = 0;
    i = (i + dir + gens.length) % gens.length;
    store.selectedGeneralId = gens[i].id;
    this.render();
  }

  private async changePage(page: number): Promise<void> {
    if (page < 1) return;
    await this.fetchLeaderboard(page);
    this.render();
  }

  private async startBattle(attackerId: string): Promise<void> {
    const hide = loadingOverlay(this, 'BUSCANDO RIVAL...');
    try {
      const res = await api.post<{ battleResult: BattleResult; rewards: any }>('/api/pvp/battle', { attackerId });
      hide();
      this.scene.start('PvpCombat', { battleResult: res.battleResult, rewards: res.rewards });
    } catch (err: any) {
      hide();
      toast(this, err.message || 'Error al emparejar', COLORS.danger);
    }
  }
}
