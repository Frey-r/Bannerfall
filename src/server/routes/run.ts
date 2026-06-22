import { Router } from 'express';
import { getCurrentUserId } from '../core/auth.ts';
import { startRun, submitRun } from '../core/runs.ts';
import { getUserGenerals } from '../core/generals.ts';
import { checkAndLockIdempotency, saveIdempotency } from '../core/idempotency.ts';

const router = Router();

// POST /api/run/start - Start a training run
router.post('/start', async (req, res) => {
  const { deckSnapshot, idempToken } = req.body;

  try {
    const userId = getCurrentUserId();

    if (!deckSnapshot || !Array.isArray(deckSnapshot)) {
      return res.status(400).json({ error: 'El deckSnapshot es requerido y debe ser un arreglo.' });
    }

    if (idempToken) {
      const idemp = await checkAndLockIdempotency(idempToken);
      if (!idemp.isNew) {
        return res.json(JSON.parse(idemp.cachedResult || '{}'));
      }
    }

    const result = await startRun(userId, deckSnapshot);

    if (idempToken) {
      await saveIdempotency(idempToken, JSON.stringify(result));
    }

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error starting run' });
  }
});

// POST /api/run/submit - Submit a training actionLog to mint a General
router.post('/submit', async (req, res) => {
  const { runId, actionLog, name, idempToken } = req.body;

  try {
    const userId = getCurrentUserId();

    if (!runId || !actionLog) {
      return res.status(400).json({ error: 'runId y actionLog son requeridos.' });
    }

    if (idempToken) {
      const idemp = await checkAndLockIdempotency(idempToken);
      if (!idemp.isNew) {
        return res.json(JSON.parse(idemp.cachedResult || '{}'));
      }
    }

    const general = await submitRun(userId, runId, actionLog, name);

    if (idempToken) {
      await saveIdempotency(idempToken, JSON.stringify(general));
    }

    res.json(general);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error submitting run' });
  }
});

// GET /api/run/generals - Get user's general inventory
router.get('/generals', async (req, res) => {
  try {
    const userId = getCurrentUserId();
    const generals = await getUserGenerals(userId);
    res.json(generals);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching generals' });
  }
});

export default router;
