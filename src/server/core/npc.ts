import { redis } from '../devvitProxy/index.ts';
import { keys } from './keys.ts';
import { General, GeneralStats } from '../../shared/types/index.ts';
import { calculatePower, calculateTier, deriveAbilities } from '../../shared/sim/balance.ts';

const NPC_NAMES = [
  'Valerius el Temible', 'Lydia la Pía', 'Darius el Cauto', 'Titus de Hierro',
  'Aurelia del Viento', 'Lucius el Astuto', 'Flavia la Fuerte', 'Marcus el Sabio',
  'Cassia de Ocre', 'Julius el Bravo', 'Diana la Veloz', 'Rufus Colmillo',
  'Decimus el Firme', 'Septimus el Gris', 'Faustus el Rojo', 'Nero el Negro',
  'Severa la Altiva', 'Gaius el Grande', 'Vannia la Leal', 'Aetius de Plata',
  'Belisarius de Oriente', 'Stilicho de Occidente', 'Zenobia de Palmira',
  'Boudica de Icenos', 'Alaric el Destructor', 'Attila el Azote', 'Clovis el Grande',
  'Theodora de Púrpura', 'Justinian el Grande', 'Arminius de Germania',
  'Vercingetorix de Galia', 'Leonidas de Esparta', 'Hannibal de Cartago',
  'Scipio el Africano', 'Alexander de Macedonia', 'Cyrus de Persia',
  'Pyrrhus de Epiro', 'Mithridates del Ponto', 'Cleopatra del Nilo',
  'Caesar el Dictador'
];

export async function seedNPCs(): Promise<void> {
  const isSeeded = await redis.get('npcs:seeded');
  if (isSeeded === 'true') {
    return;
  }

  console.log('Seeding NPCs for matchmaking pool and leaderboard...');

  const poolKey = keys.poolPower();
  const lbKey = keys.lbSeason(1);

  for (let i = 0; i < NPC_NAMES.length; i++) {
    const name = NPC_NAMES[i];
    const npcId = `npc_${i + 1}`;

    // Generate stats depending on the power target
    // We want a spread of powers from 30 to 220
    const targetPower = 30 + i * 5; // 30, 35, 40, ..., 225

    // Distribute stats roughly to hit target power: power = ofe + def + man * 1.2
    // Let's divide by 3.2
    const baseStatVal = Math.floor(targetPower / 3.2);
    
    // add some variation
    const ofe = Math.max(10, Math.min(100, baseStatVal + (i % 3 - 1) * 5));
    const def = Math.max(10, Math.min(100, baseStatVal + (i % 4 - 2) * 4));
    // solve for man: man = (targetPower - ofe - def) / 1.2
    const man = Math.max(10, Math.min(100, Math.floor((targetPower - ofe - def) / 1.2)));

    const stats: GeneralStats = { ofe, def, man };
    const power = calculatePower(stats);
    const tier = calculateTier(power);
    const abilities = deriveAbilities(stats);

    const npcGeneral: General = {
      id: npcId,
      ownerId: 'npc',
      name,
      stats,
      power,
      tier,
      abilities,
      seed: `npc_seed_${i}`,
      schemaVersion: 1,
      createdAt: Date.now() - (40 - i) * 60000, // staggered creation times
    };

    // Save NPC General
    await redis.set(keys.general(npcId), JSON.stringify(npcGeneral));

    // Add to pool
    await redis.zAdd(poolKey, { member: npcId, score: power });

    // Add top NPCs to the leaderboard to simulate competition
    if (power >= 140) {
      // Add to season 1 leaderboard with representative scores (e.g. power * 10)
      await redis.zAdd(lbKey, { member: npcId, score: power * 10 });
    }
  }

  await redis.set('npcs:seeded', 'true');
  console.log('Successfully seeded 40 NPCs!');
}
