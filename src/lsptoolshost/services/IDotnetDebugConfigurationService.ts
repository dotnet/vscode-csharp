/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export enum DotnetDebugConfigurationServiceErrorKind {
    internalError = 'internalError',
    launchCancelled = 'launchCancelled',
    userError = 'userError',
}

export interface IDotnetDebugConfigurationServiceError {
    kind: DotnetDebugConfigurationServiceErrorKind;
    message?: string | undefined;
}

export interface IDotnetDebugConfigurationServiceResult {
    configurations: vscode.DebugConfiguration[];
    error?: IDotnetDebugConfigurationServiceError | undefined;
}

export interface IDotnetDebugConfigurationService {
    resolveDebugConfigurationWithLaunchConfigurationService(
        projectPath: string,
        debugConfiguration: vscode.DebugConfiguration,
        token?: vscode.CancellationToken,
    ): Promise<IDotnetDebugConfigurationServiceResult>;
}