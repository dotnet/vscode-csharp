/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig, mergeConfig } from 'vitest/config';
import { baseProjectConfig } from './baseJestConfig';

export default mergeConfig(
    baseProjectConfig,
    defineConfig({
        test: {
            name: 'vscode-csharp',
            include: ['test/**/*.test.ts'],
        },
    })
);
