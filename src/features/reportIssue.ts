/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../vscodeAdapter";
import { Extension } from "../vscodeAdapter";
import { CSharpExtensionId } from "../constants/CSharpExtensionId";
import { EventStream } from "../EventStream";
import { OpenURL } from "../omnisharp/loggingEvents";

const issuesUrl = "https://github.com/OmniSharp/omnisharp-vscode/issues/new";

export default async function reportIssue(vscode: vscode, eventStream: EventStream, execChildProcess: (command: string, workingDirectory?: string) => Promise<string>, isValidPlatformForMono: boolean) {
    const dotnetInfo = await getDotnetInfo(execChildProcess);
    const monoInfo = await getMonoIfPlatformValid(execChildProcess, isValidPlatformForMono);
    let extensions = getInstalledExtensions(vscode);
    let csharpExtVersion = getCsharpExtensionVersion(vscode);

    const body = encodeURIComponent(`## Issue Description ##
## Steps to Reproduce ##

## Expected Behavior ##

## Actual Behavior ##

## Logs ##

### OmniSharp log ###
<details>Post the output from Output-->OmniSharp log here</details>

### C# log ###
<details>Post the output from Output-->C# here</details>

## Environment information ##

**VSCode version**: ${vscode.version}
**C# Extension**: ${csharpExtVersion}

${monoInfo}
<details><summary>Dotnet Information</summary>
${dotnetInfo}</details>
<details><summary>Visual Studio Code Extensions</summary>
${generateExtensionTable(extensions)}
</details>
`);

    const encodedBody = encodeURIComponent(body);
    const queryStringPrefix: string = "?";
    const fullUrl = `${issuesUrl}${queryStringPrefix}body=${encodedBody}`;
    eventStream.post(new OpenURL(fullUrl));
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
    const table = extensions.map((e) => `|${e.packageJSON.name}|${e.packageJSON.publisher}|${e.packageJSON.version}|`).join("\n");

    const extensionTable = `
${tableHeader}\n${table};
`;

    return extensionTable;
}

async function getMonoIfPlatformValid(execChildProcess: (command: string, workingDirectory?: string) => Promise<string>, isValidPlatformForMono: boolean): Promise<string> {
    if (isValidPlatformForMono) {
        let monoInfo: string;
        try {
            monoInfo = await getMonoVersion(execChildProcess);
        }
        catch (error) {
            monoInfo = "A valid mono installation could not be found. Using the built-in mono"
        }

        return `<details><summary>Mono Information</summary>
        ${monoInfo}</details>`;
    }

    return "";
}

async function getDotnetInfo(execChildProcess: (command: string, workingDirectory?: string) => Promise<string>): Promise<string> {
    return execChildProcess("dotnet --info", process.cwd());
}

async function getMonoVersion(execChildProcess: (command: string, workingDirectory?: string) => Promise<string>): Promise<string> {
    return execChildProcess("mono --version", process.cwd());
}

function getInstalledExtensions(vscode: vscode) {
    let extensions = vscode.extensions.all
        .filter(extension => extension.packageJSON.isBuiltin === false);

    return extensions.sort(sortExtensions);
}

function getCsharpExtensionVersion(vscode: vscode): string {
    const extension = vscode.extensions.getExtension(CSharpExtensionId);
    return extension.packageJSON.version;
} 