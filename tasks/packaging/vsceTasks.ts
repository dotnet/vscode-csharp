/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as util from '../../src/common';
import * as fs from 'fs';
import spawnNode from '../spawnNode';
import { vscePath } from '../projectPaths';

/// Packaging (VSIX) Tasks
export async function createPackageAsync(
    outputFolder: string,
    prerelease: boolean,
    packageName: string,
    vscodePlatformId?: string
): Promise<string> {
    const vsceArgs = [];
    let packagePath = undefined;

    if (!(await util.fileExists(vscePath))) {
        throw new Error(`vsce does not exist at expected location: '${vscePath}'`);
    }

    vsceArgs.push(vscePath);
    vsceArgs.push('package'); // package command

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder);
    }

    vsceArgs.push('-o');
    packagePath = path.join(outputFolder, packageName);
    vsceArgs.push(packagePath);

    if (vscodePlatformId !== undefined) {
        vsceArgs.push('--target');
        vsceArgs.push(vscodePlatformId);
    }

    if (prerelease) {
        vsceArgs.push('--pre-release');
    }

    vsceArgs.push('--baseContentUrl', 'https://github.com/dotnet/vscode-csharp');

    const spawnResult = await spawnNode(vsceArgs);
    if (spawnResult.code != 0) {
        throw new Error(`'${vsceArgs.join(' ')}' failed with code ${spawnResult.code}.`);
    }

    if (packagePath) {
        if (!(await util.fileExists(packagePath))) {
            throw new Error(`vsce failed to create: '${packagePath}'`);
        }
    }

    return packagePath;
}

export async function generateVsixManifest(vsixPath: string) {
    const vsceArgs = [];
    if (!(await util.fileExists(vscePath))) {
        throw new Error(`vsce does not exist at expected location: '${vscePath}'`);
    }

    vsceArgs.push(vscePath);
    vsceArgs.push('generate-manifest');
    vsceArgs.push('--packagePath');
    vsceArgs.push(vsixPath);

    const parsed = path.parse(vsixPath);
    const outputFolder = parsed.dir;
    const vsixNameWithoutExtension = parsed.name;

    vsceArgs.push('-o');
    vsceArgs.push(path.join(outputFolder, `${vsixNameWithoutExtension}.manifest`));

    const spawnResult = await spawnNode(vsceArgs);
    if (spawnResult.code != 0) {
        throw new Error(`'${vsceArgs.join(' ')}' failed with code ${spawnResult.code}.`);
    }
}

export async function verifySignature(vsixPath: string) {
    const vsceArgs = [];
    if (!(await util.fileExists(vscePath))) {
        throw new Error(`vsce does not exist at expected location: '${vscePath}'`);
    }

    vsceArgs.push(vscePath);
    vsceArgs.push('verify-signature');
    vsceArgs.push('--packagePath');
    vsceArgs.push(vsixPath);

    const parsed = path.parse(vsixPath);
    const outputFolder = parsed.dir;
    const vsixNameWithoutExtension = parsed.name;

    vsceArgs.push('--manifestPath');
    vsceArgs.push(path.join(outputFolder, `${vsixNameWithoutExtension}.manifest`));

    vsceArgs.push('--signaturePath');
    vsceArgs.push(path.join(outputFolder, `${vsixNameWithoutExtension}.signature.p7s`));

    const spawnResult = await spawnNode(vsceArgs, { stdio: 'pipe' });
    if (spawnResult.code != 0) {
        throw new Error(`'${vsceArgs.join(' ')}' failed with code ${spawnResult.code}.`);
    } else if (spawnResult.stdout != 'Signature verification result: Success') {
        // This is a brittle check but the command does not return a non-zero exit code for failed validation.
        // Opened https://github.com/microsoft/vscode-vsce/issues/1192 to track this.

        console.log(spawnResult.stdout);
        throw new Error(`Signature verification failed - '${vsceArgs.join(' ')}'.`);
    }

    console.log(`Signature verification succeeded for ${vsixPath}`);
}
