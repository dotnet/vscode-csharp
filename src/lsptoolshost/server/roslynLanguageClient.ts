/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CancellationToken, MessageSignature } from 'vscode-jsonrpc';
import { LanguageClient, ServerOptions, State } from 'vscode-languageclient/node';
import { ErrorHandler, LanguageClientOptions } from 'vscode-languageclient';
import CompositeDisposable from '../../compositeDisposable';
import { IDisposable } from '../../disposable';
import { languageServerOptions } from '../../shared/options';
import { RoslynLspErrorCodes } from './roslynProtocol';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';

/**
 * Implementation of the base LanguageClient type that allows for additional items to be disposed of
 * when the base LanguageClient instance is disposed.
 */
export class RoslynLanguageClient extends LanguageClient {
    private readonly _disposables: CompositeDisposable;
    private readonly _csharpOutputWindow: vscode.OutputChannel;

    /**
     * Tracks if we've shown a connection close notification for the server session to
     * prevent notification spam when the server crashes.
     * This is reset when the server restarts.
     */
    private _hasShownConnectionClose = false;

    constructor(
        id: string,
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
        csharpOutputWindow: vscode.OutputChannel,
        forceDebug?: boolean
    ) {
        super(id, name, serverOptions, clientOptions, forceDebug);

        this._disposables = new CompositeDisposable();
        this._csharpOutputWindow = csharpOutputWindow;

        this.registerStateChangeHandler();
    }

    private registerStateChangeHandler() {
        this.onDidChangeState((e) => {
            if (e.newState === State.Running) {
                this._hasShownConnectionClose = false;
            }
        });
    }

    override async dispose(timeout?: number | undefined): Promise<void> {
        this._disposables.dispose();
        return super.dispose(timeout);
    }

    override handleFailedRequest<T>(
        type: MessageSignature,
        token: CancellationToken | undefined,
        error: any,
        defaultValue: T,
        showNotification?: boolean
    ) {
        if (error.code == RoslynLspErrorCodes.nonFatalRequestFailure) {
            return super.handleFailedRequest(type, token, error, defaultValue, false);
        }

        // Temporarily allow LSP error toasts to be suppressed if configured.
        // There are a few architectural issues preventing us from solving some of the underlying problems,
        // for example Razor cohosting to fix text mismatch issues and unification of serialization libraries
        // to fix URI identification issues.  Once resolved, we should remove this option.
        //
        // See also https://github.com/microsoft/vscode-dotnettools/issues/722
        // https://github.com/dotnet/vscode-csharp/issues/6973
        // https://github.com/microsoft/vscode-languageserver-node/issues/1449
        if (languageServerOptions.suppressLspErrorToasts) {
            return super.handleFailedRequest(type, token, error, defaultValue, false);
        }

        return super.handleFailedRequest(type, token, error, defaultValue, showNotification);
    }

    /**
     * The default error handler handles server crashes and connection lost issues.
     * This is not to be confused with the override of the error method specifically, which handles
     * display any error (including both request failures and critical errors from here).
     */
    override createDefaultErrorHandler(maxRestartCount?: number): ErrorHandler {
        const defaultHandler = super.createDefaultErrorHandler(maxRestartCount);

        // the error function here is called for errors writing or reading from the connection.  the closed function is called when the connection is closed.
        // note that both of these can be called in the crash scenario, so we de-dupe notifications here.
        return {
            error: async (error, message, count) => {
                this.showCrashNotification();
                // The default error handler will determine if the server should be restarted.  We just want to ensure a good notification, so we defer to the default handler for that logic.
                const defaultResult = await defaultHandler.error(error, message, count);
                // The handled property indicates to the default handling that we've displayed our own notification.
                defaultResult.handled = true;
                return defaultResult;
            },
            closed: async () => {
                this.showCrashNotification();
                const defaultResult = await defaultHandler.closed();
                defaultResult.handled = true;
                return defaultResult;
            },
        };
    }

    /**
     * Handles displaying any errors reported by the language client.  This is called for both standard request failures
     * as well as critical server errors (e.g. crashes).
     */
    override error(message: string, data?: any, showNotification?: boolean | 'force'): void {
        // When the server crashes, we may get single method request failures due to the closed connection.
        // To avoid spamming users, don't display error toasts for these.
        if (this._hasShownConnectionClose) {
            showNotification = false;
        }

        // We have an error but we're not in a crash scenario.  Override the default error toast with one that includes the report issue command.
        if (showNotification) {
            showNotification = false;
            showErrorMessageWithOptions(
                vscode,
                message,
                { modal: false },
                {
                    title: vscode.l10n.t('Go to output'),
                    action: async () => {
                        this._csharpOutputWindow.show(true);
                    },
                },
                {
                    title: vscode.l10n.t('Report Issue'),
                    command: 'csharp.reportIssue',
                }
            );
        }

        super.error(message, data, showNotification);
    }

    /**
     * Adds a disposable that should be disposed of when the LanguageClient instance gets disposed.
     */
    public addDisposable(disposable: IDisposable) {
        this._disposables.add(disposable);
    }

    private showCrashNotification() {
        if (this._hasShownConnectionClose) {
            return;
        }

        this._hasShownConnectionClose = true;
        showErrorMessageWithOptions(
            vscode,
            vscode.l10n.t('The C# language server has crashed. Restart extensions to re-enable C# functionality.'),
            { modal: false },
            {
                title: vscode.l10n.t('Restart extensions'),
                command: 'workbench.action.restartExtensionHost',
            },
            {
                title: vscode.l10n.t('Report Issue'),
                command: 'csharp.reportIssue',
            }
        );
    }
}
