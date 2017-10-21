import * as vscode from 'vscode';
import { parse } from 'jsonc-parser';
import { createLaunchConfiguration, createAttachConfiguration } from './assets';

export class CSharpConfigurationProvider implements vscode.DebugConfigurationProvider {
    /**
	 * Returns an initial debug configuration based on contextual information, e.g. package.json or folder.
	 */
    provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        // jsonc-parser's parse function parses a JSON string with comments into a JSON object.
        return [
            parse(createLaunchConfiguration("${workspaceFolder}/bin/Debug/<insert-target-framework-here>/<insert-project-name-here>.dll", '${workspaceFolder}')), 
            parse(createAttachConfiguration())
        ];
    }

    /**
	 * Try to add all missing attributes to the debug configuration being launched.
	 */
	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
        return null;
    }   
}