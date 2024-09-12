/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    expectText,
    openFileInWorkspaceAsync,
} from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, afterEach } from '@jest/globals';
import { formatDocumentAsync, formatOnTypeAsync, formatRangeAsync } from './formattingTestHelpers';

describe(`[${testAssetWorkspace.description}] Formatting Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(path.join('src', 'app', 'Formatting.cs'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Document formatting formats the entire document', async () => {
        await formatDocumentAsync();

        const expectedText = [
            'namespace Formatting;',
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
        expectText(vscode.window.activeTextEditor!.document, expectedText);
    });

    test('Document range formatting formats only the range', async () => {
        await formatRangeAsync(new vscode.Range(3, 0, 5, 0));

        const expectedText = [
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
        expectText(vscode.window.activeTextEditor!.document, expectedText);
    });

    test('Document on type formatting formats the typed location', async () => {
        // The server expects the position to be the position after the inserted character `;`
        await formatOnTypeAsync(new vscode.Position(7, 37), ';');

        const expectedText = [
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
        expectText(vscode.window.activeTextEditor!.document, expectedText);
    });
});
