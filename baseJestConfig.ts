/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Defines a base project config that we can re-use across the project specific Vitest configs.
 */
export const baseProjectConfig = defineConfig({
    resolve: {
        alias: {
            vscode: path.resolve(__dirname, '__mocks__/vscode.ts'),
        },
    },
    test: {
        environment: 'node',
        fileParallelism: false,
        passWithNoTests: false,
        setupFiles: [path.resolve(__dirname, 'test', 'vsCodeFramework.ts')],
        exclude: ['**/dist/**', '**/out/**', '**/node_modules/**'],
        reporters: ['default', 'junit'],
        outputFile: {
            junit: path.resolve(__dirname, 'out', process.env.VITEST_JUNIT_OUTPUT_NAME ?? 'junit.xml'),
        },
    },
});
