/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, vscode, WorkspaceConfiguration } from '../vscodeAdapter';

// Option in the array should be identical to each other, except the name.
export const migrateOptions = [
    {
        omnisharpOption: 'csharp.inlayHints.parameters.enabled',
        roslynOption: 'dotnet.inlayHints.enableInlayHintsForParameters',
    },
    {
        omnisharpOption: 'csharp.inlayHints.parameters.forLiteralParameters',
        roslynOption: 'dotnet.inlayHints.enableInlayHintsForLiteralParameters',
    },
    {
        omnisharpOption: 'csharp.inlayHints.parameters.forIndexerParameters',
        roslynOption: 'dotnet.inlayHints.enableInlayHintsForIndexerParameters',
    },
    {
        omnisharpOption: 'csharp.inlayHints.parameters.forObjectCreationParameters',
        roslynOption: 'dotnet.inlayHints.enableInlayHintsForObjectCreationParameters',
    },
    {
        omnisharpOption: 'csharp.inlayHints.parameters.forOtherParameters',
        roslynOption: 'dotnet.inlayHints.enableInlayHintsForOtherParameters',
    },
    {
        omnisharpOption: 'csharp.inlayHints.parameters.suppressForParametersThatDifferOnlyBySuffix',
        roslynOption: 'dotnet.inlayHints.suppressInlayHintsForParametersThatDifferOnlyBySuffix',
    },
    {
        omnisharpOption: 'csharp.inlayHints.parameters.suppressForParametersThatMatchMethodIntent',
        roslynOption: 'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchMethodIntent',
    },
    {
        omnisharpOption: 'csharp.inlayHints.parameters.suppressForParametersThatMatchArgumentName',
        roslynOption: 'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchArgumentName',
    },
    { omnisharpOption: 'csharp.inlayHints.types.enabled', roslynOption: 'csharp.inlayHints.enableInlayHintsForTypes' },
    {
        omnisharpOption: 'csharp.inlayHints.types.forImplicitVariableTypes',
        roslynOption: 'csharp.inlayHints.enableInlayHintsForImplicitVariableTypes',
    },
    {
        omnisharpOption: 'csharp.inlayHints.types.forLambdaParameterTypes',
        roslynOption: 'csharp.inlayHints.enableInlayHintsForLambdaParameterTypes',
    },
    {
        omnisharpOption: 'csharp.inlayHints.types.forImplicitObjectCreation',
        roslynOption: 'csharp.inlayHints.enableInlayHintsForImplicitObjectCreation',
    },
    { omnisharpOption: 'omnisharp.defaultLaunchSolution', roslynOption: 'dotnet.defaultSolution' },
    {
        omnisharpOption: 'omnisharp.enableImportCompletion',
        roslynOption: 'dotnet.completion.showCompletionItemsFromUnimportedNamespaces',
    },
    {
        omnisharpOption: 'csharp.referencesCodeLens.enabled',
        roslynOption: 'dotnet.codeLens.enableReferencesCodeLens',
    },
    {
        omnisharpOption: 'csharp.testsCodeLens.enabled',
        roslynOption: 'dotnet.codeLens.enableTestsCodeLens',
    },
];

export async function MigrateOptions(vscode: vscode): Promise<void> {
    const configuration = vscode.workspace.getConfiguration();
    for (const { omnisharpOption, roslynOption } of migrateOptions) {
        if (!configuration.has(omnisharpOption)) {
            continue;
        }

        const inspectionValueOfRoslynOption = configuration.inspect(roslynOption);
        if (inspectionValueOfRoslynOption == undefined) {
            continue;
        }

        const roslynOptionValue = configuration.get(roslynOption);
        if (roslynOptionValue == undefined) {
            continue;
        }

        if (roslynOptionValue == inspectionValueOfRoslynOption.defaultValue) {
            await MoveOptionsValue(omnisharpOption, roslynOption, configuration);
        }
    }
}

async function MoveOptionsValue(
    fromOption: string,
    toOption: string,
    workspaceConfig: WorkspaceConfiguration
): Promise<void> {
    const inspectionValue = workspaceConfig.inspect<any>(fromOption);
    if (inspectionValue !== undefined) {
        const { key: _, defaultValue: __, globalValue, workspaceValue, workspaceFolderValue } = inspectionValue;
        if (globalValue !== undefined) {
            await workspaceConfig.update(toOption, globalValue, ConfigurationTarget.Global);
            await workspaceConfig.update(fromOption, undefined, ConfigurationTarget.Global);
        }

        if (workspaceValue !== undefined) {
            await workspaceConfig.update(toOption, workspaceValue, ConfigurationTarget.Workspace);
            await workspaceConfig.update(fromOption, undefined, ConfigurationTarget.Workspace);
        }

        if (workspaceFolderValue !== undefined) {
            await workspaceConfig.update(toOption, workspaceFolderValue, ConfigurationTarget.WorkspaceFolder);
            await workspaceConfig.update(fromOption, undefined, ConfigurationTarget.WorkspaceFolder);
        }
    }
}
