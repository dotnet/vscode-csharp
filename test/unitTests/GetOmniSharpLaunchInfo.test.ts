/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getOmniSharpLaunchInfo } from "../../src/omnisharp/GetOmniSharpLaunchInfo";
import { PlatformInformation } from "../../src/platform";
import { expect } from "chai";
import * as path from "path";

suite(getOmniSharpLaunchInfo.name, () => {
    const basePath = "basePath";

    [
        new PlatformInformation("win32", "x86"),
        new PlatformInformation("win32", "x86_64"),
    ].forEach((platformInfo: PlatformInformation) => {
        test(`OmniSharp.exe is appended to the basepath and MonoLaunchPath is undefined for windows platform ${platformInfo.toString()}`, () => {
            let launchInfo = getOmniSharpLaunchInfo(platformInfo, basePath);
            expect(launchInfo.MonoLaunchPath).to.be.undefined;
            expect(launchInfo.LaunchPath).to.equal(path.join(basePath, "OmniSharp.exe"));
        });
    });

    [
        new PlatformInformation("linux", "x86_64"),
    ].forEach((platformInfo: PlatformInformation) => {
        test(`OmniSharp.exe is appended to the basepath and MonoLaunchPath is undefined for non windows platform`, () => {
            let launchInfo = getOmniSharpLaunchInfo(platformInfo, basePath);
            expect(launchInfo.MonoLaunchPath).to.to.equal(path.join(basePath, "omnisharp" ,"OmniSharp.exe"));
            expect(launchInfo.LaunchPath).to.equal(path.join(basePath, "run"));
        });
    });
});