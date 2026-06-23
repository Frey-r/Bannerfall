/* ============================================================
   EventosScene — combate diario (con bono) + especiales.
   ============================================================ */
import Phaser from 'phaser';
import { COLORS, GAME_W } from '../ui/theme.ts';
import { screenTopbar, retroButton, retroPanel, titleText, bodyText, loadingOverlay, toast } from '../ui/widgets.ts';
import { store, loadUserData } from '../state.ts';
import { api } from '../api.ts';
import type { BattleResult } from '../../shared/types/index.ts';

export class EventosScene extends Phaser.Scene {
  constructor() {
    super('Eventos');
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor(COLORS.screen);
    screenTopbar(this, 'Eventos', () => this.scene.start('Home'));
    if (store.generals.length === 0) {
      try {
        await loadUserData();
      } catch {
        /* ignore */
      }
    }

    // Combate diario
    retroPanel(this, GAME_W / 2, 280, 900, 260, COLORS.card);
    titleText(this, GAME_W / 2, 180, '🛡️ Combate Diario', 16, COLORS.ink);
    bodyText(this, GAME_W / 2, 240, 'Enemigo: Orden Carmesí', 15, COLORS.ink);
    bodyText(this, GAME_W / 2, 280, 'Modificador: doctrina de caballería', 13, COLORS.ink);
    bodyText(this, GAME_W / 2, 312, 'Premio: oro extra + chance de consejero', 13, COLORS.ink);
    retroButton(this, GAME_W / 2, 370, '[ JUGAR COMBATE DIARIO ]', {
      width: 480,
      height: 64,
      fontSize: 15,
      onClick: () => this.playDaily(),
    });

    // Especiales
    titleText(this, GAME_W / 2, 470, 'Especiales (tiempo limitado)', 14, COLORS.cream);
    this.special(GAME_W / 2, 560, '[RUN] Torneo de Reclutas', 'Sube un general con reglas fijas. (2d4h)', 'ENTRAR', () =>
      this.scene.start('RunSetup')
    );
    this.special(GAME_W / 2, 660, '[COMBATE] Asedio Frontera', 'Arena rankeada vs jugadores. (18h)', 'ENTRAR', () =>
      this.scene.start('Pvp')
    );
  }

  private special(x: number, y: number, title: string, desc: string, btn: string, onClick: () => void): void {
    retroPanel(this, x, y, 900, 80, COLORS.card2);
    bodyText(this, x - 420, y - 14, title, 14, COLORS.ink).setOrigin(0, 0.5);
    bodyText(this, x - 420, y + 14, desc, 12, COLORS.ink).setOrigin(0, 0.5);
    retroButton(this, x + 360, y, btn, { width: 200, height: 52, fontSize: 13, onClick });
  }

  private async playDaily(): Promise<void> {
    if (store.generals.length === 0) {
      this.scene.start('RunSetup');
      return;
    }
    const attackerId = store.selectedGeneralId || store.generals[0].id;
    const hide = loadingOverlay(this, 'COMBATE DIARIO...');
    try {
      const res = await api.post<{ battleResult: BattleResult; rewards: any }>('/api/pvp/battle', { attackerId });
      hide();
      // Bono de evento diario sobre la recompensa base del servidor.
      const rewards = {
        goldEarned: (res.rewards?.goldEarned ?? 0) + 100,
        scoreEarned: (res.rewards?.scoreEarned ?? 0) + 5,
      };
      this.scene.start('PvpCombat', { battleResult: res.battleResult, rewards });
    } catch (err: any) {
      hide();
      toast(this, err.message || 'Error en combate diario', COLORS.danger);
    }
  }
}
