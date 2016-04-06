/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
 
'use strict';

import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as vscode from 'vscode';

const runFileName = process.platform === 'win32' ? 'run.cmd' : 'run';
const omnisharpFileName = process.platform === 'win32' ? 'omnisharp.cmd' : 'omnisharp';
const omnisharpExeFileName = process.platform === 'win32' ? 'omnisharp.exe' : 'omnisharp';

function getLaunchFilePath(filePathOrFolder: string): Promise<string> {
    return fs.lstatAsync(filePathOrFolder).then(stats => {
        // If a file path was passed, assume its the launch file.
        if (stats.isFile()) {
            return filePathOrFolder;
        }

        // Otherwise, search the specified folder.
        let candidate: string;
        
        candidate = path.join(filePathOrFolder, runFileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        
        candidate = path.join(filePathOrFolder, omnisharpFileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        
        candidate = path.join(filePathOrFolder, omnisharpExeFileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        
        throw new Error(`Could not fnd launch file in ${filePathOrFolder}. Expected '${runFileName}', '${omnisharpFileName}', '${omnisharpExeFileName}'`);
    });
}

function getLaunchPathFromSettings(): Promise<string> {
    const setting = vscode.workspace.getConfiguration('csharp').get<string>('omnisharp');
    
    if (setting) {
        return getLaunchFilePath(setting)
            .catch(err => {
                vscode.window.showWarningMessage(`Invalid "csharp.omnisharp" use setting specified ('${setting}).`);
                throw err;
            })
    }
    
    return Promise.reject<string>(new Error('OmniSharp use setting does not exists.'));
}

function getLaunchPathFromDefaultInstallFolder(): Promise<string> {
    const installLocation = path.join(__dirname, '../.omnisharp');
    return getLaunchFilePath(installLocation);
}

export function getOmnisharpLaunchFilePath(): Promise<string> {
    // Attempt to find launch file path first from settings, and then from the default install location.
    
    return getLaunchPathFromSettings()
        .catch(getLaunchPathFromDefaultInstallFolder);
}