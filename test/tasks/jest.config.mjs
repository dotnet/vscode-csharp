/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { baseProjectConfig } from '../../baseJestConfig.mjs';
import { jestProjectNames } from '../jestProjectNames.mjs';

/**
 * Defines a jest project configuration for tasks unit tests.
 */
/** @type {import('jest').Config} */
const tasksTestConfig = {
    ...baseProjectConfig,
    displayName: jestProjectNames.tasksUnit,
    modulePathIgnorePatterns: ['out'],
    roots: ['<rootDir>', '<rootDir>../../__mocks__'],
};

export default tasksTestConfig;
