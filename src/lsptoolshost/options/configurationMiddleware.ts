/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ConfigurationParams } from 'vscode-languageclient/node';
import { convertServerOptionNameToClientConfigurationName as convertServerOptionNameToClientConfigurationName } from './optionNameConverter';
import { readEquivalentVsCodeConfiguration } from './universalEditorConfigProvider';

export function readConfigurations(params: ConfigurationParams): (string | null)[] {
    // Note: null means there is no such configuration in client.
    // If the configuration is null, should push 'null' to result.
    const result: (string | null)[] = [];
    const settings = vscode.workspace.getConfiguration();

    for (const configurationItem of params.items) {
        const section = configurationItem.section;
        // Currently only support global option.
        if (section === undefined || configurationItem.scopeUri !== undefined) {
            result.push(null);
            continue;
        }

        // HACK: https://github.com/dotnet/razor/issues/12491
        // In order to allow us to remove the cohosting setting, without a dual Roslyn and Razor
        // insertion, we're just going to hardcode it to true, until we have removed and inserted
        // the code in those repos that check it
        if (section === 'razor.language_server.cohosting_enabled') {
            result.push('true');
            continue;
        }

        // Server use a different name compare to the name defined in client, so do the remapping.
        const clientSideName = convertServerOptionNameToClientConfigurationName(section);
        if (clientSideName == null) {
            result.push(null);
            continue;
        }

        let value = settings.get<string>(clientSideName);
        if (value !== undefined) {
            result.push(value);
            continue;
        }

        value = readEquivalentVsCodeConfiguration(clientSideName);
        if (value !== undefined) {
            result.push(value);
            continue;
        }

        result.push(null);
    }

    return result;
}
