/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ParsedEnvironmentFile } from '../coreclrDebug/parsedEnvironmentFile';
import { debugSessionTracker } from '../coreclrDebug/provisionalDebugSessionTracker';

import { CertToolStatusCodes, createSelfSignedCert, hasDotnetDevCertsHttps } from '../utils/dotnetDevCertsHttps';
import {
    AttachItem,
    RemoteAttachPicker,
    DotNetAttachItemsProviderFactory,
    AttachPicker,
} from '../shared/processPicker';
import { PlatformInformation } from './platform';
import { getCSharpDevKit } from '../utils/getCSharpDevKit';
import {
    ActionOption,
    showErrorMessageWithOptions,
    showInformationMessage,
    showWarningMessage,
} from './observers/utils/showMessage';

/**
 * Class used for debug configurations that will be sent to the debugger registered by {@link DebugAdapterExecutableFactory}
 *
 * This class will handle:
 * 1. Setting options that were set under csharp.debug.*
 * 2. Show the process picker if the request type is attach and if process is not set.
 * 3. Handle registering developer certs for web development.
 */
export class BaseVsDbgConfigurationProvider implements vscode.DebugConfigurationProvider {
    public constructor(
        protected platformInformation: PlatformInformation,
        private csharpOutputChannel: vscode.OutputChannel
    ) {}

    //#region DebugConfigurationProvider

    async resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        debugConfiguration: vscode.DebugConfiguration,
        _?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | undefined | null> {
        // Check to see if we are in the "Run and Debug" scenario.
        if (Object.keys(debugConfiguration).length == 0) {
            const csharpDevkitExtension = getCSharpDevKit();
            // If we dont have the csharpDevKitExtension, prompt for initial configurations.
            return csharpDevkitExtension ? undefined : null;
        }

        // Load settings before resolving variables as there may be variables set in settings.
        this.loadSettingDebugOptions(debugConfiguration);

        return debugConfiguration;
    }

    /**
     * Try to add all missing attributes to the debug configuration being launched.
     */
    async resolveDebugConfigurationWithSubstitutedVariables(
        folder: vscode.WorkspaceFolder | undefined,
        debugConfiguration: vscode.DebugConfiguration,
        _?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | null | undefined> {
        if (!debugConfiguration.type) {
            // If the config doesn't look functional force VSCode to open a configuration file https://github.com/Microsoft/vscode/issues/54213
            return null;
        }

        const brokeredServicePipeName = debugSessionTracker.getBrokeredServicePipeName();
        if (brokeredServicePipeName !== undefined) {
            debugConfiguration.brokeredServicePipeName = brokeredServicePipeName;
        }

        if (debugConfiguration.request === 'launch') {
            if (!debugConfiguration.cwd && !debugConfiguration.pipeTransport) {
                debugConfiguration.cwd = folder?.uri.fsPath; // Workspace folder
            }

            if (!debugConfiguration.internalConsoleOptions) {
                // If the target app is NOT using integratedTerminal, use 'openOnSessionStart' so that the debug console can be seen
                // If the target app is using integratedTerminal, use 'neverOpen' so that the integrated terminal doesn't get hidden
                debugConfiguration.internalConsoleOptions =
                    debugConfiguration.console === 'integratedTerminal' ? 'neverOpen' : 'openOnSessionStart';
            }

            // read from envFile and set config.env
            if (debugConfiguration.envFile !== undefined && debugConfiguration.envFile.length > 0) {
                debugConfiguration = this.parseEnvFile(debugConfiguration.envFile, debugConfiguration);
            }
        }

        // Process Id is empty, handle Attach to Process Dialog.
        if (
            debugConfiguration.request === 'attach' &&
            !debugConfiguration.processId &&
            !debugConfiguration.processName
        ) {
            let process: AttachItem | undefined;
            if (debugConfiguration.pipeTransport) {
                process = await RemoteAttachPicker.ShowAttachEntries(debugConfiguration, this.platformInformation);
            } else {
                const attachItemsProvider = DotNetAttachItemsProviderFactory.Get();
                const attacher = new AttachPicker(attachItemsProvider);
                process = await attacher.ShowAttachEntries();
            }

            if (process !== undefined) {
                debugConfiguration.processId = process.id;

                if (
                    debugConfiguration.type == 'coreclr' &&
                    this.platformInformation.isMacOS() &&
                    this.platformInformation.architecture == 'arm64'
                ) {
                    // For Apple Silicon M1, it is possible that the process we are attaching to is being emulated as x86_64.
                    // The process is emulated if it has process flags has P_TRANSLATED (0x20000).
                    if (process.flags & 0x20000) {
                        debugConfiguration.targetArchitecture = 'x86_64';
                    } else {
                        debugConfiguration.targetArchitecture = 'arm64';
                    }
                }
            } else {
                showErrorMessageWithOptions(vscode, vscode.l10n.t('No process was selected.'), { modal: true });
                return undefined;
            }
        }

        // We want to ask the user if we should run dotnet  dev-certs https --trust, but this doesn't work in a few cases --
        // Linux -- not supported by the .NET CLI as there isn't a single root cert store
        // VS Code remoting/Web UI -- the trusted cert work would need to happen on the client machine, but we don't have a way to run code there currently
        // pipeTransport -- the dev cert on the server will be different from the client
        if (
            !this.platformInformation.isLinux() &&
            !vscode.env.remoteName &&
            vscode.env.uiKind != vscode.UIKind.Web &&
            !debugConfiguration.pipeTransport
        ) {
            if (
                debugConfiguration.checkForDevCert === undefined &&
                debugConfiguration.serverReadyAction &&
                debugConfiguration.type === 'coreclr'
            ) {
                debugConfiguration.checkForDevCert = true;
            }

            if (debugConfiguration.checkForDevCert) {
                if (!(await this.checkForDevCerts())) {
                    return undefined;
                }
            }
        }
        if (
            debugConfiguration.type === 'monovsdbg_wasm' &&
            debugConfiguration.monoDebuggerOptions.platform === 'browser' &&
            this.isDotnetWorkspaceConfigurationProvider()
        ) {
            if (folder && debugConfiguration.monoDebuggerOptions.assetsPath == null) {
                const csharpDevKitExtension = getCSharpDevKit();
                if (csharpDevKitExtension === undefined) {
                    if (!(await this.isDotNet9OrNewer(folder))) {
                        return undefined;
                    }
                }
                const [assetsPath, programName] = await this.getAssetsPathAndProgram(folder);
                debugConfiguration.monoDebuggerOptions.assetsPath = assetsPath;
                debugConfiguration.program = programName;
                if (debugConfiguration.program == null) {
                    return undefined;
                }
            }
        }
        return debugConfiguration;
    }

    //#endregion

    /**
     * Parse envFile and add to config.env
     */
    private parseEnvFile(envFile: string, config: vscode.DebugConfiguration): vscode.DebugConfiguration {
        try {
            const parsedFile = ParsedEnvironmentFile.CreateFromFile(envFile, config['env']);

            // show error message if single lines cannot get parsed
            if (parsedFile.Warning) {
                this.showFileWarning(parsedFile.Warning, envFile);
            }

            config.env = parsedFile.Env;
        } catch (e) {
            throw new Error(vscode.l10n.t("Can't parse envFile {0} because of {1}", envFile, `${e}`));
        }

        // remove envFile from config after parsing
        delete config.envFile;

        return config;
    }

    private showFileWarning(message: string, fileName: string) {
        const openItem: ActionOption = {
            title: vscode.l10n.t('Open envFile'),
            action: async () => {
                const doc = await vscode.workspace.openTextDocument(fileName);
                await vscode.window.showTextDocument(doc);
            },
        };
        showWarningMessage(vscode, message, openItem);
    }

    private loadSettingDebugOptions(debugConfiguration: vscode.DebugConfiguration): void {
        const debugOptions = vscode.workspace.getConfiguration('csharp').get('debug');
        const result = JSON.parse(JSON.stringify(debugOptions));
        const keys = Object.keys(result);

        for (const key of keys) {
            // Skip since option is set in the launch.json configuration
            if (
                Object.prototype.hasOwnProperty.call(debugConfiguration, key) ||
                key === 'console' || // Skip 'console' option since this should be set when we know this is a console project.
                key == 'debugConsoleVerbosity' // Skip 'debugConsoleVerbosity' since this is a C# Dev Kit option
            ) {
                continue;
            }

            const settingsValue: any = result[key];
            if (!this.CheckIfSettingIsEmpty(settingsValue)) {
                debugConfiguration[key] = settingsValue;
            }
        }
    }

    private CheckIfSettingIsEmpty(input: any): boolean {
        switch (typeof input) {
            case 'object':
                if (Array.isArray(input)) {
                    return input.length === 0;
                } else {
                    return Object.keys(input).length === 0;
                }
            case 'string':
                return !input;
            case 'boolean':
            case 'number':
                return false; // booleans and numbers are never empty
            default:
                throw 'Unknown type to check to see if setting is empty';
        }
    }

    private async checkForDevCerts(): Promise<boolean> {
        let result: boolean | undefined = undefined;

        while (result === undefined) {
            const returnData = await hasDotnetDevCertsHttps();
            const errorCode = returnData.error?.code;
            if (
                errorCode === CertToolStatusCodes.CertificateNotTrusted ||
                errorCode === CertToolStatusCodes.ErrorNoValidCertificateFound
            ) {
                const labelYes = vscode.l10n.t('Yes');
                const labelMoreInfo = vscode.l10n.t('More Information');

                const dialogResult = await vscode.window.showWarningMessage(
                    vscode.l10n.t('Security Warning'),
                    {
                        modal: true,
                        detail: vscode.l10n.t(
                            'The selected launch configuration is configured to launch a web browser but no trusted development certificate was found. Create a trusted self-signed certificate?'
                        ),
                    },
                    labelYes,
                    labelMoreInfo
                );

                if (dialogResult === labelYes) {
                    const returnData = await createSelfSignedCert();
                    if (returnData.error === null) {
                        // if the process returns 0, returnData.error is null, otherwise the return code can be accessed in returnData.error.code
                        const message = errorCode === CertToolStatusCodes.CertificateNotTrusted ? 'trusted' : 'created';
                        showInformationMessage(
                            vscode,
                            vscode.l10n.t('Self-signed certificate successfully {0}', message)
                        );

                        result = true;
                    } else {
                        this.csharpOutputChannel.appendLine(
                            vscode.l10n.t(
                                `Couldn't create self-signed certificate. {0}\ncode: {1}\nstdout: {2}`,
                                returnData.error.message,
                                `${returnData.error.code}`,
                                returnData.stdout
                            )
                        );

                        const labelShowOutput: ActionOption = {
                            title: vscode.l10n.t('Show Output'),
                            action: async () => {
                                this.csharpOutputChannel.show();
                            },
                        };
                        showWarningMessage(
                            vscode,
                            vscode.l10n.t("Couldn't create self-signed certificate. See output for more information."),
                            labelShowOutput
                        );

                        result = false;
                    }
                } else if (dialogResult === labelMoreInfo) {
                    const launchjsonDescriptionURL = 'https://aka.ms/VSCode-CS-CheckForDevCert';
                    await vscode.env.openExternal(vscode.Uri.parse(launchjsonDescriptionURL));
                } else if (dialogResult === undefined) {
                    // User cancelled dialog and wishes to continue debugging.
                    result = true;
                }
            } else {
                result = true;
            }
        }

        return result;
    }
    async getAssetsPathAndProgram(_: vscode.WorkspaceFolder): Promise<[string, string]> {
        return ['', ''];
    }

    async isDotNet9OrNewer(_: vscode.WorkspaceFolder): Promise<boolean> {
        return false;
    }

    isDotnetWorkspaceConfigurationProvider(): boolean {
        return false;
    }
}
