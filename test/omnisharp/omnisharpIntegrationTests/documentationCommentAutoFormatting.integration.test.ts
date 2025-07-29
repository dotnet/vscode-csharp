/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import { describeIfNotRazorOrGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';

const onTypeFormatProviderCommand = 'vscode.executeFormatOnTypeProvider';

function normalizeNewlines(original: string): string {
    while (original.indexOf('\r\n') != -1) {
        original = original.replace('\r\n', '\n');
    }

    return original;
}

describeIfNotRazorOrGenerator(`Documentation Comment Auto Formatting: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const filePath = path.join(projectDirectory, 'DocComments.cs');
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand('vscode.open', fileUri);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Triple slash inserts doc comment snippet', async () => {
        const commentPosition = new vscode.Position(2, 7);
        const formatEdits = <vscode.TextEdit[]>(
            await vscode.commands.executeCommand(onTypeFormatProviderCommand, fileUri, commentPosition, '/')
        );
        expect(formatEdits).toHaveLength(1);
        expect(normalizeNewlines(formatEdits[0].newText)).toEqual(
            ' <summary>\n    /// \n    /// </summary>\n    /// <param name="param1"></param>\n    /// <param name="param2"></param>\n    /// <returns></returns>'
        );
        expect(formatEdits[0].range.start.line).toEqual(commentPosition.line);
        expect(formatEdits[0].range.start.character).toEqual(commentPosition.character);
        expect(formatEdits[0].range.end.line).toEqual(commentPosition.line);
        expect(formatEdits[0].range.end.character).toEqual(commentPosition.character);
    });

    test('Enter in comment inserts triple-slashes preceding', async () => {
        const commentPosition = new vscode.Position(9, 0);
        const formatEdits = <vscode.TextEdit[]>(
            await vscode.commands.executeCommand(onTypeFormatProviderCommand, fileUri, commentPosition, '\n')
        );
        expect(formatEdits).toHaveLength(1);
        expect(formatEdits[0].newText).toEqual('    /// ');
        expect(formatEdits[0].range.start.line).toEqual(commentPosition.line);
        expect(formatEdits[0].range.start.character).toEqual(commentPosition.character);
        expect(formatEdits[0].range.end.line).toEqual(commentPosition.line);
        expect(formatEdits[0].range.end.character).toEqual(commentPosition.character);
    });
});
