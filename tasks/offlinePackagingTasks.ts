
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as debugUtil from '../src/coreclr-debug/util';
import * as del from 'del';
import * as fs from 'fs';
import * as gulp from 'gulp';
import * as path from 'path';
import * as util from '../src/common';
import spawnNode from '../tasks/spawnNode';
import { codeExtensionPath, offlineVscodeignorePath, vscodeignorePath, vscePath, packedVsixOutputRoot } from '../tasks/projectPaths';
import { commandLineOptions } from '../tasks/commandLineArguments';
import { CsharpLoggerObserver } from '../src/observers/CsharpLoggerObserver';
import { EventStream } from '../src/EventStream';
import { getPackageJSON } from '../tasks/packageJson';
import { Logger } from '../src/logger';
import { PlatformInformation } from '../src/platform';
import { DownloadAndInstallPackages } from '../src/packageManager/PackageManager';
import NetworkSettings from '../src/NetworkSettings';
import { GetRunTimeDependenciesPackages } from '../src/CSharpExtDownloader';

gulp.task('vsix:offline:package', async () => {
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
    util.setExtensionPath(codeExtensionPath);

    if (commandLineOptions.retainVsix) {
        //if user doesnot want to clean up the existing vsix packages
        cleanSync(false);
    }
    else {
        cleanSync(true);
    }

    const packageJSON = getPackageJSON();
    const name = packageJSON.name;
    const version = packageJSON.version;
    const packageName = name + '.' + version;

    const packages = [
        new PlatformInformation('win32', 'x86_64'),
        new PlatformInformation('darwin', 'x86_64'),
        new PlatformInformation('linux', 'x86_64')
    ];

    for (let platformInfo of packages) {
        await doOfflinePackage(platformInfo, packageName, packageJSON, packedVsixOutputRoot);
    }
}

function cleanSync(deleteVsix: boolean) {
    del.sync('install.*');
    del.sync('.omnisharp*');
    del.sync('.debugger');

    if (deleteVsix) {
        del.sync('*.vsix');
    }
}

async function doOfflinePackage(platformInfo: PlatformInformation, packageName: string, packageJSON: any, outputFolder: string) {
    if (process.platform === 'win32') {
        throw new Error('Do not build offline packages on windows. Runtime executables will not be marked executable in *nix packages.');
    }

    cleanSync(false);

    const packageFileName = `${packageName}-${platformInfo.platform}-${platformInfo.architecture}.vsix`;

    await install(platformInfo, packageJSON);
    await doPackageSync(packageFileName, outputFolder);
}

// Install Tasks
async function install(platformInfo: PlatformInformation, packageJSON: any) {
    let eventStream = new EventStream();
    const logger = new Logger(message => process.stdout.write(message));
    let stdoutObserver = new CsharpLoggerObserver(logger);
    eventStream.subscribe(stdoutObserver.post);
    const debuggerUtil = new debugUtil.CoreClrDebugUtil(path.resolve('.'));
    let runTimeDependencies = GetRunTimeDependenciesPackages(packageJSON);
    let provider = () => new NetworkSettings(undefined, undefined);
    await DownloadAndInstallPackages(runTimeDependencies, provider, platformInfo, eventStream);
    await debugUtil.CoreClrDebugUtil.writeEmptyFile(debuggerUtil.installCompleteFilePath());
}

/// Packaging (VSIX) Tasks
async function doPackageSync(packageName: string, outputFolder: string) {

    let vsceArgs = [];
    vsceArgs.push(vscePath);
    vsceArgs.push('package'); // package command

    if (packageName !== undefined) {
        vsceArgs.push('-o');
        if (outputFolder) {
            //if we have specified an output folder then put the files in that output folder
            vsceArgs.push(path.join(outputFolder, packageName));
        }
        else {
            vsceArgs.push(packageName);
        }
    }

    return spawnNode(vsceArgs);
}