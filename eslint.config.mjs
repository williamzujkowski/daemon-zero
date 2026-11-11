// ESLint flat config. Architectural rules live here so they are enforced, not just documented.
import js from '@eslint/js';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

const UI_ONLY_IMPORTS = ['react', 'react-dom', 'react-native', 'react-native-*', 'expo', 'expo-*', 'zustand', 'zustand/*', '@react-native-*/*'];

export default tseslint.config(
  { ignores: ['node_modules/', 'coverage/', 'dist/', '.expo/', 'reference/', 'android/', 'ios/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  security.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ['eslint.config.mjs'] }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Size limits: small files and small functions are a project standard.
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-eval': 'error',
      // Typed lookups into our own records are safe and pervasive; this rule only adds noise here.
      'security/detect-object-injection': 'off',
    },
  },
  {
    // The simulation and content layers are pure: no UI frameworks, no clocks, no randomness.
    files: ['src/engine/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: UI_ONLY_IMPORTS, message: 'src/engine and src/content must stay UI-free.' }] }],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'The engine is deterministic. Thread a seeded RNG through state instead.' },
        { object: 'Date', property: 'now', message: 'The engine never reads a clock. Callers pass elapsed time in.' },
      ],
      'no-restricted-globals': ['error', { name: 'setTimeout', message: 'No timers in the engine.' }, { name: 'setInterval', message: 'No timers in the engine.' }],
    },
  },
  {
    // Content-agnostic engine: ids belong in JSON, never in engine logic.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "Literal[value=/^(p[0-9]_|rep_|op_|act_|dil_|ai_)[a-z0-9_]+$/]", message: 'Do not hardcode content ids in the engine. Use systemFlags, actuatorBinding or requirements in JSON.' },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      // Tests corrupt raw JSON on purpose to prove validation catches it.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
  { files: ['**/*.mjs'], ...tseslint.configs.disableTypeChecked },
);
