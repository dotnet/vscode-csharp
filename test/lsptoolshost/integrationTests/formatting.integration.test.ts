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
import { describe, beforeEach, afterAll, test, afterEach } from '@jest/globals';
import { formatDocumentAsync, formatOnTypeAsync, formatRangeAsync } from './formattingTestHelpers';

describe(`Formatting Tests`, () => {
    beforeEach(async () => {
        await setOrganizeImportsOnFormat(undefined);
        await activateCSharpExtension();

        await openFileInWorkspaceAsync(path.join('src', 'app', 'Formatting.cs'));
    });

    afterAll(async () => {
        await setOrganizeImportsOnFormat(undefined);
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
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

    test('Document formatting can organize imports', async () => {
        await setOrganizeImportsOnFormat(true);
        await activateCSharpExtension();

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
        await setOrganizeImportsOnFormat(true);
        await activateCSharpExtension();

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

    async function setOrganizeImportsOnFormat(value: boolean | undefined) {
        const dotnetConfig = vscode.workspace.getConfiguration('dotnet');
        await dotnetConfig.update('formatting.organizeImportsOnFormat', value, true);
    }
});
