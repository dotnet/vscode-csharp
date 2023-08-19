/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { assert } from 'chai';
import { migrateOptions } from '../../src/shared/migrateOptions';
import * as jestLib from '@jest/globals';

jestLib.describe('Migrate configuration should in package.json', () => {
    const packageJson = JSON.parse(readFileSync('package.json').toString());
    const properties = packageJson.contributes.configuration[1].properties;
    const configurations = Object.keys(properties);

    migrateOptions.forEach((data) => {
        jestLib.test(`Should have ${data.roslynOption} in package.json`, () => {
            assert.include(configurations, data.roslynOption);
        });
    });
});
