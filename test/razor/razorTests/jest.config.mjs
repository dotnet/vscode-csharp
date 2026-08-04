/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { baseProjectConfig } from '../../../baseJestConfig.mjs';
import { jestProjectNames } from '../../jestProjectNames.mjs';

/**
 * Defines a jest project configuration for Razor jest tests.
 */
/** @type {import('jest').Config} */
const razorConfig = {
    ...baseProjectConfig,
    displayName: jestProjectNames.razorUnit,
    // We need to explicity ignore the out directory for modules - otherwise we'll get duplicate vscode module,
    // the TS version from the __mocks__ directory and the compiled js version from the out directory.
    modulePathIgnorePatterns: ['out'],
    // Specify jest to only run tests in jest folders.
    roots: ['<rootDir>'],
};

export default razorConfig;
