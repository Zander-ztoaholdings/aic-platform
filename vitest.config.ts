import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['apps/**/__tests__/**/*.{test,spec}.{ts,tsx}', 'packages/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next'],
    deps: {
      inline: ['jspdf'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['apps/**/lib/**/*.ts', 'apps/**/lib/**/*.tsx', 'apps/**/components/**/*.tsx'],
      exclude: ['node_modules', '**/*.d.ts', '**/*.test.ts', '**/*.test.tsx'],
      thresholds: {
        global: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@/lib': path.resolve(__dirname, './apps/web/lib'),
      '@/app': path.resolve(__dirname, './apps/web/app'),
      'jspdf': path.resolve(__dirname, './apps/web/node_modules/jspdf'),
    },
  },
});
