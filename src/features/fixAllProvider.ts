/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as serverUtils from '../omnisharp/utils';
import * as protocol from '../omnisharp/protocol';
import { OmniSharpServer } from '../omnisharp/server';
import { FixAllScope, FixAllItem, FileModificationType } from '../omnisharp/protocol';
import { Uri } from 'vscode';
import CompositeDisposable from '../CompositeDisposable';
import AbstractProvider from './abstractProvider';
import { toRange2 } from '../omnisharp/typeConversion';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';

export class FixAllProvider extends AbstractProvider implements vscode.CodeActionProvider {
    public constructor(private server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        let disposable = new CompositeDisposable();
        disposable.add(vscode.commands.registerCommand('o.fixAll.solution', async () => this.fixAllMenu(server, protocol.FixAllScope.Solution)));
        disposable.add(vscode.commands.registerCommand('o.fixAll.project', async () => this.fixAllMenu(server, protocol.FixAllScope.Project)));
        disposable.add(vscode.commands.registerCommand('o.fixAll.document', async () => this.fixAllMenu(server, protocol.FixAllScope.Document)));
        this.addDisposables(disposable);
    }

    public async provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken,
    ): Promise<vscode.CodeAction[]> {
        console.log(context);
        if (!context.only) {
            return [];
        }

        if (context.only.value === "source.fixAll.csharp") {
            await this.applyFixes(document.fileName, FixAllScope.Document, undefined);
        }

        return [];
    }

    private async fixAllMenu(server: OmniSharpServer, scope: protocol.FixAllScope): Promise<void> {
        let availableFixes = await serverUtils.getFixAll(server, { FileName: vscode.window.activeTextEditor.document.fileName, Scope: scope });

        let targets = availableFixes.Items.map(x => `${x.Id}: ${x.Message}`);

        if (scope === protocol.FixAllScope.Document) {
            targets = ["Fix all issues", ...targets];
        }

        return vscode.window.showQuickPick(targets, {
            matchOnDescription: true,
            placeHolder: `Select fix all action`
        }).then(async selectedAction => {
            let filter: FixAllItem[] = undefined;

            if (selectedAction === undefined) {
                return;
            }

            if (selectedAction !== "Fix all issues") {
                let actionTokens = selectedAction.split(":");
                filter = [{ Id: actionTokens[0], Message: actionTokens[1] }];
            }

            await this.applyFixes(vscode.window.activeTextEditor.document.fileName, scope, filter);
        });
    }

    private async applyFixes(fileName: string, scope: FixAllScope, fixAllFilter: FixAllItem[]): Promise<boolean | string | {}> {
        let response = await serverUtils.runFixAll(this.server, { FileName: fileName, Scope: scope, FixAllFilter: fixAllFilter, WantsAllCodeActionOperations: true, WantsTextChanges: true });

        if (response && Array.isArray(response.Changes)) {
            let edit = new vscode.WorkspaceEdit();

            let fileToOpen: Uri = null;
            let renamedFiles: Uri[] = [];

            for (let change of response.Changes) {
                if (change.ModificationType == FileModificationType.Renamed)
                {
                    // The file was renamed. Omnisharp has already persisted
                    // the right changes to disk. We don't need to try to
                    // apply text changes (and will skip this file if we see an edit)
                    renamedFiles.push(Uri.file(change.FileName));
                }
            }

            for (let change of response.Changes) {
                if (change.ModificationType == FileModificationType.Opened)
                {
                    // The CodeAction requested that we open a file.
                    // Record that file name and keep processing CodeActions.
                    // If a CodeAction requests that we open multiple files 
                    // we only open the last one (what would it mean to open multiple files?)
                    fileToOpen = vscode.Uri.file(change.FileName);
                }

                if (change.ModificationType == FileModificationType.Modified)
                {
                    let uri = vscode.Uri.file(change.FileName);
                    if (renamedFiles.some(r => r == uri))
                    {
                        // This file got renamed. Omnisharp has already
                        // persisted the new file with any applicable changes.
                        continue;
                    }

                    let edits: vscode.TextEdit[] = [];
                    for (let textChange of change.Changes) {
                        edits.push(vscode.TextEdit.replace(toRange2(textChange), textChange.NewText));
                    }

                    edit.set(uri, edits);
                }
            }

            let applyEditPromise = vscode.workspace.applyEdit(edit);

            // Unfortunately, the textEditor.Close() API has been deprecated
            // and replaced with a command that can only close the active editor.
            // If files were renamed that weren't the active editor, their tabs will
            // be left open and marked as "deleted" by VS Code
            let next = applyEditPromise;
            if (renamedFiles.some(r => r.fsPath == vscode.window.activeTextEditor.document.uri.fsPath))
            {
                next = applyEditPromise.then(_ => 
                    {
                        return vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                    });
            }

            return fileToOpen != null
             ? next.then(_ =>
                    {
                        return vscode.commands.executeCommand("vscode.open", fileToOpen);
                    })
             : next;
        }
    }
}