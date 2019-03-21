/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import testAssetWorkspace from '../integrationTests/testAssets/testAssetWorkspace';
import { activateCSharpExtension, pollUntil, waitForDocumentUpdate, htmlLanguageFeaturesExtensionReady, extensionActivated } from '../integrationTests/integrationHelpers';

let doc: vscode.TextDocument;
let editor: vscode.TextEditor;

suite(`Completions ${testAssetWorkspace.description}`, () => {
    suiteSetup(async function () {
        await activateCSharpExtension();
        await htmlLanguageFeaturesExtensionReady();
        await testAssetWorkspace.restore();
    });

    setup(async () => {
        const filePath = path.join(testAssetWorkspace.projects[0].projectDirectoryPath, 'Pages', 'Index.cshtml');
        doc = await vscode.workspace.openTextDocument(filePath);
        editor = await vscode.window.showTextDocument(doc);
        await extensionActivated;
    });
    
    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
        await pollUntil(() => vscode.window.visibleTextEditors.length === 0, 1000);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();    
    });

    test('Can complete C# code blocks', async () => {
        const lastLine = new vscode.Position(doc.lineCount - 1, 0);
        await editor.edit(edit => edit.insert(lastLine, '@{}'));
        await waitForDocumentUpdate(doc.uri, document => document.getText().indexOf('@{}') >= 0);

        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            doc.uri,
            new vscode.Position(doc.lineCount - 1, 2));
        const matchingCompletions = completions!.items
            .filter(item => (typeof item.insertText === 'string') && item.insertText.startsWith('DateTime'))
            .map(item => item.insertText as string);

        assert.deepEqual(matchingCompletions, ['DateTime', 'DateTimeKind', 'DateTimeOffset']);
    });
});
