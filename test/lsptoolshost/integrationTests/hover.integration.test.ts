/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { EOL } from 'os';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { activateCSharpExtension, closeAllEditorsAsync, openFileInWorkspaceAsync } from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';

describe(`Hover Tests`, () => {
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

        const expected = `\`\`\`csharp${EOL}bool testissue.Compare(int gameObject, string tagName)${EOL}\`\`\`${EOL}  ${EOL}A cref&nbsp;testissue  ${EOL}**strong text**  ${EOL}_italic text_  ${EOL}<u>underline text</u>  ${EOL}  ${EOL}•&nbsp;Item 1\\.  ${EOL}•&nbsp;Item 2\\.  ${EOL}  ${EOL}[link text](https://google.com)  ${EOL}  ${EOL}Remarks are cool too\\.  ${EOL}  ${EOL}Returns:  ${EOL}&nbsp;&nbsp;a string  ${EOL}  ${EOL}Exceptions:  ${EOL}&nbsp;&nbsp;NullReferenceException  ${EOL}`;

        expect(hovers.length).toEqual(1);
        expect((hovers[0].contents[0] as vscode.MarkdownString).value).toEqual(expected);
        expect(hovers[0].range).toStrictEqual(new vscode.Range(33, 27, 33, 34));
    });
});
