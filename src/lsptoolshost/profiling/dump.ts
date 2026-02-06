/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ObservableLogOutputChannel } from '../logging/observableLogOutputChannel';
import { registerDumpToolCommand, DumpCommandConfig } from './profilingUtils';

const dumpConfig: DumpCommandConfig = {
    commandName: 'csharp.collectDump',
    toolName: 'dotnet-dump',
    fileExtension: 'dmp',
    filePrefix: 'csharp-dump',
    saveLabel: vscode.l10n.t('Save Memory Dump'),
    defaultArgs: '--process-id {processId} --type Full',
    collectingMessage: vscode.l10n.t('Collecting memory dump...'),
    failedMessage: vscode.l10n.t('Failed to create dump file.'),
    successMessage: vscode.l10n.t('C# memory dump saved successfully.'),
};

export function registerDumpCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel
): void {
    registerDumpToolCommand(context, languageServer, outputChannel, dumpConfig);
}
