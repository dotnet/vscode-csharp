/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import {
    ensureCSharpExtensionActivated,
    closeAllEditorsAsync,
    expectText,
    openFileInWorkspaceAsync,
    resetCSharpTestWorkspace,
    revertActiveFile,
    usingDevKit,
} from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, afterEach, expect } from '@jest/globals';
import { formatDocumentAsync, formatOnTypeAsync, formatRangeAsync } from './formattingTestHelpers';

describe(`Formatting Tests`, () => {
    let originalOrganizeImportsOnFormat: boolean | undefined;
    let serverProcessId: number | undefined;

    beforeAll(() => {
        originalOrganizeImportsOnFormat = vscode.workspace
            .getConfiguration('dotnet')
            .inspect<boolean>('formatting.organizeImportsOnFormat')?.workspaceValue;
    });

    beforeEach(async () => {
        const extension = await ensureCSharpExtensionActivated();
        if (!usingDevKit()) {
            expect(extension.languageServerProcessId()).toBe(serverProcessId);
        }
        await openFileInWorkspaceAsync(path.join('src', 'app', 'Formatting.cs'));
    });

    afterAll(async () => {
        try {
            await testAssetWorkspace.cleanupWorkspace();
        } finally {
            await setOrganizeImportsOnFormat(originalOrganizeImportsOnFormat);
        }
    });

    afterEach(async () => {
        await revertActiveFile();
        await closeAllEditorsAsync();
    });

    describe('Organize imports disabled', () => {
        beforeAll(async () => {
            await prepareFormattingWorkspace(false);
        });

        test('Document formatting formats the entire document', async () => {
            await formatDocumentAsync();

            const expectedText = [
                'using Options;',
                'using System;',
                'namespace Formatting;',
                '',
                'class DocumentFormatting',
                '{',
                '    public int Property1',
                '    {',
                '        get; set;',
                '    }',
                '',
                '    public void Method1()',
                '    {',
                '        System.Console.Write("");',
                '    }',
                '}',
            ];
            await expectText(vscode.window.activeTextEditor!.document, expectedText);
        });

        test('Document range formatting formats only the range', async () => {
            await formatRangeAsync(new vscode.Range(5, 0, 7, 0));

            const expectedText = [
                'using Options;',
                'using System;',
                'namespace Formatting;',
                'class DocumentFormatting',
                '{',
                '    public int Property1',
                '    {',
                '        get; set;',
                '    }',
                '',
                '    public void Method1() {',
                '            System.Console.Write("");',
                '    }',
                '}',
            ];
            await expectText(vscode.window.activeTextEditor!.document, expectedText);
        });

        test('Document on type formatting formats the typed location', async () => {
            // The server expects the position to be the position after the inserted character `;`
            await formatOnTypeAsync(new vscode.Position(9, 37), ';');

            const expectedText = [
                'using Options;',
                'using System;',
                'namespace Formatting;',
                'class DocumentFormatting',
                '{',
                '    public int Property1 {',
                '        get; set; }',
                '',
                '    public void Method1() {',
                '        System.Console.Write("");',
                '    }',
                '}',
            ];
            await expectText(vscode.window.activeTextEditor!.document, expectedText);
        });
    });

    describe('Organize imports enabled', () => {
        beforeAll(async () => {
            await prepareFormattingWorkspace(true);
        });

        test('Document formatting can organize imports', async () => {
            await formatDocumentAsync();

            const expectedText = [
                'using System;',
                'using Options;',
                'namespace Formatting;',
                '',
                'class DocumentFormatting',
                '{',
                '    public int Property1',
                '    {',
                '        get; set;',
                '    }',
                '',
                '    public void Method1()',
                '    {',
                '        System.Console.Write("");',
                '    }',
                '}',
            ];
            await expectText(vscode.window.activeTextEditor!.document, expectedText);
        });

        test('Document range formatting does not organize imports', async () => {
            await formatRangeAsync(new vscode.Range(0, 0, 7, 0));

            const expectedText = [
                'using Options;',
                'using System;',
                'namespace Formatting;',
                '',
                'class DocumentFormatting',
                '{',
                '    public int Property1',
                '    {',
                '        get; set;',
                '    }',
                '',
                '    public void Method1() {',
                '            System.Console.Write("");',
                '    }',
                '}',
            ];
            await expectText(vscode.window.activeTextEditor!.document, expectedText);
        });
    });

    async function prepareFormattingWorkspace(organizeImports: boolean) {
        await setOrganizeImportsOnFormat(organizeImports);
        // Keep one reset per configuration group until configuration changes have an explicit completion barrier.
        const extension = await resetCSharpTestWorkspace();
        serverProcessId = extension.languageServerProcessId();
        if (!usingDevKit()) {
            expect(serverProcessId).toBeDefined();
        }
    }

    async function setOrganizeImportsOnFormat(value: boolean | undefined) {
        const dotnetConfig = vscode.workspace.getConfiguration('dotnet');
        await dotnetConfig.update('formatting.organizeImportsOnFormat', value, vscode.ConfigurationTarget.Workspace);
    }
});
