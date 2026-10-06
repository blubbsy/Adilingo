/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // The HSK word list and example sentences are intentionally large, lazily loaded data chunks.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
