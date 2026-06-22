// Dev launcher: runs the Vite client and the Express API server together.
// Vite (default :5173) proxies /api -> http://localhost:4000 (see vite.config.ts),
// so the client receives JSON from the API instead of the SPA index.html.
import { spawn } from 'node:child_process';

const procs = [
  { name: 'SERVER', cmd: 'bun', args: ['run', 'dev:server'] },
  { name: 'CLIENT', cmd: 'bun', args: ['run', 'dev:client'] },
];

const children = procs.map(({ name, cmd, args }) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    console.log(`\n[${name}] exited with code ${code}. Shutting down dev environment.`);
    for (const c of children) {
      if (c !== child && !c.killed) c.kill();
    }
    process.exit(code ?? 0);
  });
  return child;
});

const shutdown = () => {
  for (const c of children) {
    if (!c.killed) c.kill();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
