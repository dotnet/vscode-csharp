/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from 'vscode';
import testAssetWorkspace from '../integrationTests/testAssets/testAssetWorkspace';
import { activateCSharpExtension, htmlLanguageFeaturesExtensionReady } from '../integrationTests/integrationHelpers';
import { EventStream } from '../../src/EventStream';
import { EventType } from '../../src/omnisharp/EventType';
import { TelemetryEvent } from 'microsoft.aspnetcore.razor.vscode/dist/HostEventStream';

//let doc: vscode.TextDocument;
let eventStream: EventStream;
let activationResolver: (value?: any) => void;
// tslint:disable-next-line:promise-must-complete
export const extensionActivated = new Promise(resolve => {
    activationResolver = resolve;
});

suite(`Completions ${testAssetWorkspace.description}`, () => {
    suiteSetup(async function () {
        eventStream = (await activateCSharpExtension()).eventStream;
        eventStream.subscribe(event =>{
            if (event.type == EventType.TelemetryEvent) {
                let possibleRazorEvent = <TelemetryEvent>event;
                if (possibleRazorEvent.eventName == "VSCode.Razor.DocumentOpened") {
                    activationResolver();
                }
            }
        });

        await htmlLanguageFeaturesExtensionReady();
        await testAssetWorkspace.restore();
    });

    setup(async () => {
        const filePath = path.join(testAssetWorkspace.projects[0].projectDirectoryPath, 'Pages', 'Index.cshtml');
        await vscode.workspace.openTextDocument(filePath);
        //eventStream = result.eventStream;
    });
    
    // teardown(async () => {
    //     await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    //     await pollUntil(() => vscode.window.visibleTextEditors.length === 0, 1000);
    // });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();    
    });

    // test('Can get HTML completions on document open', async () => {
    //     // This test relies on the Index.cshtml document containing at least 1 HTML tag in it.
    //     // For the purposes of this test it locates that tag and tries to get the Html completion
    //     // list from it.

    //     const content = doc.getText();
    //     const tagNameIndex = content.indexOf('<') + 1;
    //     const docPosition = doc.positionAt(tagNameIndex);
    //     const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
    //         'vscode.executeCompletionItemProvider',
    //         doc.uri,
    //         docPosition);
    //     const matchingCompletions = completions!.items
    //         .filter(item => (typeof item.insertText === 'string') && item.insertText === 'iframe')
    //         .map(item => item.insertText as string);

    //     assert.deepEqual(matchingCompletions, ['iframe']);
    // });

    // test('Can complete C# code blocks', async () => {
    //     const lastLine = new vscode.Position(doc.lineCount - 1, 0);
    //     await editor.edit(edit => edit.insert(lastLine, '@{}'));
    //     await waitForDocumentUpdate(doc.uri, document => document.getText().indexOf('@{}') >= 0);

    //     const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
    //         'vscode.executeCompletionItemProvider',
    //         doc.uri,
    //         new vscode.Position(doc.lineCount - 1, 2));
    //     const matchingCompletions = completions!.items
    //         .filter(item => (typeof item.insertText === 'string') && item.insertText.startsWith('DateTime'))
    //         .map(item => item.insertText as string);

    //     assert.deepEqual(matchingCompletions, ['DateTime', 'DateTimeKind', 'DateTimeOffset']);
    // });

    test("The telemetry event is received", async() => {
        await extensionActivated;
    });
});
