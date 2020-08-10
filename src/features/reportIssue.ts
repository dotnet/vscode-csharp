/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../vscodeAdapter";
import { Extension } from "../vscodeAdapter";
import { CSharpExtensionId } from "../constants/CSharpExtensionId";
import { EventStream } from "../EventStream";
import { OpenURL } from "../omnisharp/loggingEvents";
import { Options } from "../omnisharp/options";
import { IMonoResolver } from "../constants/IMonoResolver";
import { IGetDotnetInfo } from "../constants/IGetDotnetInfo";

const issuesUrl = "https://github.com/OmniSharp/omnisharp-vscode/issues/new";

export default async function reportIssue(vscode: vscode, eventStream: EventStream, getDotnetInfo: IGetDotnetInfo, isValidPlatformForMono: boolean, options: Options, monoResolver: IMonoResolver) {
    const dotnetInfo = await getDotnetInfo();
    const monoInfo = await getMonoIfPlatformValid(isValidPlatformForMono, options, monoResolver);
    let extensions = getInstalledExtensions(vscode);
    let csharpExtVersion = getCsharpExtensionVersion(vscode);

    const body = `## Issue Description ##
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
${dotnetInfo.FullInfo}</details>
<details><summary>Visual Studio Code Extensions</summary>
${generateExtensionTable(extensions)}
</details>
`;

    const queryStringPrefix: string = "?";
    const issueDefault = "Please paste the output from your clipboard";
    const fullUrl = `${issuesUrl}${queryStringPrefix}body=${issueDefault}`;
    await vscode.env.clipboard.writeText(body);
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

async function getMonoIfPlatformValid(isValidPlatformForMono: boolean, options: Options, monoResolver: IMonoResolver): Promise<string> {
    if (isValidPlatformForMono) {
        let monoVersion: string;
        try {
            let globalMonoInfo = await monoResolver.getGlobalMonoInfo(options);
            if (globalMonoInfo) {
                monoVersion = `OmniSharp using global mono :${globalMonoInfo.version}`;
            }
            else {
                monoVersion = `OmniSharp using built-in mono`;
            }
        }
        catch (error) {
            monoVersion = `There is a problem with running OmniSharp on mono: ${error}`;
        }

        return `<details><summary>Mono Information</summary>
        ${monoVersion}</details>`;
    }

    return "";
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