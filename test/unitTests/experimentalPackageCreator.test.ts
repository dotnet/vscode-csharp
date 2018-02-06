/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assert, should, expect } from "chai";
import { Package } from "../../src/packages";
import { GetExperimentPackage, GetPackagesFromVersion } from "../../src/omnisharp/experimentalPackageCreator";


suite("Package Creator - Correct parameters are formed for an input package", () => {

    let serverUrl: string;
    let version: string;
    let installPath: string;
    let inputPackages: any;

    setup(() => {
        serverUrl = "http://serverUrl";
        version = "0.0.0";
        installPath = "testPath";
        inputPackages = <Package[]>GetInputPackages();
        should();
    });

    test('Description, architectures, binaries and platforms do not change', () => {
        let testPackage = inputPackages.find(element => (element.experimentalPackageId && element.experimentalPackageId == "os-architecture"));
        let resultPackage = GetExperimentPackage(testPackage, serverUrl, version, installPath);

        resultPackage.description.should.equal(testPackage.description);
        resultPackage.architectures.should.equal(testPackage.architectures);
        assert.equal(resultPackage.binaries, testPackage.binaries);
        resultPackage.platforms.should.equal(testPackage.platforms);
    });

    test('Download url is calculated using server url and version', () => {
        let testPackage = inputPackages.find(element => (element.experimentalPackageId && element.experimentalPackageId == "os-architecture"));
        let resultPackage = GetExperimentPackage(testPackage, "http://someurl", "1.1.1", installPath);
        //rename the url
        resultPackage.url.should.equal("http://someurl/ext/omnisharp-os-architecture-1.1.1.zip");
    });

    test('Install path is calculated using the specified path and version', () => {
        let testPackage = inputPackages.find(element => (element.experimentalPackageId && element.experimentalPackageId == "os-architecture"));
        let resultPackage = GetExperimentPackage(testPackage, serverUrl, "1.2.3", "experimentPath");

        resultPackage.installPath.should.equal("experimentPath/1.2.3");
    });

    test('Install test path is calculated using specified path, version and ends with Omnisharp.exe - Windows(x86)', () => {
        let testPackage = inputPackages.find(element => (element.experimentalPackageId && element.experimentalPackageId == "win-x86"));
        let resultPackage = GetExperimentPackage(testPackage, serverUrl, "1.2.3", "experimentPath");

        resultPackage.installTestPath.should.equal("./experimentPath/1.2.3/Omnisharp.exe");
    });

    test('Install test path is calculated using specified path, version and ends with Omnisharp.exe - Windows(x64)', () => {
        let testPackage = inputPackages.find(element => (element.experimentalPackageId && element.experimentalPackageId == "win-x64"));
        let resultPackage = GetExperimentPackage(testPackage, serverUrl, "1.2.3", "experimentPath");

        resultPackage.installTestPath.should.equal("./experimentPath/1.2.3/Omnisharp.exe");
    });

    test('Install test path is calculated using specified path, version and ends with mono.osx - OSX', () => {
        let testPackage = inputPackages.find(element => (element.experimentalPackageId && element.experimentalPackageId == "osx"));
        let resultPackage = GetExperimentPackage(testPackage, serverUrl, "1.2.3", "experimentPath");

        resultPackage.installTestPath.should.equal("./experimentPath/1.2.3/mono.osx");
    });

    test('Install test path is calculated using specified path, version and ends with mono.linux-x86 - Linux(x86)', () => {
        let testPackage = inputPackages.find(element => (element.experimentalPackageId && element.experimentalPackageId == "linux-x86"));
        let resultPackage = GetExperimentPackage(testPackage, serverUrl, "1.2.3", "experimentPath");

        resultPackage.installTestPath.should.equal("./experimentPath/1.2.3/mono.linux-x86");
    });

    test('Install test path is calculated using specified path, version and ends with mono.linux-x86_64 - Linux(x64)', () => {
        let testPackage = inputPackages.find(element => (element.experimentalPackageId && element.experimentalPackageId == "linux-x64"));
        let resultPackage = GetExperimentPackage(testPackage, serverUrl, "1.2.3", "experimentPath");

        resultPackage.installTestPath.should.equal("./experimentPath/1.2.3/mono.linux-x86_64");
    });
});

suite('Package Creator - Gets the experimental omnisharp packages from a set of input packages', () => {

    const serverUrl = "http://serverUrl";
    const installPath = "testPath";

    suiteSetup(() => {
        should();
    });

    test('Throws exception if the version is null', () => {
        let version: string = null;
        let inputPackages = <Package[]>GetInputPackages();
        let fn = function () { GetPackagesFromVersion(version, inputPackages, serverUrl, installPath); };
        expect(fn).to.throw('Invalid version');
    });

    test('Throws exception if the version is empty', () => {
        let version = "";
        let inputPackages = <Package[]>GetInputPackages();
        let fn = function () { GetPackagesFromVersion(version, inputPackages, serverUrl, installPath); };
        expect(fn).to.throw('Invalid version');
    });

    test('Throws exception if the version is not a valid semver version', () => {
        let version = "a.b.c";
        let inputPackages = <Package[]>GetInputPackages();
        let fn = function () { GetPackagesFromVersion(version, inputPackages, serverUrl, installPath); };
        expect(fn).to.throw('Invalid version');
    });

    test('Returns experiment packages with install test path depending on install path and version', () => {
        let inputPackages = <Package[]>[
            {
                "description": "OmniSharp for Windows (.NET 4.6 / x64)",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505821/c570a9e20dbf7172f79850babd058872/omnisharp-win-x64-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x64-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "win32"
                ],
                "architectures": [
                    "x86_64"
                ],
                "installTestPath": "./.omnisharp/OmniSharp.exe",
                "experimentalPackageId": "win-x64"
            },
            {
                "description": "OmniSharp for OSX",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505818/6b99c6a86da3221919158ca0f36a3e45/omnisharp-osx-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-osx-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "darwin"
                ],
                "binaries": [
                    "./mono.osx",
                    "./run"
                ],
                "installTestPath": "./.omnisharp/mono.osx",
                "experimentalPackageId": "osx"
            },
        ];

        let outPackages = GetPackagesFromVersion("1.1.1", inputPackages, serverUrl, "experimentPath");
        outPackages.length.should.equal(2);
        outPackages[0].installTestPath.should.equal("./experimentPath/1.1.1/Omnisharp.exe");
        outPackages[1].installTestPath.should.equal("./experimentPath/1.1.1/mono.osx");
    });

    test('Returns only omnisharp packages with experimentalIds', () => {
        let version = "0.0.0";
        let inputPackages = <Package[]>[
            {
                "description": "OmniSharp for Windows (.NET 4.6 / x64)",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505821/c570a9e20dbf7172f79850babd058872/omnisharp-win-x64-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x64-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "win32"
                ],
                "architectures": [
                    "x86_64"
                ],
                "installTestPath": "./.omnisharp/OmniSharp.exe",
                "experimentalPackageId": "win-x64"
            },
            {
                "description": "Some other package - no experimental id",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505818/6b99c6a86da3221919158ca0f36a3e45/omnisharp-osx-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-osx-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "darwin"
                ],
                "binaries": [
                    "./mono.osx",
                    "./run"
                ],
                "installTestPath": "./.omnisharp/mono.osx",
            },
        ];

        let outPackages = GetPackagesFromVersion(version, inputPackages, serverUrl, installPath);
        outPackages.length.should.equal(1);
        outPackages[0].experimentalPackageId.should.equal("win-x64");
    });
});

//ask if these packages should be simplified or remain same to simulate the exact behavior
function GetInputPackages() {
    let inputPackages = [
        {
            "description": "OmniSharp for Windows (.NET 4.6 / x86)",
            "url": "https://download.visualstudio.microsoft.com/download/pr/100505823/5804b7d3b5eeb7e4ae812a7cff03bd52/omnisharp-win-x86-1.28.0.zip",
            "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x86-1.28.0.zip",
            "installPath": ".omnisharp",
            "platforms": [
                "win32"
            ],
            "architectures": [
                "x86"
            ],
            "installTestPath": "./.omnisharp/OmniSharp.exe",
            "experimentalPackageId": "win-x86"
        },
        {
            "description": "OmniSharp for Windows (.NET 4.6 / x64)",
            "url": "https://download.visualstudio.microsoft.com/download/pr/100505821/c570a9e20dbf7172f79850babd058872/omnisharp-win-x64-1.28.0.zip",
            "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x64-1.28.0.zip",
            "installPath": ".omnisharp",
            "platforms": [
                "win32"
            ],
            "architectures": [
                "x86_64"
            ],
            "installTestPath": "./.omnisharp/OmniSharp.exe",
            "experimentalPackageId": "win-x64"
        },
        {
            "description": "OmniSharp for OSX",
            "url": "https://download.visualstudio.microsoft.com/download/pr/100505818/6b99c6a86da3221919158ca0f36a3e45/omnisharp-osx-1.28.0.zip",
            "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-osx-1.28.0.zip",
            "installPath": ".omnisharp",
            "platforms": [
                "darwin"
            ],
            "binaries": [
                "./mono.osx",
                "./run"
            ],
            "installTestPath": "./.omnisharp/mono.osx",
            "experimentalPackageId": "osx"
        },
        {
            "description": "OmniSharp for Linux (x86)",
            "url": "https://download.visualstudio.microsoft.com/download/pr/100505817/b710ec9c2bedc0cfdb57da82da166c47/omnisharp-linux-x86-1.28.0.zip",
            "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-linux-x86-1.28.0.zip",
            "installPath": ".omnisharp",
            "platforms": [
                "linux"
            ],
            "architectures": [
                "x86",
                "i686"
            ],
            "binaries": [
                "./mono.linux-x86",
                "./run"
            ],
            "installTestPath": "./.omnisharp/mono.linux-x86",
            "experimentalPackageId": "linux-x86"
        },
        {
            "description": "OmniSharp for Linux (x64)",
            "url": "https://download.visualstudio.microsoft.com/download/pr/100505485/3f8a10409240decebb8a3189429f3fdf/omnisharp-linux-x64-1.28.0.zip",
            "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-linux-x64-1.28.0.zip",
            "installPath": ".omnisharp",
            "platforms": [
                "linux"
            ],
            "architectures": [
                "x86_64"
            ],
            "binaries": [
                "./mono.linux-x86_64",
                "./run"
            ],
            "installTestPath": "./.omnisharp/mono.linux-x86_64",
            "experimentalPackageId": "linux-x64"
        },
        {
            "description": "OmniSharp for Test OS(architecture)",
            "url": "https://download.visualstudio.microsoft.com/download/pr/100505485/3f8a10409240decebb8a3189429f3fdf/omnisharp-os-architecture-version.zip",
            "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-os-architecture-version.zip",
            "installPath": ".omnisharp",
            "platforms": [
                "platform1"
            ],
            "architectures": [
                "architecture"
            ],
            "binaries": [
                "./binary1",
                "./binary2"
            ],
            "installTestPath": "./.omnisharp/binary",
            "experimentalPackageId": "os-architecture"
        },
        {
            "description": "Non omnisharp package without experimentalPackageID",
            "url": "https://download.visualstudio.microsoft.com/download/pr/100317420/a30d7e11bc435433d297adc824ee837f/coreclr-debug-win7-x64.zip",
            "fallbackUrl": "https://vsdebugger.blob.core.windows.net/coreclr-debug-1-14-4/coreclr-debug-win7-x64.zip",
            "installPath": ".debugger",
            "platforms": [
                "win32"
            ],
            "architectures": [
                "x86_64"
            ],
            "installTestPath": "./.debugger/vsdbg-ui.exe"
        }
    ];

    return inputPackages;
}
