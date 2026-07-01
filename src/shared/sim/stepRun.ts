/* ============================================================
   stepRun — motor por-turno COMPARTIDO por cliente y servidor.

   Es la ÚNICA fuente de verdad de la run: toda la aleatoriedad sale
   del PRNG sembrado (vía el motor de DADOS, ver dice.ts) y cada
   decisión vive en el actionLog, así que el servidor re-deriva
   exactamente las mismas stats que vio el cliente. La energía es
   DERIVADA (se recalcula aquí, no se guarda).

   Cada entrenamiento y cada rama de evento con probabilidad se
   resuelve tirando dados. Los consejeros que ASISTEN se activan al
   azar cada turno (determinista por seed+turno, ver decisions/0012):
   reforman el dado según su arquetipo, detonan efectos de run y
   acumulan "afinidad" (bond); al cruzar el umbral desbloquean su
   habilidad de combate.

   Devuelve además un `TurnResult[]` (con las caras del dado) que
   alimenta el feedback por acción del cliente — determinismo y
   feedback comparten origen.
   ============================================================ */
import { PRNG } from './prng.ts';
import {
  Affinity,
  Consejero,
  ActionLog,
  General,
  GeneralStats,
  EncounterResult,
  RunSimResult,
  TurnResult,
  TurnOutcome,
} from '../types/index.ts';
import { validateActionLog } from './validate.ts';
import {
  BASE_STAT,
  MAX_STAT,
  MIN_STAT,
  ENERGY_MAX,
  TRAIN_COST,
  REST_GAIN,
  BOND_THRESHOLD,
  CONSEJERO_ABILITY,
  SIM_VERSION,
  MOOD_START,
  nextMood,
  baseGain,
  planTrainTurn,
  activeAdvisorsForTurn,
  secondaryStatFor,
  buildEventRoll,
  gainForBand,
  bondForParticipation,
  participantsBestFor,
  eventTurns,
  eventForTurn,
  calculatePower,
  calculateTier,
  deriveAbilities,
  encounterAfterTurn,
  makeEnemyGeneral,
} from './balance.ts';
import { simulateBattle } from './simulateBattle.ts';
import { rollDice, rollOdds, DiceRoll, OutcomeBand } from './dice.ts';

function clampStats(s: GeneralStats): void {
  s.ofe = Math.max(MIN_STAT, Math.min(MAX_STAT, s.ofe));
  s.def = Math.max(MIN_STAT, Math.min(MAX_STAT, s.def));
  s.man = Math.max(MIN_STAT, Math.min(MAX_STAT, s.man));
}

function diff(before: GeneralStats, after: GeneralStats): Partial<GeneralStats> {
  const d: Partial<GeneralStats> = {};
  if (after.ofe !== before.ofe) d.ofe = after.ofe - before.ofe;
  if (after.def !== before.def) d.def = after.def - before.def;
  if (after.man !== before.man) d.man = after.man - before.man;
  return d;
}

function bandToOutcome(band: OutcomeBand): TurnOutcome {
  return band === 'FALLO' ? 'fail' : band === 'CRITICO' ? 'crit' : 'normal';
}

/** Signo del ánimo que provoca un evento, según sus deltas de stat. */
function eventMoodSign(gains: Partial<GeneralStats>): 'eventPos' | 'eventNeg' | null {
  const vals = Object.values(gains).filter((v): v is number => v !== undefined);
  if (vals.some((v) => v < 0)) return 'eventNeg';
  if (vals.some((v) => v > 0)) return 'eventPos';
  return null;
}

/** General provisional del recluta con sus stats y habilidades ACTUALES (para los encuentros). */
function buildRunGeneral(seed: string, stats: GeneralStats, bond: Record<string, number>): General {
  const unlocked = Object.entries(bond)
    .filter(([, v]) => v >= BOND_THRESHOLD)
    .map(([id]) => CONSEJERO_ABILITY[id])
    .filter((n): n is string => !!n);
  const abilities = Array.from(new Set([...deriveAbilities(stats), ...unlocked]));
  const power = calculatePower(stats);
  return {
    id: 'run_general',
    ownerId: '',
    name: '(recluta)',
    stats: { ...stats },
    power,
    tier: calculateTier(power),
    abilities,
    seed,
    schemaVersion: SIM_VERSION,
    createdAt: 0,
  };
}

export function stepRun(seed: string, deck: Consejero[], actionLog: ActionLog): RunSimResult {
  const validation = validateActionLog(seed, deck, actionLog);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid action log or deck snapshot');
  }

  const prng = new PRNG(seed);
  const stats: GeneralStats = { ofe: BASE_STAT, def: BASE_STAT, man: BASE_STAT };
  let energy = ENERGY_MAX;
  let mood = MOOD_START; // ánimo: reforma el dado; vive aquí (autoritativo/determinista)
  const evtSet = eventTurns(seed);
  const turns: TurnResult[] = [];
  const bond: Record<string, number> = {};
  const encounters: EncounterResult[] = [];
  for (const c of deck) bond[c.id] = 0;

  for (let t = 0; t < actionLog.length; t++) {
    const action = actionLog[t];
    const energyBefore = energy;
    const moodBefore = mood;
    const before: GeneralStats = { ...stats };

    // --- Turno de evento (estructura derivada del seed) ---
    if (evtSet.has(t)) {
      const ev = eventForTurn(seed, t);
      const branchIdx = action.kind === 'event' ? action.branch : 0;
      const branch = ev.branches[branchIdx];
      let success = true;
      let dice: TurnResult['dice'];
      if (branch.successProb > 0 && branch.successProb < 1) {
        const outcome = rollDice(prng, buildEventRoll(branch.successProb));
        success = outcome.band === 'CRITICO';
        dice = { faces: outcome.faces, keptFace: outcome.keptFace, band: outcome.band, roll: outcome.roll };
      }
      const outcomeText = branch.apply(stats, success, prng);
      clampStats(stats);
      const gains = diff(before, stats);
      const sign = eventMoodSign(gains);
      if (sign) mood = nextMood(mood, sign);
      turns.push({
        turn: t,
        kind: 'event',
        gains,
        energyBefore,
        energyAfter: energy,
        moodBefore,
        moodAfter: mood,
        event: { id: ev.id, name: ev.name, branch: branchIdx, label: branch.label, outcomeText },
        dice,
      });
    } else if (action.kind === 'rest') {
      // --- Descanso (determinista, no tira dado) ---
      energy = Math.min(ENERGY_MAX, energy + REST_GAIN);
      mood = nextMood(mood, 'rest');
      turns.push({ turn: t, kind: 'rest', gains: {}, energyBefore, energyAfter: energy, moodBefore, moodAfter: mood });
    } else {
      // --- Entrenamiento: los consejeros ASISTEN al azar (determinista) y se resuelve con DADOS ---
      const choice: Affinity = action.kind === 'train' ? action.choice : 'OFE';
      const participants = activeAdvisorsForTurn(seed, deck, t);
      // El riesgo usa la energía Y el ánimo ANTES de resolver (ambos reforman el dado).
      const plan = planTrainTurn(participants, choice, energyBefore, moodBefore);

      energy = Math.min(ENERGY_MAX, Math.max(0, energy - TRAIN_COST + plan.energyRefund));
      const outcome = rollDice(prng, plan.roll);
      const base = baseGain(participantsBestFor(participants, choice), choice);
      const gain = gainForBand(outcome.band, base);

      const primary: keyof GeneralStats = choice === 'OFE' ? 'ofe' : choice === 'DEF' ? 'def' : 'man';
      stats[primary] += gain;
      // Stat secundaria (arquetipo Intendente / efecto Botín): solo en éxito (NORMAL o CRÍTICO).
      if (outcome.band !== 'FALLO' && plan.secondaryGain > 0) {
        stats[secondaryStatFor(choice)] += plan.secondaryGain;
      }
      clampStats(stats);

      // El ánimo reacciona al resultado: crítico lo sube, fallo lo baja (normal no cambia).
      if (outcome.band === 'CRITICO') mood = nextMood(mood, 'crit');
      else if (outcome.band === 'FALLO') mood = nextMood(mood, 'fail');

      // Bond por cada consejero ACTIVO (+ bonus de efecto de run, p. ej. Lealtad Fervorosa).
      const bondDeltas: Record<string, number> = {};
      for (const c of participants) {
        const d = bondForParticipation(c, choice) + (plan.bondBonus[c.id] ?? 0);
        bond[c.id] = (bond[c.id] ?? 0) + d;
        bondDeltas[c.id] = (bondDeltas[c.id] ?? 0) + d;
      }

      turns.push({
        turn: t,
        kind: 'train',
        choice,
        outcome: bandToOutcome(outcome.band),
        gains: diff(before, stats),
        energyBefore,
        energyAfter: energy,
        moodBefore,
        moodAfter: mood,
        dice: { faces: outcome.faces, keptFace: outcome.keptFace, band: outcome.band, roll: outcome.roll },
        bondDeltas,
        activeIds: participants.map((c) => c.id),
        advisorProcs: plan.procs.map((p) => ({ id: p.id, effectId: p.effectId, label: p.label })),
      });
    }

    // --- Encuentro en la frontera de este turno (común a todos los tipos) ---
    // Auto-resolución: NO consume energía ni el PRNG principal (seed derivado).
    // Una derrota DESPLOMA el ánimo → empeora las tiradas de los turnos siguientes.
    const encDef = encounterAfterTurn(t);
    if (encDef) {
      const me = buildRunGeneral(seed, stats, bond);
      const enemy = makeEnemyGeneral(seed, encDef);
      const battle = simulateBattle(`${seed}:enc:${t}`, me, enemy);
      const won = battle.winnerId === me.id;
      mood = nextMood(mood, won ? 'encounterWin' : 'encounterLoss');
      const result: EncounterResult = {
        index: encDef.index,
        afterTurn: t,
        enemyName: encDef.name,
        enemyPower: enemy.power,
        isBoss: encDef.isBoss,
        won,
        playerPower: me.power,
        battle,
      };
      encounters.push(result);
      const last = turns[turns.length - 1];
      last.encounter = result;
      last.moodAfter = mood; // refleja la subida/bajada del encuentro
    }
  }

  const unlockedAbilities = Array.from(
    new Set(
      Object.entries(bond)
        .filter(([, v]) => v >= BOND_THRESHOLD)
        .map(([id]) => CONSEJERO_ABILITY[id])
        .filter((name): name is string => !!name)
    )
  );

  const bonusEarned = encounters.find((e) => e.isBoss)?.won ?? false;

  return { stats, energy, mood, turns, bond, unlockedAbilities, encounters, bonusEarned };
}

/* ---- Preview (sólo display, NO consume el PRNG de la run) -------- */
export interface TrainPreview {
  energyCost: number; // coste NETO (TRAIN_COST menos reembolso de los activos)
  successPct: number; // 1 - probabilidad de fallo
  critPct: number;
  failPct: number;
  normalGain: number;
  critGain: number;
  secondaryGain: number; // +stat secundaria en éxito (0 si ninguno activo lo otorga)
  roll: DiceRoll; // spec efectivo del dado para dibujarlo
  activeIds: string[]; // consejeros que ASISTEN este turno (set activo determinista)
}

/**
 * Lo que el jugador ve en una carta ANTES de comprometerse: la lectura de la apuesta
 * para ESTE turno. El set de consejeros activos es determinista (seed+turno), así que
 * el preview muestra exactamente quién asiste; solo el resultado del dado es aleatorio.
 */
export function previewTurn(
  seed: string,
  deck: Consejero[],
  choice: Affinity,
  energy: number,
  turn: number,
  mood = 1.0
): TrainPreview {
  const participants = activeAdvisorsForTurn(seed, deck, turn);
  const plan = planTrainTurn(participants, choice, energy, mood);
  const odds = rollOdds(plan.roll);
  const base = baseGain(participantsBestFor(participants, choice), choice);
  return {
    energyCost: TRAIN_COST - plan.energyRefund,
    successPct: 1 - odds.failPct,
    critPct: odds.critPct,
    failPct: odds.failPct,
    normalGain: gainForBand('NORMAL', base),
    critGain: gainForBand('CRITICO', base),
    secondaryGain: plan.secondaryGain,
    roll: plan.roll,
    activeIds: participants.map((c) => c.id),
  };
}
