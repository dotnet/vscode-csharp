/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import { getTargetArchitecture } from '../../../../src/coreclrDebug/util';
import { PlatformInformation } from '../../../../src/shared/platform';
import { DotnetInfo } from '../../../../src/shared/utils/dotnetInfo';

describe('getTargetArchitecture Tests', () => {
    describe('Windows', () => {
        test('Windows x86_64', () => {
            const platformInfo = new PlatformInformation('win32', 'x86_64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '5.0.0',
                RuntimeId: 'win10-x64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, undefined, dotnetInfo);

            expect(targetArchitecture).toEqual('x86_64');
        });

        test('Windows: X64 SDK on ARM64', () => {
            const platformInfo = new PlatformInformation('win32', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '6.0.0',
                RuntimeId: 'win10-x64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, undefined, dotnetInfo);

            expect(targetArchitecture).toEqual('x86_64');
        });

        test('Windows: ARM64 SDK on ARM64', () => {
            const platformInfo = new PlatformInformation('win32', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '6.0.0',
                RuntimeId: 'win10-arm64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, undefined, dotnetInfo);

            expect(targetArchitecture).toEqual('arm64');
        });
    });

    describe('Linux', () => {
        test('getTargetArchitecture on Linux', () => {
            const platformInfo = new PlatformInformation('linux', 'x86_64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '5.0.0',
                RuntimeId: 'linux-x64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, undefined, dotnetInfo);

            expect(targetArchitecture).toEqual('');
        });
    });

    describe('macOS', () => {
        test('Apple x86_64', () => {
            const platformInfo = new PlatformInformation('darwin', 'x86_64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '5.0.0',
                RuntimeId: 'osx.11.0-x64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, undefined, dotnetInfo);

            expect(targetArchitecture).toEqual('x86_64');
        });

        test('Apple ARM64 on .NET 5', () => {
            const platformInfo = new PlatformInformation('darwin', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '5.0.0',
                RuntimeId: 'osx.11.0-x64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, undefined, dotnetInfo);

            expect(targetArchitecture).toEqual('x86_64');
        });

        test('Apple ARM64 on .NET 6 osx-arm64', () => {
            const platformInfo = new PlatformInformation('darwin', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '6.0.0',
                RuntimeId: 'osx.11.0-arm64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, undefined, dotnetInfo);

            expect(targetArchitecture).toEqual('arm64');
        });

        test('Apple ARM64 on .NET 6 osx-x64', () => {
            const platformInfo = new PlatformInformation('darwin', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '6.0.0',
                RuntimeId: 'osx.11.0-x64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, undefined, dotnetInfo);

            expect(targetArchitecture).toEqual('x86_64');
        });

        test("Apple ARM64 on .NET 6 osx-arm64 with targetArchitecture: 'arm64'", () => {
            const platformInfo = new PlatformInformation('darwin', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '6.0.0',
                RuntimeId: 'osx.11.0-arm64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, 'arm64', dotnetInfo);

            expect(targetArchitecture).toEqual('arm64');
        });

        test("Apple ARM64 on .NET 6 osx-arm64 with targetArchitecture: 'x86_64'", () => {
            const platformInfo = new PlatformInformation('darwin', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '6.0.0',
                RuntimeId: 'osx.11.0-x86_64',
                Runtimes: {},
            };

            const targetArchitecture = getTargetArchitecture(platformInfo, 'x86_64', dotnetInfo);

            expect(targetArchitecture).toEqual('x86_64');
        });

        test('Apple ARM64 on .NET 6 osx-arm64 with invalid targetArchitecture', () => {
            const platformInfo = new PlatformInformation('darwin', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '6.0.0',
                RuntimeId: 'osx.11.0-x86_64',
                Runtimes: {},
            };

            const fn = function () {
                getTargetArchitecture(platformInfo, 'x64', dotnetInfo);
            };

            expect(fn).toThrow(
                "The value 'x64' for 'targetArchitecture' in launch configuraiton is invalid. Expected 'x86_64' or 'arm64'."
            );
        });

        test('Apple ARM64 on .NET 6 osx-arm64 with invalid RuntimeId', () => {
            const platformInfo = new PlatformInformation('darwin', 'arm64');
            const dotnetInfo: DotnetInfo = {
                FullInfo: 'Irrelevant',
                Version: '6.0.0',
                RuntimeId: 'osx.11.0-FUTURE_ISA',
                Runtimes: {},
            };

            const fn = function () {
                getTargetArchitecture(platformInfo, undefined, dotnetInfo);
            };

            expect(fn).toThrow(`Unexpected RuntimeId 'osx.11.0-FUTURE_ISA'.`);
        });
    });
});
