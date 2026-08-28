import json from '@eslint/json';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  globalIgnores([
    'build/**',
    'coverage/**',
    'dist/**',
    'main.js',
    'node_modules/**',
  ]),

  // The rules the Obsidian team runs against submitted plugins. Linting the
  // same way locally keeps a review from reporting what a build could have.
  ...obsidianmd.configs.recommendedWithLocalesEn,

  // Translation files are data, not modules. The English locale rules above
  // target them by name but leave the parser alone, so it is set here — the
  // same way the plugin itself sets it up for package.json.
  {
    files: ['src/translations/*.json'],
    language: 'json/json',
    plugins: { json },
    rules: { 'no-irregular-whitespace': 'off' },
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'import-x': importX },
    rules: {
      'import-x/order': [
        'error',
        { 'newlines-between': 'always', alphabetize: { order: 'asc' } },
      ],
      'sort-imports': [
        'error',
        { ignoreDeclarationSort: true, ignoreCase: true },
      ],
    },
  },

  prettier,
]);
