/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import DefinitionProvider from './features/definitionProvider';
import CodeLensProvider from './features/codeLensProvider';
import DocumentHighlightProvider from './features/documentHighlightProvider';
import DocumentSymbolProvider from './features/documentSymbolProvider';
import CodeActionProvider from './features/codeActionProvider';
import ReferenceProvider from './features/referenceProvider';
import HoverProvider from './features/hoverProvider';
import RenameProvider from './features/renameProvider';
import FormatProvider from './features/formattingEditProvider';
import CompletionItemProvider from './features/completionItemProvider';
import WorkspaceSymbolProvider from './features/workspaceSymbolProvider';
import reportDiagnostics, {Advisor} from './features/diagnosticsProvider';
import SignatureHelpProvider from './features/signatureHelpProvider';
import registerCommands from './features/commands';
import {StdioOmnisharpServer} from './omnisharp/server';
import {readOptions} from './omnisharp/options';
import forwardChanges from './features/changeForwarding';
import reportStatus from './features/status';
import * as coreclrdebug from './coreclr-debug/activate';
import {addAssetsIfNecessary, AddAssetResult} from './assets';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import {DefinitionMetadataDocumentProvider} from './features/definitionMetadataDocumentProvider';
import * as util from './common';
import { Logger } from './logger';
import { PackageManager, Status } from './packages';
import { PlatformInformation } from './platform';

export function activate(context: vscode.ExtensionContext): any {

    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);

    util.setExtensionPath(extension.extensionPath);

    ensureRuntimeDependencies(extension)
        .then(() => {
            // activate language services
            activateLanguageServices(context, reporter);

            // activate coreclr-debug
            coreclrdebug.activate(context, reporter);
        });
}

function activateLanguageServices(context: vscode.ExtensionContext, reporter: TelemetryReporter) {
    const documentSelector: vscode.DocumentSelector = {
        language: 'csharp',
        scheme: 'file' // only files from disk
    };

    const server = new StdioOmnisharpServer(reporter);
    const advisor = new Advisor(server); // create before server is started
    const disposables: vscode.Disposable[] = [];
    const localDisposables: vscode.Disposable[] = [];

    disposables.push(server.onServerStart(() => {
        // register language feature provider on start
        const definitionMetadataDocumentProvider = new DefinitionMetadataDocumentProvider();
        definitionMetadataDocumentProvider.register();
        localDisposables.push(definitionMetadataDocumentProvider);

        localDisposables.push(vscode.languages.registerDefinitionProvider(documentSelector, new DefinitionProvider(server, definitionMetadataDocumentProvider)));
        localDisposables.push(vscode.languages.registerCodeLensProvider(documentSelector, new CodeLensProvider(server)));
        localDisposables.push(vscode.languages.registerDocumentHighlightProvider(documentSelector, new DocumentHighlightProvider(server)));
        localDisposables.push(vscode.languages.registerDocumentSymbolProvider(documentSelector, new DocumentSymbolProvider(server)));
        localDisposables.push(vscode.languages.registerReferenceProvider(documentSelector, new ReferenceProvider(server)));
        localDisposables.push(vscode.languages.registerHoverProvider(documentSelector, new HoverProvider(server)));
        localDisposables.push(vscode.languages.registerRenameProvider(documentSelector, new RenameProvider(server)));
        localDisposables.push(vscode.languages.registerDocumentRangeFormattingEditProvider(documentSelector, new FormatProvider(server)));
        localDisposables.push(vscode.languages.registerOnTypeFormattingEditProvider(documentSelector, new FormatProvider(server), '}', ';'));
        localDisposables.push(vscode.languages.registerCompletionItemProvider(documentSelector, new CompletionItemProvider(server), '.', '<'));
        localDisposables.push(vscode.languages.registerWorkspaceSymbolProvider(new WorkspaceSymbolProvider(server)));
        localDisposables.push(vscode.languages.registerSignatureHelpProvider(documentSelector, new SignatureHelpProvider(server), '(', ','));
        const codeActionProvider = new CodeActionProvider(server);
        localDisposables.push(codeActionProvider);
        localDisposables.push(vscode.languages.registerCodeActionsProvider(documentSelector, codeActionProvider));
        localDisposables.push(reportDiagnostics(server, advisor));
        localDisposables.push(forwardChanges(server));
    }));

    disposables.push(server.onServerStop(() => {
        // remove language feature providers on stop
        vscode.Disposable.from(...localDisposables).dispose();
    }));

    disposables.push(registerCommands(server, context.extensionPath));
    disposables.push(reportStatus(server));

    if (!context.workspaceState.get<boolean>('assetPromptDisabled')) {
        disposables.push(server.onServerStart(() => {
            // Update or add tasks.json and launch.json
            addAssetsIfNecessary(server).then(result => {
                if (result === AddAssetResult.Disable) {
                    context.workspaceState.update('assetPromptDisabled', true);
                }
            });
        }));
    }

    // read and store last solution or folder path
    disposables.push(server.onBeforeServerStart(path => context.workspaceState.update('lastSolutionPathOrFolder', path)));

    const options = readOptions();
    if (options.autoStart) {
        server.autoStart(context.workspaceState.get<string>('lastSolutionPathOrFolder'));
    }

    // stop server on deactivate
    disposables.push(new vscode.Disposable(() => {
        advisor.dispose();
        server.stop();
    }));

    context.subscriptions.push(...disposables);
}

function ensureRuntimeDependencies(extension: vscode.Extension<any>): Promise<void> {
    return util.lockFileExists().then(exists => {
        if (!exists) {
            return installRuntimeDependencies(extension);
        }
    });
}

function installRuntimeDependencies(extension: vscode.Extension<any>): Promise<void> {
    let channel = vscode.window.createOutputChannel('C#');
    channel.show();

    let logger = new Logger(text => channel.append(text));
    logger.appendLine('Updating C# dependencies...');

    let statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    let status: Status = {
        setMessage: text => {
            statusItem.text = text;
            statusItem.show();
        },
        setDetail: text => {
            statusItem.tooltip = text;
            statusItem.show();
        }
    }

    let platformInfo: PlatformInformation;
    let packageManager: PackageManager;
    let installationStage = 'getPlatformInfo';
    let errorMessage = '';

    return PlatformInformation.GetCurrent()
        .then(info => {
            platformInfo = info;
            packageManager = new PackageManager(info, extension.packageJSON);
            logger.appendLine();

            installationStage = 'downloadPackages';
            return packageManager.DownloadPackages(logger, status);
        })
        .then(() => {
            logger.appendLine();

            installationStage = 'installPackages';
            return packageManager.InstallPackages(logger, status);
        })
        .then(() => {
            installationStage = 'touchLockFile';
            return util.touchLockFile();
        })
        .catch(error => {
            errorMessage = error.toString();
            logger.appendLine(`Failed at stage: ${installationStage}`);
            logger.appendLine(errorMessage);
        })
        .then(() => {
            logger.appendLine();
            installationStage = '';
            logger.appendLine('Finished');

            // TODO: Send telemetry event

            statusItem.dispose();
        });
}
