/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as utils from './utils';
import * as vscode from 'vscode';
import { AddAssetResult, addAssetsIfNecessary } from '../assets';
import reportDiagnostics, { Advisor } from '../features/diagnosticsProvider';
import { safeLength, sum } from '../common';
import { CSharpConfigurationProvider } from '../configurationProvider';
import CodeActionProvider from '../features/codeActionProvider';
import CodeLensProvider from '../features/codeLensProvider';
import CompletionProvider, { CompletionAfterInsertCommand } from '../features/completionProvider';
import DefinitionMetadataDocumentProvider from '../features/definitionMetadataDocumentProvider';
import DefinitionProvider from '../features/definitionProvider';
import DocumentHighlightProvider from '../features/documentHighlightProvider';
import DocumentSymbolProvider from '../features/documentSymbolProvider';
import FormatProvider from '../features/formattingEditProvider';
import HoverProvider from '../features/hoverProvider';
import ImplementationProvider from '../features/implementationProvider';
import { OmniSharpServer } from './server';
import ReferenceProvider from '../features/referenceProvider';
import RenameProvider from '../features/renameProvider';
import SignatureHelpProvider from '../features/signatureHelpProvider';
import TestManager from '../features/dotnetTest';
import WorkspaceSymbolProvider from '../features/workspaceSymbolProvider';
import forwardChanges from '../features/changeForwarding';
import registerCommands from '../features/commands';
import { PlatformInformation } from '../platform';
import { ProjectJsonDeprecatedWarning, OmnisharpStart, RazorDevModeActive } from './loggingEvents';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from '../NetworkSettings';
import CompositeDisposable from '../CompositeDisposable';
import Disposable from '../Disposable';
import OptionProvider from '../observers/OptionProvider';
import trackVirtualDocuments from '../features/virtualDocumentTracker';
import { StructureProvider } from '../features/structureProvider';
import { OmniSharpMonoResolver } from './OmniSharpMonoResolver';
import { getMonoVersion } from '../utils/getMonoVersion';
import { FixAllProvider } from '../features/fixAllProvider';
import { LanguageMiddlewareFeature } from './LanguageMiddlewareFeature';
import SemanticTokensProvider from '../features/semanticTokensProvider';

export interface ActivationResult {
    readonly server: OmniSharpServer;
    readonly advisor: Advisor;
    readonly testManager: TestManager;
}

export async function activate(context: vscode.ExtensionContext, packageJSON: any, platformInfo: PlatformInformation, provider: NetworkSettingsProvider, eventStream: EventStream, optionProvider: OptionProvider, extensionPath: string) {
    const documentSelector: vscode.DocumentSelector = {
        language: 'csharp',
    };

    const options = optionProvider.GetLatestOptions();
    let omnisharpMonoResolver = new OmniSharpMonoResolver(getMonoVersion);
    const decompilationAuthorized = context.workspaceState.get<boolean | undefined>("decompilationAuthorized") ?? false;
    const server = new OmniSharpServer(vscode, provider, packageJSON, platformInfo, eventStream, optionProvider, extensionPath, omnisharpMonoResolver, decompilationAuthorized);
    const advisor = new Advisor(server, optionProvider); // create before server is started
    const disposables = new CompositeDisposable();
    const languageMiddlewareFeature = new LanguageMiddlewareFeature();
    languageMiddlewareFeature.register();
    disposables.add(languageMiddlewareFeature);
    let localDisposables: CompositeDisposable;
    const testManager = new TestManager(server, eventStream, languageMiddlewareFeature);
    const completionProvider = new CompletionProvider(server, languageMiddlewareFeature);

    disposables.add(server.onServerStart(() => {
        // register language feature provider on start
        localDisposables = new CompositeDisposable();
        const definitionMetadataDocumentProvider = new DefinitionMetadataDocumentProvider();
        definitionMetadataDocumentProvider.register();
        localDisposables.add(definitionMetadataDocumentProvider);
        const definitionProvider = new DefinitionProvider(server, definitionMetadataDocumentProvider, languageMiddlewareFeature);
        localDisposables.add(vscode.languages.registerDefinitionProvider(documentSelector, definitionProvider));
        localDisposables.add(vscode.languages.registerDefinitionProvider({ scheme: definitionMetadataDocumentProvider.scheme }, definitionProvider));
        localDisposables.add(vscode.languages.registerImplementationProvider(documentSelector, new ImplementationProvider(server, languageMiddlewareFeature)));
        localDisposables.add(vscode.languages.registerCodeLensProvider(documentSelector, new CodeLensProvider(server, testManager, optionProvider, languageMiddlewareFeature)));
        localDisposables.add(vscode.languages.registerDocumentHighlightProvider(documentSelector, new DocumentHighlightProvider(server, languageMiddlewareFeature)));
        localDisposables.add(vscode.languages.registerDocumentSymbolProvider(documentSelector, new DocumentSymbolProvider(server, languageMiddlewareFeature)));
        localDisposables.add(vscode.languages.registerReferenceProvider(documentSelector, new ReferenceProvider(server, languageMiddlewareFeature)));
        localDisposables.add(vscode.languages.registerHoverProvider(documentSelector, new HoverProvider(server, languageMiddlewareFeature)));
        localDisposables.add(vscode.languages.registerRenameProvider(documentSelector, new RenameProvider(server, languageMiddlewareFeature)));
        if (options.useFormatting) {
            localDisposables.add(vscode.languages.registerDocumentRangeFormattingEditProvider(documentSelector, new FormatProvider(server, languageMiddlewareFeature)));
            localDisposables.add(vscode.languages.registerOnTypeFormattingEditProvider(documentSelector, new FormatProvider(server, languageMiddlewareFeature), '}', '/', '\n', ';'));
        }
        localDisposables.add(vscode.languages.registerCompletionItemProvider(documentSelector, completionProvider, '.', ' '));
        localDisposables.add(vscode.commands.registerCommand(CompletionAfterInsertCommand, async (item) => completionProvider.afterInsert(item)));
        localDisposables.add(vscode.languages.registerWorkspaceSymbolProvider(new WorkspaceSymbolProvider(server, optionProvider, languageMiddlewareFeature)));
        localDisposables.add(vscode.languages.registerSignatureHelpProvider(documentSelector, new SignatureHelpProvider(server, languageMiddlewareFeature), '(', ','));
        // Since the CodeActionProvider registers its own commands, we must instantiate it and add it to the localDisposables
        // so that it will be cleaned up if OmniSharp is restarted.
        const codeActionProvider = new CodeActionProvider(server, optionProvider, languageMiddlewareFeature);
        localDisposables.add(codeActionProvider);
        localDisposables.add(vscode.languages.registerCodeActionsProvider(documentSelector, codeActionProvider));
        // Since the FixAllProviders registers its own commands, we must instantiate it and add it to the localDisposables
        // so that it will be cleaned up if OmniSharp is restarted.
        const fixAllProvider = new FixAllProvider(server, languageMiddlewareFeature);
        localDisposables.add(fixAllProvider);
        localDisposables.add(vscode.languages.registerCodeActionsProvider(documentSelector, fixAllProvider));
        localDisposables.add(reportDiagnostics(server, advisor, languageMiddlewareFeature));
        localDisposables.add(forwardChanges(server));
        localDisposables.add(trackVirtualDocuments(server, eventStream));
        localDisposables.add(vscode.languages.registerFoldingRangeProvider(documentSelector, new StructureProvider(server, languageMiddlewareFeature)));

        const semanticTokensProvider = new SemanticTokensProvider(server, optionProvider, languageMiddlewareFeature);
        localDisposables.add(vscode.languages.registerDocumentSemanticTokensProvider(documentSelector, semanticTokensProvider, semanticTokensProvider.getLegend()));
        localDisposables.add(vscode.languages.registerDocumentRangeSemanticTokensProvider(documentSelector, semanticTokensProvider, semanticTokensProvider.getLegend()));
    }));

    disposables.add(server.onServerStop(() => {
        // remove language feature providers on stop
        if (localDisposables) {
            localDisposables.dispose();
        }
        localDisposables = null;
    }));

    disposables.add(registerCommands(context, server, platformInfo, eventStream, optionProvider, omnisharpMonoResolver, packageJSON, extensionPath));

    if (!context.workspaceState.get<boolean>('assetPromptDisabled')) {
        disposables.add(server.onServerStart(() => {
            // Update or add tasks.json and launch.json
            addAssetsIfNecessary(server).then(result => {
                if (result === AddAssetResult.Disable) {
                    context.workspaceState.update('assetPromptDisabled', true);
                }
            });
        }));
    }

    // After server is started (and projects are loaded), check to see if there are
    // any project.json projects if the suppress option is not set. If so, notify the user about migration.
    let csharpConfig = vscode.workspace.getConfiguration('csharp');
    if (!csharpConfig.get<boolean>('suppressProjectJsonWarning')) {
        disposables.add(server.onServerStart(() => {
            utils.requestWorkspaceInformation(server)
                .then(workspaceInfo => {
                    if (workspaceInfo.DotNet && workspaceInfo.DotNet.Projects.length > 0) {
                        const shortMessage = 'project.json is no longer a supported project format for .NET Core applications.';
                        const moreDetailItem: vscode.MessageItem = { title: 'More Detail' };
                        vscode.window.showWarningMessage(shortMessage, moreDetailItem)
                            .then(item => {
                                eventStream.post(new ProjectJsonDeprecatedWarning());
                            });
                    }
                });
        }));
    }

    // Send telemetry about the sorts of projects the server was started on.
    disposables.add(server.onServerStart(() => {
        let measures: { [key: string]: number } = {};

        utils.requestWorkspaceInformation(server)
            .then(workspaceInfo => {
                if (workspaceInfo.DotNet && workspaceInfo.DotNet.Projects.length > 0) {
                    measures['projectjson.projectcount'] = workspaceInfo.DotNet.Projects.length;
                    measures['projectjson.filecount'] = sum(workspaceInfo.DotNet.Projects, p => safeLength(p.SourceFiles));
                }

                if (workspaceInfo.MsBuild && workspaceInfo.MsBuild.Projects.length > 0) {
                    measures['msbuild.projectcount'] = workspaceInfo.MsBuild.Projects.length;
                    measures['msbuild.filecount'] = sum(workspaceInfo.MsBuild.Projects, p => safeLength(p.SourceFiles));
                    measures['msbuild.unityprojectcount'] = sum(workspaceInfo.MsBuild.Projects, p => p.IsUnityProject ? 1 : 0);
                    measures['msbuild.netcoreprojectcount'] = sum(workspaceInfo.MsBuild.Projects, p => utils.isNetCoreProject(p) ? 1 : 0);
                }

                // TODO: Add measurements for script.

                eventStream.post(new OmnisharpStart('OmniSharp.Start', measures));
            });
    }));

    disposables.add(server.onBeforeServerStart(path => {
        if (options.razorDevMode) {
            eventStream.post(new RazorDevModeActive());
        }

        // read and store last solution or folder path
        context.workspaceState.update('lastSolutionPathOrFolder', path);
    }));

    if (options.autoStart) {
        server.autoStart(context.workspaceState.get<string>('lastSolutionPathOrFolder'));
    }

    // stop server on deactivate
    disposables.add(new Disposable(() => {
        testManager.dispose();
        advisor.dispose();
        server.stop();
    }));

    // Register ConfigurationProvider
    disposables.add(vscode.debug.registerDebugConfigurationProvider('coreclr', new CSharpConfigurationProvider(server)));

    context.subscriptions.push(disposables);

    return new Promise<ActivationResult>(resolve =>
        server.onServerStart(e =>
            resolve({ server, advisor, testManager })));
}
