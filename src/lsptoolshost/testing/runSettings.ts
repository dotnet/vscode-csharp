/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { languageServerOptions } from '../../shared/options';

export function getRunSettings(documentUri: string, dotnetTestChannel: vscode.OutputChannel): string | undefined {
    const runSettingsPathOption = languageServerOptions.runSettingsPath;
    if (runSettingsPathOption.length === 0) {
        return undefined;
    }

    let absolutePath = runSettingsPathOption;
    if (!path.isAbsolute(runSettingsPathOption)) {
        // Path is relative to the workspace. Create absolute path.
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(documentUri));
        if (workspaceFolder === undefined) {
            dotnetTestChannel.appendLine(
                `Warning: Unable to find workspace folder for ${documentUri}, cannot resolve run settings path ${runSettingsPathOption}.`
            );
            return undefined;
        }
        absolutePath = path.join(workspaceFolder.uri.fsPath, runSettingsPathOption);
    }

    if (!fs.existsSync(absolutePath)) {
        dotnetTestChannel.appendLine(`Warning: Unable to find run settings file at ${absolutePath}.`);
        return undefined;
    }

    return absolutePath;
}
