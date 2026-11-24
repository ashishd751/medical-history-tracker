/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment:
        'src/domain is pure TypeScript: no React, React Native, Expo, or any other layer (section 7).',
      from: { path: '^src/domain' },
      to: { path: '^(src/(data|features|platform|ui|lib)|app/|react|react-native|expo|@expo)' },
    },
    {
      name: 'data-imports-domain-only',
      severity: 'error',
      comment: 'src/data may only import src/domain (plus Drizzle, expo-sqlite, expo-file-system).',
      from: { path: '^src/data' },
      to: { path: '^(src/(features|platform|ui)|app/)' },
    },
    {
      name: 'ui-imports-nothing-above-it',
      severity: 'error',
      comment: 'src/ui must not import features, data, platform or route files (section 7).',
      from: { path: '^src/ui' },
      to: { path: '^(src/(features|data|platform)|app/)' },
    },
    {
      name: 'platform-imports-domain-only',
      severity: 'error',
      comment: 'src/platform may import src/domain types only.',
      from: { path: '^src/platform' },
      to: { path: '^(src/(features|data|ui)|app/)' },
    },
    {
      name: 'features-do-not-import-feature-internals',
      severity: 'error',
      comment: 'Features must not import another feature internals; share via domain/ or lib/.',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/(?!$1)([^/]+)/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make layering impossible to reason about.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '(node_modules|android|ios|\\.expo|coverage)' },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
