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
import { version } from '../../package.json';

suite("Offline packaging of VSIX", function () {
    let vsixFiles: string[];
    this.timeout(1000000);
    let tmpDir: TmpAsset;

    const expectedPackages = [
        new PlatformInformation('win32', 'x64'),
        new PlatformInformation('win32', 'arm64'),
        new PlatformInformation('darwin', 'x64'),
        new PlatformInformation('darwin', 'arm64'),
        new PlatformInformation('linux', 'x64'),
        new PlatformInformation('linux', 'arm64')
    ];

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

    test(`Exactly ${expectedPackages.length} vsix files should be produced`, () => {
        vsixFiles.length.should.be.equal(expectedPackages.length, `the build should produce exactly ${expectedPackages.length} vsix files`);
    });

    expectedPackages.forEach(element => {
        test(`Given Platform: ${element.platform} and Architecture: ${element.architecture}, the vsix file is created`, () => {
            const expectedVsixName = `csharp.${version}-${element.platform}-${element.architecture}.vsix`;
            vsixFiles.includes(expectedVsixName).should.be.equal(true, `offline packaging did not build package ${expectedVsixName}`);
        });
    });

    suiteTeardown(async () => {
        if (tmpDir) {
            tmpDir.dispose();
        }
    });
});
