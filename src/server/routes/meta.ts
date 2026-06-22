import { Router } from 'express';
import { getCurrentUserId } from '../core/auth.ts';
import { getUserProfile, getUserConsejeros, levelConsejero } from '../core/rewards.ts';
import { checkAndLockIdempotency, saveIdempotency } from '../core/idempotency.ts';

const router = Router();

// GET /api/profile - Retrieve authenticated user profile
router.get('/profile', async (req, res) => {
  try {
    const userId = getCurrentUserId();
    const profile = await getUserProfile(userId);
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// GET /api/consejeros - Retrieve authenticated user's advisors
router.get('/consejeros', async (req, res) => {
  try {
    const userId = getCurrentUserId();
    const advisors = await getUserConsejeros(userId);
    res.json(advisors);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// POST /api/consejeros/:id/level - Level up a specific advisor
router.post('/consejeros/:id/level', async (req, res) => {
  const { id } = req.params;
  const { idempToken } = req.body;

  try {
    const userId = getCurrentUserId();

    // Idempotency check
    if (idempToken) {
      const idemp = await checkAndLockIdempotency(idempToken);
      if (!idemp.isNew) {
        return res.json(JSON.parse(idemp.cachedResult || '{}'));
      }
    }

    const result = await levelConsejero(userId, id);

    if (idempToken) {
      await saveIdempotency(idempToken, JSON.stringify(result));
    }

    res.json(result);
  } catch (err: any) {
    // If idempotency failed, it won't save. If transaction failed, throw.
    res.status(400).json({ error: err.message || 'Error leveling advisor' });
  }
});

export default router;
