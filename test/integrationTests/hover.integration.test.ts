/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { activateCSharpExtension, closeAllEditorsAsync, openFileInWorkspaceAsync } from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';

describe(`[${testAssetWorkspace.description}] Hover Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(path.join('src', 'app', 'hover.cs'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Hover returns correct documentation', async () => {
        const hovers = <vscode.Hover[]>(
            await vscode.commands.executeCommand(
                'vscode.executeHoverProvider',
                vscode.window.activeTextEditor!.document.uri,
                new vscode.Position(33, 27)
            )
        );

        const expected =
            '```csharp\r\nbool testissue.Compare(int gameObject, string tagName)\r\n```\r\n  \r\nA cref&nbsp;testissue  \r\n**strong text**  \r\n_italic text_  \r\n<u>underline text</u>  \r\n  \r\n•&nbsp;Item 1\\.  \r\n•&nbsp;Item 2\\.  \r\n  \r\n[link text](https://google.com)  \r\n  \r\nRemarks are cool too\\.  \r\n  \r\nReturns:  \r\n&nbsp;&nbsp;a string  \r\n  \r\nExceptions:  \r\n&nbsp;&nbsp;NullReferenceException  \r\n';

        expect(hovers.length).toEqual(1);
        expect((hovers[0].contents[0] as vscode.MarkdownString).value).toEqual(expected);
        expect(hovers[0].range).toStrictEqual(new vscode.Range(33, 27, 33, 34));
    });
});
