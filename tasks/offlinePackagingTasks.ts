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
    { vsceTarget: 'win32-ia32', rid: 'win-x86', platformInfo: new PlatformInformation('win32', 'x86') },
    { vsceTarget: 'win32-arm64', rid: 'win-arm64', platformInfo: new PlatformInformation('win32', 'arm64') },
    { vsceTarget: 'linux-x64', rid: 'linux-x64', platformInfo: new PlatformInformation('linux', 'x86_64') },
    { vsceTarget: 'linux-arm64', rid: 'linux-arm64', platformInfo: new PlatformInformation('linux', 'arm64') },
    { vsceTarget: 'alpine-x64', rid: 'alpine-x64', platformInfo: new PlatformInformation('linux-musl', 'x86_64') },
    { vsceTarget: 'alpine-arm64', rid: 'alpine-arm64', platformInfo: new PlatformInformation('linux-musl', 'arm64') },
    { vsceTarget: 'darwin-x64', rid: 'osx-x64', platformInfo: new PlatformInformation('darwin', 'x86_64') },
    { vsceTarget: 'darwin-arm64', rid: 'osx-arm64', platformInfo: new PlatformInformation('darwin', 'arm64') },
];

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

    try {
        await installRoslyn(packageJSON, platform);
        await installDebugger(packageJSON, platform);
        await installRazor(packageJSON, platform);
    } catch (err) {
        const message = (err instanceof Error ? err.stack : err) ?? '<unknown error>';
        // NOTE: Extra `\n---` at the end is because gulp will print this message following by the
        // stack trace of this line. So that seperates the two stack traces.
        throw Error(`Failed to install packages for ${platform}. ${message}\n---`);
    }
});

gulp.task(
    'updateRoslynVersion',
    // Run the fetch of all packages, and then also installDependencies after
    gulp.series(async () => {
        const packageJSON = getPackageJSON();

        // Fetch the neutral package that we don't otherwise have in our platform list
        await acquireRoslyn(packageJSON, undefined, true);

        // And now fetch each platform specific
        for (const p of platformSpecificPackages) {
            await acquireRoslyn(packageJSON, p.platformInfo, true);
        }

        // Also pull in the Roslyn DevKit dependencies nuget package.
        await acquireRoslynDevKit(packageJSON, true);
    }, 'installDependencies')
);

// Install Tasks
async function installRoslyn(packageJSON: any, platformInfo?: PlatformInformation) {
    // Install the Roslyn language server bits.
    const { packagePath, serverPlatform } = await acquireRoslyn(packageJSON, platformInfo, false);
    await installNuGetPackage(
        packagePath,
        path.join('content', 'LanguageServer', serverPlatform),
        languageServerDirectory
    );

    // Install Roslyn DevKit dependencies.
    const roslynDevKitPackagePath = await acquireRoslynDevKit(packageJSON, false);
    await installNuGetPackage(roslynDevKitPackagePath, 'content', devKitDependenciesDirectory);
}

async function installNuGetPackage(pathToPackage: string, contentPath: string, outputPath: string) {
    // Get the directory containing the content.
    const contentDirectory = path.join(pathToPackage, contentPath);
    if (!fs.existsSync(contentDirectory)) {
        throw new Error(`Failed to find NuGet package content at ${contentDirectory}`);
    }

    const numFilesToCopy = fs.readdirSync(contentDirectory).length;

    console.log(`Extracting content from ${contentDirectory}`);

    // Copy the files to the language server directory.
    fs.mkdirSync(outputPath);
    fsextra.copySync(contentDirectory, outputPath);
    const numCopiedFiles = fs.readdirSync(outputPath).length;

    // Not expected to ever happen, just a simple sanity check.
    if (numFilesToCopy !== numCopiedFiles) {
        throw new Error('Failed to copy all files from NuGet package');
    }
}

async function acquireRoslyn(
    packageJSON: any,
    platformInfo: PlatformInformation | undefined,
    interactive: boolean
): Promise<{ packagePath: string; serverPlatform: string }> {
    const roslynVersion = packageJSON.defaults.roslyn;

    // Find the matching server RID for the current platform.
    let serverPlatform: string;
    if (platformInfo === undefined) {
        serverPlatform = 'neutral';
    } else {
        serverPlatform = platformSpecificPackages.find(
            (p) =>
                p.platformInfo.platform === platformInfo.platform &&
                p.platformInfo.architecture === platformInfo.architecture
        )!.rid;
    }

    const packagePath = await acquireNugetPackage(
        `Microsoft.CodeAnalysis.LanguageServer.${serverPlatform}`,
        roslynVersion,
        interactive
    );
    return { packagePath, serverPlatform };
}

async function acquireRoslynDevKit(packageJSON: any, interactive: boolean): Promise<string> {
    const roslynVersion = packageJSON.defaults.roslyn;
    const packagePath = await acquireNugetPackage(
        `Microsoft.VisualStudio.LanguageServices.DevKit`,
        roslynVersion,
        interactive
    );
    return packagePath;
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

async function acquireNugetPackage(packageName: string, packageVersion: string, interactive: boolean): Promise<string> {
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
            await buildVsix(
                packageJSON,
                packedVsixOutputRoot,
                prerelease,
                vsixPlatform.vsceTarget,
                vsixPlatform.platformInfo
            );
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
    await del([
        'install.*',
        '.omnisharp*',
        '.debugger',
        '.razor',
        languageServerDirectory,
        devKitDependenciesDirectory,
    ]);
}

async function buildVsix(
    packageJSON: any,
    outputFolder: string,
    prerelease: boolean,
    vsceTarget?: string,
    platformInfo?: PlatformInformation
) {
    await installRoslyn(packageJSON, platformInfo);

    if (platformInfo != null) {
        await installRazor(packageJSON, platformInfo);
        await installDebugger(packageJSON, platformInfo);
    }

    const packageFileName = getPackageName(packageJSON, vsceTarget);
    await createPackageAsync(outputFolder, prerelease, packageFileName, vsceTarget);
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
