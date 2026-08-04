/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { baseIntegrationProjectConfig } from '../../../baseJestConfig.mjs';
import { jestProjectNames } from '../../jestProjectNames.mjs';

/**
 * Defines a project configuration for jest integration tests.
 */
/** @type {import('jest').Config} */
const integrationTestConfig = {
    ...baseIntegrationProjectConfig,
    displayName: jestProjectNames.integration,
    roots: ['<rootDir>'],
    testEnvironment: '<rootDir>/../../vsCodeEnvironment.ts',
    setupFilesAfterEnv: ['<rootDir>/../../vsCodeFramework.ts'],
};

export default integrationTestConfig;
