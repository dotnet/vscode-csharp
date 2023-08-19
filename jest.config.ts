/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    preset: 'ts-jest',
    testEnvironment: 'node',
    transformIgnorePatterns: ['/dist/.+\\.js'],
    modulePathIgnorePatterns: ['out'],
    /* Specify jest to only run tests in jestUnitTests.
     * We also have to include the __mocks__ folder.  That folder must be next to node_modules so we can't move it,
     * but if we specify roots, jest won't automatically pick it up.  So we have to specify it here.
     */
    roots: ['<rootDir>/test/unitTests', '<rootDir>/omnisharptest/omnisharpJestTests', '<rootDir>/__mocks__'],
};

export default config;
