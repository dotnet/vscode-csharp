/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { expect, should } from 'chai';
import * as vscode from 'vscode';
import * as path from 'path';
import { isRazorWorkspace } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

const onTypeFormatProviderCommand = 'vscode.executeFormatOnTypeProvider';

function normalizeNewlines(original: string): string {
    while (original.indexOf('\r\n') != -1) {
        original = original.replace('\r\n', '\n');
    }

    return original;
}

suite(`Documentation Comment Auto Formatting: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        if (isRazorWorkspace(vscode.workspace)) {
            // The format-on-type provider does not run for razor files.
            this.skip();
        }

        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const filePath = path.join(projectDirectory, 'DocComments.cs');
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand('vscode.open', fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Triple slash inserts doc comment snippet', async () => {
        const commentPosition = new vscode.Position(2, 7);
        const formatEdits = <vscode.TextEdit[]>(await vscode.commands.executeCommand(onTypeFormatProviderCommand, fileUri, commentPosition, '/'));
        expect(formatEdits).ofSize(1);
        expect(normalizeNewlines(formatEdits[0].newText)).eq(" <summary>\n    /// \n    /// </summary>\n    /// <param name=\"param1\"></param>\n    /// <param name=\"param2\"></param>\n    /// <returns></returns>");
        expect(formatEdits[0].range.start.line).eq(commentPosition.line);
        expect(formatEdits[0].range.start.character).eq(commentPosition.character);
        expect(formatEdits[0].range.end.line).eq(commentPosition.line);
        expect(formatEdits[0].range.end.character).eq(commentPosition.character);
    });

    test('Enter in comment inserts triple-slashes preceding', async () => {
        const commentPosition = new vscode.Position(9, 0);
        const formatEdits = <vscode.TextEdit[]>(await vscode.commands.executeCommand(onTypeFormatProviderCommand, fileUri, commentPosition, '\n'));
        expect(formatEdits).ofSize(1);
        expect(formatEdits[0].newText).eq("    /// ");
        expect(formatEdits[0].range.start.line).eq(commentPosition.line);
        expect(formatEdits[0].range.start.character).eq(commentPosition.character);
        expect(formatEdits[0].range.end.line).eq(commentPosition.line);
        expect(formatEdits[0].range.end.character).eq(commentPosition.character);
    });
});
