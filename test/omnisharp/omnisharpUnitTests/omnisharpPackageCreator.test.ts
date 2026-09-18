/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from '@jest/globals';
import {
    GetPackagesFromVersion,
    SetBinaryAndGetPackage,
    getModernNetVersion,
    getPackageSuffix,
} from '../../../src/omnisharp/omnisharpPackageCreator';
import { Package } from '../../../src/packageManager/package';

const serverUrl = 'http://serverUrl';
const installPath = 'experimentPath';
const testPackage: Package = {
    id: 'OmniSharp',
    description: 'OmniSharp for Test OS',
    url: 'unused',
    installPath: '.omnisharp',
    platforms: ['platform1'],
    architectures: ['architecture'],
    installTestPath: './.omnisharp/OmniSharp.dll',
    platformId: 'os-architecture',
};

describe('SetBinaryAndGetPackage', () => {
    test('preserves package targeting information', () => {
        const result = SetBinaryAndGetPackage(testPackage, serverUrl, '1.39.16', installPath);

        expect(result.architectures).toEqual(testPackage.architectures);
        expect(result.platforms).toEqual(testPackage.platforms);
        expect(result.platformId).toEqual(testPackage.platformId);
    });

    test('creates the modern package URL and install paths', () => {
        const result = SetBinaryAndGetPackage(testPackage, serverUrl, '1.39.16', installPath);

        expect(result.description).toEqual('OmniSharp for Test OS, Version = 1.39.16');
        expect(result.url).toEqual('http://serverUrl/releases/download/v1.39.16/omnisharp-os-architecture-net10.0.zip');
        expect(result.installPath).toEqual('experimentPath/1.39.16-net10.0');
        expect(result.installTestPath).toEqual('./experimentPath/1.39.16-net10.0/OmniSharp.dll');
    });
});

describe('package version naming', () => {
    test('target framework follows the OmniSharp release version', () => {
        expect(getModernNetVersion('1.39.15')).toEqual('6.0');
        expect(getModernNetVersion('1.39.16-beta.1')).toEqual('10.0');
        expect(getModernNetVersion('1.39.16')).toEqual('10.0');
    });

    test('OmniSharp 2.x uses unsuffixed asset names', () => {
        expect(getPackageSuffix('1.39.15')).toEqual('-net6.0');
        expect(getPackageSuffix('1.39.16')).toEqual('-net10.0');
        expect(getPackageSuffix('2.0.0-preview.1')).toEqual('');
        expect(getPackageSuffix('2.0.0')).toEqual('');
    });
});

describe('GetPackagesFromVersion', () => {
    test('creates packages only from platform-specific dependencies', () => {
        const packages = GetPackagesFromVersion(
            '2.0.0',
            [
                testPackage,
                {
                    ...testPackage,
                    description: 'Package without platform id',
                    platformId: undefined,
                },
                {
                    ...testPackage,
                    id: 'Debugger',
                },
            ],
            serverUrl,
            installPath
        );

        expect(packages).toHaveLength(1);
        expect(packages[0].url).toEqual('http://serverUrl/releases/download/v2.0.0/omnisharp-os-architecture.zip');
        expect(packages[0].installTestPath).toEqual('./experimentPath/2.0.0/OmniSharp.dll');
    });
});
