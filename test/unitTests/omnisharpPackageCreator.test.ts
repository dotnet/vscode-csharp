/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assert, should } from "chai";
import { SetBinaryAndGetPackage, GetPackagesFromVersion, modernNetVersion } from "../../src/omnisharp/omnisharpPackageCreator";
import { Package } from "../../src/packageManager/package";
import { testPackageJSON } from "./testAssets/testAssets";
import { isNotNull } from "../testUtil";

suite("GetOmnisharpPackage : Output package depends on the input package and other input parameters like serverUrl", () => {

    let serverUrl: string;
    let version: string;
    let installPath: string;
    let inputPackages: Package[];

    suiteSetup(() => {
        serverUrl = "http://serverUrl";
        version = "0.0.0";
        installPath = "testPath";
        const packageJSON = testPackageJSON;
        inputPackages = <Package[]>(packageJSON.runtimeDependencies);
        should();
    });

    const useFrameworkOptions = [true, false];

    useFrameworkOptions.forEach((useFramework) => {
        const pathSuffix = useFramework ? '' : `-net${modernNetVersion}`;

        test(`Architectures, binaries and platforms do not change useFramework: ${useFramework}`, () => {
            const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "os-architecture"));
            isNotNull(testPackage);
            const resultPackage = SetBinaryAndGetPackage(testPackage, useFramework, serverUrl, version, installPath);

            resultPackage.architectures.should.equal(testPackage.architectures);
            assert.equal(resultPackage.binaries, testPackage.binaries);
            resultPackage.platforms.should.equal(testPackage.platforms);
        });

        test(`Version information is appended to the description useFramework: ${useFramework}`, () => {
            const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "os-architecture"));
            isNotNull(testPackage);
            const resultPackage = SetBinaryAndGetPackage(testPackage, useFramework, serverUrl, "1.2.3", installPath);

            resultPackage.description.should.equal(`${testPackage.description}, Version = 1.2.3`);
        });

        test(`Install path is calculated using the specified path and version useFramework: ${useFramework}`, () => {
            const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "os-architecture"));
            const resultPackage = SetBinaryAndGetPackage(testPackage!, useFramework, serverUrl, "1.2.3", "experimentPath");
            resultPackage.installPath!.should.equal(`experimentPath/1.2.3${pathSuffix}`);
        });

        test(`Install test path is calculated using specified path, version and ends with OmniSharp.exe or OmniSharp.dll - Windows(x86) useFramework: ${useFramework}`, () => {
            const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "win-x86"));
            const resultPackage = SetBinaryAndGetPackage(testPackage!, useFramework, serverUrl, "1.2.3", "experimentPath");
            resultPackage.installTestPath!.should.equal(`./experimentPath/1.2.3${pathSuffix}/OmniSharp.${useFramework ? 'exe' : 'dll'}`);
        });

        test(`Install test path is calculated using specified path, version and ends with OmniSharp.exe or OmniSharp.dll - Windows(x64) useFramework: ${useFramework}`, () => {
            const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "win-x64"));
            const resultPackage = SetBinaryAndGetPackage(testPackage!, useFramework, serverUrl, "1.2.3", "experimentPath");
            resultPackage.installTestPath!.should.equal(`./experimentPath/1.2.3${pathSuffix}/OmniSharp.${useFramework ? 'exe' : 'dll'}`);
        });

        test(`Install test path is calculated using specified path, version and ends with correct binary - OSX useFramework: ${useFramework}`, () => {
            const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "osx"));
            const resultPackage = SetBinaryAndGetPackage(testPackage!, useFramework, serverUrl, "1.2.3", "experimentPath");
            resultPackage.installTestPath!.should.equal(`./experimentPath/1.2.3${pathSuffix}/${useFramework ? 'run' : 'OmniSharp.dll'}`);
        });

        test(`Install test path is calculated using specified path, version and ends with correct binary - Linux(x86) useFramework: ${useFramework}`, () => {
            const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "linux-x86"));
            const resultPackage = SetBinaryAndGetPackage(testPackage!, useFramework, serverUrl, "1.2.3", "experimentPath");
            resultPackage.installTestPath!.should.equal(`./experimentPath/1.2.3${pathSuffix}/${useFramework ? 'run' : 'OmniSharp.dll'}`);
        });

        test(`Install test path is calculated using specified path, version and ends with correct binary - Linux(x64) useFramework: ${useFramework}`, () => {
            const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "linux-x64"));
            const resultPackage = SetBinaryAndGetPackage(testPackage!, useFramework, serverUrl, "1.2.3", "experimentPath");
            resultPackage.installTestPath!.should.equal(`./experimentPath/1.2.3${pathSuffix}/${useFramework ? 'run' : 'OmniSharp.dll'}`);
        });
    });

    test('Download url is calculated using server url and version (useFramework: true)', () => {
        const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "os-architecture"));
        const resultPackage = SetBinaryAndGetPackage(testPackage!, /* useFramework: */ true, "http://someurl", "1.1.1", installPath);
        resultPackage.url.should.equal("http://someurl/releases/1.1.1/omnisharp-os-architecture.zip");
    });

    test('Download url is calculated using server url and version (useFramework: false)', () => {
        const testPackage = inputPackages.find(element => (element.platformId && element.platformId == "os-architecture"));
        const resultPackage = SetBinaryAndGetPackage(testPackage!, /* useFramework: */ false, "http://someurl", "1.1.1", installPath);
        resultPackage.url.should.equal(`http://someurl/releases/1.1.1/omnisharp-os-architecture-net${modernNetVersion}.zip`);
    });
});

suite('GetPackagesFromVersion : Gets the experimental omnisharp packages from a set of input packages', () => {

    const serverUrl = "http://serverUrl";
    const installPath = "testPath";

    [true, false].forEach((useFramework) => {
        test('Returns experiment packages with install test path depending on install path and version', () => {
            const inputPackages: Package[] = [
                {
                    id: "OmniSharp",
                    description: "OmniSharp for Windows (.NET 4.7.2 / x64)",
                    url: "https://download.visualstudio.microsoft.com/download/pr/100505821/c570a9e20dbf7172f79850babd058872/omnisharp-win-x64-1.28.0.zip",
                    fallbackUrl: "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x64-1.28.0.zip",
                    installPath: ".omnisharp",
                    platforms: [
                        "win32"
                    ],
                    architectures: [
                        "x86_64"
                    ],
                    installTestPath: "./.omnisharp/OmniSharp.exe",
                    platformId: "win-x64",
                    isFramework: useFramework
                },
                {
                    id: "OmniSharp",
                    description: "OmniSharp for Windows (.NET 4.7.2 / x64)",
                    url: "https://download.visualstudio.microsoft.com/download/pr/100505821/c570a9e20dbf7172f79850babd058872/omnisharp-win-x64-1.28.0.zip",
                    fallbackUrl: "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x64-1.28.0.zip",
                    installPath: ".omnisharp",
                    platforms: [
                        "win32"
                    ],
                    architectures: [
                        "x86_64"
                    ],
                    installTestPath: "./.omnisharp/OmniSharp.exe",
                    platformId: "win-x64",
                    isFramework: !useFramework
                },
                {
                    id: "OmniSharp",
                    description: "OmniSharp for OSX",
                    url: "https://download.visualstudio.microsoft.com/download/pr/100505818/6b99c6a86da3221919158ca0f36a3e45/omnisharp-osx-1.28.0.zip",
                    fallbackUrl: "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-osx-1.28.0.zip",
                    installPath: ".omnisharp",
                    platforms: [
                        "darwin"
                    ],
                    architectures: [
                        "x86_64"
                    ],
                    binaries: [
                        "./mono.osx",
                        "./run"
                    ],
                    installTestPath: "./.omnisharp/mono.osx",
                    platformId: "osx",
                    isFramework: useFramework
                },
            ];

            const outPackages = GetPackagesFromVersion("1.1.1", useFramework, inputPackages, serverUrl, "experimentPath");
            const suffix = useFramework ? '' : `-net${modernNetVersion}`;
            outPackages.length.should.equal(2);
            outPackages[0].installTestPath!.should.equal(`./experimentPath/1.1.1${suffix}/OmniSharp.${useFramework ? 'exe' : 'dll'}`);
            outPackages[1].installTestPath!.should.equal(`./experimentPath/1.1.1${suffix}/${useFramework ? 'run' : 'OmniSharp.dll'}`);
        });

        test('Returns only omnisharp packages with experimentalIds', () => {
            const version = "0.0.0";
            const inputPackages: Package[] = [
                {
                    id: "OmniSharp",
                    description: "OmniSharp for Windows (.NET 4.7.2 / x64)",
                    url: "https://download.visualstudio.microsoft.com/download/pr/100505821/c570a9e20dbf7172f79850babd058872/omnisharp-win-x64-1.28.0.zip",
                    fallbackUrl: "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x64-1.28.0.zip",
                    installPath: ".omnisharp",
                    platforms: [
                        "win32"
                    ],
                    architectures: [
                        "x86_64"
                    ],
                    installTestPath: "./.omnisharp/OmniSharp.exe",
                    platformId: "win-x64",
                    isFramework: useFramework
                },
                {
                    id: "OmniSharp",
                    description: "OmniSharp for Windows (.NET 4.7.2 / x64)",
                    url: "https://download.visualstudio.microsoft.com/download/pr/100505821/c570a9e20dbf7172f79850babd058872/omnisharp-win-x64-1.28.0.zip",
                    fallbackUrl: "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x64-1.28.0.zip",
                    installPath: ".omnisharp",
                    platforms: [
                        "win32"
                    ],
                    architectures: [
                        "x86_64"
                    ],
                    installTestPath: "./.omnisharp/OmniSharp.exe",
                    platformId: "win-x64",
                    isFramework: !useFramework
                },
                {
                    id: "OmniSharp",
                    description: "Some other package - no experimental id",
                    url: "https://download.visualstudio.microsoft.com/download/pr/100505818/6b99c6a86da3221919158ca0f36a3e45/omnisharp-osx-1.28.0.zip",
                    fallbackUrl: "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-osx-1.28.0.zip",
                    installPath: ".omnisharp",
                    platforms: [
                        "darwin"
                    ],
                    architectures: [
                        "x86_64"
                    ],
                    binaries: [
                        "./mono.osx",
                        "./run"
                    ],
                    installTestPath: "./.omnisharp/mono.osx",
                },
            ];

            const outPackages = GetPackagesFromVersion(version, useFramework, inputPackages, serverUrl, installPath);
            outPackages.length.should.equal(1);
            outPackages[0].platformId!.should.equal("win-x64");
            outPackages[0].isFramework!.should.equal(useFramework);
        });
    });
});
