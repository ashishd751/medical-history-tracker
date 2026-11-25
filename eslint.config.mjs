// Flat ESLint config. Expo's preset brings typescript-eslint, react-hooks and import rules.
import tsPlugin from '@typescript-eslint/eslint-plugin';
import expoConfig from 'eslint-config-expo/flat.js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'coverage/**',
      'dist/**',
      'expo-env.d.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: {
      'simple-import-sort': simpleImportSort,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // Section 16: no `any` without a commented justification.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // `@types/node` is loaded so the node:sqlite test harness typechecks (ADR-019). Device code
    // has no Node runtime, so these globals are banned everywhere except tests and the harness.
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'src/data/testing/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'Node globals do not exist in React Native.' },
        { name: 'Buffer', message: 'Node globals do not exist in React Native.' },
        { name: 'require', message: 'Use ES imports; require() is not available in the bundle.' },
        { name: '__dirname', message: 'Node globals do not exist in React Native.' },
        { name: '__filename', message: 'Node globals do not exist in React Native.' },
        { name: 'global', message: 'Use globalThis.' },
      ],
    },
  },
  {
    // Test files may use jest globals.
    files: ['**/*.test.{ts,tsx}', 'jest.setup.ts'],
    languageOptions: {
      globals: { jest: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly' },
    },
  },
];
