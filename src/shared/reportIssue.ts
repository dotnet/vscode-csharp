/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { basename, dirname } from 'path';
import { DotnetInfo } from './utils/dotnetInfo';
import { CSharpExtensionId } from '../constants/csharpExtensionId';
import { commonOptions, LanguageServerOptions, languageServerOptions } from './options';

export default async function reportIssue(
    context: vscode.ExtensionContext,
    getDotnetInfo: (dotNetCliPaths: string[]) => Promise<DotnetInfo>,
    shouldIncludeMonoInfo: boolean,
    logChannels: vscode.LogOutputChannel[],
    dotnetResolver: IHostExecutableResolver,
    monoResolver?: IHostExecutableResolver
) {
    // Get info for the dotnet that the language server executable is run on, not the dotnet the language server will execute user code on.
    let fullDotnetInfo = '';
    try {
        const info = await dotnetResolver.getHostExecutableInfo();
        const dotnetInfo = await getDotnetInfo([dirname(info.path)]);
        fullDotnetInfo = dotnetInfo.FullInfo;
    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        fullDotnetInfo = message;
    }

    let monoInfo = '';
    if (shouldIncludeMonoInfo && monoResolver) {
        monoInfo = await getMonoIfPlatformValid(monoResolver);
    }

    const csharpExtVersion = context.extension.packageJSON.version;
    const useOmnisharp = commonOptions.useOmnisharpServer;
    const extensionsTable = generateExtensionTable();
    const optionsTable = generateOptionsTable();
    const logInfo = await getLogInfo(logChannels, context);

    const body = `## Issue Description ##
## Steps to Reproduce ##

## Expected Behavior ##

## Actual Behavior ##

`;

    const userData = `### Logs ###

${logInfo}

## Environment Information ##
**VSCode version**: ${vscode.version}
**C# Extension**: ${csharpExtVersion}
**Using OmniSharp**: ${useOmnisharp}

${monoInfo}
<details><summary>Dotnet Information</summary>
${fullDotnetInfo}</details>
<details><summary>Visual Studio Code Extensions</summary>
${extensionsTable}
</details>
<details><summary>C# Settings</summary>
${optionsTable}
</details>
`;
    await vscode.commands.executeCommand('workbench.action.openIssueReporter', {
        extensionId: CSharpExtensionId,
        issueBody: body,
        data: userData,
    });
}

function sortExtensions(a: vscode.Extension<any>, b: vscode.Extension<any>): number {
    if (a.packageJSON.name.toLowerCase() < b.packageJSON.name.toLowerCase()) {
        return -1;
    }
    if (a.packageJSON.name.toLowerCase() > b.packageJSON.name.toLowerCase()) {
        return 1;
    }
    return 0;
}

function generateExtensionTable() {
    const extensions = getInstalledExtensions();
    if (extensions.length <= 0) {
        return 'none';
    }

    const tableHeader = `|Extension|Author|Version|Folder Name|\n|---|---|---|---|`;
    const table = extensions
        .map(
            (e) =>
                `|${e.packageJSON.name}|${e.packageJSON.publisher}|${e.packageJSON.version}|${basename(
                    e.extensionPath
                )}|`
        )
        .join('\n');

    const extensionTable = `
${tableHeader}\n${table};
`;

    return extensionTable;
}

function generateOptionsTable() {
    const tableHeader = `|Setting|Value|\n|---|---|`;
    const relevantOptions = [
        getLanguageServerOptionData('preferCSharpExtension'),
        getLanguageServerOptionData('compilerDiagnosticScope'),
        getLanguageServerOptionData('analyzerDiagnosticScope'),
        getLanguageServerOptionData('enableXamlTools'),
        getLanguageServerOptionData('useServerGC'),
    ];
    const table = relevantOptions.map((e) => `|${e.name}|${e.value}|`).join('\n');

    const extensionTable = `
${tableHeader}\n${table};
`;

    return extensionTable;
}

function getLanguageServerOptionData(k: keyof LanguageServerOptions): { name: string; value: string | undefined } {
    return {
        name: k,
        value: languageServerOptions[k]?.toString(),
    };
}

async function getMonoIfPlatformValid(monoResolver: IHostExecutableResolver): Promise<string> {
    let monoVersion = 'Unknown Mono version';
    try {
        const monoInfo = await monoResolver.getHostExecutableInfo();
        monoVersion = `OmniSharp using mono: ${monoInfo.version}`;
    } catch (error) {
        monoVersion = error instanceof Error ? error.message : `${error}`;
    }

    return `<details><summary>Mono Information</summary>
    ${monoVersion}</details>`;
}

async function getLogInfo(logChannels: vscode.LogOutputChannel[], context: vscode.ExtensionContext): Promise<string> {
    let logInfo = `<!--
If you can, it would be the most helpful to zip up and attach the entire extensions log folder.  The folder can be opened by running the \`workbench.action.openExtensionLogsFolder\` command.

Additionally, if you can reproduce the issue reliably, use trace logging, see https://github.com/dotnet/vscode-csharp/blob/main/SUPPORT.md#c-lsp-trace-logs and then report the issue.
-->
`;

    for (const channel of logChannels) {
        const contents = await getLogOutputChannelContents(context, channel);
        logInfo += `### ${channel.name} log ###
<details>

\`\`\`
${contents}
\`\`\`
</details>

`;
    }

    return logInfo;
}

async function getLogOutputChannelContents(
    context: vscode.ExtensionContext,
    channel: vscode.LogOutputChannel
): Promise<string> {
    const logFilePath = vscode.Uri.joinPath(context.logUri, channel.name + '.log');

    try {
        const fileStat = await vscode.workspace.fs.stat(logFilePath);
        if (fileStat.type !== vscode.FileType.File) {
            return `Unable to find log file at ${logFilePath}, ${fileStat.type}`;
        }

        const logContent = await vscode.workspace.fs.readFile(logFilePath);
        const contents = Buffer.from(logContent).toString('utf8');
        return contents;
    } catch (error) {
        return `Error reading log file: ${error instanceof Error ? error.message : `${error}`}`;
    }
}

function getInstalledExtensions() {
    const extensions = vscode.extensions.all.filter((extension) => extension.packageJSON.isBuiltin === false);

    return extensions.sort(sortExtensions);
}
