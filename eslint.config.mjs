import pluginJs from '@eslint/js';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
    perfectionist.configs['recommended-natural'],
    { files: ['**/*.{js,mjs,cjs,ts}'] },
    { languageOptions: { ecmaVersion: 'latest', globals: globals.es2025, sourceType: 'module' } },
    pluginJs.configs.recommended,
    ...tsEslintPlugin.configs.recommended,
    eslintPluginPrettierRecommended,
    eslintConfigPrettier,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
];
