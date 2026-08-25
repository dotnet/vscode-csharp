/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
    ActiveDocumentLanguageSupport,
    ActiveDocumentLanguageSupportService as IActiveDocumentLanguageSupportService,
} from '../../csharpExtensionExports';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { shouldNotifyForMiscellaneousFile } from '../workspace/miscellaneousFileNotifier';

export class ActiveDocumentLanguageSupportService implements IActiveDocumentLanguageSupportService, vscode.Disposable {
    private readonly _onDidChangeEmitter = new vscode.EventEmitter<ActiveDocumentLanguageSupport | undefined>();
    private readonly _activeEditorSubscription: vscode.Disposable;
    private _projectContextSubscription: vscode.Disposable | undefined;
    private _current: ActiveDocumentLanguageSupport | undefined;
    private _isDisposed = false;

    constructor(languageServerPromise: Promise<RoslynLanguageServer>) {
        this._activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor(() => this.updateCurrent(undefined));

        void languageServerPromise.then((languageServer) => {
            if (this._isDisposed) {
                return;
            }

            this._projectContextSubscription = languageServer._projectContextService.onActiveFileContextChanged(
                (event) => {
                    const activeDocument = vscode.window.activeTextEditor?.document;
                    if (
                        event.document.uri.scheme !== 'file' ||
                        event.document.languageId !== 'csharp' ||
                        activeDocument?.uri.toString() !== event.document.uri.toString()
                    ) {
                        return;
                    }

                    this.updateCurrent({
                        documentUri: event.document.uri.toString(),
                        state: event.context._vs_is_miscellaneous
                            ? shouldNotifyForMiscellaneousFile(event, languageServer.state)
                                ? 'limited'
                                : 'unknown'
                            : event.context._vs_id
                              ? 'full'
                              : 'unknown',
                        projectLabels: event.context._vs_label ? [event.context._vs_label] : [],
                    });
                }
            );

            void languageServer._projectContextService.refresh();
        });
    }

    public get current(): ActiveDocumentLanguageSupport | undefined {
        return this._current;
    }

    public get onDidChange(): vscode.Event<ActiveDocumentLanguageSupport | undefined> {
        return this._onDidChangeEmitter.event;
    }

    public dispose(): void {
        this._isDisposed = true;
        this._activeEditorSubscription.dispose();
        this._projectContextSubscription?.dispose();
        this._onDidChangeEmitter.dispose();
    }

    private updateCurrent(value: ActiveDocumentLanguageSupport | undefined): void {
        this._current = value;
        this._onDidChangeEmitter.fire(value);
    }
}
