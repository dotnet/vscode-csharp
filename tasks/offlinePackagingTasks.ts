
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as del from 'del';
import * as fs from 'fs';
import * as gulp from 'gulp';
import * as path from 'path';
import * as util from '../src/common';
import spawnNode from '../tasks/spawnNode';
import { codeExtensionPath, offlineVscodeignorePath, vscodeignorePath, vscePath, packedVsixOutputRoot } from '../tasks/projectPaths';
import { CsharpLoggerObserver } from '../src/observers/CsharpLoggerObserver';
import { EventStream } from '../src/EventStream';
import { getPackageJSON } from '../tasks/packageJson';
import { Logger } from '../src/logger';
import { PlatformInformation } from '../src/platform';
import { downloadAndInstallPackages } from '../src/packageManager/downloadAndInstallPackages';
import NetworkSettings from '../src/NetworkSettings';
import { commandLineOptions } from '../tasks/commandLineArguments';
import { getRuntimeDependenciesPackages } from '../src/tools/RuntimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from '../src/packageManager/getAbsolutePathPackagesToInstall';
import { isValidDownload } from '../src/packageManager/isValidDownload';

export const offlinePackages = [
    { platformInfo: new PlatformInformation('win32', 'x86_64'), id: "win32-x64" },
    { platformInfo: new PlatformInformation('win32', 'x86'), id: "win32-ia32" },
    { platformInfo: new PlatformInformation('win32', 'arm64'), id: "win32-arm64" },
    { platformInfo: new PlatformInformation('linux', 'x86_64'), id: "linux-x64" },
    { platformInfo: new PlatformInformation('darwin', 'x86_64'), id: "darwin-x64" },
    { platformInfo: new PlatformInformation('darwin', 'arm64'), id: "darwin-arm64" },
];

export function getPackageName(packageJSON: any, vscodePlatformId: string) {
    const name = packageJSON.name;
    const version = packageJSON.version;
    return `${name}-${version}-${vscodePlatformId}.vsix`;
}

gulp.task('vsix:release:package:platform-specific', async () => {

    if (process.platform === 'win32') {
        throw new Error('Do not build offline packages on windows. Runtime executables will not be marked executable in *nix packages.');
    }

    //if user does not want to clean up the existing vsix packages
    await cleanAsync(/* deleteVsix: */ !commandLineOptions.retainVsix);

    del.sync(vscodeignorePath);

    fs.copyFileSync(offlineVscodeignorePath, vscodeignorePath);

    try {
        await doPackageOffline();
    }
    finally {
        del(vscodeignorePath);
    }
});

async function doPackageOffline() {

    const packageJSON = getPackageJSON();

    for (let p of offlinePackages) {
        try {
            await doOfflinePackage(p.platformInfo, p.id, packageJSON, packedVsixOutputRoot);
        }
        catch (err) {
            // NOTE: Extra `\n---` at the end is because gulp will print this message following by the
            // stack trace of this line. So that seperates the two stack traces.
            throw Error(`Failed to create package ${p.id}. ${err.stack ?? err ?? '<unknown error>'}\n---`);
        }
    }
}

async function cleanAsync(deleteVsix: boolean) {
    await del(['install.*', '.omnisharp*', '.debugger', '.razor']);

    if (deleteVsix) {
        await del('*.vsix');
    }
}

async function doOfflinePackage(platformInfo: PlatformInformation, vscodePlatformId: string, packageJSON: any, outputFolder: string) {
    await cleanAsync(false);
    const packageFileName = getPackageName(packageJSON, vscodePlatformId);
    await install(platformInfo, packageJSON);
    await createPackageAsync(packageFileName, outputFolder, vscodePlatformId);
}

// Install Tasks
async function install(platformInfo: PlatformInformation, packageJSON: any) {
    let eventStream = new EventStream();
    const logger = new Logger(message => process.stdout.write(message));
    let stdoutObserver = new CsharpLoggerObserver(logger);
    eventStream.subscribe(stdoutObserver.post);
    let runTimeDependencies = getRuntimeDependenciesPackages(packageJSON);
    let packagesToInstall = await getAbsolutePathPackagesToInstall(runTimeDependencies, platformInfo, codeExtensionPath);
    let provider = () => new NetworkSettings(undefined, undefined);
    if (!(await downloadAndInstallPackages(packagesToInstall, provider, eventStream, isValidDownload))) {
        throw Error("Failed to download package.");
    }

    // The VSIX Format doesn't allow files that differ only by case. The Linux OmniSharp package had a lowercase version of these files ('.targets') targets from mono,
    // and an upper case ('.Targets') from Microsoft.Build.Runtime. Remove the lowercase versions.
    await del(['.omnisharp/*/omnisharp/.msbuild/Current/Bin/Workflow.targets', '.omnisharp/*/omnisharp/.msbuild/Current/Bin/Workflow.VisualBasic.targets']);
}

/// Packaging (VSIX) Tasks
async function createPackageAsync(packageName: string, outputFolder: string, vscodePlatformId: string) {

    let vsceArgs = [];
    let packagePath = undefined;

    if (!(await util.fileExists(vscePath))) {
        throw new Error(`vsce does not exist at expected location: '${vscePath}'`);
    }

    vsceArgs.push(vscePath);
    vsceArgs.push('package'); // package command

    if (packageName !== undefined) {
        vsceArgs.push('-o');
        if (outputFolder) {
            //if we have specified an output folder then put the files in that output folder
            packagePath = path.join(outputFolder, packageName);
            vsceArgs.push(packagePath);
        }
        else {
            vsceArgs.push(packageName);
        }

        if (vscodePlatformId !== undefined) {
            vsceArgs.push("--target");
            vsceArgs.push(vscodePlatformId);
        }
    }

    const spawnResult = await spawnNode(vsceArgs);
    if (spawnResult.code != 0) {
        throw new Error(`'${vsceArgs.join(' ')}' failed with code ${spawnResult.code}.`);
    }

    if (packagePath) {
        if (!(await util.fileExists(packagePath))) {
            throw new Error(`vsce failed to create: '${packagePath}'`);
        }
    }
}