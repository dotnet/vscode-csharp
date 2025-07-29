/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as serverUtils from '../utils';
import * as vscode from 'vscode';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../server';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';
import CompositeDisposable from '../../compositeDisposable';
import {
    InlayHint,
    InlayHintRequest,
    InlayHintResolve as InlayHintResolveRequest,
    LinePositionSpanTextChange,
} from '../protocol';
import { fromVSCodeRange, toVSCodePosition, toVSCodeTextEdit } from '../typeConversion';
import { isVirtualCSharpDocument } from './virtualDocumentTracker';

export default class OmniSharpInlayHintProvider extends AbstractProvider implements vscode.InlayHintsProvider {
    private readonly _onDidChangeInlayHints = new vscode.EventEmitter<void>();
    public readonly onDidChangeInlayHints = this._onDidChangeInlayHints.event;

    private readonly _hintsMap = new Map<vscode.InlayHint, InlayHint>();

    constructor(server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        this.addDisposables(
            new CompositeDisposable(
                this._onDidChangeInlayHints,
                vscode.workspace.onDidChangeTextDocument((e) => {
                    if (e.document.languageId === 'csharp') {
                        this._onDidChangeInlayHints.fire();
                    }
                })
            )
        );
    }

    async provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): Promise<vscode.InlayHint[]> {
        // Exclude documents from other schemes, such as those in the diff view.
        if (document.uri.scheme !== 'file') {
            return [];
        }

        if (isVirtualCSharpDocument(document)) {
            return [];
        }

        const request: InlayHintRequest = {
            Location: {
                FileName: document.fileName,
                Range: fromVSCodeRange(range),
            },
        };

        try {
            const hints = await serverUtils.getInlayHints(this._server, request, token);

            return hints.InlayHints.map((inlayHint): vscode.InlayHint => {
                const mappedHint = this.toVSCodeHint(inlayHint);
                this._hintsMap.set(mappedHint, inlayHint);
                return mappedHint;
            });
        } catch (error) {
            return Promise.reject(new Error(`Problem invoking 'GetInlayHints' on OmniSharpServer: ${error}`));
        }
    }

    async resolveInlayHint?(hint: vscode.InlayHint, token: vscode.CancellationToken): Promise<vscode.InlayHint> {
        const inlayHint = this._hintsMap.get(hint);
        if (inlayHint === undefined) {
            return Promise.reject(new Error(`Outdated inlay hint was requested to be resolved, aborting.`));
        }

        const request: InlayHintResolveRequest = { Hint: inlayHint };

        try {
            const result = await serverUtils.resolveInlayHints(this._server, request, token);
            return this.toVSCodeHint(result);
        } catch (error) {
            return Promise.reject(new Error(`Problem invoking 'ResolveInlayHints' on OmniSharpServer: ${error}`));
        }
    }

    private toVSCodeHint(inlayHint: InlayHint): vscode.InlayHint {
        return {
            label: inlayHint.Label,
            position: toVSCodePosition(inlayHint.Position),
            tooltip: new vscode.MarkdownString(inlayHint.Tooltip ?? ''),
            textEdits: toVSCodeTextEdits(inlayHint.TextEdits),
        };

        function toVSCodeTextEdits(textEdits: LinePositionSpanTextChange[] | undefined): vscode.TextEdit[] | undefined {
            return textEdits?.map(toVSCodeTextEdit) ?? undefined;
        }
    }
}
