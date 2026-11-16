import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `react-native` maps to the web build; `expo-audio` maps to a stub because the real module
  // reads Expo globals (`__DEV__`) at import time and voice playback is now reachable from the
  // transmission widgets. Specs that assert on the player override the stub with vi.mock.
  // fileURLToPath, not URL.pathname: the latter percent-encodes a checkout path with spaces.
  //
  // `react-native-safe-area-context` runs for real, not as a stub: its package entry points at
  // sources that pull in native `react-native`, so the alias names its ESM build, `inline` puts
  // that build through this resolver, and the `.web.js` extension picks the DOM provider exactly
  // as Metro does for the web export. The specs then exercise the shipped env() reader.
  resolve: {
    extensions: ['.web.js', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      'react-native': 'react-native-web',
      'expo-audio': fileURLToPath(new URL('./tests/stubs/expo-audio.ts', import.meta.url).href),
      'react-native-safe-area-context': fileURLToPath(new URL('./node_modules/react-native-safe-area-context/lib/module/index.js', import.meta.url).href),
    },
  },
  test: {
    server: { deps: { inline: [/react-native-safe-area-context/] } },
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
