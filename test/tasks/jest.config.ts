/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Config } from 'jest';
import { baseProjectConfig } from '../../baseJestConfig';

export const jestTasksTestProjectName = 'Tasks Unit Tests';

/**
 * Defines a jest project configuration for tasks unit tests.
 */
const tasksTestConfig: Config = {
    ...baseProjectConfig,
    displayName: jestTasksTestProjectName,
    modulePathIgnorePatterns: ['out'],
    roots: ['<rootDir>', '<rootDir>../../__mocks__'],
};

export default tasksTestConfig;
