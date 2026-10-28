/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as yauzl from 'yauzl';
import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { downloadAndInstallPackages } from '../../src/packageManager/downloadAndInstallPackages';
import { getPackageJSON } from '../../tasks/packageJson';
import {
    allNugetPackages,
    vsixReleasePackageWindowsTask,
    VsixReleasePackageOptions,
} from '../../tasks/packaging/offlinePackagingTasks';
import { rootPath } from '../../tasks/projectPaths';

jest.mock('nerdbank-gitversioning', () => ({
    getVersion: async () => ({ npmPackageVersion: '1.0.0' }),
    setPackageVersion: jest.fn(),
    resetPackageVersionPlaceholder: jest.fn(),
}));
jest.mock('../../tasks/packageJson');
jest.mock('../../src/packageManager/downloadAndInstallPackages');
jest.mock('../../tasks/packaging/vsceTasks', () => ({
    ...jest.requireActual<typeof import('../../tasks/packaging/vsceTasks')>('../../tasks/packaging/vsceTasks'),
    generateVsixManifest: jest.fn(),
}));
jest.mock('../../tasks/projectPaths', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const path = jest.requireActual<typeof import('path')>('path');
    const os = jest.requireActual<typeof import('os')>('os');
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'csharp-offline-vsix-'));
    return {
        rootPath,
        nodePath: process.execPath,
        vscePath: path.join(path.dirname(require.resolve('@vscode/vsce/package.json')), 'vsce'),
        languageServerDirectory: path.join(rootPath, '.roslyn'),
        devKitDependenciesDirectory: path.join(rootPath, '.roslynDevKit'),
        xamlToolsDirectory: path.join(rootPath, '.xamlTools'),
        testDiscoveryDirectory: path.join(rootPath, '.testDiscovery'),
    };
});

const dependencies = [
    { id: 'Razor', installPath: '.razor' },
    { id: 'Debugger', installPath: '.debugger' },
    { id: 'RoslynCopilot', installPath: '.roslynCopilot' },
    { id: 'VSWebAssemblyBridge', installPath: '.vswebassemblybridge' },
];

const options: VsixReleasePackageOptions = {
    prerelease: false,
    offline: false,
    outputFolder: path.join(rootPath, 'vsix'),
    codeExtensionPath: rootPath,
};

async function getVsixFiles(vsixPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        yauzl.open(vsixPath, { lazyEntries: true }, (error, zipFile) => {
            if (error) {
                reject(error);
                return;
            }
            const files: string[] = [];
            zipFile.on('error', reject);
            zipFile.on('entry', (entry: yauzl.Entry) => {
                files.push(entry.fileName);
                zipFile.readEntry();
            });
            zipFile.on('end', () => resolve(files));
            zipFile.readEntry();
        });
    });
}

describe('offline VSIX packaging', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const packageJSON = {
            name: 'offline-packaging-test',
            publisher: 'test',
            version: '1.0.0',
            description: 'Offline packaging test fixture',
            license: 'MIT',
            repository: 'https://github.com/dotnet/vscode-csharp',
            engines: { vscode: '^1.106.0' },
            defaults: Object.fromEntries(Object.values(allNugetPackages).map((pkg) => [pkg.packageJsonName, '1.0.0'])),
            runtimeDependencies: dependencies.map((dep) => ({
                ...dep,
                description: dep.id,
                url: `https://example.com/${dep.id}.zip`,
                platforms: ['neutral'],
                architectures: ['neutral'],
            })),
        };
        jest.mocked(getPackageJSON).mockReturnValue(packageJSON);
        fs.writeFileSync(path.join(rootPath, 'package.json'), JSON.stringify(packageJSON));
        fs.writeFileSync(path.join(rootPath, 'README.md'), '# Offline packaging test fixture');
        fs.copyFileSync(path.join(__dirname, '..', '..', '.vscodeignore'), path.join(rootPath, '.vscodeignore'));
        fs.writeFileSync(
            path.join(rootPath, '.gitignore'),
            dependencies.map((dep) => `${dep.installPath}/`).join('\n')
        );
        for (const pkg of Object.values(allNugetPackages)) {
            fs.mkdirSync(pkg.vsixOutputPath, { recursive: true });
            fs.writeFileSync(path.join(pkg.vsixOutputPath, 'version.nfo'), '1.0.0');
        }

        jest.mocked(downloadAndInstallPackages).mockImplementation(async (packages) => {
            for (const pkg of packages) {
                fs.mkdirSync(pkg.installPath.value, { recursive: true });
                fs.writeFileSync(path.join(pkg.installPath.value, `${pkg.id}.dll`), 'test payload');
                fs.writeFileSync(path.join(pkg.installPath.value, 'install.Lock'), '');
            }
            return Object.fromEntries(packages.map((pkg) => [pkg.id, true]));
        });
    });

    afterAll(() => {
        fs.rmSync(rootPath, { recursive: true, force: true });
    });

    test('default VSIXs omit optional downloads', async () => {
        await vsixReleasePackageWindowsTask(options);

        for (const target of ['win32-x64', 'win32-arm64']) {
            const files = await getVsixFiles(
                path.join(options.outputFolder, `offline-packaging-test-${target}-1.0.0.vsix`)
            );
            expect(files).toContain('extension/.razor/Razor.dll');
            expect(files).toContain('extension/.debugger/Debugger.dll');
            expect(files.some((file) => file.startsWith('extension/.roslynCopilot/'))).toBe(false);
            expect(files.some((file) => file.startsWith('extension/.vswebassemblybridge/'))).toBe(false);
        }
    }, 60_000);

    test('offline VSIXs include payloads and lock files without leaking into later default VSIXs', async () => {
        await vsixReleasePackageWindowsTask({ ...options, offline: true });

        for (const target of ['win32-x64', 'win32-arm64']) {
            const files = await getVsixFiles(
                path.join(options.outputFolder, `offline-packaging-test-${target}-1.0.0.vsix`)
            );
            for (const dep of dependencies) {
                expect(files).toContain(`extension/${dep.installPath}/${dep.id}.dll`);
                expect(files).toContain(`extension/${dep.installPath}/install.Lock`);
            }
        }

        await vsixReleasePackageWindowsTask(options);

        for (const target of ['win32-x64', 'win32-arm64']) {
            const files = await getVsixFiles(
                path.join(options.outputFolder, `offline-packaging-test-${target}-1.0.0.vsix`)
            );
            expect(files.some((file) => file.startsWith('extension/.roslynCopilot/'))).toBe(false);
            expect(files.some((file) => file.startsWith('extension/.vswebassemblybridge/'))).toBe(false);
        }
    }, 60_000);

    test.each(['RoslynCopilot', 'VSWebAssemblyBridge'])(
        'fails offline packaging when %s cannot be installed',
        async (failedId) => {
            jest.mocked(downloadAndInstallPackages).mockImplementation(async (packages) =>
                Object.fromEntries(packages.map((pkg) => [pkg.id, pkg.id !== failedId]))
            );

            await expect(vsixReleasePackageWindowsTask({ ...options, offline: true })).rejects.toThrow(
                `The following packages failed to install: ${failedId}`
            );
        }
    );
});
