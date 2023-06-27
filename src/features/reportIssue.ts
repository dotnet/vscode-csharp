/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode, Extension } from '../vscodeAdapter';
import { EventStream } from '../eventStream';
import { OpenURL } from '../omnisharp/loggingEvents';
import { Options } from '../shared/options';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { IGetDotnetInfo } from '../constants/IGetDotnetInfo';
import { dirname } from 'path';

const issuesUrl = 'https://github.com/OmniSharp/omnisharp-vscode/issues/new';

export default async function reportIssue(
    vscode: vscode,
    csharpExtVersion: string,
    eventStream: EventStream,
    getDotnetInfo: IGetDotnetInfo,
    isValidPlatformForMono: boolean,
    options: Options,
    dotnetResolver: IHostExecutableResolver,
    monoResolver: IHostExecutableResolver
) {
    // Get info for the dotnet that the Omnisharp executable is run on, not the dotnet Omnisharp will execute user code on.
    let fullDotnetInfo: string | undefined;
    try {
        const dotnetInfo = await getDotnetInfo([dirname((await dotnetResolver.getHostExecutableInfo(options)).path)]);
        fullDotnetInfo = dotnetInfo.FullInfo;
    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        fullDotnetInfo = message;
    }

    const monoInfo = await getMonoIfPlatformValid(isValidPlatformForMono, options, monoResolver);
    const extensions = getInstalledExtensions(vscode);

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
${fullDotnetInfo}</details>
<details><summary>Visual Studio Code Extensions</summary>
${generateExtensionTable(extensions)}
</details>
`;

    const queryStringPrefix = '?';
    const issueDefault = 'Please paste the output from your clipboard';
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
        return 'none';
    }

    const tableHeader = `|Extension|Author|Version|\n|---|---|---|`;
    const table = extensions
        .map((e) => `|${e.packageJSON.name}|${e.packageJSON.publisher}|${e.packageJSON.version}|`)
        .join('\n');

    const extensionTable = `
${tableHeader}\n${table};
`;

    return extensionTable;
}

async function getMonoIfPlatformValid(
    isValidPlatformForMono: boolean,
    options: Options,
    monoResolver: IHostExecutableResolver
): Promise<string> {
    if (isValidPlatformForMono) {
        let monoVersion = 'Unknown Mono version';
        try {
            const monoInfo = await monoResolver.getHostExecutableInfo(options);
            monoVersion = `OmniSharp using mono: ${monoInfo.version}`;
        } catch (error) {
            monoVersion = `There is a problem with running OmniSharp on mono: ${error}`;
        }

        return `<details><summary>Mono Information</summary>
        ${monoVersion}</details>`;
    }

    return '';
}

function getInstalledExtensions(vscode: vscode) {
    const extensions = vscode.extensions.all.filter((extension) => extension.packageJSON.isBuiltin === false);

    return extensions.sort(sortExtensions);
}
