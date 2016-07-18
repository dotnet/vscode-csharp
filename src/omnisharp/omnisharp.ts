/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Note that this file intentionally does not import 'vscode' as the code within is intended
 * to be usable outside of VS Code. 
 */

'use strict';

import * as fs from 'fs-extra-promise';
import * as path from 'path';

export interface Options {
	path?: string;
	usesMono?: boolean;
}

export enum Flavor {
    CoreCLR,
    Mono,
    Desktop
}

/**
 * Given a file path, returns the path to the OmniSharp launch file.
 */
export function findServerPath(filePath: string): Promise<string> {
	const cmdFileName = process.platform === 'win32' ? 'OmniSharp.cmd' : 'OmniSharp';
	const exeFileName = process.platform === 'win32' ? 'OmniSharp.exe' : 'OmniSharp';

    return fs.lstatAsync(filePath).then(stats => {
        // If a file path was passed, assume its the launch file.
        if (stats.isFile()) {
            return filePath;
        }

        // Otherwise, search the specified folder.
        let candidate: string;
        
        candidate = path.join(filePath, cmdFileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        
        candidate = path.join(filePath, exeFileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        
        throw new Error(`Could not find OmniSharp launch file in ${filePath}.`);
    });
}

export function getInstallDirectory(flavor: Flavor): string {
    const basePath = path.join(__dirname, '../.omnisharp');

    switch (flavor) {
        case Flavor.CoreCLR:
            return basePath + '-coreclr';
        case Flavor.Desktop:
            return basePath + '-desktop';
        case Flavor.Mono:
            return basePath + '-full';

        default:
            throw new Error(`Unexpected OmniSharp flavor specified: ${flavor}`);
    }
}