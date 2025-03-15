/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { createLaunchTargetForSolution } from '../../shared/launchTarget';
import { getCSharpDevKit } from '../../utils/getCSharpDevKit';

/**
 * Register commands that drive the workspace.
 */
export function registerWorkspaceCommands(context: vscode.ExtensionContext, languageServer: RoslynLanguageServer) {
    if (!getCSharpDevKit()) {
        context.subscriptions.push(
            vscode.commands.registerCommand('dotnet.openSolution', async () => openSolution(languageServer))
        );
    }
}

async function openSolution(languageServer: RoslynLanguageServer): Promise<vscode.Uri | undefined> {
    if (!vscode.workspace.workspaceFolders) {
        return undefined;
    }

    const solutionFiles = await vscode.workspace.findFiles('**/*.{sln,slnf}');
    const launchTargets = solutionFiles.map(createLaunchTargetForSolution);
    const launchTarget = await vscode.window.showQuickPick(launchTargets, {
        matchOnDescription: true,
        placeHolder: `Select solution file`,
    });

    if (launchTarget) {
        const uri = vscode.Uri.file(launchTarget.target);
        await languageServer.openSolution(uri);
        return uri;
    }
}
