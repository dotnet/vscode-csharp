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
import { ProjectContextChangeEvent } from './projectContextService';

export class ActiveDocumentLanguageSupportService implements IActiveDocumentLanguageSupportService, vscode.Disposable {
    private readonly _onDidChangeEmitter = new vscode.EventEmitter<ActiveDocumentLanguageSupport | undefined>();
    private readonly _activeEditorSubscription: vscode.Disposable;
    private readonly _outputChannel: vscode.LogOutputChannel | undefined;
    private _projectContextSubscription: vscode.Disposable | undefined;
    private _current: ActiveDocumentLanguageSupport | undefined;
    private _isDisposed = false;

    constructor(languageServerPromise: Promise<RoslynLanguageServer>, outputChannel?: vscode.LogOutputChannel) {
        this._activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor(() => this.updateCurrent(undefined));
        this._outputChannel = outputChannel;

        languageServerPromise
            .then(async (languageServer) => {
                if (this._isDisposed) {
                    return;
                }

                this._projectContextSubscription = languageServer._projectContextService.onActiveFileContextChanged(
                    (event: ProjectContextChangeEvent) => {
                        const activeDocumentUriString = vscode.window.activeTextEditor?.document?.uri.toString();
                        const eventDocumentUriString = event.document.uri.toString();
                        if (
                            event.document.uri.scheme !== 'file' ||
                            event.document.languageId !== 'csharp' ||
                            activeDocumentUriString !== eventDocumentUriString
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

                return languageServer._projectContextService.refresh();
            })
            .catch((error) => this._outputChannel?.error('ActiveDocumentLanguageSupport failed to initialize:', error));
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
        this._outputChannel?.debug('ActiveDocumentLanguageSupport changing to:', value);
        this._onDidChangeEmitter.fire(value);
    }
}
