/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface CopilotLspConfig {
    lspServers?: { [key: string]: unknown };
}

export function getUpdatedCopilotLspConfigContent(
    currentContent: string | undefined,
    packagedContent: string
): { shouldWrite: boolean; updatedContent?: string } {
    const packagedConfig = JSON.parse(packagedContent) as CopilotLspConfig;
    const packagedCsharpConfig = packagedConfig.lspServers?.csharp;
    if (!packagedCsharpConfig || typeof packagedCsharpConfig !== 'object') {
        throw new Error('Packaged Copilot LSP config is missing lspServers.csharp.');
    }

    if (currentContent === undefined) {
        return { shouldWrite: true, updatedContent: packagedContent };
    }

    const currentConfig = JSON.parse(currentContent) as CopilotLspConfig;
    if (copilotConfigContainsCSharpLsp(currentConfig)) {
        return { shouldWrite: false };
    }

    const updatedConfig: CopilotLspConfig = {
        ...currentConfig,
        lspServers:
            currentConfig.lspServers && typeof currentConfig.lspServers === 'object'
                ? { ...currentConfig.lspServers }
                : {},
    };

    updatedConfig.lspServers!.csharp = packagedCsharpConfig;
    return { shouldWrite: true, updatedContent: `${JSON.stringify(updatedConfig, null, 2)}\n` };
}

export function getUninstalledCopilotLspConfigContent(currentContent: string | undefined): {
    shouldWrite: boolean;
    updatedContent?: string;
} {
    if (currentContent === undefined) {
        return { shouldWrite: false };
    }

    const currentConfig = JSON.parse(currentContent) as CopilotLspConfig;
    const lspServers = currentConfig.lspServers;
    if (!lspServers || typeof lspServers !== 'object') {
        return { shouldWrite: false };
    }

    const updatedConfig: CopilotLspConfig = {
        ...currentConfig,
        lspServers: { ...lspServers },
    };

    const matchingServerNames = getCSharpServerNames(lspServers);
    for (const serverName of matchingServerNames) {
        delete updatedConfig.lspServers![serverName];
    }

    if (matchingServerNames.length === 0) {
        return { shouldWrite: false };
    }

    return { shouldWrite: true, updatedContent: `${JSON.stringify(updatedConfig, null, 2)}\n` };
}

function copilotConfigContainsCSharpLsp(lspConfig: CopilotLspConfig): boolean {
    const lspServers = lspConfig.lspServers;
    if (!lspServers || typeof lspServers !== 'object') {
        return false;
    }

    return containsCSharpServer(lspServers);
}

function getCSharpServerNames(lspServers: { [key: string]: unknown }): string[] {
    const csharpServerNames: string[] = [];

    for (const [serverName, server] of Object.entries(lspServers)) {
        if (serverContainsCSharpFileExtension(server)) {
            csharpServerNames.push(serverName);
        }
    }

    return csharpServerNames;
}

function containsCSharpServer(lspServers: { [key: string]: unknown }): boolean {
    for (const [serverName, server] of Object.entries(lspServers)) {
        if (serverName === 'csharp' || serverContainsCSharpFileExtension(server)) {
            return true;
        }
    }

    return false;
}

function serverContainsCSharpFileExtension(server: unknown): boolean {
    if (!server || typeof server !== 'object') {
        return false;
    }

    const fileExtensions = (server as { fileExtensions?: unknown }).fileExtensions;
    if (!fileExtensions) {
        return false;
    }

    if (Array.isArray(fileExtensions)) {
        return fileExtensions.includes('.cs');
    }

    return typeof fileExtensions === 'object' && '.cs' in fileExtensions;
}
