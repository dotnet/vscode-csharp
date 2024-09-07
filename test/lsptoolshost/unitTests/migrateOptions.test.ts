/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { migrateOptions } from '../../../src/shared/migrateOptions';
import { describe, test, expect } from '@jest/globals';

describe('Migrate configuration should in package.json', () => {
    const packageJson = JSON.parse(readFileSync('package.json').toString());
    const configuration = packageJson.contributes.configuration;
    // Read the "Project", "Text Editor", "Debugger", "LSP Server" sections of the package.json
    const configurations = [
        ...Object.keys(configuration[0].properties),
        ...Object.keys(configuration[1].properties),
        ...Object.keys(configuration[2].properties),
        ...Object.keys(configuration[3].properties),
    ];

    migrateOptions.forEach((data) => {
        test(`Should have ${data.newName} in package.json`, () => {
            expect(configurations).toContain(data.newName);
        });
    });
});
