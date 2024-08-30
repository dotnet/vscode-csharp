/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Config } from 'jest';

/**
 * Defines a base project config that we can re-use across the project specific jest configs.
 * We do this because jest generally does not inherit project configuration settings.
 */
export const baseProjectConfig: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transformIgnorePatterns: ['/dist/.+\\.js'],
};
