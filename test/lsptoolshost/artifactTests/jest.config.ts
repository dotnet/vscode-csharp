/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig, mergeConfig } from 'vitest/config';
import { baseProjectConfig } from '../../../baseJestConfig';

export const artifactTestsProjectName = 'Artifact Tests';

/**
 * Defines a Vitest project configuration for artifact tests.
 */
export default mergeConfig(
    baseProjectConfig,
    defineConfig({
        test: {
            name: artifactTestsProjectName,
            dir: __dirname,
            include: ['**/*.test.ts'],
        },
    })
);
