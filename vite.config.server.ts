import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@server': path.resolve(__dirname, './src/server'),
    },
  },
  build: {
    ssr: true,
    lib: {
      entry: path.resolve(__dirname, './src/server/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    outDir: path.resolve(__dirname, './dist/server'),
    emptyOutDir: true,
    rollupOptions: {
      external: [
        '@devvit/web/server',
        '@devvit/public-api',
        'express',
        'ioredis',
        'path',
        'fs',
        'crypto',
        'events'
      ],
    },
  },
});
