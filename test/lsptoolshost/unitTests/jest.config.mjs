/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { baseProjectConfig } from '../../../baseJestConfig.mjs';
import { jestProjectNames } from '../../jestProjectNames.mjs';

/**
 * Defines a jest project configuration for unit tests.
 */
/** @type {import('jest').Config} */
const unitTestConfig = {
    ...baseProjectConfig,
    displayName: jestProjectNames.unit,
    // We need to explicity ignore the out directory for modules - otherwise we'll get duplicate vscode module,
    // the TS version from the __mocks__ directory and the compiled js version from the out directory.
    modulePathIgnorePatterns: ['out'],
    // Specify jest to only run tests in jest folders.
    // We also have to include the __mocks__ folder.  That folder must be next to node_modules so we can't move it,
    // but if we specify roots, jest won't automatically pick it up.  So we have to specify it here.
    roots: ['<rootDir>', '<rootDir>../../../__mocks__'],
};

export default unitTestConfig;
