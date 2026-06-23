import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { localContextStorage } from './devvitProxy/index.ts';
import { seedNPCs } from './core/npc.ts';

// Routers
import metaRouter from './routes/meta.ts';
import runRouter from './routes/run.ts';
import pvpRouter from './routes/pvp.ts';
import internalRouter from './routes/internal.ts';
import devvitInternalRouter from './routes/devvitInternal.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

// Request-scoped context binding middleware (only used in local dev)
const isDev = process.env.IS_DEV === 'true' || !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

if (isDev) {
  app.use((req, res, next) => {
    // Extract user ID from header or default to t2_devuser
    const userId = (req.headers['x-user-id'] as string) || 't2_devuser';
    localContextStorage.run({ userId }, next);
  });
}

// API Routes
app.use('/api', metaRouter);
app.use('/api/run', runRouter);
app.use('/api/pvp', pvpRouter);
app.use('/api/internal', internalRouter);
// Endpoints invocados por Devvit (menú / triggers) — deben colgar de /internal/*
app.use('/internal', devvitInternalRouter);

import fs from 'fs';

// Serve static assets from Vite build in client directory
const clientBuildPath = fs.existsSync(path.join(process.cwd(), 'dist/client'))
  ? path.join(process.cwd(), 'dist/client')
  : path.join(__dirname, '../client');

app.use(express.static(clientBuildPath));

// SPA Client-side routing fallback
app.get('/*splat', (req, res, next) => {
  // If it looks like an API call or file resource, skip fallback
  if (req.url.startsWith('/api') || req.url.includes('.')) {
    return next();
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Startup Seeding & Server Listening Configuration
async function startServer() {
  if (isDev) {
    const port = process.env.PORT || 4000;
    app.listen(port, async () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Tiny Tacticians Local Dev Server listening at:`);
      console.log(`   http://localhost:${port}`);
      console.log(`======================================================\n`);

      // Auto-seed NPCs on local startup to ensure opponents are ready
      try {
        await seedNPCs();
      } catch (err) {
        console.error('Failed to seed NPCs on startup:', err);
      }
    });
  } else {
    // Dynamic import inside async function is CJS compatible
    const { createServer, getServerPort } = await import('@devvit/web/server');
    const server = createServer(app);
    server.listen(getServerPort());
  }
}

startServer().catch(err => {
  console.error('Fatal error starting Tiny Tacticians server:', err);
});
