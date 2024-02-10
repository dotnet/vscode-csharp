/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import * as fs from 'async-file';
import * as glob from 'glob-promise';
import * as path from 'path';

const vsixFiles = glob.sync(path.join(process.cwd(), '**', '*.vsix'));

describe('Vscode VSIX', () => {
    test('At least one vsix file should be produced', () => {
        expect(vsixFiles.length).toBeGreaterThan(0);
    });

    vsixFiles.forEach((element) => {
        // We're packaging the platform specific Roslyn server with ready to run in the vsix, so the size should be roughly ~50MB
        // We also publish the Razor server, which is roughly ~75MB
        const sizeInMB = 240;
        const maximumVsixSizeInBytes = sizeInMB * 1024 * 1024;

        describe(`Given ${element}`, () => {
            test(`Then its size is less than ${sizeInMB}MB`, async () => {
                const stats = await fs.stat(element);
                expect(stats.size).toBeLessThan(maximumVsixSizeInBytes);
            });

            test(`Then it should not be empty`, async () => {
                const stats = await fs.stat(element);
                expect(stats.size).toBeGreaterThan(0);
            });
        });
    });
});
