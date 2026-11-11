import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), viewer: resolve(__dirname, 'viewer.html') } },
  },
  server: { host: true },
});
