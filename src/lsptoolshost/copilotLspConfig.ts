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
    if (copilotConfigContainsRoslynLanguageServer(currentConfig)) {
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

function copilotConfigContainsRoslynLanguageServer(lspConfig: CopilotLspConfig): boolean {
    const lspServers = lspConfig.lspServers;
    if (!lspServers || typeof lspServers !== 'object') {
        return false;
    }

    const csharpServer = lspServers.csharp;
    if (csharpServer && typeof csharpServer === 'object') {
        return true;
    }

    return false;
}
