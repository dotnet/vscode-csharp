/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, vscode, WorkspaceConfiguration } from '../vscodeAdapter';

// Option in the array should be identical to each other, except the name.
const mergeOptions = [
    {omnisharpOption: "csharp.inlayHints.parameters.enabled", roslynOption: "dotnet.inlineHints.enableInlineHintsForParameters" },
    {omnisharpOption: "csharp.inlayHints.parameters.forLiteralParameters", roslynOption: "dotnet.inlineHints.enableInlineHintsForLiteralParameters" },
    {omnisharpOption: "csharp.inlayHints.parameters.forIndexerParameters", roslynOption: "dotnet.inlineHints.enableInlineHintsForIndexerParameters" },
    {omnisharpOption: "csharp.inlayHints.parameters.forObjectCreationParameters", roslynOption: "dotnet.inlineHints.enableInlineHintsForObjectCreationParameters" },
    {omnisharpOption: "csharp.inlayHints.parameters.forOtherParameters", roslynOption: "dotnet.inlineHints.enableInlineHintsForOtherParameters" },
    {omnisharpOption: "csharp.inlayHints.parameters.suppressForParametersThatDifferOnlyBySuffix", roslynOption: "dotnet.inlineHints.suppressInlineHintsForParametersThatDifferOnlyBySuffix" },
    {omnisharpOption: "csharp.inlayHints.parameters.suppressForParametersThatMatchMethodIntent", roslynOption: "dotnet.inlineHints.suppressInlineHintsForParametersThatMatchMethodIntent" },
    {omnisharpOption: "csharp.inlayHints.parameters.suppressForParametersThatMatchArgumentName", roslynOption: "dotnet.inlineHints.suppressInlineHintsForParametersThatMatchArgumentName" },
    {omnisharpOption: "csharp.inlayHints.types.enabled", roslynOption: "csharp.inlineHints.enableInlineHintsForTypes" },
    {omnisharpOption: "csharp.inlayHints.types.forImplicitVariableTypes", roslynOption: "csharp.inlineHints.enableInlineHintsForImplicitVariableTypes" },
    {omnisharpOption: "csharp.inlayHints.types.forLambdaParameterTypes", roslynOption: "csharp.inlineHints.enableInlineHintsForLambdaParameterTypes" },
    {omnisharpOption: "csharp.inlayHints.types.forImplicitObjectCreation", roslynOption: "csharp.inlineHints.enableInlineHintsForImplicitObjectCreation" },
];

export async function MigrateOptions(vscode: vscode): Promise<void> {
    let configuration = vscode.workspace.getConfiguration();
    for (const {omnisharpOption, roslynOption} of mergeOptions) {
        let roslynOptionValue = configuration.get(roslynOption);
        let roslynOptionDefaultValue = configuration.inspect(roslynOption)?.defaultValue;
        let roslynOptionsHasValue = roslynOption !== undefined ? roslynOptionValue !== roslynOptionDefaultValue : false;
        if (configuration.has(omnisharpOption) && !roslynOptionsHasValue) {
            await MoveOptionsValue(omnisharpOption, roslynOption, configuration);
        }
    }
}

async function MoveOptionsValue(fromOption: string, toOption: string, workspaceConfig: WorkspaceConfiguration) : Promise<void> {
    let inspectionValue = workspaceConfig.inspect<any>(fromOption);
    if (inspectionValue !== undefined) {
        let {key: _, defaultValue: __, globalValue, workspaceValue, workspaceFolderValue} = inspectionValue;
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