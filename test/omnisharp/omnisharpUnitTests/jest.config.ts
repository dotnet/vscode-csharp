/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Config } from 'jest';
import { baseProjectConfig } from '../../../baseJestConfig';

export const jestOmniSharpUnitTestProjectName = 'OmniSharp Unit Tests';

/**
 * Defines a jest project configuration for O# jest tests.
 */
const omnisharpConfig: Config = {
    ...baseProjectConfig,
    displayName: jestOmniSharpUnitTestProjectName,
    // We need to explicity ignore the out directory for modules - otherwise we'll get duplicate vscode module,
    // the TS version from the __mocks__ directory and the compiled js version from the out directory.
    modulePathIgnorePatterns: ['out'],
    // Specify jest to only run tests in jest folders.
    // We also have to include the __mocks__ folder.  That folder must be next to node_modules so we can't move it,
    // but if we specify roots, jest won't automatically pick it up.  So we have to specify it here.
    roots: ['<rootDir>', '<rootDir>/../../../__mocks__'],
};

export default omnisharpConfig;
