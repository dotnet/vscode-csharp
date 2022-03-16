/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as serverUtils from '../omnisharp/utils';
import * as vscode from 'vscode';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import CompositeDisposable from '../CompositeDisposable';
import { InlayHint, InlayHintRequest, InlayHintResolve as InlayHintResolveRequest } from '../omnisharp/protocol';
import { fromVSCodeRange, toVSCodePosition } from '../omnisharp/typeConversion';

export default class CSharpInlayHintProvider extends AbstractProvider implements vscode.InlayHintsProvider {
    private readonly _onDidChangeInlayHints = new vscode.EventEmitter<void>();
    public readonly onDidChangeInlayHints = this._onDidChangeInlayHints.event;

    private readonly _hintsMap = new Map<vscode.InlayHint, InlayHint>();

    constructor(server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        this.addDisposables(new CompositeDisposable(
            this._onDidChangeInlayHints,
            vscode.workspace.onDidChangeTextDocument(e => {
                if (e.document.languageId === 'csharp') {
                    this._onDidChangeInlayHints.fire();
                }
            })));
    }

    async provideInlayHints(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken): Promise<vscode.InlayHint[]> {
        const request: InlayHintRequest = {
            Location: {
                FileName: document.fileName,
                Range: fromVSCodeRange(range)
            }
        };

        try {
            const hints = await serverUtils.getInlayHints(this._server, request, token);

            return hints.InlayHints.map((inlayHint): vscode.InlayHint => {
                const mappedHint = this.toVscodeHint(inlayHint);
                this._hintsMap.set(mappedHint, inlayHint);
                return mappedHint;
            });
        } catch (error) {
            return Promise.reject(`Problem invoking 'GetInlayHints' on OmniSharpServer: ${error}`);
        }
    }

    async resolveInlayHint?(hint: vscode.InlayHint, token: vscode.CancellationToken): Promise<vscode.InlayHint> {
        if (!this._hintsMap.has(hint)) {
            return Promise.reject(`Outdated inlay hint was requested to be resolved, aborting.`);
        }

        const request: InlayHintResolveRequest = { Hint: this._hintsMap.get(hint) };

        try {
            const result = await serverUtils.resolveInlayHints(this._server, request, token);
            return this.toVscodeHint(result);
        } catch (error) {
            return Promise.reject(`Problem invoking 'ResolveInlayHints' on OmniSharpServer: ${error}`);
        }
    }

    private toVscodeHint(inlayHint: InlayHint): vscode.InlayHint {
        return {
            label: inlayHint.Label,
            position: toVSCodePosition(inlayHint.Position),
            tooltip: new vscode.MarkdownString(inlayHint.Tooltip ?? "")
        };
    }
}
