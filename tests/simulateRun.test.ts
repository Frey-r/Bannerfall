import { describe, it, expect } from 'vitest';
import { simulateRun } from '../src/shared/sim/simulateRun.ts';
import { DeckSnapshot, ActionLog } from '../src/shared/types/index.ts';

const mockDeck: DeckSnapshot = [
  { id: 'adv1', name: 'Consejero 1', affinity: 'OFE', level: 2 },
  { id: 'adv2', name: 'Consejero 2', affinity: 'DEF', level: 1 },
  { id: 'adv3', name: 'Consejero 3', affinity: 'MAN', level: 3 },
];

const mockValidLog: ActionLog = [
  { consejeroId: 'adv1', choice: 'OFE' },
  { consejeroId: 'adv1', choice: 'OFE' },
  { consejeroId: 'adv2', choice: 'DEF' },
  { consejeroId: 'adv2', choice: 'DEF' },
  { consejeroId: 'adv3', choice: 'MAN' },
  { consejeroId: 'adv3', choice: 'MAN' },
  { consejeroId: 'adv1', choice: 'OFE' },
  { consejeroId: 'adv3', choice: 'MAN' },
];

describe('simulateRun (deterministic training)', () => {
  it('should generate the exact same General when run twice with the same inputs', () => {
    const seed = 'run_seed_999';
    const gen1 = simulateRun(seed, mockDeck, mockValidLog, 'Marcus');
    const gen2 = simulateRun(seed, mockDeck, mockValidLog, 'Marcus');

    expect(gen1.id).toBe(gen2.id);
    expect(gen1.stats).toEqual(gen2.stats);
    expect(gen1.power).toBe(gen2.power);
    expect(gen1.abilities).toEqual(gen2.abilities);
    expect(gen1.tier).toBe(gen2.tier);
  });

  it('should reject actionLogs that do not have exactly 8 turns', () => {
    const seed = 'fail_length';
    const invalidLog = mockValidLog.slice(0, 7);

    expect(() => simulateRun(seed, mockDeck, invalidLog)).toThrow(
      'El actionLog debe tener exactamente 8 acciones.'
    );
  });

  it('should reject actions training with advisors not present in the deck', () => {
    const seed = 'fail_advisor';
    const invalidLog: ActionLog = [
      ...mockValidLog.slice(0, 7),
      { consejeroId: 'non_existent_adv', choice: 'MAN' },
    ];

    expect(() => simulateRun(seed, mockDeck, invalidLog)).toThrow(
      "El consejero 'non_existent_adv' en el índice 7 no pertenece al deckSnapshot."
    );
  });

  it('should clamp stats to MAX_STAT = 100 without exceeding it', () => {
    const seed = 'clamp_test';
    // Let's create high-level advisors that push stats beyond limits
    const superDeck: DeckSnapshot = [
      { id: 'op_adv', name: 'Overpowered Advisor', affinity: 'OFE', level: 50 },
    ];
    const opLog: ActionLog = Array.from({ length: 8 }, () => ({
      consejeroId: 'op_adv',
      choice: 'OFE',
    }));

    const general = simulateRun(seed, superDeck, opLog);
    expect(general.stats.ofe).toBe(100);
    expect(general.stats.ofe).not.toBeGreaterThan(100);
  });
});
