/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Extension IDs for container-related tools that may require static debugging configurations
 */
export const containerToolsExtensionIds = [
    'ms-azuretools.vscode-docker', // Docker extension
    'ms-vscode-remote.remote-containers', // Dev Containers extension
];

/**
 * Checks if any container tools extension is installed and active.
 * Container debugging scenarios require static task configurations and cannot use
 * dynamic debugging configurations from C# Dev Kit.
 * @returns true if any container tools extension is found
 */
export function hasContainerToolsExtension(): boolean {
    return containerToolsExtensionIds.some((extensionId) => {
        const extension = vscode.extensions.getExtension(extensionId);
        return extension !== undefined;
    });
}