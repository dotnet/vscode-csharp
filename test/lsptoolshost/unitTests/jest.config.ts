/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig, mergeConfig } from 'vitest/config';
import { baseProjectConfig } from '../../../baseJestConfig';

export const unitTestProjectName = 'Unit Tests';

/**
 * Defines a Vitest project configuration for unit tests.
 */
export default mergeConfig(
    baseProjectConfig,
    defineConfig({
        test: {
            name: unitTestProjectName,
            dir: __dirname,
            include: ['**/*.test.ts'],
        },
    })
);
