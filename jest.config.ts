/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Config } from 'jest';

const config: Config = {
    projects: [
        '<rootDir>/test/unitTests/jest.config.ts',
        '<rootDir>/test/integrationTests/jest.config.ts',
        '<rootDir>/test/razorIntegrationTests/jest.config.ts',
        '<rootDir>/test/razorTests/jest.config.ts',
        '<rootDir>/omnisharptest/omnisharpJestTests/jest.config.ts',
    ],
};

export default config;
