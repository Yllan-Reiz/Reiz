// Vérification du code (npx expo lint). Config Expo + règles des hooks React : ce sont elles qui attrapent les boucles
// de rendu et les effets qui relancent des requêtes sans raison.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*', 'build/*', 'supabase/functions/*', 'landing/*', 'modules/*/build/*'],
  },
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
