/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as del from 'del';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as gulp from 'gulp';
import * as nbgv from 'nerdbank-gitversioning';
import { Logger } from '../src/logger';
import { PlatformInformation } from '../src/shared/platform';
import { CsharpLoggerObserver } from '../src/shared/observers/csharpLoggerObserver';
import { EventStream } from '../src/eventStream';
import NetworkSettings from '../src/networkSettings';
import { downloadAndInstallPackages } from '../src/packageManager/downloadAndInstallPackages';
import { getRuntimeDependenciesPackages } from '../src/tools/runtimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from '../src/packageManager/getAbsolutePathPackagesToInstall';
import {
    codeExtensionPath,
    packedVsixOutputRoot,
    languageServerDirectory,
    nugetTempPath,
    rootPath,
    devKitDependenciesDirectory,
    xamlToolsDirectory,
    razorLanguageServerDirectory,
    razorDevKitDirectory,
} from '../tasks/projectPaths';
import { getPackageJSON } from '../tasks/packageJson';
import { createPackageAsync } from '../tasks/vsceTasks';
import { isValidDownload } from '../src/packageManager/isValidDownload';
import path = require('path');
import { CancellationToken } from 'vscode';
// There are no typings for this library.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const argv = require('yargs').argv;

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

interface NugetPackageInfo {
    getPackageName: (platformInfo: VSIXPlatformInfo | undefined) => string;
    packageJsonName: string;
    getPackageContentPath: (platformInfo: VSIXPlatformInfo | undefined) => string;
    vsixOutputPath: string;
}

// Set of NuGet packages that we need to download and install.
export const allNugetPackages: { [key: string]: NugetPackageInfo } = {
    roslyn: {
        getPackageName: (platformInfo) => `Microsoft.CodeAnalysis.LanguageServer.${platformInfo?.rid ?? 'neutral'}`,
        packageJsonName: 'roslyn',
        getPackageContentPath: (platformInfo) => path.join('content', 'LanguageServer', platformInfo?.rid ?? 'neutral'),
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
    razor: {
        getPackageName: (platformInfo) => `rzls.${platformInfo?.rid ?? 'neutral'}`,
        packageJsonName: 'razor',
        getPackageContentPath: (platformInfo) => path.join('content', 'LanguageServer', platformInfo?.rid ?? 'neutral'),
        vsixOutputPath: razorLanguageServerDirectory,
    },
    razorDevKit: {
        getPackageName: (_platformInfo) => 'Microsoft.VisualStudio.DevKit.Razor',
        packageJsonName: 'razor',
        getPackageContentPath: (_platformInfo) => 'content',
        vsixOutputPath: razorDevKitDirectory,
    },
};

const vsixTasks: string[] = [];
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

    const taskName = `vsix:release:package:${platformName}:${p.vsceTarget}`;
    vsixTasks.push(taskName);
    gulp.task(taskName, async () => {
        await doPackageOffline(p);
    });
}

gulp.task('vsix:release:package:windows', gulp.series(...vsixTasks.filter((t) => t.includes('windows'))));
gulp.task('vsix:release:package:linux', gulp.series(...vsixTasks.filter((t) => t.includes('linux'))));
gulp.task('vsix:release:package:darwin', gulp.series(...vsixTasks.filter((t) => t.includes('darwin'))));
gulp.task('vsix:release:package:neutral', async () => {
    await doPackageOffline(undefined);
});

gulp.task(
    'vsix:release:package',
    gulp.series(
        'vsix:release:package:windows',
        'vsix:release:package:linux',
        'vsix:release:package:darwin',
        'vsix:release:package:neutral'
    )
);

// Downloads dependencies for local development.
gulp.task('installDependencies', async () => {
    await cleanAsync();

    const packageJSON = getPackageJSON();

    const platform = await PlatformInformation.GetCurrent();
    const vsixPlatformInfo = platformSpecificPackages.find(
        (p) => p.platformInfo.platform === platform.platform && p.platformInfo.architecture === platform.architecture
    )!;

    try {
        acquireAndInstallAllNugetPackages(vsixPlatformInfo, packageJSON, true);
    } catch (err) {
        const message = (err instanceof Error ? err.stack : err) ?? '<unknown error>';
        // NOTE: Extra `\n---` at the end is because gulp will print this message following by the
        // stack trace of this line. So that seperates the two stack traces.
        throw Error(`Failed to install packages for ${platform}. ${message}\n---`);
    }
});

// Defines a special task to acquire all the platform specific Roslyn packages.
// All packages need to be saved to the consumption AzDo artifacts feed, for non-platform
// specific packages this only requires running the installDependencies tasks.  However for Roslyn packages
// we need to acquire the nuget packages once for each platform to ensure they get saved to the feed.
gulp.task(
    'updateRoslynVersion',
    // Run the fetch of all packages, and then also installDependencies after
    gulp.series(async () => {
        await updateNugetPackageVersion(allNugetPackages.roslyn);

        // Also pull in the Roslyn DevKit dependencies nuget package.
        await acquireNugetPackage(allNugetPackages.roslynDevKit, undefined, getPackageJSON(), true);
    }, 'installDependencies')
);

// Defines a special task to acquire all the platform specific Razor packages.
// All packages need to be saved to the consumption AzDo artifacts feed, for non-platform
// specific packages this only requires running the installDependencies tasks.  However for Razor packages
// we need to acquire the nuget packages once for each platform to ensure they get saved to the feed.
gulp.task(
    'updateRazorVersion',
    // Run the fetch of all packages, and then also installDependencies after
    gulp.series(async () => {
        await updateNugetPackageVersion(allNugetPackages.razor);

        // Also pull in the Razor DevKit dependencies nuget package.
        await acquireNugetPackage(allNugetPackages.razorDevKit, undefined, getPackageJSON(), true);
    }, 'installDependencies')
);

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

async function acquireNugetPackage(
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
    if (platformInfo === undefined) {
        const platformNeutral = new PlatformInformation('neutral', 'neutral');
        return await installPackageJsonDependency('Razor', packageJSON, platformNeutral);
    }

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
    if (!(await downloadAndInstallPackages(packagesToInstall, provider, eventStream, isValidDownload, token))) {
        throw Error('Failed to download package.');
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
        path.join(rootPath, 'server'),
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

async function doPackageOffline(vsixPlatform: VSIXPlatformInfo | undefined) {
    await cleanAsync();
    // Set the package.json version based on the value in version.json.
    const versionInfo = await nbgv.getVersion();
    console.log(versionInfo.npmPackageVersion);
    await nbgv.setPackageVersion();

    let prerelease: boolean;
    if (argv.prerelease) {
        console.log('Packaging prerelease version.');
        prerelease = true;
    } else {
        console.log('Packaging release version.');
        prerelease = false;
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
        throw Error(`Failed to create package ${vsixPlatform?.vsceTarget ?? 'neutral'}. ${message}\n---`);
    } finally {
        // Reset package version to the placeholder value.
        await nbgv.resetPackageVersionPlaceholder();
    }
}

async function cleanAsync() {
    const directoriesToDelete = ['install.*', '.omnisharp*', '.debugger', '.razor'];
    for (const key in allNugetPackages) {
        directoriesToDelete.push(allNugetPackages[key].vsixOutputPath);
    }

    await del(directoriesToDelete);
}

async function buildVsix(packageJSON: any, outputFolder: string, prerelease: boolean, platformInfo?: VSIXPlatformInfo) {
    await acquireAndInstallAllNugetPackages(platformInfo, packageJSON, false);

    if (platformInfo != null) {
        await installRazor(packageJSON, platformInfo.platformInfo);
        await installDebugger(packageJSON, platformInfo.platformInfo);
    }

    const packageFileName = getPackageName(packageJSON, platformInfo?.vsceTarget);
    await createPackageAsync(outputFolder, prerelease, packageFileName, platformInfo?.vsceTarget);
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

async function updateNugetPackageVersion(packageInfo: NugetPackageInfo) {
    const packageJSON = getPackageJSON();

    // Fetch the neutral package that we don't otherwise have in our platform list
    await acquireNugetPackage(packageInfo, undefined, packageJSON, true);

    // And now fetch each platform specific
    for (const p of platformSpecificPackages) {
        await acquireNugetPackage(packageInfo, p, packageJSON, true);
    }
}
