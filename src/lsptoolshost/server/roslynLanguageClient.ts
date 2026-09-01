/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
import { LanguageClient, ServerOptions } from 'vscode-languageclient/node';
import { CancellationToken, ErrorHandler, LanguageClientOptions, MessageSignature, State } from 'vscode-languageclient';
import CompositeDisposable from '../../compositeDisposable';
import { IDisposable } from '../../disposable';
import { languageServerOptions } from '../../shared/options';
import { RoslynLspErrorCodes } from './roslynProtocol';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';
import { ITelemetryReporter } from '../../shared/telemetryReporter';
import { TelemetryEventNames } from '../../shared/telemetryEventNames';

/**
 * How long to wait for the server process to be reaped after the connection closes.
 * The connection closing and the process exiting are separate events, and the exit normally follows
 * within a few milliseconds. This only elapses if the process is still alive (for example a protocol
 * error), in which case we report the generic crash message.
 */
const serverExitTimeoutMs = 1000;

/**
 * SIGKILL cannot be caught, blocked, or ignored, and the .NET runtime never raises it on itself -
 * fatal CLR errors (unhandled exceptions, stack overflow, Environment.FailFast) go through abort()
 * and surface as SIGABRT instead. So SIGKILL means the OS or another program terminated the server:
 * a Linux OOM killer, macOS Jetsam, a container memory limit, or `kill -9`.
 *
 * Other externally-originated signals such as SIGTERM are deliberately not treated this way. VS Code
 * and our own teardown can send them during an intentional shutdown, so reporting them as an external
 * kill risks blaming the user's environment for a normal stop.
 */
const externalTerminationSignal: NodeJS.Signals = 'SIGKILL';

/**
 * Implementation of the base LanguageClient type that allows for additional items to be disposed of
 * when the base LanguageClient instance is disposed.
 */
export class RoslynLanguageClient extends LanguageClient {
    private readonly _disposables: CompositeDisposable;
    private readonly _csharpOutputWindow: vscode.OutputChannel;
    private readonly _telemetryReporter: ITelemetryReporter;

    /**
     * Tracks if we've shown a connection close notification for the server session to
     * prevent notification spam when the server crashes.
     * This is reset when the server restarts.
     */
    private _hasShownConnectionClose = false;

    /**
     * The signal that killed the server process for the current session, captured when the connection
     * closes. Holding the resolved answer rather than the process itself means we do not keep a dead
     * process and its stdio buffers alive. Reset on restart so a previous session's exit is never
     * attributed to a later failure.
     */
    private _serverExitSignal: Promise<NodeJS.Signals | null> | undefined;

    constructor(
        id: string,
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
        telemetryReporter: ITelemetryReporter,
        csharpOutputWindow: vscode.OutputChannel,
        forceDebug?: boolean
    ) {
        super(id, name, serverOptions, clientOptions, forceDebug);

        this._disposables = new CompositeDisposable();
        this._csharpOutputWindow = csharpOutputWindow;
        this._telemetryReporter = telemetryReporter;

        this.registerStateChangeHandler();
    }

    private registerStateChangeHandler() {
        this.onDidChangeState((e) => {
            if (e.newState === State.Running) {
                this._hasShownConnectionClose = false;
                this._serverExitSignal = undefined;
            }
        });
    }

    override async dispose(timeout?: number | undefined): Promise<void> {
        this._disposables.dispose();
        return super.dispose(timeout);
    }

    protected override async handleConnectionClosed(): Promise<void> {
        // The base implementation drops its reference to the process before the close handler runs, so
        // start listening now. Clearing that reference does not unregister the listener, and the process
        // is normally reaped a few milliseconds later.
        this._serverExitSignal = getExitSignal(this.serverProcess);
        return super.handleConnectionClosed();
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

        // Set the guard before awaiting so the error and closed handlers cannot both get past it.
        this._hasShownConnectionClose = true;
        // The connection close captures the signal itself, since it clears the process reference first.
        // Reaching here without it means the connection errored while the process is still ours to read.
        void this.showCrashNotificationAsync(this._serverExitSignal ?? getExitSignal(this.serverProcess));
    }

    private async showCrashNotificationAsync(exitSignal: Promise<NodeJS.Signals | null>): Promise<void> {
        const signal = await exitSignal;
        const externallyTerminated = signal === externalTerminationSignal;

        this._telemetryReporter.sendTelemetryEvent(TelemetryEventNames.ServerCrash, {
            signal: signal ?? '',
            externallyTerminated: externallyTerminated.toString(),
        });

        this.showCrashNotificationCore(externallyTerminated);
    }

    private showCrashNotificationCore(externallyTerminated: boolean) {
        showErrorMessageWithOptions(
            vscode,
            externallyTerminated
                ? // The server did not fail on its own, so leading with a crash report or a dump would
                  // send the user down the wrong path. Name the likely external cause instead.
                  vscode.l10n.t(
                      'The C# language server was terminated by the operating system or another program rather than crashing. This is usually caused by running out of memory, a container memory limit, or another process stopping it. Restart extensions to re-enable C# functionality.'
                  )
                : vscode.l10n.t(
                      'The C# language server has crashed. Restart extensions to re-enable C# functionality.'
                  ),
            { modal: false },
            {
                title: vscode.l10n.t('Restart extensions'),
                command: 'workbench.action.restartExtensionHost',
            },
            {
                title: vscode.l10n.t('Report Issue'),
                action: async () => {
                    vscode.commands.executeCommand('csharp.reportIssue');
                    // Re-show the notification so the user can still restart extensions after reporting.
                    this.showCrashNotificationCore(externallyTerminated);
                },
            }
        );
    }
}

/**
 * Reports the signal that killed the server process, or null if it was not killed by one.
 * The connection close is observed a few milliseconds before the process is reaped, so wait briefly
 * for the exit instead of concluding that no signal was involved.
 */
async function getExitSignal(serverProcess: ChildProcess | undefined): Promise<NodeJS.Signals | null> {
    if (serverProcess === undefined) {
        return null;
    }

    // Node populates these once the process is reaped. If it already exited then 'exit' has fired and
    // will not fire again for a listener added now, so read the result directly.
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
        return serverProcess.signalCode;
    }

    return new Promise<NodeJS.Signals | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), serverExitTimeoutMs);
        serverProcess.once('exit', (_code, signal) => {
            clearTimeout(timeout);
            resolve(signal);
        });
    });
}
