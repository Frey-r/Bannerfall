import { describe, it, expect } from 'vitest';
import {
  getUserProfile,
  adjustGold,
  recordBattleRewards,
  levelConsejero,
  getUserConsejeros,
} from '../src/server/core/rewards.ts';

describe('rewards core (resources, progression & atomic actions)', () => {
  it('should initialize a default user profile and advisors if not existing', async () => {
    const userId = 't2_newuser';
    const profile = await getUserProfile(userId);

    expect(profile.gold).toBe(1000);
    expect(profile.settlementLevel).toBe(1);

    const advisors = await getUserConsejeros(userId);
    expect(advisors.length).toBe(3);
    expect(advisors[0].level).toBe(1);
  });

  it('should successfully credit gold', async () => {
    const userId = 't2_golduser';
    const profile = await getUserProfile(userId); // starts with 1000
    const finalGold = await adjustGold(userId, 500);

    expect(finalGold).toBe(1500);
    const updated = await getUserProfile(userId);
    expect(updated.gold).toBe(1500);
  });

  it('should throw an error and NOT debit gold if it would go below 0', async () => {
    const userId = 't2_pooruser';
    await getUserProfile(userId); // starts with 1000

    await expect(adjustGold(userId, -1500)).rejects.toThrow(
      'INSUFFICIENT_FUNDS: No tienes suficiente oro'
    );

    // Verify gold remained at 1000
    const profile = await getUserProfile(userId);
    expect(profile.gold).toBe(1000);
  });

  it('should distribute correct rewards for winning a battle', async () => {
    const userId = 't2_pveuser';
    await getUserProfile(userId);

    const result = await recordBattleRewards(userId, true, 'some_gen');
    expect(result.goldEarned).toBe(200);
    expect(result.scoreEarned).toBe(15);
    expect(result.newGoldTotal).toBe(1200);
  });

  it('should level up advisors and deduct cost', async () => {
    const userId = 't2_proguser';
    const profile = await getUserProfile(userId); // 1000 gold

    // Level 1 to 2 cost is 1 * 150 = 150 gold
    const result = await levelConsejero(userId, 'c1');
    expect(result.newLevel).toBe(2);
    expect(result.cost).toBe(150);

    const updatedProfile = await getUserProfile(userId);
    expect(updatedProfile.gold).toBe(850); // 1000 - 150
  });

  it('should reject leveling up advisors if gold is insufficient', async () => {
    const userId = 't2_nongolduser';
    await getUserProfile(userId); // 1000 gold
    
    // Level up c1 to Level 2 (150 gold) -> Remaining 850
    await levelConsejero(userId, 'c1');

    // Level up c1 to Level 3 (2 * 150 = 300 gold) -> Remaining 550
    await levelConsejero(userId, 'c1');

    // Level up c1 to Level 4 (3 * 150 = 450 gold) -> Remaining 100
    await levelConsejero(userId, 'c1');

    // Level up c1 to Level 5 (4 * 150 = 600 gold) -> Should fail because only 100 gold remains
    await expect(levelConsejero(userId, 'c1')).rejects.toThrow(
      'INSUFFICIENT_FUNDS: No tienes suficiente oro'
    );
  });
});
