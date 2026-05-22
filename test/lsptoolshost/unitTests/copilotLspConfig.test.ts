/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import {
    getUninstalledCopilotLspConfigContent,
    getUpdatedCopilotLspConfigContent,
} from '../../../src/lsptoolshost/copilotLspConfig';

describe('Copilot LSP config installation', () => {
    test('is idempotent and preserves shipped config content across multiple runs', () => {
        const packagedContent = readFileSync('redist/lsp-config.json', 'utf8');

        const firstRun = getUpdatedCopilotLspConfigContent(undefined, packagedContent);
        expect(firstRun.shouldWrite).toBe(true);
        expect(firstRun.updatedContent).toBe(packagedContent);

        const secondRun = getUpdatedCopilotLspConfigContent(firstRun.updatedContent, packagedContent);
        expect(secondRun.shouldWrite).toBe(false);

        const finalContent = secondRun.updatedContent ?? firstRun.updatedContent;
        expect(finalContent).toBe(packagedContent);
    });

    test('does not modify config when any server maps .cs in fileExtensions', () => {
        const packagedContent = readFileSync('redist/lsp-config.json', 'utf8');
        const existingConfig = JSON.stringify(
            {
                lspServers: {
                    customServerName: {
                        command: 'some-other-command',
                        fileExtensions: {
                            '.cs': 'csharp',
                        },
                    },
                },
            },
            null,
            2
        );

        const result = getUpdatedCopilotLspConfigContent(existingConfig, packagedContent);
        expect(result.shouldWrite).toBe(false);
    });

    test('adds csharp server when .cs is not present in fileExtensions', () => {
        const packagedContent = readFileSync('redist/lsp-config.json', 'utf8');
        const existingConfig = JSON.stringify(
            {
                lspServers: {
                    typescript: {
                        command: 'typescript-language-server',
                        fileExtensions: {
                            '.ts': 'typescript',
                        },
                    },
                },
            },
            null,
            2
        );

        const result = getUpdatedCopilotLspConfigContent(existingConfig, packagedContent);
        expect(result.shouldWrite).toBe(true);
        const parsed = JSON.parse(result.updatedContent!);
        expect(parsed.lspServers.csharp).toBeDefined();
    });

    test('uninstall removes lspServers.csharp when it maps .cs and preserves other servers', () => {
        const existingConfig = JSON.stringify(
            {
                lspServers: {
                    csharp: {
                        command: 'dotnet',
                        fileExtensions: {
                            '.cs': 'csharp',
                        },
                    },
                    typescript: {
                        command: 'typescript-language-server',
                        args: ['--stdio'],
                    },
                },
            },
            null,
            2
        );

        const result = getUninstalledCopilotLspConfigContent(existingConfig);
        expect(result.shouldWrite).toBe(true);
        const parsed = JSON.parse(result.updatedContent!);
        expect(parsed.lspServers.csharp).toBeUndefined();
        expect(parsed.lspServers.typescript).toBeDefined();
    });

    test('uninstall removes custom server when it maps .cs in fileExtensions', () => {
        const existingConfig = JSON.stringify(
            {
                lspServers: {
                    customCsharpServer: {
                        command: 'dotnet',
                        fileExtensions: {
                            '.cs': 'csharp',
                        },
                    },
                    typescript: {
                        command: 'typescript-language-server',
                        fileExtensions: {
                            '.ts': 'typescript',
                        },
                    },
                },
            },
            null,
            2
        );

        const result = getUninstalledCopilotLspConfigContent(existingConfig);
        expect(result.shouldWrite).toBe(true);
        const parsed = JSON.parse(result.updatedContent!);
        expect(parsed.lspServers.customCsharpServer).toBeUndefined();
        expect(parsed.lspServers.typescript).toBeDefined();
    });

    test('uninstall is a no-op when lspServers.csharp is absent', () => {
        const existingConfig = JSON.stringify(
            {
                lspServers: {
                    typescript: {
                        command: 'typescript-language-server',
                    },
                },
            },
            null,
            2
        );

        const result = getUninstalledCopilotLspConfigContent(existingConfig);
        expect(result.shouldWrite).toBe(false);
    });
});
