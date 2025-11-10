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
    openFileInWorkspaceAsync,
    revertActiveFile,
    sleep,
    waitForExpectedResult,
} from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';
import { EOL } from 'os';

describe(`OnAutoInsert Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(path.join('src', 'app', 'DocComments.cs'));
    });

    afterEach(async () => {
        await revertActiveFile();
        await closeAllEditorsAsync();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Triple slash inserts doc comment snippet', async () => {
        await sleep(1);
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(new vscode.Position(2, 6), '/');
        });

        // OnAutoInsert is triggered by the change event but completes asynchronously, so wait for the buffer to be updated.

        await waitForExpectedResult<string | undefined>(
            async () => vscode.window.activeTextEditor?.document.getText(),
            10000,
            100,
            (input) => {
                expect(normalizeNewlines(input)).toContain(
                    '/// <summary>\n    /// \n    /// </summary>\n    /// <param name="param1"></param>\n    /// <param name="param2"></param>\n    /// <returns></returns>'
                );
            }
        );
    });

    test('Enter in comment inserts triple-slashes preceding', async () => {
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(new vscode.Position(8, 17), '\n');
        });

        // OnAutoInsert is triggered by the change event but completes asynchronously, so wait for the buffer to be updated.

        await waitForExpectedResult<string | undefined>(
            async () => vscode.window.activeTextEditor?.document.getText(),
            10000,
            100,
            (input) => {
                expect(normalizeNewlines(input)).toContain(
                    '/// <summary>\n    /// \n\n    /// </summary>\n    void M2() {}'
                );
            }
        );
    });

    test('Enter inside braces fixes brace lines', async () => {
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(new vscode.Position(11, 15), '\n');
        });

        // OnAutoInsert is triggered by the change event but completes asynchronously, so wait for the buffer to be updated.

        const expectedLines = [
            'class DocComments',
            '{',
            '    //',
            '    string M(int param1, string param2)',
            '    {',
            '        return null;',
            '    }',
            '',
            '    /// <summary>',
            '',
            '    /// </summary>',
            '    void M2()',
            '    {',
            '        ',
            '    }',
            '}',
            '',
        ];

        await waitForExpectedResult<string | undefined>(
            async () => vscode.window.activeTextEditor?.document.getText(),
            10000,
            100,
            (input) => {
                expect(input).toBe(expectedLines.join(EOL));
            }
        );
    });

    test('Enter inside braces respects language-specific tabSize', async () => {
        // Set global tabSize to 2 and C# tabSize to 4
        const globalConfig = vscode.workspace.getConfiguration('editor');
        const csharpConfig = vscode.workspace.getConfiguration('editor', {
            languageId: 'csharp',
            uri: vscode.window.activeTextEditor!.document.uri,
        });

        const originalGlobalTabSize = globalConfig.get('tabSize');
        const originalCsharpTabSize = csharpConfig.get('tabSize');

        try {
            // Configure global tabSize to 2
            await globalConfig.update('tabSize', 2, vscode.ConfigurationTarget.Global);
            // Configure C# tabSize to 4
            await vscode.workspace
                .getConfiguration('[csharp]', vscode.window.activeTextEditor!.document.uri)
                .update('editor.tabSize', 4, vscode.ConfigurationTarget.Global);

            // Wait for configuration to propagate
            await sleep(100);

            await vscode.window.activeTextEditor!.edit((editBuilder) => {
                editBuilder.insert(new vscode.Position(11, 15), '\n');
            });

            // OnAutoInsert is triggered by the change event but completes asynchronously, so wait for the buffer to be updated.

            const expectedLines = [
                'class DocComments',
                '{',
                '    //',
                '    string M(int param1, string param2)',
                '    {',
                '        return null;',
                '    }',
                '',
                '    /// <summary>',
                '',
                '    /// </summary>',
                '    void M2()',
                '    {',
                '        ', // Should be 4 spaces (C# setting), not 2 (global setting)
                '    }',
                '}',
                '',
            ];

            await waitForExpectedResult<string | undefined>(
                async () => vscode.window.activeTextEditor?.document.getText(),
                10000,
                100,
                (input) => {
                    expect(input).toBe(expectedLines.join(EOL));
                }
            );
        } finally {
            // Restore original settings
            await globalConfig.update('tabSize', originalGlobalTabSize, vscode.ConfigurationTarget.Global);
            await vscode.workspace
                .getConfiguration('[csharp]', vscode.window.activeTextEditor!.document.uri)
                .update('editor.tabSize', originalCsharpTabSize, vscode.ConfigurationTarget.Global);
        }
    });
});

function normalizeNewlines(text: string | undefined): string | undefined {
    return text?.replaceAll('\r\n', '\n');
}
