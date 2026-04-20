/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig, mergeConfig } from 'vitest/config';
import { baseProjectConfig } from '../../../baseJestConfig';

export const integrationTestProjectName = 'Razor Integration Tests';

/**
 * Defines a project configuration for Vitest integration tests.
 */
export default mergeConfig(
    baseProjectConfig,
    defineConfig({
        test: {
            name: integrationTestProjectName,
            dir: __dirname,
            include: ['**/*.test.ts'],
            testTimeout: 120000,
        },
    })
);
