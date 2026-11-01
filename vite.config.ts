import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so dist/ works from any sub-path (e.g. GitHub Pages).
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
