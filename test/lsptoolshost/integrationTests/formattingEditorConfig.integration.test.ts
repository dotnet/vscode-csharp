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

describe(`Formatting With EditorConfig Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(
            path.join('src', 'app', 'folderWithEditorConfig', 'FormattingWithEditorConfig.cs')
        );
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Document formatting respects editorconfig', async () => {
        await formatDocumentAsync();

        const expectedText = [
            'namespace Formatting;',
            '',
            'class DocumentFormattingWithEditorConfig {',
            '    public int Property1 {',
            '        get; set;',
            '    }',
            '',
            '    public void Method1() {',
            '        if (true) {',
            '        }',
            '    }',
            '}',
        ];
        await expectText(vscode.window.activeTextEditor!.document, expectedText);
    });

    test('Document range formatting respects editorconfig', async () => {
        await formatRangeAsync(new vscode.Range(3, 0, 6, 0));

        const expectedText = [
            'namespace Formatting;',
            'class DocumentFormattingWithEditorConfig',
            '{',
            '    public int Property1 {',
            '        get; set;',
            '    }',
            '',
            '    public void Method1()',
            '    {',
            '        if (true)',
            '        {',
            '        }',
            '    }',
            '}',
        ];
        await expectText(vscode.window.activeTextEditor!.document, expectedText);
    });

    test('Document on type formatting respects editorconfig', async () => {
        // The server expects the position to be the position after the inserted character `}`
        await formatOnTypeAsync(new vscode.Position(12, 9), '}');

        const expectedText = [
            'namespace Formatting;',
            'class DocumentFormattingWithEditorConfig',
            '{',
            '    public int Property1',
            '    {',
            '        get; set;',
            '    }',
            '',
            '    public void Method1()',
            '    {',
            '        if (true) {',
            '        }',
            '    }',
            '}',
        ];
        await expectText(vscode.window.activeTextEditor!.document, expectedText);
    });
});
