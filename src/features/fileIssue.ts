/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../vscodeAdapter";
import { Extension } from "../vscodeAdapter";
import { CSharpExtensionId } from "../constants/CSharpExtensionId";
import { EventStream } from "../EventStream";
import { ReportIssue } from "../omnisharp/loggingEvents";

const issuesUrl = "https://github.com/OmniSharp/omnisharp-vscode/issues/new";

export default async function fileIssue(vscode: vscode, eventStream: EventStream, execChildProcess:(command: string, workingDirectory?: string) => Promise<string>, isValidPlatformForMono: boolean) {
    const dotnetInfo = await getDotnetInfo(execChildProcess);
    const monoInfo = await getMonoIfPlatformValid(execChildProcess, isValidPlatformForMono);
    let extensions = getInstalledExtensions(vscode);
    let csharpExtVersion = getCsharpExtensionVersion(vscode);

    const body = `## Issue Description ##
## Steps to Reproduce ##

## Expected Behavior ##

## Actual Behavior ##

## Environment Information ##

VSCode version: ${vscode.version}
C# Extension: ${csharpExtVersion}
${monoInfo}

<details><summary>Dotnet Info</summary>
${dotnetInfo}</details>

## Other relevant information ##
<details><summary>Omnisharp log</summary>
Post the output from Output-->OmniSharp log here
</details>
<details><summary>C# log</summary>
Post the output from Output-->C# here
</details>
<details><summary>Visual Studio Code Extensions</summary>
${generateExtensionTable(extensions)}
</details>
`;

    eventStream.post(new ReportIssue(issuesUrl, body));
}

function sortExtensions(a: Extension<any>, b: Extension<any>): number {

    if (a.packageJSON.name.toLowerCase() < b.packageJSON.name.toLowerCase()) {
        return -1;
    }
    if (a.packageJSON.name.toLowerCase() > b.packageJSON.name.toLowerCase()) {
        return 1;
    }
    return 0;
}

function generateExtensionTable(extensions: Extension<any>[]) {
    if (extensions.length <= 0) {
        return "none";
    }

    const tableHeader = `|Extension|Author|Version|\n|---|---|---|`;
    const table = extensions.map((e) => {
        if (e.packageJSON.isBuiltin === false) {
            return `|${e.packageJSON.name}|${e.packageJSON.publisher}|${e.packageJSON.version}|`;
        }
    }).join("\n");

    const extensionTable = `
${tableHeader}\n${table};
`;

    return extensionTable;
}

async function getMonoIfPlatformValid(execChildProcess:(command: string, workingDirectory?: string) =>Promise<string>, isValidPlatformForMono: boolean): Promise<string>{
    if (isValidPlatformForMono) {
        return `Mono: ${await getMonoVersion(execChildProcess)}`;
    }
    
    return "";
}

async function getDotnetInfo(execChildProcess:(command: string, workingDirectory?: string) =>Promise<string>): Promise<string> {
    return execChildProcess("dotnet --info", process.cwd());
}

async function getMonoVersion(execChildProcess:(command: string, workingDirectory?: string) =>Promise<string>): Promise<string>{
    return execChildProcess("mono --version", process.cwd());
}

function getInstalledExtensions(vscode: vscode) {
    let extensions = vscode.extensions.all
    .filter(extension => extension.packageJSON.isBuiltin === false);

    return extensions.sort(sortExtensions);
}

function getCsharpExtensionVersion(vscode: vscode): string{
    const extension = vscode.extensions.getExtension(CSharpExtensionId);
    return extension.packageJSON.version;
} 