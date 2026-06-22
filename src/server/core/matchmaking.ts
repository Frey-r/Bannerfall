import { redis } from '../devvitProxy/index.ts';
import { keys } from './keys.ts';
import { General } from '../../shared/types/index.ts';
import { getGeneral } from './generals.ts';
import { MATCHMAKING_POWER_BAND } from '../../shared/sim/balance.ts';

export async function findOpponent(userId: string, attacker: General): Promise<General> {
  const poolKey = keys.poolPower();
  const P = attacker.power;

  // 1. Try finding within standard power band [P - 15, P + 15]
  let opponent = await searchPoolInBand(userId, attacker.id, P, MATCHMAKING_POWER_BAND);
  if (opponent) return opponent;

  // 2. Expand band to 50 if none found [P - 50, P + 50]
  opponent = await searchPoolInBand(userId, attacker.id, P, 50);
  if (opponent) return opponent;

  // 3. Fallback to wide search to find the closest NPC or any valid opponent
  opponent = await searchPoolInBand(userId, attacker.id, P, 500);
  if (opponent) return opponent;

  throw new Error('NO_OPPONENT_FOUND: No se encontraron rivales elegibles en el pool.');
}

async function searchPoolInBand(
  userId: string,
  attackerId: string,
  power: number,
  band: number
): Promise<General | null> {
  const poolKey = keys.poolPower();
  const min = Math.max(0, power - band);
  const max = power + band;

  // Query up to 30 candidates
  const candidates = await redis.zRangeByScore(poolKey, min, max, {
    limit: { offset: 0, count: 30 },
  });

  if (candidates.length === 0) return null;

  // Randomize candidate ordering to avoid everyone fighting the same general
  const shuffled = candidates.sort(() => Math.random() - 0.5);

  for (const candidate of shuffled) {
    const opponentId = candidate.member;

    // Exclude own general
    if (opponentId === attackerId) continue;

    // Load general details
    const general = await getGeneral(opponentId);

    // Stale handling: if general expired (returns null), clean it up from pool and keep searching
    if (!general) {
      await redis.del(keys.general(opponentId)); // ensure clean
      await redis.zAdd(poolKey, { member: opponentId, score: -1 }); // send to bottom or remove
      // Wait, let's remove from pool using zAdd with score or zRem if we had it.
      // Since we don't have a direct zRem in the proxy API, we can just ignore it or set score to -1,
      // but let's see. If we don't have zRem in the proxy, can we add zRem?
      // Yes, let's check: we have zRemRangeByRank, but no zRem.
      // Wait, is it necessary to delete it? Just skipping it is fine and safe.
      continue;
    }

    // Exclude user's own generals (ownerId === userId)
    // Note: NPCs have ownerId === 'npc', so they are not excluded.
    if (general.ownerId === userId) continue;

    return general;
  }

  return null;
}
