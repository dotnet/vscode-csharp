/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 import { WorkspaceEdit, CancellationToken, ProviderResult, Location } from "vscode";

/**
 * The language feature middleware interface defines the contract between Omnisharp and
 * the plugins of Omnisharp.
 */
export interface LanguageMiddleware {

    language: string;
    
    remapWorkspaceEdit?(workspaceEdit: WorkspaceEdit, token: CancellationToken): ProviderResult<WorkspaceEdit>;
    
    remapLocations?(locations: Location[], token: CancellationToken): ProviderResult<Location[]>;
}