/* ============================================================
   Endpoints internos invocados por Devvit (no por el cliente).
   Deben colgar de /internal/* (ver patrón InternalEndpoint del
   schema de devvit.json). Aquí viven la acción de menú para crear
   el post jugable y el trigger onAppInstall que evita que el
   subreddit quede vacío al instalar la app (playtest/upload).
   ============================================================ */
import { Router } from 'express';
import { reddit, context as webServerContext } from '@devvit/web/server';
import { context, redis } from '../devvitProxy/index.ts';
import { keys } from '../core/keys.ts';
import { seedNPCs } from '../core/npc.ts';
import { logDevvitDiag } from '../core/diag.ts';

const router = Router();

const POST_TITLE = 'Tiny Tacticians — ¡Entrena a tu general y conquista la arena!';

/**
 * Crea (o reutiliza) el custom post jugable del subreddit actual.
 * Idempotente: guarda el id del post en Redis y, si ese post sigue vivo, lo
 * devuelve en lugar de crear un duplicado. El primero que se crea se fija
 * (sticky) como entrada del juego.
 */
async function createGamePost(runAsUser: boolean = false): Promise<{ id: string; url: string; created: boolean }> {
  let subredditName = context.subredditName;
  if (!subredditName) {
    try {
      subredditName = (await reddit.getCurrentSubreddit()).name;
    } catch (err: any) {
      console.error('[createGamePost] no se pudo resolver el subreddit:', err?.message || err);
    }
  }
  if (!subredditName) {
    throw new Error('No hay subreddit en el contexto para publicar el post.');
  }

  const storedId = await redis.get(keys.firstPost());
  if (storedId) {
    try {
      const existing = await reddit.getPostById(storedId as any);
      return { id: existing.id, url: existing.url, created: false };
    } catch {
      // El post guardado ya no existe (borrado/eliminado): creamos uno nuevo.
    }
  }

  const baseOptions: any = {
    subredditName,
    title: POST_TITLE,
    entry: 'default',
    textFallback: {
      text: 'Tiny Tacticians — ¡Entrena a tu general y conquista la arena!',
    },
  };

  // Intentamos runAs: 'USER' si se pide; si el gRPC de UserActions falla
  // (error "undefined undefined: undefined", issue conocido de Devvit #261),
  // caemos a runAs: 'APP' que usa el cliente estándar de Reddit API.
  const attempts: any[] = [];
  if (runAsUser) {
    attempts.push({
      ...baseOptions,
      runAs: 'USER' as const,
      userGeneratedContent: {
        text: 'Tiny Tacticians — ¡Entrena a tu general y conquista la arena!',
      },
    });
  }
  attempts.push({ ...baseOptions, runAs: 'APP' as const });

  let post;
  let lastErr: any;
  for (const opts of attempts) {
    console.log(`[createGamePost] Intentando crear post en subreddit: "${subredditName}" con runAs: ${opts.runAs}`);
    try {
      post = await reddit.submitCustomPost(opts);
      break;
    } catch (err: any) {
      lastErr = err;
      console.error(`[createGamePost] submitCustomPost (runAs: ${opts.runAs}) falló:`, {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        stack: err?.stack?.split('\n').slice(0, 3).join('\n'),
      });
    }
  }

  if (!post) {
    throw lastErr ?? new Error('No se pudo crear el post.');
  }

  try {
    await post.sticky(1);
  } catch (err: any) {
    console.error('No se pudo fijar (sticky) el post:', err?.message || err);
  }

  await redis.set(keys.firstPost(), post.id);
  return { id: post.id, url: post.url, created: true };
}


// GET /internal/test-post — endpoint de diagnóstico para probar creación de posts
router.get('/test-post', async (req, res) => {
  const runAsUser = req.query.runAsUser === 'true';
  const postType = req.query.type || 'custom'; // 'custom' o 'self'
  
  let subredditName = context.subredditName;
  if (!subredditName) {
    try {
      subredditName = (await reddit.getCurrentSubreddit()).name;
    } catch (err: any) {
      console.error('[test-post] no se pudo resolver el subreddit:', err);
    }
  }
  if (!subredditName) {
    subredditName = 'tiny_tacticians_dev';
  }

  console.log(`[test-post] Diagnóstico: type=${postType}, runAsUser=${runAsUser}, subreddit=${subredditName}`);

  try {
    if (postType === 'self') {
      const post = await reddit.submitPost({
        subredditName,
        title: 'Test Self Post ' + Date.now(),
        text: 'This is a test text post from Devvit',
        runAs: runAsUser ? 'USER' : 'APP',
      });
      res.json({ success: true, id: post.id, url: post.url });
    } else {
      const options: any = {
        subredditName,
        title: 'Test Custom Post ' + Date.now(),
        entry: 'default',
        textFallback: {
          text: 'Test Custom Post Fallback',
        },
      };
      if (runAsUser) {
        options.runAs = 'USER';
      }
      const post = await reddit.submitCustomPost(options);
      res.json({ success: true, id: post.id, url: post.url });
    }
  } catch (err: any) {
    console.error('[test-post] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: err.stack,
      errDetails: err.details,
      errCode: err.code,
    });
  }
});

async function runRedditDiagnostics(subredditName: string) {
  console.log('\n=============================================');
  console.log('🚀 RUNNING REDDIT API DIAGNOSTICS');
  console.log(`Subreddit: ${subredditName}`);
  console.log('=============================================');

  // Test 1: getCurrentSubreddit
  try {
    const sub = await reddit.getCurrentSubreddit();
    console.log('✅ getCurrentSubreddit succeeded:', sub.name);
  } catch (err: any) {
    console.error('❌ getCurrentSubreddit failed:', err.message || err);
  }

  // Test 2: submitPost (Self post as APP)
  try {
    console.log('Testing: submitPost as APP...');
    const post = await reddit.submitPost({
      subredditName,
      title: 'Diagnostic Self Post APP ' + Date.now(),
      text: 'This is a test text post from Devvit (runAs: APP)',
      runAs: 'APP',
    });
    console.log('✅ submitPost as APP succeeded. ID:', post.id);
  } catch (err: any) {
    console.error('❌ submitPost as APP failed:', err.message || err);
  }

  // Test 3: submitPost (Self post as USER)
  try {
    console.log('Testing: submitPost as USER...');
    const post = await reddit.submitPost({
      subredditName,
      title: 'Diagnostic Self Post USER ' + Date.now(),
      text: 'This is a test text post from Devvit (runAs: USER)',
      runAs: 'USER',
    });
    console.log('✅ submitPost as USER succeeded. ID:', post.id);
  } catch (err: any) {
    console.error('❌ submitPost as USER failed:', err.message || err);
  }

  // Test 4: submitCustomPost as APP
  try {
    console.log('Testing: submitCustomPost as APP...');
    const post = await reddit.submitCustomPost({
      subredditName,
      title: 'Diagnostic Custom Post APP ' + Date.now(),
      entry: 'default',
      textFallback: { text: 'Fallback APP' },
      runAs: 'APP',
    });
    console.log('✅ submitCustomPost as APP succeeded. ID:', post.id);
  } catch (err: any) {
    console.error('❌ submitCustomPost as APP failed:', err.message || err);
  }

  // Test 5: submitCustomPost as USER
  try {
    console.log('Testing: submitCustomPost as USER...');
    const post = await reddit.submitCustomPost({
      subredditName,
      title: 'Diagnostic Custom Post USER ' + Date.now(),
      entry: 'default',
      textFallback: { text: 'Fallback USER' },
      runAs: 'USER',
      userGeneratedContent: {
        text: 'Diagnostic Custom Post USER content',
      },
    });
    console.log('✅ submitCustomPost as USER succeeded. ID:', post.id);
  } catch (err: any) {
    console.error('❌ submitCustomPost as USER failed:', err.message || err);
  }

  console.log('=============================================\n');
}

// POST /internal/menu/create-post — acción de menú (moderador).
router.post('/menu/create-post', async (req, res) => {
  try {
    logDevvitDiag('menu/create-post', req);
    // Asegura que haya rivales/leaderboard la primera vez (idempotente).
    await seedNPCs().catch((e) => console.error('seedNPCs (menu) falló:', e));
    // El menu action tiene contexto de usuario, por lo que corremos con runAsUser: true.
    // createGamePost intenta runAs: 'USER' y cae a runAs: 'APP' si falla.
    const post = await createGamePost(true);
    res.json({
      showToast: post.created
        ? '¡Post de Tiny Tacticians creado!'
        : 'El post de Tiny Tacticians ya existía.',
      navigateTo: post.url,
    });
  } catch (err: any) {
    console.error('[menu/create-post] Error completo:', {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      stack: err?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    res.status(400).json({ showToast: `Error: ${err.message || 'no se pudo crear el post'}` });
  }
});

// POST /internal/on-install — triggers onAppInstall + onAppUpgrade.
// Siembra NPCs y asegura (idempotente) un post jugable para que el subreddit no
// quede vacío. onAppUpgrade hace que esto corra en cada deploy (playtest/upload),
// no solo en la instalación inicial.
router.post('/on-install', async (req, res) => {
  logDevvitDiag('on-install', req);
  try {
    await seedNPCs();
  } catch (err) {
    console.error('[on-install] seedNPCs falló:', err);
  }
  try {
    // El trigger de instalación corre en segundo plano como app, runAsUser: false
    const post = await createGamePost(false);
    console.log(
      `[on-install] post ${post.created ? 'CREADO' : 'reutilizado'}: ${post.id} → ${post.url}`
    );
  } catch (err) {
    console.error('[on-install] createGamePost falló:', err);
  }
  res.json({});
});

export default router;
