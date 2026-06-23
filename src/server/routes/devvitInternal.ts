/* ============================================================
   Endpoints internos invocados por Devvit (no por el cliente).
   Deben colgar de /internal/* (ver patrón InternalEndpoint del
   schema de devvit.json). Aquí viven la acción de menú para crear
   el post jugable y el trigger onAppInstall que evita que el
   subreddit quede vacío al instalar la app (playtest/upload).
   ============================================================ */
import { Router } from 'express';
import { reddit } from '@devvit/web/server';
import { context } from '../devvitProxy/index.ts';
import { seedNPCs } from '../core/npc.ts';

const router = Router();

const POST_TITLE = 'Tiny Tacticians — ¡Entrena a tu general y conquista la arena!';

/** Crea un custom post jugable en el subreddit actual. */
async function createGamePost(): Promise<{ id: string; url: string }> {
  const subredditName = context.subredditName;
  if (!subredditName) {
    throw new Error('No hay subreddit en el contexto para publicar el post.');
  }
  const post = await reddit.submitCustomPost({
    subredditName,
    title: POST_TITLE,
  });
  return { id: post.id, url: post.url };
}

// POST /internal/menu/create-post — acción de menú (moderador).
router.post('/menu/create-post', async (_req, res) => {
  try {
    // Asegura que haya rivales/leaderboard la primera vez (idempotente).
    await seedNPCs().catch((e) => console.error('seedNPCs (menu) falló:', e));
    const post = await createGamePost();
    res.json({ showToast: '¡Post de Tiny Tacticians creado!', navigateTo: post.url });
  } catch (err: any) {
    res.status(400).json({ showToast: `Error: ${err.message || 'no se pudo crear el post'}` });
  }
});

// POST /internal/on-install — trigger onAppInstall.
// Siembra NPCs y publica un primer post para que el subreddit no quede vacío.
router.post('/on-install', async (_req, res) => {
  try {
    await seedNPCs();
  } catch (err) {
    console.error('seedNPCs (on-install) falló:', err);
  }
  try {
    await createGamePost();
  } catch (err) {
    console.error('createGamePost (on-install) falló:', err);
  }
  res.json({});
});

export default router;
