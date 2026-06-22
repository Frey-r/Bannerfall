import { redis } from '../devvitProxy/index.ts';
import { keys } from './keys.ts';
import { General } from '../../shared/types/index.ts';

export async function getGeneral(gid: string): Promise<General | null> {
  const data = await redis.get(keys.general(gid));
  if (!data) return null;
  
  try {
    const general = JSON.parse(data) as General;
    // Schema versioning default application (ADR-0007 / Meta progression spec)
    if (!general.schemaVersion) {
      general.schemaVersion = 1;
    }
    if (!general.abilities) {
      general.abilities = [];
    }
    return general;
  } catch (err) {
    console.error(`Error parsing general data for ID: ${gid}`, err);
    return null;
  }
}

export async function getUserGenerals(userId: string): Promise<General[]> {
  const userGeneralsKey = keys.userGenerals(userId);
  // Get all generals sorted by score (createdAt) descending
  const list = await redis.zRange(userGeneralsKey, 0, -1, { reverse: true });
  
  if (list.length === 0) return [];

  const generals = await Promise.all(
    list.map(item => getGeneral(item.member))
  );

  return generals.filter((g): g is General => g !== null);
}
