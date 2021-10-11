/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as serverUtils from '../omnisharp/utils';
import * as protocol from '../omnisharp/protocol';
import { OmniSharpServer } from '../omnisharp/server';
import { FixAllScope, FixAllItem } from '../omnisharp/protocol';
import CompositeDisposable from '../CompositeDisposable';
import AbstractProvider from './abstractProvider';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import { buildEditForResponse } from '../omnisharp/fileOperationsResponseEditBuilder';
import { CancellationToken } from 'vscode-languageserver-protocol';
import OptionProvider from '../observers/OptionProvider';

export class FixAllProvider extends AbstractProvider implements vscode.CodeActionProvider {
    public static fixAllCodeActionKind =
        vscode.CodeActionKind.SourceFixAll.append('csharp');

    public static metadata: vscode.CodeActionProviderMetadata = {
        providedCodeActionKinds: [FixAllProvider.fixAllCodeActionKind]
    };

    public constructor(private server: OmniSharpServer, private optionProvider: OptionProvider, languageMiddlewareFeature: LanguageMiddlewareFeature) {
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

        if (context.only.contains(FixAllProvider.fixAllCodeActionKind)) {
            await this.fixAllOnSave(document);
        }

        return [];
    }

    private async getFilteredFixAll(server: OmniSharpServer, scope: protocol.FixAllScope, diagnosticFilter: Set<string>): Promise<FixAllItem[]> {
        const availableFixes = await serverUtils.getFixAll(server, { FileName: vscode.window.activeTextEditor.document.fileName, Scope: scope });

        return diagnosticFilter.size == 0
            ? availableFixes.Items
            : availableFixes.Items.filter(item => !diagnosticFilter.has(item.Id.toLowerCase()));
    }

    private async fixAllMenu(server: OmniSharpServer, scope: protocol.FixAllScope): Promise<void> {
        const { filteredDiagnosticsFixAll } = this.optionProvider.GetLatestOptions();

        let availableFixes = await this.getFilteredFixAll(server, scope, filteredDiagnosticsFixAll);

        let targets = availableFixes.map(x => `${x.Id}: ${x.Message}`);

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

    private async fixAllOnSave(document: vscode.TextDocument) {
        let fixes: FixAllItem[] = undefined;

        const { filteredDiagnosticsFixAll } = this.optionProvider.GetLatestOptions();

        // If we are not filtering then we do not have to pull down a list of FixAllItems.
        if (filteredDiagnosticsFixAll.size > 0) {
            fixes = await this.getFilteredFixAll(super._server, FixAllScope.Document, filteredDiagnosticsFixAll);
        }

        await this.applyFixes(document.fileName, FixAllScope.Document, fixes);
    }

    private async applyFixes(fileName: string, scope: FixAllScope, fixAllFilter: FixAllItem[]): Promise<boolean | string | {}> {
        let response = await serverUtils.runFixAll(this.server, {
            FileName: fileName,
            Scope: scope,
            FixAllFilter: fixAllFilter,
            WantsAllCodeActionOperations: true,
            WantsTextChanges: true,
            ApplyChanges: false
        });

        if (response) {
            return buildEditForResponse(response.Changes, this._languageMiddlewareFeature, CancellationToken.None);
        }
    }
}
