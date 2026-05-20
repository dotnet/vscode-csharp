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

    test('does not modify config when lspServers.csharp object already exists', () => {
        const packagedContent = readFileSync('redist/lsp-config.json', 'utf8');
        const existingConfig = JSON.stringify(
            {
                lspServers: {
                    csharp: {
                        command: 'some-other-command',
                    },
                },
            },
            null,
            2
        );

        const result = getUpdatedCopilotLspConfigContent(existingConfig, packagedContent);
        expect(result.shouldWrite).toBe(false);
    });

    test('uninstall removes lspServers.csharp and preserves other servers', () => {
        const existingConfig = JSON.stringify(
            {
                lspServers: {
                    csharp: {
                        command: 'dotnet',
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
