export class PRNG {
  private seed: number;

  constructor(seedStr: string | number) {
    if (typeof seedStr === 'string') {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
      }
      this.seed = h >>> 0;
    } else {
      this.seed = seedStr >>> 0;
    }
  }

  /**
   * Generates a pseudo-random float between 0 (inclusive) and 1 (exclusive).
   */
  nextFloat(): number {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a pseudo-random integer between min (inclusive) and max (inclusive).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  /**
   * Generates a deterministic hex string of a given byte length.
   */
  nextHex(bytes: number): string {
    let out = '';
    for (let i = 0; i < bytes; i++) {
      const val = this.nextInt(0, 255);
      out += val.toString(16).padStart(2, '0');
    }
    return out;
  }
}
