/* ============================================================
   Tiny Tacticians — Paleta y tipografías (Phaser)
   Calcado del mockup pixel-art medieval (ver index.css legado).
   Los colores se exponen como número (0xRRGGBB) para Phaser y
   como string CSS para textos / estilos DOM puntuales.
   ============================================================ */

export const COLORS = {
  bg: 0x15110e,
  bg2: 0x1b1612,
  screen: 0x241d17,
  panelDark: 0x2c2319,

  maroon: 0x7e2f30,
  maroonTop: 0x9c4243,
  maroonEdge: 0x4c1a1b,

  lime: 0xb3d23f,
  limeTop: 0xc8e457,
  limeEdge: 0x6f8a22,
  limeHover: 0xc2e04c,

  card: 0xcdc8bd,
  card2: 0xbdb7aa,
  cardHi: 0xeae5da,
  cardLo: 0x8b857a,

  grass: 0x6f9e4b,
  grassDark: 0x57863a,
  grassRow: 0x659146,
  dirt: 0x9a6b3f,

  ink: 0x1a1510,
  cream: 0xefe7d6,
  gold: 0xe8c33a,
  danger: 0xc2402f,
  border: 0x000000,

  // Tintes por afinidad de consejero
  affOFE: 0xa83b34,
  affDEF: 0x2f6aa3,
  affMAN: 0x7a45a8,
} as const;

/** Convierte 0xRRGGBB a string CSS '#rrggbb'. */
export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export const FONT = {
  title: '"Press Start 2P", "Courier New", monospace',
  body: '"JetBrains Mono", "VT323", "Courier New", monospace',
} as const;

/** Tamaño base del lienzo (landscape, proporción del mockup). */
export const GAME_W = 1280;
export const GAME_H = 800;
