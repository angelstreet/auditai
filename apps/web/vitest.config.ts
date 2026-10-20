import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Next compiles JSX with the automatic runtime; component tests render the same way.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
