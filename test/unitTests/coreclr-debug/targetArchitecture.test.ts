/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getTargetArchitecture } from '../../../src/coreclr-debug/util';
import { PlatformInformation } from '../../../src/platform';

import { expect, should, assert } from 'chai';
import { DotnetInfo } from '../../../src/utils/getDotnetInfo';

suite("getTargetArchitecture Tests", () => {
    suiteSetup(() => should());

    suite("Error", () => {
        test("Invalid Call", () => {
            let fn = function () { getTargetArchitecture(null, null, null); };

            expect(fn).to.throw("Unable to retrieve 'TargetArchitecture' without platformInfo.");
        });
    });

    suite("Windows", () => {
        test("Windows x86_64", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("windows", "x86_64", null);

            const targetArchitecture = getTargetArchitecture(platformInfo, null, null);

            assert.equal(targetArchitecture, "");
        });
    });

    suite("Linux", () => {
        test("getTargetArchitecture on Linux", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("linux", "x86_64", null);

            const targetArchitecture = getTargetArchitecture(platformInfo, null, null);

            assert.equal(targetArchitecture, "");
        });
    });

    suite("macOS", () => {
        test("Apple x86_64", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("darwin", "x86_64", null);

            const targetArchitecture = getTargetArchitecture(platformInfo, null, null);

            assert.equal(targetArchitecture, "x86_64");
        });

        test("Apple ARM64 on .NET 5", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("darwin", "arm64", null);
            const dotnetInfo: DotnetInfo = new DotnetInfo();
            dotnetInfo.Version = "5.0.0";
            dotnetInfo.RuntimeId = "osx.11.0-x64";

            const targetArchitecture = getTargetArchitecture(platformInfo, null, dotnetInfo);

            assert.equal(targetArchitecture, "x86_64");
        });

        test("Apple ARM64 on .NET 6 osx-arm64", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("darwin", "arm64", null);
            const dotnetInfo: DotnetInfo = new DotnetInfo();
            dotnetInfo.Version = "6.0.0";
            dotnetInfo.RuntimeId = "osx.11.0-arm64";

            const targetArchitecture = getTargetArchitecture(platformInfo, null, dotnetInfo);

            assert.equal(targetArchitecture, "arm64");
        });

        test("Apple ARM64 on .NET 6 osx-x64", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("darwin", "arm64", null);
            const dotnetInfo: DotnetInfo = new DotnetInfo();
            dotnetInfo.Version = "6.0.0";
            dotnetInfo.RuntimeId = "osx.11.0-x64";

            const targetArchitecture = getTargetArchitecture(platformInfo, null, dotnetInfo);

            assert.equal(targetArchitecture, "x86_64");
        });

        test("Apple ARM64 on .NET 6 osx-arm64 with targetArchitecture: 'arm64'", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("darwin", "arm64", null);
            const dotnetInfo: DotnetInfo = new DotnetInfo();
            dotnetInfo.Version = "6.0.0";
            dotnetInfo.RuntimeId = "osx.11.0-arm64";

            const targetArchitecture = getTargetArchitecture(platformInfo, "arm64", dotnetInfo);

            assert.equal(targetArchitecture, "arm64");
        });

        test("Apple ARM64 on .NET 6 osx-arm64 with targetArchitecture: 'x86_64'", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("darwin", "arm64", null);
            const dotnetInfo: DotnetInfo = new DotnetInfo();
            dotnetInfo.Version = "6.0.0";
            dotnetInfo.RuntimeId = "osx.11.0-x86_64";

            const targetArchitecture = getTargetArchitecture(platformInfo, "x86_64", dotnetInfo);

            assert.equal(targetArchitecture, "x86_64");
        });

        test("Apple ARM64 on .NET 6 osx-arm64 with invalid targetArchitecture", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("darwin", "arm64", null);
            const dotnetInfo: DotnetInfo = new DotnetInfo();
            dotnetInfo.Version = "6.0.0";
            dotnetInfo.RuntimeId = "osx.11.0-x86_64";

            let fn = function () { getTargetArchitecture(platformInfo, "x64", dotnetInfo); };

            expect(fn).to.throw("The value 'x64' for 'targetArchitecture' in launch configuraiton is invalid. Expected 'x86_64' or 'arm64'.");
        });

        test("Apple ARM64 on .NET 6 osx-arm64 with invalid RuntimeId", () => {
            const platformInfo: PlatformInformation = new PlatformInformation("darwin", "arm64", null);
            const dotnetInfo: DotnetInfo = new DotnetInfo();
            dotnetInfo.Version = "6.0.0";
            dotnetInfo.RuntimeId = "osx.11.0-FUTURE_ISA";

            let fn = function () { getTargetArchitecture(platformInfo, null, dotnetInfo); };

            expect(fn).to.throw(`Unexpected RuntimeId 'osx.11.0-FUTURE_ISA'.`);
        });
    });
});
