import { describe, it, expect } from 'vitest';
import { stepRun } from '../src/shared/sim/stepRun.ts';
import {
  eventTurns,
  RUN_TURNS,
  ENCOUNTER_COUNT,
  BOSS_POWER,
  ENCOUNTER_BONUS,
  ENCOUNTER_POWERS,
  encounterDefs,
  encounterAfterTurn,
  balancedStatsForPower,
  makeEnemyGeneral,
  applyEncounterBonus,
  calculatePower,
  MAX_STAT,
} from '../src/shared/sim/balance.ts';
import { DeckSnapshot, ActionLog, Affinity } from '../src/shared/types/index.ts';

const deck: DeckSnapshot = [
  { id: 'c1', name: 'Consejero de Guerra', affinity: 'OFE', level: 5 },
  { id: 'c2', name: 'Albañil del Muro', affinity: 'DEF', level: 3 },
  { id: 'c3', name: 'Maestre de Cuentas', affinity: 'MAN', level: 2 },
];

function trainLog(seed: string, choice: Affinity = 'OFE'): ActionLog {
  const evt = eventTurns(seed);
  const log: ActionLog = [];
  for (let i = 0; i < RUN_TURNS; i++) {
    log.push(evt.has(i) ? { kind: 'event', branch: 0 } : { kind: 'train', choice });
  }
  return log;
}

describe('encuentros — definiciones y enemigos', () => {
  it('hay exactamente 4 encuentros y el último es el jefe de 120 de poder', () => {
    const defs = encounterDefs();
    expect(defs).toHaveLength(ENCOUNTER_COUNT);
    const boss = defs[defs.length - 1];
    expect(boss.isBoss).toBe(true);
    expect(boss.power).toBe(BOSS_POWER);
    expect(boss.afterTurn).toBe(RUN_TURNS - 1);
    // Solo uno es jefe; los 3 primeros no lo son.
    expect(defs.filter((d) => d.isBoss)).toHaveLength(1);
  });

  it('encounterAfterTurn coincide con las fronteras y es undefined fuera de ellas', () => {
    for (const d of encounterDefs()) {
      expect(encounterAfterTurn(d.afterTurn)?.index).toBe(d.index);
    }
    expect(encounterAfterTurn(0)).toBeUndefined();
  });

  it('balancedStatsForPower produce stats equilibradas con el poder exacto', () => {
    for (const target of ENCOUNTER_POWERS) {
      const s = balancedStatsForPower(target);
      expect(calculatePower(s)).toBe(target);
      // "Equilibrado": las tres stats casi iguales (rango ≤ 2).
      const max = Math.max(s.ofe, s.def, s.man);
      const min = Math.min(s.ofe, s.def, s.man);
      expect(max - min).toBeLessThanOrEqual(2);
    }
  });

  it('makeEnemyGeneral del jefe tiene poder 120 y stats equilibradas', () => {
    const bossDef = encounterDefs().find((d) => d.isBoss)!;
    const enemy = makeEnemyGeneral('seed_x', bossDef);
    expect(enemy.power).toBe(BOSS_POWER);
    expect(enemy.name).toBe(bossDef.name);
  });
});

describe('encuentros — bono del jefe', () => {
  it('applyEncounterBonus suma +10 a todo solo si se ganó, con clamp a MAX_STAT', () => {
    const base = { ofe: 40, def: 50, man: 95 };
    expect(applyEncounterBonus(base, false)).toEqual(base);
    expect(applyEncounterBonus(base, true)).toEqual({
      ofe: 40 + ENCOUNTER_BONUS,
      def: 50 + ENCOUNTER_BONUS,
      man: Math.min(MAX_STAT, 95 + ENCOUNTER_BONUS), // 100
    });
  });
});

describe('encuentros — integración en stepRun', () => {
  it('resuelve los 4 encuentros en una run completa, de forma determinista', () => {
    const seed = 'enc_full';
    const a = stepRun(seed, deck, trainLog(seed, 'OFE'));
    const b = stepRun(seed, deck, trainLog(seed, 'OFE'));
    expect(a.encounters).toHaveLength(ENCOUNTER_COUNT);
    expect(a.encounters.map((e) => e.won)).toEqual(b.encounters.map((e) => e.won));
    // bonusEarned refleja exactamente la victoria del jefe.
    const bossWon = a.encounters.find((e) => e.isBoss)!.won;
    expect(a.bonusEarned).toBe(bossWon);
  });

  it('en logs parciales solo aparecen los encuentros cuya frontera ya pasó', () => {
    const seed = 'enc_partial';
    const full = trainLog(seed, 'OFE');
    // Tras 5 acciones (índices 0..4) solo pudo resolverse el encuentro de afterTurn=3.
    const res = stepRun(seed, deck, full.slice(0, 5));
    expect(res.encounters.every((e) => e.afterTurn < 5)).toBe(true);
    expect(res.encounters.some((e) => e.isBoss)).toBe(false); // el jefe es afterTurn=RUN_TURNS-1
    expect(res.bonusEarned).toBe(false);
  });

  it('cada encuentro queda adjunto al TurnResult de su frontera', () => {
    const seed = 'enc_attach';
    const res = stepRun(seed, deck, trainLog(seed, 'OFE'));
    for (const e of res.encounters) {
      expect(res.turns[e.afterTurn].encounter?.index).toBe(e.index);
    }
  });
});
