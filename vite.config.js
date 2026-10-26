import { defineConfig } from 'vite';

// Static, offline bundle: relative base so dist/ works from any static server path.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, target: 'es2020' },
  server: { port: 5173 },
});
