/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const testPackageJSON = {
    runtimeDependencies: [
        {
            id: 'OmniSharp',
            description: 'OmniSharp for Windows (.NET / x64)',
            url: 'https://example.com/omnisharp-win-x64.zip',
            installPath: '.omnisharp',
            platforms: ['win32'],
            architectures: ['x86_64'],
            installTestPath: './.omnisharp/OmniSharp.dll',
            platformId: 'win-x64',
        },
        {
            id: 'OmniSharp',
            description: 'OmniSharp for OSX',
            url: 'https://example.com/omnisharp-osx.zip',
            installPath: '.omnisharp',
            platforms: ['darwin'],
            architectures: ['x86'],
            installTestPath: './.omnisharp/OmniSharp.dll',
            platformId: 'osx',
        },
        {
            id: 'OmniSharp',
            description: 'OmniSharp for Linux (x86)',
            url: 'https://example.com/omnisharp-linux-x86.zip',
            installPath: '.omnisharp',
            platforms: ['linux'],
            architectures: ['x86', 'i686'],
            installTestPath: './.omnisharp/OmniSharp.dll',
            platformId: 'linux-x86',
        },
        {
            id: 'OmniSharp',
            description: 'OmniSharp for Linux (x64)',
            url: 'https://example.com/omnisharp-linux-x64.zip',
            installPath: '.omnisharp',
            platforms: ['linux'],
            architectures: ['x86_64'],
            installTestPath: './.omnisharp/OmniSharp.dll',
            platformId: 'linux-x64',
        },
        {
            id: 'OmniSharp',
            description: 'OmniSharp for Test OS',
            url: 'https://example.com/omnisharp-os-architecture.zip',
            installPath: '.omnisharp',
            platforms: ['platform1'],
            architectures: ['architecture'],
            installTestPath: './.omnisharp/OmniSharp.dll',
            platformId: 'os-architecture',
        },
        {
            id: 'Debugger',
            description: 'Non omnisharp package without platformId',
            url: 'https://example.com/debugger.zip',
            installPath: '.debugger',
            platforms: ['win32'],
            architectures: ['x86_64'],
            installTestPath: './.debugger/vsdbg-ui.exe',
        },
    ],
};
