import { DeckSnapshot, ActionLog, General, GeneralStats } from '../types/index.ts';
import { PRNG } from './prng.ts';
import { validateActionLog } from './validate.ts';
import {
  BASE_STAT,
  MAX_STAT,
  MIN_STAT,
  calculatePower,
  calculateTier,
  deriveAbilities,
  CAMPAIGN_EVENTS,
} from './balance.ts';

export function simulateRun(
  seed: string,
  deckSnapshot: DeckSnapshot,
  actionLog: ActionLog,
  name?: string
): General {
  const validation = validateActionLog(deckSnapshot, actionLog);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid action log or deck snapshot');
  }

  const prng = new PRNG(seed);
  const generalId = `gen_${prng.nextHex(8)}_${prng.nextInt(100000, 999999)}`;

  const stats: GeneralStats = {
    ofe: BASE_STAT,
    def: BASE_STAT,
    man: BASE_STAT,
  };

  // Find advisor map for quick lookup
  const advisors = new Map(deckSnapshot.map(a => [a.id, a]));

  for (let turn = 0; turn < actionLog.length; turn++) {
    const action = actionLog[turn];
    const advisor = advisors.get(action.consejeroId)!;
    const choice = action.choice;

    // 1. Train stat
    const isAffinityMatch = advisor.affinity === choice;
    const baseGain = 5;
    const affinityBonus = isAffinityMatch ? 3 : 0;
    const levelBonus = advisor.level;

    const gain = baseGain + affinityBonus + levelBonus;

    if (choice === 'OFE') stats.ofe = Math.min(MAX_STAT, stats.ofe + gain);
    if (choice === 'DEF') stats.def = Math.min(MAX_STAT, stats.def + gain);
    if (choice === 'MAN') stats.man = Math.min(MAX_STAT, stats.man + gain);

    // 2. Roll for campaign event
    // 40% chance of an event (0 to 3), 60% chance of nothing (4 to 9)
    const roll = prng.nextInt(0, 9);
    if (roll < CAMPAIGN_EVENTS.length) {
      const event = CAMPAIGN_EVENTS[roll];
      event.effect(stats, choice);
    }

    // Force clamp
    stats.ofe = Math.max(MIN_STAT, Math.min(MAX_STAT, stats.ofe));
    stats.def = Math.max(MIN_STAT, Math.min(MAX_STAT, stats.def));
    stats.man = Math.max(MIN_STAT, Math.min(MAX_STAT, stats.man));
  }

  const finalPower = calculatePower(stats);
  const finalTier = calculateTier(finalPower);
  const finalAbilities = deriveAbilities(stats);

  const resolvedName = name || `General_${seed.substring(0, 4)}_${prng.nextInt(10, 99)}`;

  return {
    id: generalId,
    ownerId: '', // Filled by the server or client context
    name: resolvedName,
    stats,
    power: finalPower,
    tier: finalTier,
    abilities: finalAbilities,
    seed,
    schemaVersion: 1,
    createdAt: Date.now(), // Filled on the server, but default provided
  };
}
