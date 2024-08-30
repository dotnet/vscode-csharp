/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Config } from 'jest';
import { baseProjectConfig } from '../../baseJestConfig';

export const jestIntegrationTestProjectName = 'OmniSharp Integration Tests';

/**
 * Defines a project configuration for jest integration tests.
 */
const integrationTestConfig: Config = {
    ...baseProjectConfig,
    displayName: jestIntegrationTestProjectName,
    roots: ['<rootDir>'],
    testEnvironment: '<rootDir>/../../test/integrationTests/jestSetup/vsCodeEnvironment.ts',
    setupFilesAfterEnv: ['<rootDir>/../../test/integrationTests/jestSetup/vsCodeFramework.ts'],
};

export default integrationTestConfig;
