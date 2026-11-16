import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `react-native` maps to the web build; `expo-audio` maps to a stub because the real module
  // reads Expo globals (`__DEV__`) at import time and voice playback is now reachable from the
  // transmission widgets. Specs that assert on the player override the stub with vi.mock.
  resolve: { alias: { 'react-native': 'react-native-web', 'expo-audio': new URL('./tests/stubs/expo-audio.ts', import.meta.url).pathname } },
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
