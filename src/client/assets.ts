/* ============================================================
   Tiny Tacticians — Registro central de sprites (UI)
   Importa los PNG del pack para que Vite los empaquete y nos
   devuelva URLs hasheadas. El resto de la app consume estos
   helpers en vez de rutas crudas.
   ============================================================ */

const UI = 'assets/sprites/UI Elements/UI Elements';

/* ---- Iconos (64x64) -------------------------------------------- */
// Cargamos los 12 iconos en orden numérico (Icon_01..Icon_12).
const iconModules = import.meta.glob<string>(
  './assets/sprites/UI Elements/UI Elements/Icons/Icon_*.png',
  { eager: true, import: 'default' }
);
const iconList = Object.keys(iconModules)
  .sort()
  .map((k) => iconModules[k]);

// Mapa semántico según el contenido visual de cada icono del pack.
export const ICON = {
  tools: iconList[0], // Icon_01 mazo / herramientas
  wood: iconList[1], // Icon_02 tronco de madera
  gold: iconList[2], // Icon_03 moneda de oro
  meat: iconList[3], // Icon_04 carne
  sword: iconList[4], // Icon_05 espada (OFE)
  shield: iconList[5], // Icon_06 escudo (DEF)
  arrowGreen: iconList[6], // Icon_07 flecha verde (avanzar)
  arrowOrange: iconList[7], // Icon_08 flecha naranja
  close: iconList[8], // Icon_09 cruz roja (cerrar)
  gear: iconList[9], // Icon_10 engranaje (opciones)
  info: iconList[10], // Icon_11 información
  music: iconList[11], // Icon_12 nota musical
} as const;

/* ---- Retratos / avatares (256x256) ----------------------------- */
const avatarModules = import.meta.glob<string>(
  './assets/sprites/UI Elements/UI Elements/Human Avatars/Avatars_*.png',
  { eager: true, import: 'default' }
);
export const AVATARS = Object.keys(avatarModules)
  .sort()
  .map((k) => avatarModules[k]);

// Hash estable de una cadena -> índice de avatar. Así un mismo
// consejero/general siempre muestra el mismo retrato.
function avatarIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % AVATARS.length;
}

export function avatarFor(seed: string): string {
  return AVATARS[avatarIndex(seed)];
}

// Clave de textura Phaser ('avatar_<n>') para el mismo hash estable.
// Los avatares se registran con estas claves en BootScene.
export function avatarKeyFor(seed: string): string {
  return `avatar_${avatarIndex(seed)}`;
}

/* ---- Paneles nine-slice (border-image) ------------------------- */
// Re-exportamos como URL para usarlos en estilos inline cuando haga falta.
import bigRedBtn from './assets/sprites/UI Elements/UI Elements/Buttons/BigRedButton_Regular.png';
import bigBlueBtn from './assets/sprites/UI Elements/UI Elements/Buttons/BigBlueButton_Regular.png';
import regularPaper from './assets/sprites/UI Elements/UI Elements/Papers/RegularPaper.png';
import specialPaper from './assets/sprites/UI Elements/UI Elements/Papers/SpecialPaper.png';
import banner from './assets/sprites/UI Elements/UI Elements/Banners/Banner.png';

export const PANEL = {
  buttonRed: bigRedBtn,
  buttonBlue: bigBlueBtn,
  paper: regularPaper,
  paperSpecial: specialPaper,
  banner,
} as const;

// Unidades
import blueWarriorIdle from './assets/sprites/Units/Blue Units/Warrior/Warrior_Idle.png';
import redWarriorIdle from './assets/sprites/Units/Red Units/Warrior/Warrior_Idle.png';
import blueArcherIdle from './assets/sprites/Units/Blue Units/Archer/Archer_Idle.png';
import blueLancerIdle from './assets/sprites/Units/Blue Units/Lancer/Lancer_Idle.png';

// Edificios
import blueCastle from './assets/sprites/Buildings/Blue Buildings/Castle.png';
import blueBarracks from './assets/sprites/Buildings/Blue Buildings/Barracks.png';
import blueTower from './assets/sprites/Buildings/Blue Buildings/Tower.png';

// Terreno / Recursos
import goldResource from './assets/sprites/Terrain/Resources/Gold/Gold Resource/Gold_Resource.png';
import cloud1 from './assets/sprites/Terrain/Decorations/Clouds/Clouds_01.png';
import cloud2 from './assets/sprites/Terrain/Decorations/Clouds/Clouds_02.png';

// Partículas
import explosion1 from './assets/sprites/Particle FX/Explosion_01.png';

export const SPRITE = {
  warriorBlue: blueWarriorIdle,
  warriorRed: redWarriorIdle,
  archerBlue: blueArcherIdle,
  lancerBlue: blueLancerIdle,
  castle: blueCastle,
  barracks: blueBarracks,
  tower: blueTower,
  goldResource,
  cloud1,
  cloud2,
  explosion: explosion1,
} as const;

export { UI };
