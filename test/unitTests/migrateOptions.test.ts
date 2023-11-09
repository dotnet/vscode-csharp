/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { migrateOptions } from '../../src/shared/migrateOptions';
import * as jestLib from '@jest/globals';

jestLib.describe('Migrate configuration should in package.json', () => {
    const packageJson = JSON.parse(readFileSync('package.json').toString());
    const configuration = packageJson.contributes.configuration;
    // Read the "Editor Behavior", "Debugger", "LSP Server" sections of the package.json
    const configurations = [
        ...Object.keys(configuration[0].properties),
        ...Object.keys(configuration[1].properties),
        ...Object.keys(configuration[2].properties),
    ];

    migrateOptions.forEach((data) => {
        jestLib.test(`Should have ${data.roslynOption} in package.json`, () => {
            jestLib.expect(configurations).toContain(data.roslynOption);
        });
    });
});
