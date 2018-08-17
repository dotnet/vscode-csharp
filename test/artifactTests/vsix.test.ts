/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'async-file';
import * as glob from 'glob-promise';
import * as path from 'path';

let vsixFiles = glob.sync(path.join(process.cwd(), '**', '*.vsix'));

suite("Omnisharp-Vscode VSIX", async () => {
    suiteSetup(async () => {
        chai.should();

    });

    test("At least one vsix file should be produced", () => {
        vsixFiles.length.should.be.greaterThan(0, "the build should produce at least one vsix file");
    });

    vsixFiles.forEach(element => {
        const sizeInMB = 5;
        const maximumVsixSizeInBytes = sizeInMB * 1024 * 1024;

        suite(`Given ${element}`, () => {
            test(`Then its size is less than ${sizeInMB}MB`, async () => {
                const stats = await fs.stat(element);
                stats.size.should.be.lessThan(maximumVsixSizeInBytes);
            });

            test(`Then it should not be empty`, async () => {
                const stats = await fs.stat(element);
                stats.size.should.be.greaterThan(0);
            });
        });
    });
});
