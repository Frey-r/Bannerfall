import { redis } from '../devvitProxy/index.ts';
import { keys } from './keys.ts';

export async function checkAndLockIdempotency(
  token: string,
  ttlSeconds = 300
): Promise<{ isNew: boolean; cachedResult?: string }> {
  if (!token) {
    return { isNew: true };
  }

  const key = keys.idemp(token);

  // 1. Check if we already have a cached result or a pending lock
  const existing = await redis.get(key);
  if (existing) {
    return { isNew: false, cachedResult: existing };
  }

  // 2. Set as PENDING with NX
  await redis.set(key, 'PENDING', { nx: true, expiration: ttlSeconds });

  // 3. Double-check to ensure we won the race
  const current = await redis.get(key);
  if (current === 'PENDING') {
    return { isNew: true };
  }

  // We lost the race
  return { isNew: false, cachedResult: current || undefined };
}

export async function saveIdempotency(
  token: string,
  result: string,
  ttlSeconds = 300
): Promise<void> {
  if (!token) return;
  const key = keys.idemp(token);
  await redis.set(key, result, { expiration: ttlSeconds });
}
