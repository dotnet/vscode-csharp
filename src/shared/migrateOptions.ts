/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { types } from 'util';
import { ConfigurationTarget, vscode, WorkspaceConfiguration } from '../vscodeAdapter';

// Option in the array should be identical to each other, except the name.
export const migrateOptions = [
    {
        oldName: 'csharp.inlayHints.parameters.enabled',
        newName: 'dotnet.inlayHints.enableInlayHintsForParameters',
    },
    {
        oldName: 'csharp.inlayHints.parameters.forLiteralParameters',
        newName: 'dotnet.inlayHints.enableInlayHintsForLiteralParameters',
    },
    {
        oldName: 'csharp.inlayHints.parameters.forIndexerParameters',
        newName: 'dotnet.inlayHints.enableInlayHintsForIndexerParameters',
    },
    {
        oldName: 'csharp.inlayHints.parameters.forObjectCreationParameters',
        newName: 'dotnet.inlayHints.enableInlayHintsForObjectCreationParameters',
    },
    {
        oldName: 'csharp.inlayHints.parameters.forOtherParameters',
        newName: 'dotnet.inlayHints.enableInlayHintsForOtherParameters',
    },
    {
        oldName: 'csharp.inlayHints.parameters.suppressForParametersThatDifferOnlyBySuffix',
        newName: 'dotnet.inlayHints.suppressInlayHintsForParametersThatDifferOnlyBySuffix',
    },
    {
        oldName: 'csharp.inlayHints.parameters.suppressForParametersThatMatchMethodIntent',
        newName: 'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchMethodIntent',
    },
    {
        oldName: 'csharp.inlayHints.parameters.suppressForParametersThatMatchArgumentName',
        newName: 'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchArgumentName',
    },
    {
        oldName: 'csharp.inlayHints.types.enabled',
        newName: 'csharp.inlayHints.enableInlayHintsForTypes',
    },
    {
        oldName: 'csharp.inlayHints.types.forImplicitVariableTypes',
        newName: 'csharp.inlayHints.enableInlayHintsForImplicitVariableTypes',
    },
    {
        oldName: 'csharp.inlayHints.types.forLambdaParameterTypes',
        newName: 'csharp.inlayHints.enableInlayHintsForLambdaParameterTypes',
    },
    {
        oldName: 'csharp.inlayHints.types.forImplicitObjectCreation',
        newName: 'csharp.inlayHints.enableInlayHintsForImplicitObjectCreation',
    },
    {
        oldName: 'omnisharp.defaultLaunchSolution',
        newName: 'dotnet.defaultSolution',
    },
    {
        oldName: 'omnisharp.enableImportCompletion',
        newName: 'dotnet.completion.showCompletionItemsFromUnimportedNamespaces',
    },
    {
        oldName: 'csharp.referencesCodeLens.enabled',
        newName: 'dotnet.codeLens.enableReferencesCodeLens',
    },
    {
        oldName: 'csharp.testsCodeLens.enabled',
        newName: 'dotnet.codeLens.enableTestsCodeLens',
    },
    {
        oldName: 'csharp.unitTestDebuggingOptions',
        newName: 'dotnet.unitTestDebuggingOptions',
    },
    {
        oldName: 'omnisharp.testRunSettings',
        newName: 'dotnet.unitTests.runSettingsPath',
    },
    {
        oldName: 'dotnet.implementType.insertionBehavior',
        newName: 'dotnet.typeMembers.memberInsertionLocation',
    },
    {
        oldName: 'dotnet.implementType.propertyGenerationBehavior',
        newName: 'dotnet.typeMembers.propertyGenerationBehavior',
    },
];

export async function MigrateOptions(vscode: vscode): Promise<void> {
    const configuration = vscode.workspace.getConfiguration();
    for (const { oldName, newName } of migrateOptions) {
        if (!configuration.has(oldName)) {
            continue;
        }

        const inspectionValueOfNewOption = configuration.inspect(newName);
        if (inspectionValueOfNewOption == undefined) {
            continue;
        }

        const newOptionValue = configuration.get(newName);
        if (newOptionValue == undefined) {
            continue;
        }

        if (shouldMove(newOptionValue, inspectionValueOfNewOption.defaultValue)) {
            await MoveOptionsValue(oldName, newName, configuration);
        }
    }
}

function shouldMove(newOptionValue: unknown, defaultInspectValueOfNewOption: unknown): boolean {
    if (newOptionValue == defaultInspectValueOfNewOption) {
        return true;
    }

    // For certain kinds of complex object options, vscode will return a proxy object which isn't comparable to the default empty object {}.
    if (types.isProxy(newOptionValue)) {
        return JSON.stringify(newOptionValue) === JSON.stringify(defaultInspectValueOfNewOption);
    }

    return false;
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
