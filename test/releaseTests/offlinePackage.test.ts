/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as glob from 'glob-promise';
import * as path from 'path';
import { invokeNode } from './testAssets/testAssets';
import { TmpAsset, CreateTmpDir } from '../../src/CreateTmpAsset';
import { getPackageName, offlinePackages } from '../../tasks/offlinePackagingTasks';
import { getPackageJSON } from '../../tasks/packageJson';
import { expect } from 'chai';

suite("Offline packaging of VSIX", function () {
    let vsixFiles: string[];
    this.timeout(1000000);
    let tmpDir: TmpAsset;

    const packageJson = getPackageJSON();

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

    test(`Exactly ${offlinePackages.length} vsix files should be produced`, () => {
        vsixFiles.length.should.be.equal(offlinePackages.length, `the build should produce exactly ${offlinePackages.length} vsix files`);
    });

    offlinePackages.forEach(packageInfo => {
        const platformInfo = packageInfo.platformInfo;
        const packageId = packageInfo.id;

        test(`Given Platform: ${platformInfo.platform} and Architecture: ${platformInfo.architecture}, the vsix file is created`, () => {
            const expectedVsixName = getPackageName(packageJson, packageId);
            const vsixFile = vsixFiles.find(file => file.endsWith(expectedVsixName))
            expect(vsixFile, `offline packaging did not build package ${expectedVsixName}`)
                .to.not.be.null;
        });
    });

    suiteTeardown(async () => {
        if (tmpDir) {
            tmpDir.dispose();
        }
    });
});
