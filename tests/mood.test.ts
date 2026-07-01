import { describe, it, expect } from 'vitest';
import { stepRun, previewTurn } from '../src/shared/sim/stepRun.ts';
import {
  eventTurns,
  RUN_TURNS,
  MOOD_START,
  MOOD_MIN,
  MOOD_MAX,
  MOOD_CRIT,
  MOOD_FAIL,
  nextMood,
  moodDiceShift,
} from '../src/shared/sim/balance.ts';
import { DeckSnapshot, ActionLog, Affinity } from '../src/shared/types/index.ts';

const deck: DeckSnapshot = [
  { id: 'c1', name: 'Consejero de Guerra', affinity: 'OFE', level: 5 },
  { id: 'c2', name: 'Albañil del Muro', affinity: 'DEF', level: 3 },
  { id: 'c3', name: 'Maestre de Cuentas', affinity: 'MAN', level: 2 },
];

function trainLog(seed: string, choice: Affinity = 'OFE'): ActionLog {
  const evt = eventTurns(seed);
  return [...Array(RUN_TURNS)].map((_, i) =>
    evt.has(i) ? ({ kind: 'event', branch: 0 } as const) : ({ kind: 'train', choice } as const)
  );
}

/** Log que SOLO descansa (mantiene las stats bajas → encuentros perdidos garantizados). */
function restLog(seed: string): ActionLog {
  const evt = eventTurns(seed);
  return [...Array(RUN_TURNS)].map((_, i) =>
    evt.has(i) ? ({ kind: 'event', branch: 0 } as const) : ({ kind: 'rest' } as const)
  );
}

describe('ánimo — helpers puros', () => {
  it('nextMood aplica el delta y acota a [MOOD_MIN, MOOD_MAX]', () => {
    expect(nextMood(1.0, 'crit')).toBeCloseTo(1.0 + MOOD_CRIT);
    expect(nextMood(1.0, 'fail')).toBeCloseTo(1.0 + MOOD_FAIL);
    expect(nextMood(MOOD_MAX, 'crit')).toBe(MOOD_MAX); // clamp arriba
    expect(nextMood(MOOD_MIN, 'fail')).toBe(MOOD_MIN); // clamp abajo
    expect(nextMood(MOOD_MIN, 'encounterLoss')).toBe(MOOD_MIN);
  });

  it('moodDiceShift es neutro en 1.0 y favorece/penaliza en los extremos', () => {
    expect(moodDiceShift(1.0)).toEqual({ failMaxDelta: 0, critMinDelta: 0 });
    // Ánimo alto: menos fallo y/o más crítico (deltas ≤ 0).
    expect(moodDiceShift(MOOD_MAX).failMaxDelta).toBeLessThanOrEqual(0);
    expect(moodDiceShift(MOOD_MAX).critMinDelta).toBeLessThan(0);
    // Ánimo bajo: más fallo (failMaxDelta > 0).
    expect(moodDiceShift(MOOD_MIN).failMaxDelta).toBeGreaterThan(0);
  });
});

describe('ánimo — efecto en las probabilidades del entrenamiento', () => {
  it('ánimo alto nunca da peores odds que ánimo bajo (y a veces mejores)', () => {
    let sawBetter = false;
    for (let seedN = 0; seedN < 8; seedN++) {
      const seed = `mood_odds_${seedN}`;
      for (let t = 0; t < RUN_TURNS; t++) {
        const hi = previewTurn(seed, deck, 'OFE', 100, t, MOOD_MAX);
        const lo = previewTurn(seed, deck, 'OFE', 100, t, MOOD_MIN);
        // Monotonía: el ánimo solo relaja umbrales a favor (siempre se cumple).
        expect(hi.failPct).toBeLessThanOrEqual(lo.failPct + 1e-9);
        expect(hi.critPct).toBeGreaterThanOrEqual(lo.critPct - 1e-9);
        if (hi.failPct < lo.failPct - 1e-9 || hi.critPct > lo.critPct + 1e-9) sawBetter = true;
      }
    }
    expect(sawBetter).toBe(true); // hay un efecto real, no vacío
  });
});

describe('ánimo — integración en stepRun', () => {
  it('arranca en MOOD_START y se mantiene dentro de [MOOD_MIN, MOOD_MAX]', () => {
    const seed = 'mood_bounds';
    const res = stepRun(seed, deck, trainLog(seed, 'OFE'));
    expect(res.turns[0].moodBefore).toBe(MOOD_START);
    for (const t of res.turns) {
      expect(t.moodAfter!).toBeGreaterThanOrEqual(MOOD_MIN);
      expect(t.moodAfter!).toBeLessThanOrEqual(MOOD_MAX);
    }
    expect(res.mood).toBeGreaterThanOrEqual(MOOD_MIN);
    expect(res.mood).toBeLessThanOrEqual(MOOD_MAX);
  });

  it('perder encuentros DESPLOMA el ánimo (build solo-descanso pierde los 4)', () => {
    const seed = 'mood_crash';
    const res = stepRun(seed, deck, restLog(seed));
    expect(res.encounters).toHaveLength(4);
    expect(res.encounters.every((e) => !e.won)).toBe(true); // poder ~base, pierde todo
    expect(res.bonusEarned).toBe(false);
    // En cada frontera perdida, el ánimo cae respecto al inicio del turno.
    for (const e of res.encounters) {
      const turn = res.turns[e.afterTurn];
      expect(turn.moodAfter!).toBeLessThanOrEqual(turn.moodBefore!);
    }
    expect(res.mood).toBeLessThan(0.9); // se desplomó
  });
});
