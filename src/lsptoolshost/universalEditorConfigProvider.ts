/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WorkspaceConfiguration, workspace } from 'vscode';

// By default we don't want to provide any fall back value for code style options.
// These values are exceptions because they already exist in vscode's configuration.
const universalEditorConfigOptionsToReaderMap: Map<
    string,
    (workspaceConfiguration: WorkspaceConfiguration) => string | undefined
> = new Map([
    ['codeStyle.formatting.indentationAndSpacing.tabWidth', readTabSize],
    ['codeStyle.formatting.indentationAndSpacing.indentSize', readIndentSize],
    ['codeStyle.formatting.indentationAndSpacing.indentStyle', readInsertSpaces],
    ['codeStyle.formatting.newLine.endOfLine', readEol],
    ['codeStyle.formatting.newLine.insertFinalNewline', readInsertFinalNewline],
]);

export function readEquivalentVsCodeConfiguration(serverSideOptionName: string): string | undefined {
    if (!universalEditorConfigOptionsToReaderMap.has(serverSideOptionName)) {
        return undefined;
    }

    const readerFunction = universalEditorConfigOptionsToReaderMap.get(serverSideOptionName)!;
    const config = workspace.getConfiguration('', { languageId: 'csharp' });
    return readerFunction(config);
}

function readTabSize(configuration: WorkspaceConfiguration): string {
    return readValueIfDetectIndentationIsOff(configuration, 'editor.tabSize', '4');
}

function readIndentSize(configuration: WorkspaceConfiguration): string {
    const indentSize = readValueIfDetectIndentationIsOff<string>(configuration, 'editor.indentSize', '4');
    // indent size could be a number or 'tabSize'. If it is 'tabSize', read the 'tabSize' section from config.
    if (indentSize == 'tabSize') {
        return readTabSize(configuration);
    }

    return indentSize;
}

function readInsertSpaces(configuration: WorkspaceConfiguration): string {
    const insertSpace = readValueIfDetectIndentationIsOff<boolean>(configuration, 'editor.insertSpaces', true);
    return insertSpace ? 'space' : 'tab';
}

function readEol(configuration: WorkspaceConfiguration): string {
    const eol = readVsCodeConfigurations<string>(configuration, 'files.eol');
    if (eol === '\n') {
        return 'lf';
    } else if (eol == '\r\n') {
        return 'crlf';
    }

    return eol;
}

function readInsertFinalNewline(configuration: WorkspaceConfiguration): string {
    return readVsCodeConfigurations<string>(configuration, 'files.insertFinalNewline');
}

function readValueIfDetectIndentationIsOff<T>(
    configuration: WorkspaceConfiguration,
    vscodeConfigName: string,
    defaultValue: T
): T {
    // If detectIndentation is on, tabSize, indentSize and insertSpaces would be overridden by vscode based on the file's content.
    // The values in settings become meaningless, so ask the server to fall back to default value.
    // TODO: Both 'editor.detectIndentation' and.editorconfig provided the same functions here, we need to find a graceful way to handle them.
    if (configuration.get<boolean>('editor.detectIndentation')) {
        return defaultValue;
    }

    return readVsCodeConfigurations(configuration, vscodeConfigName);
}

function readVsCodeConfigurations<T>(configuration: WorkspaceConfiguration, vscodeConfigName: string): T {
    const configValue = configuration.get<T>(vscodeConfigName);
    if (configValue === undefined) {
        // We are reading vscode built-in configurations, so we should at least get default value.
        throw new Error(`Can't read ${vscodeConfigName} from the client.`);
    }

    return configValue;
}
