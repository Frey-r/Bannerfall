/** Letra de tier (1..5 -> E/D/C/B/A), igual que el cliente React. */
export function tierLetter(tier: number): string {
  return ['E', 'D', 'C', 'B', 'A'][Math.max(0, Math.min(4, tier - 1))];
}

const RANDOM_NAMES = [
  'Aldric', 'Brienne', 'Cerdic', 'Darius', 'Eadric',
  'Godric', 'Karr', 'Lothar', 'Orin', 'Roderic',
  'Theodoric', 'Uther', 'Valerius', 'Wulfric', 'Titus',
];

export function randomGeneralName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}
