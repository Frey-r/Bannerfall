import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  root: path.resolve(__dirname, 'src/client'),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@client': path.resolve(__dirname, './src/client'),
    },
  },
  server: {
    // Forward API calls from the Vite dev server to the local Express API (port 4000),
    // so /api/* returns JSON instead of the SPA index.html fallback.
    proxy: {
      '^/api/': 'http://localhost:4000',
      '^/internal/': 'http://localhost:4000',
    },
  },
  build: {
    outDir: path.resolve(__dirname, './dist/client'),
    emptyOutDir: true,
  },
});
