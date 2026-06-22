import { Router } from 'express';
import { seedNPCs } from '../core/npc.ts';

const router = Router();

// POST /api/internal/seed-npcs - Seed NPC generals for matchmaking and leaderboard
router.post('/seed-npcs', async (req, res) => {
  try {
    await seedNPCs();
    res.json({ success: true, message: 'NPCs seeded successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error seeding NPCs' });
  }
});

export default router;
