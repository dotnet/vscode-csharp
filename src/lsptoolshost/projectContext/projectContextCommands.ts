/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { isRelevantDocument } from './projectContextService';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { VSProjectContext } from '../server/roslynProtocol';
import { CancellationToken } from 'vscode-languageclient/node';

export const changeProjectContextCommandName = 'csharp.changeProjectContext';
export const changeProjectContextFileExplorer = 'csharp.changeProjectContextFileExplorer';
export const changeProjectContextEditor = 'csharp.changeProjectContextEditor';

export async function openAndChangeProjectContext(
    languageServer: RoslynLanguageServer,
    uri: vscode.Uri | undefined
): Promise<void> {
    if (uri === undefined) {
        vscode.window.showErrorMessage(vscode.l10n.t('No file selected to change project context.'));
        return;
    }

    try {
        const document = await vscode.window.showTextDocument(uri);
        await changeProjectContext(languageServer, document.document, undefined);
    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to change context for {0}: {1}', uri.fsPath, message));
    }
}

export async function changeProjectContext(
    languageServer: RoslynLanguageServer,
    document: vscode.TextDocument | undefined,
    options: ChangeProjectContextOptions | undefined
): Promise<VSProjectContext | undefined> {
    document = document ?? vscode.window.activeTextEditor?.document;
    if (!isRelevantDocument(document)) {
        vscode.window.showErrorMessage(vscode.l10n.t('No file selected to change project context.'));
        return;
    }

    const contextList = await languageServer._projectContextService.queryServerProjectContexts(
        document.uri,
        CancellationToken.None
    );
    if (contextList === undefined) {
        return;
    }

    let context: VSProjectContext | undefined = undefined;

    if (options !== undefined) {
        const contextLabel = `${options.projectName} (${options.tfm})`;
        context =
            contextList._vs_projectContexts.find((context) => context._vs_label === contextLabel) ||
            contextList._vs_projectContexts.find((context) => context._vs_label === options.projectName);
    } else {
        const items = contextList._vs_projectContexts
            .map((context) => {
                return { label: context._vs_label, context };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
        const selectedItem = await vscode.window.showQuickPick(items, {
            placeHolder: vscode.l10n.t('Select project context'),
        });
        context = selectedItem?.context;
    }

    if (context === undefined) {
        return;
    }

    await languageServer._projectContextService.setActiveFileContext(document, contextList, context);
}

interface ChangeProjectContextOptions {
    projectName: string;
    tfm: string;
}
