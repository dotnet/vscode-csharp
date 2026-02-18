/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as nbgv from 'nerdbank-gitversioning';
import { Logger } from '../../src/logger';
import { PlatformInformation } from '../../src/shared/platform';
import { CsharpLoggerObserver } from '../../src/shared/observers/csharpLoggerObserver';
import { EventStream } from '../../src/eventStream';
import NetworkSettings from '../../src/networkSettings';
import { downloadAndInstallPackages } from '../../src/packageManager/downloadAndInstallPackages';
import { getRuntimeDependenciesPackages } from '../../src/tools/runtimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from '../../src/packageManager/getAbsolutePathPackagesToInstall';
import {
    codeExtensionPath,
    packedVsixOutputRoot,
    languageServerDirectory,
    nugetTempPath,
    rootPath,
    devKitDependenciesDirectory,
    xamlToolsDirectory,
    razorExtensionDirectory,
} from '../projectPaths';
import { getPackageJSON } from '../packageJson';
import { createPackageAsync, generateVsixManifest } from './vsceTasks';
import { isValidDownload } from '../../src/packageManager/isValidDownload';
import path from 'path';
import { CancellationToken } from 'vscode';

interface VSIXPlatformInfo {
    vsceTarget: string;
    rid: string;
    platformInfo: PlatformInformation;
}

// Mapping of vsce vsix packaging target to the RID used to build the server executable
export const platformSpecificPackages: VSIXPlatformInfo[] = [
    { vsceTarget: 'win32-x64', rid: 'win-x64', platformInfo: new PlatformInformation('win32', 'x86_64') },
    { vsceTarget: 'win32-arm64', rid: 'win-arm64', platformInfo: new PlatformInformation('win32', 'arm64') },
    { vsceTarget: 'linux-x64', rid: 'linux-x64', platformInfo: new PlatformInformation('linux', 'x86_64') },
    { vsceTarget: 'linux-arm64', rid: 'linux-arm64', platformInfo: new PlatformInformation('linux', 'arm64') },
    { vsceTarget: 'alpine-x64', rid: 'linux-musl-x64', platformInfo: new PlatformInformation('linux-musl', 'x86_64') },
    {
        vsceTarget: 'alpine-arm64',
        rid: 'linux-musl-arm64',
        platformInfo: new PlatformInformation('linux-musl', 'arm64'),
    },
    { vsceTarget: 'darwin-x64', rid: 'osx-x64', platformInfo: new PlatformInformation('darwin', 'x86_64') },
    { vsceTarget: 'darwin-arm64', rid: 'osx-arm64', platformInfo: new PlatformInformation('darwin', 'arm64') },
];

export interface NugetPackageInfo {
    getPackageName: (platformInfo: VSIXPlatformInfo | undefined) => string;
    packageJsonName: string;
    getPackageContentPath: (platformInfo: VSIXPlatformInfo | undefined) => string;
    vsixOutputPath: string;
}

// Set of NuGet packages that we need to download and install.
export const allNugetPackages: { [key: string]: NugetPackageInfo } = {
    roslyn: {
        getPackageName: (platformInfo) => {
            if (platformInfo === undefined) {
                throw new Error('Platform info is required for roslyn package name.');
            }
            return `roslyn-language-server.${platformInfo.rid}`;
        },
        packageJsonName: 'roslyn',
        getPackageContentPath: (platformInfo) => {
            if (platformInfo === undefined) {
                throw new Error('Platform info is required for roslyn package content path.');
            }
            return path.join('tools', 'net10.0', platformInfo.rid);
        },
        vsixOutputPath: languageServerDirectory,
    },
    roslynDevKit: {
        getPackageName: (_platformInfo) => 'Microsoft.VisualStudio.LanguageServices.DevKit',
        packageJsonName: 'roslyn',
        getPackageContentPath: (_platformInfo) => 'content',
        vsixOutputPath: devKitDependenciesDirectory,
    },
    xamlTools: {
        getPackageName: (_platformInfo) => 'Microsoft.VisualStudio.DesignToolsBase',
        packageJsonName: 'xamlTools',
        getPackageContentPath: (_platformInfo) => 'content',
        vsixOutputPath: xamlToolsDirectory,
    },
    razorExtension: {
        getPackageName: (_platformInfo) => 'Microsoft.VisualStudioCode.RazorExtension',
        packageJsonName: 'razor',
        getPackageContentPath: (_platformInfo) => 'content',
        vsixOutputPath: razorExtensionDirectory,
    },
};

interface PlatformEntry {
    platformName: string;
    vsixPlatform: VSIXPlatformInfo;
}

const platformEntries: PlatformEntry[] = [];
for (const p of platformSpecificPackages) {
    let platformName: string;
    if (p.platformInfo.isWindows()) {
        platformName = 'windows';
    } else if (p.platformInfo.isLinux()) {
        platformName = 'linux';
    } else if (p.platformInfo.isMacOS()) {
        platformName = 'darwin';
    } else {
        throw new Error(`Unexpected platform ${p.platformInfo.platform}`);
    }

    platformEntries.push({ platformName, vsixPlatform: p });
}

export async function vsixReleasePackageWindowsTask(prerelease: boolean): Promise<void> {
    for (const entry of platformEntries.filter((e) => e.platformName === 'windows')) {
        await doPackageOffline(entry.vsixPlatform, prerelease);
    }
}
export async function vsixReleasePackageLinuxTask(prerelease: boolean): Promise<void> {
    for (const entry of platformEntries.filter((e) => e.platformName === 'linux')) {
        await doPackageOffline(entry.vsixPlatform, prerelease);
    }
}
export async function vsixReleasePackageDarwinTask(prerelease: boolean): Promise<void> {
    for (const entry of platformEntries.filter((e) => e.platformName === 'darwin')) {
        await doPackageOffline(entry.vsixPlatform, prerelease);
    }
}

export async function vsixReleasePackageTask(prerelease: boolean): Promise<void> {
    for (const entry of platformEntries) {
        await doPackageOffline(entry.vsixPlatform, prerelease);
    }
}

// Downloads dependencies for local development.
export async function installDependencies(): Promise<void> {
    await cleanAsync();

    const packageJSON = getPackageJSON();

    const platform = await PlatformInformation.GetCurrent();
    const vsixPlatformInfo = platformSpecificPackages.find(
        (p) => p.platformInfo.platform === platform.platform && p.platformInfo.architecture === platform.architecture
    )!;

    try {
        await acquireAndInstallAllNugetPackages(vsixPlatformInfo, packageJSON, true);
    } catch (err) {
        const message = (err instanceof Error ? err.stack : err) ?? '<unknown error>';
        throw Error(`Failed to install packages for ${platform}. ${message}`);
    }
}

async function acquireAndInstallAllNugetPackages(
    platformInfo: VSIXPlatformInfo | undefined,
    packageJSON: any,
    interactive: boolean
) {
    for (const key in allNugetPackages) {
        const nugetPackage = allNugetPackages[key];
        const packagePath = await acquireNugetPackage(nugetPackage, platformInfo, packageJSON, interactive);
        await installNuGetPackage(packagePath, nugetPackage, platformInfo);
    }
}

export async function acquireNugetPackage(
    nugetPackageInfo: NugetPackageInfo,
    platformInfo: VSIXPlatformInfo | undefined,
    packageJSON: any,
    interactive: boolean
) {
    const packageVersion = packageJSON.defaults[nugetPackageInfo.packageJsonName];
    const packageName = nugetPackageInfo.getPackageName(platformInfo);
    const packagePath = await restoreNugetPackage(packageName, packageVersion, interactive);
    return packagePath;
}

async function installNuGetPackage(
    pathToPackage: string,
    nugetPackageInfo: NugetPackageInfo,
    platformInfo: VSIXPlatformInfo | undefined
) {
    // Get the directory containing the content.
    const pathToContentInNugetPackage = nugetPackageInfo.getPackageContentPath(platformInfo);
    const contentDirectory = path.join(pathToPackage, pathToContentInNugetPackage);
    if (!fs.existsSync(contentDirectory)) {
        throw new Error(
            `Failed to find NuGet package content at ${contentDirectory} for ${nugetPackageInfo.getPackageName(
                platformInfo
            )}`
        );
    }

    const numFilesToCopy = fs.readdirSync(contentDirectory).length;

    console.log(`Extracting content from ${contentDirectory}`);

    // Copy the files to the specified output directory.
    const outputPath = nugetPackageInfo.vsixOutputPath;
    fs.mkdirSync(outputPath);
    fsextra.copySync(contentDirectory, outputPath);
    const numCopiedFiles = fs.readdirSync(outputPath).length;

    // Not expected to ever happen, just a simple sanity check.
    if (numFilesToCopy !== numCopiedFiles) {
        throw new Error('Failed to copy all files from NuGet package');
    }
}

async function installRazor(packageJSON: any, platformInfo: PlatformInformation) {
    return await installPackageJsonDependency('Razor', packageJSON, platformInfo);
}

async function installDebugger(packageJSON: any, platformInfo: PlatformInformation) {
    return await installPackageJsonDependency('Debugger', packageJSON, platformInfo);
}

async function installPackageJsonDependency(
    dependencyName: string,
    packageJSON: any,
    platformInfo: PlatformInformation,
    token?: CancellationToken
) {
    const eventStream = new EventStream();
    const logger = new Logger((message) => process.stdout.write(message));
    const stdoutObserver = new CsharpLoggerObserver(logger);
    eventStream.subscribe(stdoutObserver.post);
    const runTimeDependencies = getRuntimeDependenciesPackages(packageJSON).filter(
        (dep) => (dep.isFramework === undefined || !dep.isFramework) && dep.id === dependencyName
    );
    const packagesToInstall = await getAbsolutePathPackagesToInstall(
        runTimeDependencies,
        platformInfo,
        codeExtensionPath
    );
    const provider = () => new NetworkSettings('', true);
    const installationResults = await downloadAndInstallPackages(
        packagesToInstall,
        provider,
        eventStream,
        isValidDownload,
        undefined,
        token
    );
    const failedPackages = Object.entries(installationResults)
        .filter(([, installed]) => !installed)
        .map(([name]) => name);
    if (failedPackages.length > 0) {
        throw Error('The following packages failed to install: ' + failedPackages.join(', '));
    }
}

async function restoreNugetPackage(packageName: string, packageVersion: string, interactive: boolean): Promise<string> {
    packageName = packageName.toLocaleLowerCase();
    const packageOutputPath = path.join(nugetTempPath, packageName, packageVersion);
    if (fs.existsSync(packageOutputPath)) {
        // Package is already downloaded, no need to download again.
        console.log(`Reusing existing download of ${packageName}.${packageVersion}`);
        return packageOutputPath;
    }

    const dotnetArgs = [
        'restore',
        path.join(rootPath, 'msbuild', 'server'),
        `/p:PackageName=${packageName}`,
        `/p:PackageVersion=${packageVersion}`,
    ];

    if (interactive) {
        dotnetArgs.push('--interactive');
    }

    console.log(`Restore args: dotnet ${dotnetArgs.join(' ')}`);
    const process = cp.spawn('dotnet', dotnetArgs, { stdio: 'inherit' });
    await new Promise((resolve) => {
        process.on('exit', (exitCode, _) => {
            if (exitCode !== 0) {
                throw new Error(`Failed to download nuget package ${packageName}.${packageVersion}`);
            }
            resolve(undefined);
        });
    });

    if (!fs.existsSync(packageOutputPath)) {
        throw new Error(`Failed to find downloaded package at ${packageOutputPath}`);
    }

    return packageOutputPath;
}

async function doPackageOffline(vsixPlatform: VSIXPlatformInfo | undefined, prerelease: boolean) {
    await cleanAsync();
    // Set the package.json version based on the value in version.json.
    const versionInfo = await nbgv.getVersion();
    console.log(versionInfo.npmPackageVersion);
    await nbgv.setPackageVersion();

    if (prerelease) {
        console.log('Packaging prerelease version.');
    } else {
        console.log('Packaging release version.');
    }

    try {
        // Now that we've updated the version, get the package.json.
        const packageJSON = getPackageJSON();

        if (process.platform === 'win32' && !vsixPlatform?.rid.startsWith('win')) {
            console.warn(
                `Skipping packaging for ${vsixPlatform?.rid} on Windows since runtime executables will not be marked executable in *nix packages.`
            );
            return;
        }

        if (vsixPlatform === undefined) {
            await buildVsix(packageJSON, packedVsixOutputRoot, prerelease);
        } else {
            await buildVsix(packageJSON, packedVsixOutputRoot, prerelease, vsixPlatform);
        }
    } catch (err) {
        const message = (err instanceof Error ? err.stack : err) ?? '<unknown error>';
        // NOTE: Extra `\n---` at the end is because gulp will print this message following by the
        // stack trace of this line. So that seperates the two stack traces.
        throw Error(`Failed to create package ${vsixPlatform?.vsceTarget ?? 'undefined'}. ${message}\n---`);
    } finally {
        // Reset package version to the placeholder value.
        await nbgv.resetPackageVersionPlaceholder();
    }
}

async function cleanAsync() {
    const directoriesToDelete = ['install.*', '.omnisharp*', '.debugger', '.razorExtension'];
    for (const key in allNugetPackages) {
        directoriesToDelete.push(allNugetPackages[key].vsixOutputPath);
    }

    for (const directory of directoriesToDelete) {
        await fsextra.remove(directory);
    }
}

async function buildVsix(packageJSON: any, outputFolder: string, prerelease: boolean, platformInfo?: VSIXPlatformInfo) {
    await acquireAndInstallAllNugetPackages(platformInfo, packageJSON, false);

    if (platformInfo != null) {
        await installRazor(packageJSON, platformInfo.platformInfo);
        await installDebugger(packageJSON, platformInfo.platformInfo);
    }

    const packageFileName = getPackageName(packageJSON, platformInfo?.vsceTarget);
    const packagePath = await createPackageAsync(outputFolder, prerelease, packageFileName, platformInfo?.vsceTarget);
    await generateVsixManifest(packagePath);
}

function getPackageName(packageJSON: any, vscodePlatformId?: string) {
    const name = packageJSON.name;
    const version = packageJSON.version;

    if (vscodePlatformId) {
        return `${name}-${vscodePlatformId}-${version}.vsix`;
    } else {
        return `${name}-${version}.vsix`;
    }
}

export async function updateNugetPackageVersion(packageInfo: NugetPackageInfo) {
    const packageJSON = getPackageJSON();

    // And now fetch each platform specific
    for (const p of platformSpecificPackages) {
        await acquireNugetPackage(packageInfo, p, packageJSON, true);
    }
}
