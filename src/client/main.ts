/* ============================================================
   Tiny Tacticians — punto de entrada del cliente Phaser.
   El servidor mantiene la autoridad sobre el estado (ver AGENTS.md);
   este cliente solo renderiza y envía intenciones vía /api.
   ============================================================ */
import Phaser from 'phaser';
import { COLORS, hex, GAME_W, GAME_H } from './ui/theme.ts';
import { BootScene } from './scenes/BootScene.ts';
import { HomeScene } from './scenes/HomeScene.ts';
import { CollectionScene } from './scenes/CollectionScene.ts';
import { RunSetupScene } from './scenes/RunSetupScene.ts';
import { RunPlayScene } from './scenes/RunPlayScene.ts';
import { PvpScene } from './scenes/PvpScene.ts';
import { PvpCombatScene } from './scenes/PvpCombatScene.ts';
import { EventosScene } from './scenes/EventosScene.ts';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: hex(COLORS.bg),
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NONE,
    width: GAME_W,
    height: GAME_H,
  },
  scene: [
    BootScene,
    HomeScene,
    CollectionScene,
    RunSetupScene,
    RunPlayScene,
    PvpScene,
    PvpCombatScene,
    EventosScene,
  ],
};

async function start(): Promise<void> {
  // Esperar a las fuentes web (Press Start 2P / JetBrains Mono) para que
  // los textos pixel-art no se rendericen con una fuente de respaldo.
  try {
    await document.fonts.ready;
  } catch {
    /* document.fonts no disponible: continuar igualmente */
  }
  new Phaser.Game(config);
}

void start();
