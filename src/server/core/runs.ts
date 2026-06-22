import { redis } from '../devvitProxy/index.ts';
import { keys } from './keys.ts';
import { DeckSnapshot, ActionLog, General } from '../../shared/types/index.ts';
import { simulateRun } from '../../shared/sim/simulateRun.ts';

const RUN_TTL_SECONDS = 1800; // 30 minutes
const GENERAL_TTL_SECONDS = 30 * 24 * 3600; // 30 days
const MAX_RUNS_PER_HOUR = 10;

export async function startRun(
  userId: string,
  deckSnapshot: DeckSnapshot
): Promise<{ runId: string; seed: string; deckSnapshot: DeckSnapshot }> {
  // 1. Throttling / Rate limiting (10 runs per hour)
  const hourWindow = Math.floor(Date.now() / 3600000);
  const rateKey = `rate:run:${userId}`;
  const currentRuns = await redis.hIncrBy(rateKey, String(hourWindow), 1);
  
  if (currentRuns > MAX_RUNS_PER_HOUR) {
    // Revert increment
    await redis.hIncrBy(rateKey, String(hourWindow), -1);
    throw new Error(`RATE_LIMIT_EXCEEDED: Has superado el límite de ${MAX_RUNS_PER_HOUR} runs por hora.`);
  }

  // 2. Generate runId and seed
  // Standard UUID replacement for safe serverless usage
  const runId = `run_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
  const seed = `seed_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;

  // 3. Persist run with TTL
  const runState = {
    runId,
    seed,
    deckSnapshot,
    ownerId: userId,
    status: 'OPEN',
    createdAt: Date.now(),
  };

  const runKey = `run:${runId}`;
  await redis.set(runKey, JSON.stringify(runState), { expiration: RUN_TTL_SECONDS });

  return { runId, seed, deckSnapshot };
}

export async function submitRun(
  userId: string,
  runId: string,
  actionLog: ActionLog,
  name?: string
): Promise<General> {
  const runKey = `run:${runId}`;
  const runData = await redis.get(runKey);

  if (!runData) {
    throw new Error('RUN_NOT_FOUND: La run no existe o ha expirado.');
  }

  const run = JSON.parse(runData);

  if (run.status !== 'OPEN') {
    throw new Error('RUN_ALREADY_SUBMITTED: Esta run ya fue completada.');
  }

  if (run.ownerId !== userId) {
    throw new Error('FORBIDDEN: No eres el dueño de esta run.');
  }

  if (Date.now() - run.createdAt > RUN_TTL_SECONDS * 1000) {
    throw new Error('RUN_EXPIRED: La run ha expirado.');
  }

  // 1. Simulate the run server-side to get authoritative stats
  const general = simulateRun(run.seed, run.deckSnapshot, actionLog, name);
  
  // 2. Fill owner and timestamps
  general.ownerId = userId;
  general.createdAt = Date.now();

  // 3. Persist the minted General
  const generalKey = keys.general(general.id);
  await redis.set(generalKey, JSON.stringify(general), { expiration: GENERAL_TTL_SECONDS });

  // 4. Register ownership in user's general list
  const userGeneralsKey = keys.userGenerals(userId);
  await redis.zAdd(userGeneralsKey, { member: general.id, score: general.createdAt });

  // 5. Add to the matchmaking pool
  const poolKey = keys.poolPower();
  await redis.zAdd(poolKey, { member: general.id, score: general.power });

  // 6. Cap matchmaking pool size to prevent infinite Redis growth (e.g. cap at 500)
  const poolSize = await redis.zCard(poolKey);
  if (poolSize > 500) {
    // remove the ones with lowest power
    await redis.zRemRangeByRank(poolKey, 0, poolSize - 501);
  }

  // 7. Consume the run (delete it so it cannot be replayed)
  await redis.del(runKey);

  return general;
}
