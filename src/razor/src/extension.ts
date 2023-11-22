/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as vscodeapi from 'vscode';
import * as util from '../../common';
import { ExtensionContext } from 'vscode';
import { BlazorDebugConfigurationProvider } from './blazorDebug/blazorDebugConfigurationProvider';
import { CodeActionsHandler } from './codeActions/codeActionsHandler';
import { RazorCodeActionRunner } from './codeActions/razorCodeActionRunner';
import { RazorCodeLensProvider } from './codeLens/razorCodeLensProvider';
import { ColorPresentationHandler } from './colorPresentation/colorPresentationHandler';
import { ProvisionalCompletionOrchestrator } from './completion/provisionalCompletionOrchestrator';
import { RazorCompletionItemProvider } from './completion/razorCompletionItemProvider';
import { listenToConfigurationChanges } from './configurationChangeListener';
import { RazorCSharpFeature } from './csharp/razorCSharpFeature';
import { RazorDefinitionProvider } from './definition/razorDefinitionProvider';
import { ReportIssueCommand } from './diagnostics/reportIssueCommand';
import { RazorDocumentManager } from './document/razorDocumentManager';
import { RazorDocumentSynchronizer } from './document/razorDocumentSynchronizer';
import { DocumentColorHandler } from './documentColor/documentColorHandler';
import { RazorDocumentHighlightProvider } from './documentHighlight/razorDocumentHighlightProvider';
import { reportTelemetryForDocuments } from './documentTelemetryListener';
import { DynamicFileInfoHandler } from './dynamicFile/dynamicFileInfoHandler';
import { FoldingRangeHandler } from './folding/foldingRangeHandler';
import { FormattingHandler } from './formatting/formattingHandler';
import { HostEventStream } from './hostEventStream';
import { RazorHoverProvider } from './hover/razorHoverProvider';
import { RazorHtmlFeature } from './html/razorHtmlFeature';
import { IEventEmitterFactory } from './IEventEmitterFactory';
import { RazorImplementationProvider } from './implementation/razorImplementationProvider';
import { ProposedApisFeature } from './proposedApisFeature';
import { RazorLanguage } from './razorLanguage';
import { RazorLanguageConfiguration } from './razorLanguageConfiguration';
import { RazorLanguageServerClient } from './razorLanguageServerClient';
import { resolveRazorLanguageServerTrace } from './razorLanguageServerTraceResolver';
import { RazorLanguageServiceClient } from './razorLanguageServiceClient';
import { RazorLogger } from './razorLogger';
import { RazorReferenceProvider } from './reference/razorReferenceProvider';
import { RazorRenameProvider } from './rename/razorRenameProvider';
import { SemanticTokensRangeHandler } from './semantic/semanticTokensRangeHandler';
import { RazorSignatureHelpProvider } from './signatureHelp/razorSignatureHelpProvider';
import { TelemetryReporter as RazorTelemetryReporter } from './telemetryReporter';
import { RazorDiagnosticHandler } from './diagnostics/razorDiagnosticHandler';
import { RazorSimplifyMethodHandler } from './simplify/razorSimplifyMethodHandler';
import TelemetryReporter from '@vscode/extension-telemetry';
import { CSharpDevKitExports } from '../../csharpDevKitExports';
import { DotnetRuntimeExtensionResolver } from '../../lsptoolshost/dotnetRuntimeExtensionResolver';
import { PlatformInformation } from '../../shared/platform';
import { RazorLanguageServerOptions } from './razorLanguageServerOptions';
import { resolveRazorLanguageServerOptions } from './razorLanguageServerOptionsResolver';
import { RazorFormatNewFileHandler } from './formatNewFile/razorFormatNewFileHandler';

// We specifically need to take a reference to a particular instance of the vscode namespace,
// otherwise providers attempt to operate on the null extension.
export async function activate(
    vscodeType: typeof vscodeapi,
    context: ExtensionContext,
    languageServerDir: string,
    eventStream: HostEventStream,
    vscodeTelemetryReporter: TelemetryReporter,
    csharpDevkitExtension: vscode.Extension<CSharpDevKitExports> | undefined,
    platformInfo: PlatformInformation,
    enableProposedApis = false
) {
    const razorTelemetryReporter = new RazorTelemetryReporter(eventStream);
    const eventEmitterFactory: IEventEmitterFactory = {
        create: <T>() => new vscode.EventEmitter<T>(),
    };

    const languageServerTrace = resolveRazorLanguageServerTrace(vscodeType);
    const logger = new RazorLogger(eventEmitterFactory, languageServerTrace);

    try {
        const razorOptions: RazorLanguageServerOptions = resolveRazorLanguageServerOptions(
            vscodeType,
            languageServerDir,
            languageServerTrace,
            logger
        );

        const hostExecutableResolver = new DotnetRuntimeExtensionResolver(
            platformInfo,
            () => razorOptions.serverPath,
            logger.outputChannel,
            context.extensionPath
        );

        const dotnetInfo = await hostExecutableResolver.getHostExecutableInfo();
        const dotnetRuntimePath = path.dirname(dotnetInfo.path);

        // Take care to always run .NET processes on the runtime that we intend.
        // The dotnet.exe we point to should not go looking for other runtimes.
        const env: NodeJS.ProcessEnv = { ...process.env };
        env.DOTNET_ROOT = dotnetRuntimePath;
        env.DOTNET_MULTILEVEL_LOOKUP = '0';
        // Save user's DOTNET_ROOT env-var value so server can recover the user setting when needed
        env.DOTNET_ROOT_USER = process.env.DOTNET_ROOT ?? 'EMPTY';

        let telemetryExtensionDllPath = '';
        // Set up DevKit environment for telemetry
        if (csharpDevkitExtension) {
            await setupDevKitEnvironment(env, csharpDevkitExtension, logger);

            const telemetryExtensionPath = path.join(
                util.getExtensionPath(),
                '.razortelemetry',
                'Microsoft.VisualStudio.DevKit.Razor.dll'
            );
            if (await util.fileExists(telemetryExtensionPath)) {
                telemetryExtensionDllPath = telemetryExtensionPath;
            }
        }

        const languageServerClient = new RazorLanguageServerClient(
            vscodeType,
            languageServerDir,
            razorTelemetryReporter,
            vscodeTelemetryReporter,
            telemetryExtensionDllPath,
            env,
            dotnetInfo.path,
            logger
        );

        const languageServiceClient = new RazorLanguageServiceClient(languageServerClient);

        const documentManager = new RazorDocumentManager(
            languageServerClient,
            logger,
            razorTelemetryReporter,
            platformInfo
        );
        const documentSynchronizer = new RazorDocumentSynchronizer(documentManager, logger);
        reportTelemetryForDocuments(documentManager, razorTelemetryReporter);
        const languageConfiguration = new RazorLanguageConfiguration();
        const csharpFeature = new RazorCSharpFeature(documentManager, eventEmitterFactory, logger);
        const htmlFeature = new RazorHtmlFeature(documentManager, languageServiceClient, eventEmitterFactory, logger);
        const localRegistrations: vscode.Disposable[] = [];
        const reportIssueCommand = new ReportIssueCommand(vscodeType, documentManager, logger);
        const razorCodeActionRunner = new RazorCodeActionRunner(languageServerClient, logger);
        const codeActionsHandler = new CodeActionsHandler(
            documentManager,
            documentSynchronizer,
            languageServerClient,
            logger
        );

        // Our dynamic file handler needs to be registered regardless of whether the Razor language server starts
        // since the Roslyn implementation expects the dynamic file commands to always be registered.
        const dynamicFileInfoProvider = new DynamicFileInfoHandler(documentManager, logger);
        dynamicFileInfoProvider.register();

        languageServerClient.onStart(async () => {
            const provisionalCompletionOrchestrator = new ProvisionalCompletionOrchestrator(
                documentManager,
                csharpFeature.projectionProvider,
                languageServiceClient,
                logger
            );
            const semanticTokenHandler = new SemanticTokensRangeHandler(
                documentManager,
                documentSynchronizer,
                languageServerClient,
                logger
            );
            const colorPresentationHandler = new ColorPresentationHandler(
                documentManager,
                languageServerClient,
                logger
            );
            const documentColorHandler = new DocumentColorHandler(
                documentManager,
                documentSynchronizer,
                languageServerClient,
                logger
            );
            const foldingRangeHandler = new FoldingRangeHandler(languageServerClient, documentManager, logger);
            const formattingHandler = new FormattingHandler(
                documentManager,
                documentSynchronizer,
                languageServerClient,
                logger
            );

            const completionItemProvider = new RazorCompletionItemProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                provisionalCompletionOrchestrator,
                logger
            );
            const signatureHelpProvider = new RazorSignatureHelpProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                logger
            );
            const definitionProvider = new RazorDefinitionProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                logger
            );
            const implementationProvider = new RazorImplementationProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                logger
            );
            const hoverProvider = new RazorHoverProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                logger
            );
            const codeLensProvider = new RazorCodeLensProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                logger
            );
            const renameProvider = new RazorRenameProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                logger
            );
            const referenceProvider = new RazorReferenceProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                logger
            );
            const documentHighlightProvider = new RazorDocumentHighlightProvider(
                documentSynchronizer,
                documentManager,
                languageServiceClient,
                logger
            );
            const razorDiagnosticHandler = new RazorDiagnosticHandler(
                documentSynchronizer,
                languageServerClient,
                languageServiceClient,
                documentManager,
                logger
            );
            const razorSimplifyMethodHandler = new RazorSimplifyMethodHandler(
                documentSynchronizer,
                languageServerClient,
                languageServiceClient,
                documentManager,
                logger
            );
            const razorFormatNewFileHandler = new RazorFormatNewFileHandler(
                documentSynchronizer,
                languageServerClient,
                languageServiceClient,
                documentManager,
                logger
            );

            localRegistrations.push(
                languageConfiguration.register(),
                provisionalCompletionOrchestrator.register(),
                vscodeType.languages.registerCompletionItemProvider(
                    RazorLanguage.id,
                    completionItemProvider,
                    '.',
                    '<',
                    '@'
                ),
                vscodeType.languages.registerSignatureHelpProvider(RazorLanguage.id, signatureHelpProvider, '(', ','),
                vscodeType.languages.registerDefinitionProvider(RazorLanguage.id, definitionProvider),
                vscodeType.languages.registerImplementationProvider(RazorLanguage.id, implementationProvider),
                vscodeType.languages.registerHoverProvider(RazorLanguage.documentSelector, hoverProvider),
                vscodeType.languages.registerReferenceProvider(RazorLanguage.id, referenceProvider),
                vscodeType.languages.registerCodeLensProvider(RazorLanguage.id, codeLensProvider),
                vscodeType.languages.registerRenameProvider(RazorLanguage.id, renameProvider),
                vscodeType.languages.registerDocumentHighlightProvider(RazorLanguage.id, documentHighlightProvider),
                documentManager.register(),
                csharpFeature.register(),
                htmlFeature.register(),
                documentSynchronizer.register(),
                reportIssueCommand.register(),
                listenToConfigurationChanges(languageServerClient)
            );

            if (enableProposedApis) {
                const proposedApisFeature = new ProposedApisFeature();

                await proposedApisFeature.register(vscodeType);
            }

            razorCodeActionRunner.register();

            await Promise.all([
                colorPresentationHandler.register(),
                documentColorHandler.register(),
                foldingRangeHandler.register(),
                formattingHandler.register(),
                semanticTokenHandler.register(),
                razorDiagnosticHandler.register(),
                codeActionsHandler.register(),
                razorSimplifyMethodHandler.register(),
                razorFormatNewFileHandler.register(),
            ]);
        });

        const onStopRegistration = languageServerClient.onStop(() => {
            localRegistrations.forEach((r) => r.dispose());
            localRegistrations.length = 0;
        });

        const provider = new BlazorDebugConfigurationProvider(logger, vscodeType);
        context.subscriptions.push(vscodeType.debug.registerDebugConfigurationProvider('blazorwasm', provider));

        languageServerClient.onStarted(async () => {
            await documentManager.initialize();
        });

        await startLanguageServer(vscodeType, languageServerClient, logger, context);

        context.subscriptions.push(languageServerClient, onStopRegistration, logger);
    } catch (error) {
        logger.logError('Failed when activating Razor VSCode.', error as Error);
        razorTelemetryReporter.reportErrorOnActivation(error as Error);
    }
}

async function startLanguageServer(
    vscodeType: typeof vscodeapi,
    languageServerClient: RazorLanguageServerClient,
    logger: RazorLogger,
    context: vscode.ExtensionContext
) {
    const razorFiles = await vscodeType.workspace.findFiles(RazorLanguage.globbingPattern);
    if (razorFiles.length === 0) {
        // No Razor files in workspace, language server should stay off until one is added or opened.
        logger.logAlways('No Razor files detected in workspace, delaying language server start.');

        const watcher = vscodeType.workspace.createFileSystemWatcher(RazorLanguage.globbingPattern);
        const delayedLanguageServerStart = async () => {
            razorFileCreatedRegistration.dispose();
            razorFileOpenedRegistration.dispose();
            await languageServerClient.start();
        };
        const razorFileCreatedRegistration = watcher.onDidCreate(async () => delayedLanguageServerStart());
        const razorFileOpenedRegistration = vscodeType.workspace.onDidOpenTextDocument(async (event) => {
            if (event.languageId === RazorLanguage.id) {
                await delayedLanguageServerStart();
            }
        });
        context.subscriptions.push(razorFileCreatedRegistration, razorFileOpenedRegistration);
    } else {
        await languageServerClient.start();
    }
}

async function setupDevKitEnvironment(
    env: NodeJS.ProcessEnv,
    csharpDevkitExtension: vscode.Extension<CSharpDevKitExports>,
    logger: RazorLogger
): Promise<void> {
    try {
        const exports = await csharpDevkitExtension.activate();

        // setupTelemetryEnvironmentAsync was a later addition to devkit (not in preview 1)
        // so it may not exist in whatever version of devkit the user has installed
        if (!exports.setupTelemetryEnvironmentAsync) {
            return;
        }

        await exports.setupTelemetryEnvironmentAsync(env);
    } catch (error) {
        logger.logError('Failed to setup DevKit environment for telemetry.', error as Error);
    }
}
