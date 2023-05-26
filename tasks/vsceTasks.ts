/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as util from '../src/common';
import * as fs from 'fs';
import spawnNode from '../tasks/spawnNode';
import { vscePath } from './projectPaths';

/// Packaging (VSIX) Tasks
export async function createPackageAsync(outputFolder: string, prerelease: boolean, packageName?: string, vscodePlatformId?: string) {

    let vsceArgs = [];
    let packagePath = undefined;

    if (!(await util.fileExists(vscePath))) {
        throw new Error(`vsce does not exist at expected location: '${vscePath}'`);
    }

    vsceArgs.push(vscePath);
    vsceArgs.push('package'); // package command

    if (!(fs.existsSync(outputFolder)))
    {
        fs.mkdirSync(outputFolder);
    }

    vsceArgs.push('-o');
    if (packageName !== undefined)
    {
        //if we have specified an output folder then put the files in that output folder
        packagePath = path.join(outputFolder, packageName);
        vsceArgs.push(packagePath);
    }
    else
    {
        vsceArgs.push(outputFolder);
    }

    if (vscodePlatformId !== undefined) {
        vsceArgs.push("--target");
        vsceArgs.push(vscodePlatformId);
    }

    if (prerelease) {
        vsceArgs.push("--pre-release");
    }

    vsceArgs.push('--baseContentUrl', 'https://devdiv.visualstudio.com/DevDiv/_git/vscode-csharp-next?path=/');

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