/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fs from 'fs';
import { rootPath } from '../projectPaths';
import path from 'path';
import { verifySignature } from '../packaging/vsceTasks';
// There are no typings for this library.
// eslint-disable-next-line @typescript-eslint/no-var-requires
//const argv = require('yargs').argv;

export async function signJsTask(): Promise<void> {
    await signJs();
}

export async function signVsixTask(): Promise<void> {
    await signVsix();
}

export async function verifyVsixTask(): Promise<void> {
    await verifyVsix();
}

// Development task to install the signing plugin locally.
// Required to run test sigining tasks locally.
export async function installSignPluginTask(): Promise<void> {
    await installSignPlugin();
}

async function installSignPlugin(): Promise<void> {
    console.log(`Installing MicroBuild.Plugins.Signing`);
    await execDotnet([
        'restore',
        path.join(rootPath, 'msbuild', 'server'),
        // MicroBuild is expecting the signing plugin to be in the global package folder, so ensure it gets downloaded there.
        `/p:DownloadToGlobalNugetFolder=true`,
        `/p:PackageName=MicroBuild.Plugins.Signing`,
        `/p:PackageVersion=1.1.950`,
        `/p:RestoreSources=https://dnceng.pkgs.visualstudio.com/_packaging/MicroBuildToolset/nuget/v3/index.json`,
    ]);
}

async function signJs(): Promise<void> {
    const logPath = getLogPath();
    const signType = process.env.SignType;
    if (!signType) {
        console.warn('SignType environment variable is not set, skipping JS signing.');
        return;
    }

    if (signType === 'test' && process.platform !== 'win32') {
        console.log('Test signing is not supported on non-windows platforms. Skipping JS signing.');
        return;
    }
    console.log(`Signing JS as ${signType}`);
    await execDotnet([
        'build',
        path.join(rootPath, 'msbuild', 'signing', 'signJs'),
        `-bl:${path.join(logPath, 'signJs.binlog')}`,
        `/p:JSOutputPath=${path.join(rootPath, 'dist')}`,
    ]);
}

async function signVsix(): Promise<void> {
    const logPath = getLogPath();
    const signType = process.env.SignType;
    if (!signType) {
        console.warn('SignType environment variable is not set, skipping VSIX signing.');
        return;
    }

    if (signType === 'test' && process.platform !== 'win32') {
        console.log('Test signing is not supported on non-windows platforms. Skipping VSIX signing.');
        return;
    }
    console.log(`Signing VSIX as ${signType}`);
    await execDotnet([
        'build',
        path.join(rootPath, 'msbuild', 'signing', 'signVsix'),
        `-bl:${path.join(logPath, 'signVsix.binlog')}`,
    ]);
}

async function verifyVsix(): Promise<void> {
    const signType = process.env.SignType;
    if (!signType) {
        console.warn('SignType environment variable is not set, skipping VSIX verification.');
        return;
    }

    if (signType.toLowerCase() !== 'real') {
        console.log('Signing verification is only supported for real signing. Skipping VSIX verification.');
        return;
    }

    const vsixs = fs.readdirSync('.').filter((file) => path.extname(file) === '.vsix');
    for (const vsixFile in vsixs) {
        console.log(`Verifying signature of ${vsixFile}`);
        await verifySignature(vsixFile);
    }
}

function getLogPath(): string {
    const logPath = path.join(rootPath, 'out', 'logs');
    if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true });
    }
    return logPath;
}

async function execDotnet(args: string[]): Promise<void> {
    const dotnetArgs = args.join(' ');
    console.log(`dotnet args: dotnet ${dotnetArgs}`);
    const process = cp.spawn('dotnet', args, { stdio: 'inherit' });

    await new Promise((resolve) => {
        process.on('exit', (exitCode, _) => {
            if (exitCode !== 0) {
                throw new Error(`Failed to run command: dotnet ${dotnetArgs}`);
            }
            resolve(undefined);
        });
    });
}
