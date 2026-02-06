/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ObservableLogOutputChannel } from '../logging/observableLogOutputChannel';
import { registerDumpToolCommand, DumpCommandConfig } from './profilingUtils';

const gcDumpConfig: DumpCommandConfig = {
    commandName: 'csharp.collectGcDump',
    toolName: 'dotnet-gcdump',
    fileExtension: 'gcdump',
    filePrefix: 'csharp-gcdump',
    saveLabel: vscode.l10n.t('Save GC Dump'),
    defaultArgs: '--process-id {processId}',
    collectingMessage: vscode.l10n.t('Collecting GC dump...'),
    failedMessage: vscode.l10n.t('Failed to create GC dump file.'),
    successMessage: vscode.l10n.t('C# GC dump saved successfully.'),
};

export function registerGcDumpCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel
): void {
    registerDumpToolCommand(context, languageServer, outputChannel, gcDumpConfig);
}
