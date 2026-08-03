import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import headerPlugin from 'eslint-plugin-header';
import prettierPlugin from 'eslint-plugin-prettier';
import unicornPlugin from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const compatibleHeaderPlugin = fixupPluginRules({
    ...headerPlugin,
    rules: {
        ...headerPlugin.rules,
        header: {
            ...headerPlugin.rules.header,
            meta: {
                ...headerPlugin.rules.header.meta,
                schema: [{ enum: ['block', 'line'] }, { type: 'array', items: { type: 'string' } }],
            },
        },
    },
});

export default defineConfig([
    {
        ignores: ['out/**', 'dist/**', 'wallaby.js', 'eslint.config.mjs', 'esbuild.js', '**/*.d.ts'],
    },
    {
        files: ['**/*.ts'],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
        plugins: {
            header: compatibleHeaderPlugin,
            prettier: prettierPlugin,
            unicorn: unicornPlugin,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/promise-function-async': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            'no-unassigned-vars': 'off',
            'no-useless-assignment': 'off',
            'preserve-caught-error': 'off',
            'prefer-promise-reject-errors': 'error',
            curly: 'error',
            'prettier/prettier': ['error', { endOfLine: 'auto' }],
            'unicorn/filename-case': [
                'error',
                {
                    case: 'camelCase',
                    checkDirectories: false,
                    ignore: ['I[A-Z].*\\.ts$', 'vscode-tasks\\.d\\.ts'],
                },
            ],
            'header/header': [
                'error',
                'block',
                [
                    '---------------------------------------------------------------------------------------------',
                    ' *  Copyright (c) Microsoft Corporation. All rights reserved.',
                    ' *  Licensed under the MIT License. See License.txt in the project root for license information.',
                    ' *--------------------------------------------------------------------------------------------',
                ],
            ],
        },
    },
]);
