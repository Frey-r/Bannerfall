import { describe, it, expect } from 'vitest';
import { PRNG } from '../src/shared/sim/prng.ts';

describe('PRNG (Seeded pseudo-random number generator)', () => {
  it('should generate identical sequences for the same seed', () => {
    const seed = 'test_seed_123';
    const prng1 = new PRNG(seed);
    const prng2 = new PRNG(seed);

    const seq1 = Array.from({ length: 100 }, () => prng1.nextFloat());
    const seq2 = Array.from({ length: 100 }, () => prng2.nextFloat());

    expect(seq1).toEqual(seq2);
  });

  it('should generate different sequences for different seeds', () => {
    const prng1 = new PRNG('seed_a');
    const prng2 = new PRNG('seed_b');

    const seq1 = Array.from({ length: 50 }, () => prng1.nextFloat());
    const seq2 = Array.from({ length: 50 }, () => prng2.nextFloat());

    expect(seq1).not.toEqual(seq2);
  });

  it('should generate integers within specified bounds', () => {
    const prng = new PRNG('bounds_test');
    const min = 5;
    const max = 15;

    for (let i = 0; i < 500; i++) {
      const val = prng.nextInt(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('should generate identical hex strings for the same seed', () => {
    const seed = 'hex_seed';
    const prng1 = new PRNG(seed);
    const prng2 = new PRNG(seed);

    expect(prng1.nextHex(8)).toBe(prng2.nextHex(8));
  });
});
