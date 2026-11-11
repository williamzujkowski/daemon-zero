import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { 'react-native': 'react-native-web' } },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'App.tsx'],
      // Type-only modules have nothing to execute.
      exclude: ['src/engine/systems/types.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 90, functions: 90, statements: 90, branches: 80,
        'src/app/**': { lines: 80, functions: 80, statements: 80, branches: 80 },
        'src/ui/**': { lines: 80, functions: 80, statements: 80, branches: 80 },
      },
    },
  },
});
