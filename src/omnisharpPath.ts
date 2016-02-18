/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const runFileName = process.platform === 'win32' ? 'run.cmd' : 'run';
const omniSharpFileName = process.platform === 'win32' ? 'omnisharp.exe' : 'omnisharp';

enum PathKind {
    File,
    Directory
}

function getPathKind(filePath: string): Promise<PathKind> {
    return new Promise<PathKind>((resolve, reject) => {
        fs.lstat(filePath, (err, stats) => {
            if (err) {
                reject(err);
            }
            else if (stats.isFile()) {
                resolve(PathKind.File);
            }
            else if (stats.isDirectory()) {
                resolve(PathKind.Directory);
            }
            else {
                reject(Error(`Path is not file or directory: ${filePath}`));
            }
        });
    });
}

function getLaunchFilePath(filePath: string): Promise<string> {
    return getPathKind(filePath)
        .then(kind => {
            if (kind === PathKind.File) {
                return filePath;
            }
            else {
                // Look for launch file since kind === PathKind.Directory
                
                let candidate: string;

                candidate = path.join(filePath, runFileName);
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
                
                candidate = path.join(filePath, omniSharpFileName);
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
                
                throw new Error(`Could not find launch file in ${filePath}. Expected '${runFileName}' or '${omniSharpFileName}.`);
            }
        });
}

function getLaunchPathFromSettings(): Promise<string> {
    const setting = vscode.workspace.getConfiguration('csharp').get<string>('omnisharp');
	if (setting) {
        return getLaunchFilePath(setting)
            .catch(err => {
                vscode.window.showWarningMessage(`Invalid "csharp.omnisharp" user setting specified ('${setting}'). Falling back to default install location.`);
            });
    }
    
    return Promise.reject<string>(Error('OmniSharp user setting does not exist.'));
}

function getLaunchPathFromDefaultInstallLocation(): Promise<string> {
    const installLocation = getDefaultOmnisharpInstallLocation();
    return getLaunchFilePath(installLocation);
}

export function getDefaultOmnisharpInstallLocation(): string {
    return path.join(__dirname, '../.omnisharp');
}

export function getOmnisharpLaunchFilePath(): Promise<string> {
    // Attempt to find launch file path first from settings, and then from the default install location.
    
    return getLaunchPathFromSettings()
        .catch(getLaunchPathFromDefaultInstallLocation); 
}