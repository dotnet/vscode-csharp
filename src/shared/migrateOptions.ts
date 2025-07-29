/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { types } from 'util';
import { ConfigurationTarget, vscode, WorkspaceConfiguration } from '../vscodeAdapter';
import { CSharpExtensionId } from '../constants/csharpExtensionId';
import { commonOptions } from './options';

export interface IDotnetAcquisitionExistingPaths {
    extensionId: string;
    path: string;
}

export const dotnetPathOption = 'dotnet.dotnetPath';
export const dotnetAcquisitionExtensionOption = 'dotnetAcquisitionExtension.existingDotnetPath';

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
    {
        oldName: 'omnisharp.organizeImportsOnFormat',
        newName: 'dotnet.formatting.organizeImportsOnFormat',
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

    await migrateDotnetPathOption(vscode);
}

async function migrateDotnetPathOption(vscode: vscode): Promise<void> {
    const configuration = vscode.workspace.getConfiguration();

    if (commonOptions.useOmnisharpServer) {
        // Migrate to O# specific option.
        await MoveOptionsValue(dotnetPathOption, 'omnisharp.dotnetPath', configuration);
    } else {
        const oldOptionInspect = configuration.inspect<string>(dotnetPathOption);
        if (
            !oldOptionInspect ||
            (!oldOptionInspect.globalValue &&
                !oldOptionInspect.workspaceValue &&
                !oldOptionInspect.workspaceFolderValue)
        ) {
            // No value is set, nothing to migrate.
            return;
        }

        const newOptionInspect = configuration.inspect<IDotnetAcquisitionExistingPaths[]>(
            dotnetAcquisitionExtensionOption
        );

        if (oldOptionInspect.globalValue) {
            await migrateSingleDotnetPathValue(
                dotnetPathOption,
                oldOptionInspect.globalValue,
                dotnetAcquisitionExtensionOption,
                newOptionInspect?.globalValue,
                configuration,
                ConfigurationTarget.Global
            );
        }

        if (oldOptionInspect.workspaceValue) {
            await migrateSingleDotnetPathValue(
                dotnetPathOption,
                oldOptionInspect.workspaceValue,
                dotnetAcquisitionExtensionOption,
                newOptionInspect?.workspaceValue,
                configuration,
                ConfigurationTarget.Workspace
            );
        }

        if (oldOptionInspect.workspaceFolderValue) {
            await migrateSingleDotnetPathValue(
                dotnetPathOption,
                oldOptionInspect.workspaceFolderValue,
                dotnetAcquisitionExtensionOption,
                newOptionInspect?.workspaceFolderValue,
                configuration,
                ConfigurationTarget.WorkspaceFolder
            );
        }
    }
}

async function migrateSingleDotnetPathValue(
    oldOptionName: string,
    oldValue: string,
    newOptionName: string,
    currentNewValue: IDotnetAcquisitionExistingPaths[] | undefined,
    configuration: WorkspaceConfiguration,
    configurationTarget: ConfigurationTarget
): Promise<void> {
    // Migrate to .NET install tool specific option.
    // This requires some adjustments as the .NET install tool expects the full path to the exe and can already have a value set (e.g. a diff extension).
    const extension = process.platform === 'win32' ? '.exe' : '';
    const newValue = path.join(oldValue, `dotnet${extension}`);

    if (!fs.existsSync(newValue)) {
        // If the existing option points to a location that doesn't exist, we'll just remove the old value.
        configuration.update(oldOptionName, undefined, configurationTarget);
        return;
    }

    currentNewValue = currentNewValue ?? [];
    if (currentNewValue && currentNewValue.filter((p) => p.extensionId === CSharpExtensionId).length !== 0) {
        // There's already a dotnet path set for this extension, we don't want to overwrite it.  Just delete the old one.
        await configuration.update(oldOptionName, undefined, configurationTarget);
        return;
    }

    currentNewValue.push({ extensionId: CSharpExtensionId, path: newValue });
    await configuration.update(newOptionName, currentNewValue, configurationTarget);
    await configuration.update(oldOptionName, undefined, configurationTarget);
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
