// Complexity guardrails (Use Small and Slow Solutions). These are the
// project's "low-complexity criteria" made checkable: warnings surface drift
// in CI logs; the two error-level rules are hard limits for NEW growth, with
// the current outliers grandfathered explicitly below until they are split.
import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

export default ts.config(
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'scripts/.smoke.mjs', 'test-results/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    rules: {
      // The guardrails this config exists for:
      complexity: ['warn', 12],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 4],
      // Svelte 5 + TS codebase reality — keep the signal, drop the noise:
      'no-undef': 'off', // TypeScript checks globals; core no-undef false-positives on TS
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
      'prefer-const': 'warn',
      'svelte/no-at-html-tags': 'error',
      'svelte/require-each-key': 'warn',
      'svelte/prefer-svelte-reactivity': 'warn',
      'svelte/no-unused-svelte-ignore': 'warn',
      'svelte/no-dupe-style-properties': 'warn'
    }
  },
  {
    // Grandfathered oversize component: MapCanvas.svelte is the MapLibre
    // integration core. Its pure logic (geometry, spatial index, recommend
    // engine, basemap styles + zone palette) is extracted to lib/; the
    // remainder is map-instance-coupled and is split incrementally with
    // browser-verified changes. PlantGuide.svelte was split on 2026-07-23 into
    // NewPlantForm + PlantDetail (+ lib/plants/guide.ts) and is no longer here.
    // New files must not join this list.
    files: ['src/components/Canvas/MapCanvas.svelte'],
    rules: { 'max-lines': 'off' }
  },
  {
    files: ['src/**/*.svelte', 'src/**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser } }
  }
);
