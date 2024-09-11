/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Config } from 'jest';
import { baseProjectConfig } from '../../../baseJestConfig';

export const razorTestProjectName = 'Razor Unit Tests';

/**
 * Defines a jest project configuration for Razor jest tests.
 */
const razorConfig: Config = {
    ...baseProjectConfig,
    displayName: razorTestProjectName,
    // We need to explicity ignore the out directory for modules - otherwise we'll get duplicate vscode module,
    // the TS version from the __mocks__ directory and the compiled js version from the out directory.
    modulePathIgnorePatterns: ['out'],
    // Specify jest to only run tests in jest folders.
    roots: ['<rootDir>'],
};

export default razorConfig;
