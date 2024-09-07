/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as protocol from '../protocol';
import * as utils from '../../common';
import { CancellationToken } from '../../vscodeAdapter';
import { ChildProcess, exec } from 'child_process';
import { LaunchTarget } from '../../shared/launchTarget';
import { ReadLine, createInterface } from 'readline';
import { Request, RequestQueueCollection } from '../requestQueue';
import { EventEmitter } from 'events';
import { omnisharpOptions } from '../../shared/options';
import { PlatformInformation } from '../../shared/platform';
import { launchOmniSharp } from '../launcher';
import { setTimeout } from 'timers';
import * as ObservableEvents from '../loggingEvents';
import { EventStream } from '../../eventStream';
import CompositeDisposable from '../../compositeDisposable';
import Disposable from '../../disposable';
import { IHostExecutableResolver } from '../../shared/constants/IHostExecutableResolver';
import { removeBOMFromBuffer, removeBOMFromString } from '../../utils/removeBom';
import { IEngine } from './IEngine';
import { Events, OmniSharpServer } from '../server';
import DefinitionMetadataDocumentProvider from '../features/definitionMetadataDocumentProvider';
import SourceGeneratedDocumentProvider from '../features/sourceGeneratedDocumentProvider';
import * as vscode from 'vscode';
import OmniSharpCodeLensProvider from '../features/codeLensProvider';
import OmniSharpDocumentHighlightProvider from '../features/documentHighlightProvider';
import OmniSharpDocumentSymbolProvider from '../features/documentSymbolProvider';
import OmniSharpHoverProvider from '../features/hoverProvider';
import OmniSharpRenameProvider from '../features/renameProvider';
import OmniSharpFormatProvider from '../features/formattingEditProvider';
import OmniSharpWorkspaceSymbolProvider from '../features/workspaceSymbolProvider';
import OmniSharpSignatureHelpProvider from '../features/signatureHelpProvider';
import { OmniSharpFixAllProvider } from '../features/fixAllProvider';
import OmniSharpCompletionProvider, { CompletionAfterInsertCommand } from '../features/completionProvider';
import OmniSharpReferenceProvider from '../features/referenceProvider';
import OmniSharpImplementationProvider from '../features/implementationProvider';
import OmniSharpSemanticTokensProvider from '../features/semanticTokensProvider';
import OmniSharpInlayHintProvider from '../features/inlayHintProvider';
import fileOpenClose from '../features/fileOpenCloseProvider';
import trackVirtualDocuments from '../features/virtualDocumentTracker';
import OmniSharpCodeActionProvider from '../features/codeActionProvider';
import forwardChanges from '../features/changeForwarding';
import OmniSharpDefinitionProvider from '../features/definitionProvider';
import reportDiagnostics, { Advisor } from '../features/diagnosticsProvider';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';
import TestManager from '../features/dotnetTest';
import { OmniSharpStructureProvider } from '../features/structureProvider';

export class StdioEngine implements IEngine {
    private static _nextId = 1;
    private _readLine: ReadLine | undefined;
    private _disposables: CompositeDisposable | undefined;
    private _serverProcess: ChildProcess | undefined;
    private _eventBus: EventEmitter;
    private _requestQueue: RequestQueueCollection;

    constructor(
        eventBus: EventEmitter,
        private eventStream: EventStream,
        private platformInfo: PlatformInformation,
        private monoResolver: IHostExecutableResolver,
        private dotnetResolver: IHostExecutableResolver,
        disposables: CompositeDisposable
    ) {
        this._eventBus = eventBus;
        this._disposables = disposables;
        this._requestQueue = new RequestQueueCollection(this.eventStream, 8, (request) => this._makeRequest(request));
    }

    async registerProviders(
        server: OmniSharpServer,
        languageMiddlewareFeature: LanguageMiddlewareFeature,
        eventStream: EventStream,
        advisor: Advisor,
        testManager: TestManager
    ): Promise<Disposable> {
        const documentSelector: vscode.DocumentSelector = {
            language: 'csharp',
        };

        // register language feature provider on start
        const localDisposables = new CompositeDisposable();

        const definitionMetadataDocumentProvider = new DefinitionMetadataDocumentProvider();
        definitionMetadataDocumentProvider.register();
        localDisposables.add(definitionMetadataDocumentProvider);

        const sourceGeneratedDocumentProvider = new SourceGeneratedDocumentProvider(server);
        sourceGeneratedDocumentProvider.register();
        localDisposables.add(sourceGeneratedDocumentProvider);

        localDisposables.add(
            vscode.languages.registerCodeLensProvider(
                documentSelector,
                new OmniSharpCodeLensProvider(server, testManager, languageMiddlewareFeature)
            )
        );
        localDisposables.add(
            vscode.languages.registerDocumentHighlightProvider(
                documentSelector,
                new OmniSharpDocumentHighlightProvider(server, languageMiddlewareFeature)
            )
        );
        localDisposables.add(
            vscode.languages.registerDocumentSymbolProvider(
                documentSelector,
                new OmniSharpDocumentSymbolProvider(server, languageMiddlewareFeature)
            )
        );
        localDisposables.add(
            vscode.languages.registerHoverProvider(
                documentSelector,
                new OmniSharpHoverProvider(server, languageMiddlewareFeature)
            )
        );
        localDisposables.add(
            vscode.languages.registerRenameProvider(
                documentSelector,
                new OmniSharpRenameProvider(server, languageMiddlewareFeature)
            )
        );
        if (omnisharpOptions.useFormatting) {
            localDisposables.add(
                vscode.languages.registerDocumentRangeFormattingEditProvider(
                    documentSelector,
                    new OmniSharpFormatProvider(server, languageMiddlewareFeature)
                )
            );
            localDisposables.add(
                vscode.languages.registerOnTypeFormattingEditProvider(
                    documentSelector,
                    new OmniSharpFormatProvider(server, languageMiddlewareFeature),
                    '}',
                    '/',
                    '\n',
                    ';'
                )
            );
        }
        const completionProvider = new OmniSharpCompletionProvider(server, languageMiddlewareFeature);
        localDisposables.add(
            vscode.languages.registerCompletionItemProvider(documentSelector, completionProvider, '.', ' ')
        );
        localDisposables.add(
            vscode.commands.registerCommand(CompletionAfterInsertCommand, async (item, document) =>
                completionProvider.afterInsert(item, document)
            )
        );
        localDisposables.add(
            vscode.languages.registerWorkspaceSymbolProvider(
                new OmniSharpWorkspaceSymbolProvider(server, languageMiddlewareFeature, sourceGeneratedDocumentProvider)
            )
        );
        localDisposables.add(
            vscode.languages.registerSignatureHelpProvider(
                documentSelector,
                new OmniSharpSignatureHelpProvider(server, languageMiddlewareFeature),
                '(',
                ','
            )
        );
        // Since the FixAllProviders registers its own commands, we must instantiate it and add it to the localDisposables
        // so that it will be cleaned up if OmniSharp is restarted.
        const fixAllProvider = new OmniSharpFixAllProvider(server, languageMiddlewareFeature);
        localDisposables.add(fixAllProvider);
        localDisposables.add(
            vscode.languages.registerCodeActionsProvider(
                documentSelector,
                fixAllProvider,
                OmniSharpFixAllProvider.metadata
            )
        );
        localDisposables.add(reportDiagnostics(server, advisor, languageMiddlewareFeature));

        const definitionProvider = new OmniSharpDefinitionProvider(
            server,
            definitionMetadataDocumentProvider,
            sourceGeneratedDocumentProvider,
            languageMiddlewareFeature
        );
        localDisposables.add(vscode.languages.registerTypeDefinitionProvider(documentSelector, definitionProvider));
        localDisposables.add(
            vscode.languages.registerTypeDefinitionProvider(
                { scheme: definitionMetadataDocumentProvider.scheme },
                definitionProvider
            )
        );
        localDisposables.add(vscode.languages.registerDefinitionProvider(documentSelector, definitionProvider));
        localDisposables.add(
            vscode.languages.registerDefinitionProvider(
                { scheme: definitionMetadataDocumentProvider.scheme },
                definitionProvider
            )
        );
        localDisposables.add(
            vscode.languages.registerReferenceProvider(
                documentSelector,
                new OmniSharpReferenceProvider(server, languageMiddlewareFeature, sourceGeneratedDocumentProvider)
            )
        );
        localDisposables.add(
            vscode.languages.registerImplementationProvider(
                documentSelector,
                new OmniSharpImplementationProvider(server, languageMiddlewareFeature)
            )
        );

        localDisposables.add(forwardChanges(server));
        // Since the CodeActionProvider registers its own commands, we must instantiate it and add it to the localDisposables
        // so that it will be cleaned up if OmniSharp is restarted.
        const codeActionProvider = new OmniSharpCodeActionProvider(server, languageMiddlewareFeature);
        localDisposables.add(codeActionProvider);
        localDisposables.add(vscode.languages.registerCodeActionsProvider(documentSelector, codeActionProvider));

        localDisposables.add(trackVirtualDocuments(server, eventStream));
        localDisposables.add(
            vscode.languages.registerFoldingRangeProvider(
                documentSelector,
                new OmniSharpStructureProvider(server, languageMiddlewareFeature)
            )
        );
        localDisposables.add(fileOpenClose(server));

        const semanticTokensProvider = new OmniSharpSemanticTokensProvider(server, languageMiddlewareFeature);
        localDisposables.add(
            vscode.languages.registerDocumentSemanticTokensProvider(
                documentSelector,
                semanticTokensProvider,
                semanticTokensProvider.getLegend()
            )
        );
        localDisposables.add(
            vscode.languages.registerDocumentRangeSemanticTokensProvider(
                documentSelector,
                semanticTokensProvider,
                semanticTokensProvider.getLegend()
            )
        );

        const inlayHintsProvider = new OmniSharpInlayHintProvider(server, languageMiddlewareFeature);
        localDisposables.add(vscode.languages.registerInlayHintsProvider(documentSelector, inlayHintsProvider));

        return localDisposables;
    }

    public async stop(): Promise<void> {
        let cleanupPromise: Promise<void>;

        if (this._serverProcess === undefined) {
            // nothing to kill
            cleanupPromise = Promise.resolve();
        } else {
            if (process.platform === 'win32') {
                // when killing a process in windows its child
                // processes are *not* killed but become root
                // processes. Therefore we use TASKKILL.EXE
                cleanupPromise = new Promise<void>((resolve, reject) => {
                    const killer = exec(`taskkill /F /T /PID ${this._serverProcess!.pid}`, (err, _stdout, _stderr) => {
                        if (err) {
                            return reject(err);
                        }
                    });

                    killer.on('exit', resolve);
                    killer.on('error', reject);
                });
            } else {
                // Kill Unix process and children
                cleanupPromise = utils.getUnixChildProcessIds(this._serverProcess.pid!).then((children) => {
                    for (const child of children) {
                        process.kill(child, 'SIGTERM');
                    }

                    this._serverProcess!.kill('SIGTERM');
                });
            }
        }

        const disposables = this._disposables;
        this._disposables = undefined;

        return cleanupPromise.then(() => {
            this._serverProcess = undefined;
            this._eventBus.emit(Events.ServerStop, this);
            if (disposables) {
                disposables.dispose();
            }
        });
    }

    public async waitForInitialize(): Promise<void> {
        while (!this._requestQueue.isEmpty()) {
            const p = new Promise((resolve) => setTimeout(resolve, 100));
            await p;
        }
    }

    public addListener<T = object>(event: string, listener: (e: T) => void): Disposable {
        this._eventBus.addListener(event, listener);
        return new Disposable(() => this._eventBus.removeListener(event, listener));
    }

    public async start(cwd: string, args: string[], launchTarget: LaunchTarget, launchPath: string): Promise<void> {
        const launchResult = await launchOmniSharp(
            cwd,
            args.concat('--encoding', 'utf-8'),
            launchPath,
            this.platformInfo,
            this.monoResolver,
            this.dotnetResolver
        );
        this.eventStream.post(
            new ObservableEvents.OmnisharpLaunch(
                launchResult.hostVersion ?? '',
                launchResult.hostPath ?? '',
                launchResult.hostIsMono,
                launchResult.command,
                launchResult.process.pid
            )
        );

        this._serverProcess = launchResult.process;
        if (this._serverProcess === undefined) {
            throw new Error('Server launch failed.');
        }

        this._serverProcess.stderr!.on('data', (data: Buffer) => {
            const trimData = removeBOMFromBuffer(data);
            if (trimData.length > 0) {
                this._fireEvent(Events.StdErr, trimData.toString());
            }
        });

        this._readLine = createInterface({
            input: this._serverProcess.stdout!,
            output: this._serverProcess.stdin!,
            terminal: false,
        });

        const promise = new Promise<void>((resolve, reject) => {
            // Bogus warning.
            // eslint-disable-next-line prefer-const
            let listener: Disposable;

            // Convert the timeout from the seconds to milliseconds, which is required by setTimeout().
            const timeoutDuration = omnisharpOptions.projectLoadTimeout * 1000;

            // timeout logic
            const handle = setTimeout(() => {
                if (listener) {
                    listener.dispose();
                }

                reject(
                    new Error(
                        "OmniSharp server load timed out. Use the 'omnisharp.projectLoadTimeout' setting to override the default delay (one minute)."
                    )
                );
            }, timeoutDuration);

            // handle started-event
            listener = this.addListener(Events.Started, (_) => {
                if (listener) {
                    listener.dispose();
                }

                clearTimeout(handle);
                resolve();
            });
        });

        const lineReceived = this._onLineReceived.bind(this);

        this._readLine.addListener('line', lineReceived);

        this._disposables?.add(
            new Disposable(() => {
                this._readLine?.removeListener('line', lineReceived);
            })
        );

        await promise;

        this._requestQueue.drain();
    }

    private _onLineReceived(line: string) {
        line = removeBOMFromString(line);

        if (line[0] !== '{') {
            this.eventStream.post(new ObservableEvents.OmnisharpServerMessage(line));
            return;
        }

        let packet: protocol.WireProtocol.Packet;
        try {
            packet = JSON.parse(line);
        } catch (err) {
            // This isn't JSON
            return;
        }

        if (!packet.Type) {
            // Bogus packet
            return;
        }

        switch (packet.Type) {
            case 'response':
                this._handleResponsePacket(<protocol.WireProtocol.ResponsePacket>packet);
                break;
            case 'event':
                this._handleEventPacket(<protocol.WireProtocol.EventPacket>packet);
                break;
            default:
                this.eventStream.post(
                    new ObservableEvents.OmnisharpServerMessage(`Unknown packet type: ${packet.Type}`)
                );
                break;
        }
    }

    private _handleResponsePacket(packet: protocol.WireProtocol.ResponsePacket) {
        const request = this._requestQueue.dequeue(packet.Command, packet.Request_seq);

        if (!request) {
            this.eventStream.post(
                new ObservableEvents.OmnisharpServerMessage(
                    `Received response for ${packet.Command} but could not find request.`
                )
            );
            return;
        }

        this.eventStream.post(
            new ObservableEvents.OmnisharpServerVerboseMessage(
                `handleResponse: ${packet.Command} (${packet.Request_seq})`
            )
        );

        if (packet.Success) {
            request.onSuccess(packet.Body);
        } else {
            request.onError(packet.Message || packet.Body);
        }

        this._requestQueue.drain();
    }

    private _handleEventPacket(packet: protocol.WireProtocol.EventPacket): void {
        if (packet.Event === 'log') {
            const entry = <{ LogLevel: string; Name: string; Message: string }>packet.Body;
            this.eventStream.post(
                new ObservableEvents.OmnisharpEventPacketReceived(entry.LogLevel, entry.Name, entry.Message)
            );
        } else {
            // fwd all other events
            this._fireEvent(packet.Event, packet.Body);
        }
    }

    private _fireEvent(event: string, args: any): void {
        this._eventBus.emit(event, args);
    }

    private _makeRequest(request: Request) {
        const id = StdioEngine._nextId++;

        const requestPacket: protocol.WireProtocol.RequestPacket = {
            Type: 'request',
            Seq: id,
            Command: request.command,
            Arguments: request.data,
        };

        this.eventStream.post(new ObservableEvents.OmnisharpRequestMessage(request, id));
        this._serverProcess?.stdin!.write(JSON.stringify(requestPacket) + '\n');
        return id;
    }

    public dispose() {
        this._disposables?.dispose();
    }

    // --- requests et al
    public async makeRequest<TResponse>(command: string, data?: any, token?: CancellationToken): Promise<TResponse> {
        let request: Request;

        const promise = new Promise<TResponse>((resolve, reject) => {
            request = {
                command,
                data,
                onSuccess: (value) => resolve(value),
                onError: (err) => reject(err),
            };

            this._requestQueue.enqueue(request);
        });

        if (token) {
            token.onCancellationRequested(() => {
                this._requestQueue.cancelRequest(request);
            });
        }

        return promise;
    }
}
