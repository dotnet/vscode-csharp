/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as serverUtils from '../utils';
import * as protocol from '../protocol';
import { OmniSharpServer } from '../server';
import { FixAllScope, FixAllItem } from '../protocol';
import CompositeDisposable from '../../compositeDisposable';
import AbstractProvider from './abstractProvider';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';
import { buildEditForResponse } from '../fileOperationsResponseEditBuilder';
import { CancellationToken } from 'vscode-languageserver-protocol';

export class OmniSharpFixAllProvider extends AbstractProvider implements vscode.CodeActionProvider {
    public static fixAllCodeActionKind = vscode.CodeActionKind.SourceFixAll.append('csharp');

    public static metadata: vscode.CodeActionProviderMetadata = {
        providedCodeActionKinds: [OmniSharpFixAllProvider.fixAllCodeActionKind],
    };

    public constructor(private server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        const disposable = new CompositeDisposable();
        disposable.add(
            vscode.commands.registerCommand('o.fixAll.solution', async () =>
                this.fixAllMenu(server, protocol.FixAllScope.Solution)
            )
        );
        disposable.add(
            vscode.commands.registerCommand('o.fixAll.project', async () =>
                this.fixAllMenu(server, protocol.FixAllScope.Project)
            )
        );
        disposable.add(
            vscode.commands.registerCommand('o.fixAll.document', async () =>
                this.fixAllMenu(server, protocol.FixAllScope.Document)
            )
        );
        this.addDisposables(disposable);
    }

    public async provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {
        console.log(context);
        if (!context.only) {
            return [];
        }

        if (context.only.contains(OmniSharpFixAllProvider.fixAllCodeActionKind)) {
            await this.applyFixes(document.fileName, FixAllScope.Document, undefined);
        }

        return [];
    }

    private async fixAllMenu(server: OmniSharpServer, scope: protocol.FixAllScope): Promise<void> {
        const fileName = vscode.window.activeTextEditor?.document.fileName;
        if (fileName === undefined) {
            vscode.window.showWarningMessage(vscode.l10n.t('Text editor must be focused to fix all issues'));
            return;
        }

        const availableFixes = await serverUtils.getFixAll(server, { FileName: fileName, Scope: scope });

        let targets = availableFixes.Items.map((x) => `${x.Id}: ${x.Message}`);

        const fixAllItem = vscode.l10n.t('Fix all issues');
        if (scope === protocol.FixAllScope.Document) {
            targets = [fixAllItem, ...targets];
        }

        const action = await vscode.window.showQuickPick(targets, {
            matchOnDescription: true,
            placeHolder: vscode.l10n.t(`Select fix all action`),
        });

        if (action === undefined) {
            return;
        }

        let filter: FixAllItem[] | undefined;
        if (action !== fixAllItem) {
            const actionTokens = action.split(':');
            filter = [{ Id: actionTokens[0], Message: actionTokens[1] }];
        }

        await this.applyFixes(fileName, scope, filter);
    }

    private async applyFixes(
        fileName: string,
        scope: FixAllScope,
        fixAllFilter: FixAllItem[] | undefined
    ): Promise<void> {
        const response = await serverUtils.runFixAll(this.server, {
            FileName: fileName,
            Scope: scope,
            FixAllFilter: fixAllFilter,
            WantsAllCodeActionOperations: true,
            WantsTextChanges: true,
            ApplyChanges: false,
        });

        if (response) {
            await buildEditForResponse(response.Changes, this._languageMiddlewareFeature, CancellationToken.None);
        }
    }
}
