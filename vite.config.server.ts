import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@server': path.resolve(__dirname, './src/server'),
    },
  },
  // Devvit deploys ONLY this server bundle — there is no node_modules at runtime,
  // and the host resolves NOTHING by name except Node built-ins (proven: leaving
  // `express` external crashed, then `@devvit/web/server` crashed next). So the
  // bundle must be fully self-contained: `noExternal: true` bundles every dependency
  // (express, ioredis, @devvit/web/server and its @devvit/* + protobufjs deps).
  // Node built-ins are still auto-externalized by Vite's SSR/node build.
  ssr: {
    noExternal: true,
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
      // Devvit loads a single server entry (index.cjs). Inline the dynamic
      // import('@devvit/web/server') so everything lands in one file instead of
      // emitting a separate, unshipped chunk.
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
