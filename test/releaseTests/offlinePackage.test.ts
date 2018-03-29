/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'async-file';
import * as glob from 'glob-promise';
import * as path from 'path';
import { invokeCommand } from './testAssets/testAssets';

let vsixFiles = glob.sync(path.join(process.cwd(), '**', '*.vsix'));

suite("Omnisharp-Vscode VSIX", async () => {
    suiteSetup(async () => {
        chai.should();
        invokeCommand("node node_modules/gulp/bin/gulp.js package:offline");
    });

    test("At least one vsix file should be produced", () => {
        vsixFiles.length.should.be.equal(3, "the build should produce exactly 3 vsix files");
    });

});
