/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { getDotnetInfo, getMonoVersion } from "./getdotnetInfo";

const extensionId = 'ms-vscode.csharp';
const extension = vscode.extensions.getExtension(extensionId);
const extensionVersion = extension.packageJSON.version;
const issuesUrl = "https://github.com/OmniSharp/omnisharp-vscode/issues/new";
const queryStringPrefix: string = "?";

let extensions = vscode.extensions.all
    .filter(extension => extension.packageJSON.isBuiltin === false);

extensions.sort(sortExtensions);

export default async function generateBugReport(isValidPlatformForMono: boolean) {
    const dotnetInfo = await getDotnetInfo();
    
    const body = encodeURIComponent(`## Issue Description ##
## Steps to Reproduce ##

## Expected Behavior ##

## Actual Behavior ##

## Environment Information ##

VSCode version: ${vscode.version}
C# Extension: ${extensionVersion}
${getMonoIfPlatformValid(isValidPlatformForMono)}

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
`);

    const encodedBody = encodeURIComponent(body);
    const fullUrl = `${issuesUrl}${queryStringPrefix}body=${encodedBody}`;
    vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(fullUrl));
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

function generateExtensionTable(extensions: vscode.Extension<any>[]) {
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

function getMonoIfPlatformValid(isValidPlatformForMono: boolean): string{
    if (isValidPlatformForMono) {
        return `Mono: ${getMonoVersion()}`;
    }
    
    return "";
}

