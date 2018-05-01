/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as glob from 'glob-promise';
import * as path from 'path';
import { invokeNode } from './testAssets/testAssets';
import { PlatformInformation } from '../../src/platform';
import { TmpAsset, CreateTmpDir } from '../../src/CreateTmpAsset';

suite("Offline packaging of VSIX", function () {
    let vsixFiles: string[];
    this.timeout(1000000);
    let tmpDir: TmpAsset;

    suiteSetup(async () => {
        chai.should();
        tmpDir = await CreateTmpDir(true);
        let args: string[] = [];
        args.push(path.join("node_modules", "gulp", "bin", "gulp.js"));
        args.push("package:offline");
        args.push("--retainVsix");// do not delete the existing vsix in the repo
        args.push(`-o`);
        args.push(tmpDir.name);
        invokeNode(args);
        vsixFiles = glob.sync(path.join(tmpDir.name, '*.vsix'));
    });

    test("Exactly 3 vsix files should be produced", () => {
        vsixFiles.length.should.be.equal(3, "the build should produce exactly 3 vsix files");
    });

    [
        new PlatformInformation('win32', 'x86_64'),
        new PlatformInformation('darwin', 'x86_64'),
        new PlatformInformation('linux', 'x86_64')
    ].forEach(element => {
        test(`Given Platform: ${element.platform} and Architecture: ${element.architecture}, the vsix file is created`, () => {
            vsixFiles.findIndex(elem => elem.indexOf(element.platform) != -1).should.not.be.equal(-1);
            vsixFiles.findIndex(elem => elem.indexOf(element.architecture) != -1).should.not.be.equal(-1);
        });
    });

    suiteTeardown(async () => {
        if (tmpDir) {
            tmpDir.dispose();
        }
    });
});
