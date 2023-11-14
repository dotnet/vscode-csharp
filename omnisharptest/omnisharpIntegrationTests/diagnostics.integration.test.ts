/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import {
    ActivationResult,
    activateCSharpExtension,
    describeIfNotGenerator,
    describeIfNotRazorOrGenerator,
    describeIfRazor,
    isRazorWorkspace,
    isSlnWithGenerator,
    restartOmniSharpServer,
} from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { poll, assertWithPoll, pollDoesNotHappen } from './poll';
import { isNotNull } from '../testUtil';

async function setDiagnosticWorkspaceLimit(to: number | null) {
    const csharpConfig = vscode.workspace.getConfiguration('csharp');
    await csharpConfig.update('maxProjectFileCountForDiagnosticAnalysis', to);
    return assertWithPoll(
        () => {
            const currentConfig = vscode.workspace.getConfiguration('csharp');
            return currentConfig.get('maxProjectFileCountForDiagnosticAnalysis');
        },
        300,
        10,
        (input) => input === to
    );
}

describeIfNotGenerator(`DiagnosticProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;
    let secondaryFileUri: vscode.Uri;
    let razorFileUri: vscode.Uri;
    let virtualRazorFileUri: vscode.Uri;

    let activation: ActivationResult;

    beforeAll(async function () {
        activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);

        const fileName = 'diagnostics.cs';
        const secondaryFileName = 'secondaryDiagnostics.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;

        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        secondaryFileUri = vscode.Uri.file(path.join(projectDirectory, secondaryFileName));
        razorFileUri = vscode.Uri.file(path.join(projectDirectory, 'Pages', 'ErrorHaver.razor'));
        virtualRazorFileUri = vscode.Uri.file(razorFileUri.fsPath + '__virtual.cs');
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    describeIfRazor('razor workspace', () => {
        beforeAll(async function () {
            await vscode.commands.executeCommand('vscode.open', razorFileUri);
            await testAssetWorkspace.waitForIdle(activation.eventStream);
        });

        test("Razor shouldn't give diagnostics for virtual files", async function () {
            await pollDoesNotHappen(
                () => vscode.languages.getDiagnostics(),
                5 * 1000,
                500,
                function (res) {
                    const virtual = res.find((r) => r[0].fsPath === virtualRazorFileUri.fsPath);

                    if (!virtual) {
                        return false;
                    }

                    const diagnosticsList = virtual[1];
                    if (diagnosticsList.some((diag) => diag.code == 'CS0103')) {
                        return true;
                    } else {
                        return false;
                    }
                }
            );
        });
    });

    describeIfNotRazorOrGenerator('small workspace (based on maxProjectFileCountForDiagnosticAnalysis setting)', () => {
        beforeAll(async function () {
            await vscode.commands.executeCommand('vscode.open', fileUri);
            await testAssetWorkspace.waitForIdle(activation.eventStream);
        });

        test('Returns any diagnostics from file', async function () {
            await assertWithPoll(
                () => vscode.languages.getDiagnostics(fileUri),
                /*duration*/ 30 * 1000,
                /*step*/ 500,
                (res) => expect(res.length).toBeGreaterThan(0)
            );
        });

        test('Return unnecessary tag in case of unused variable', async function () {
            const result = await poll(
                () => vscode.languages.getDiagnostics(fileUri),
                /*duration*/ 30 * 1000,
                /*step*/ 500,
                (result) => result.find((x) => x.code === 'CS0219') != undefined
            );

            const cs0219 = result.find((x) => x.code === 'CS0219');
            isNotNull(cs0219);
            if (cs0219.tags) {
                // not currently making it through lsp 100% of the time
                expect(cs0219.tags).toContain(vscode.DiagnosticTag.Unnecessary);
            }
        });

        test('Return unnecessary tag in case of unnesessary using', async function () {
            const result = await poll(
                () => vscode.languages.getDiagnostics(fileUri),
                /*duration*/ 30 * 1000,
                /*step*/ 500,
                (result) => result.find((x) => x.code === 'CS8019') != undefined
            );

            const cs8019 = result.find((x) => x.code === 'CS8019');
            isNotNull(cs8019);
            if (cs8019.tags) {
                // not currently making it through lsp 100% of the time
                expect(cs8019.tags).toContain(vscode.DiagnosticTag.Unnecessary);
            }
        });

        test('Return fadeout diagnostics like unused variables based on roslyn analyzers', async function () {
            const result = await poll(
                () => vscode.languages.getDiagnostics(fileUri),
                /*duration*/ 30 * 1000,
                /*step*/ 500,
                (result) => result.find((x) => x.code === 'IDE0059') != undefined
            );

            const ide0059 = result.find((x) => x.code === 'IDE0059');
            isNotNull(ide0059);
            if (ide0059.tags) {
                // not currently making it through lsp 100% of the time
                expect(ide0059.tags).toContain(vscode.DiagnosticTag.Unnecessary);
            }
        });

        test('On small workspaces also show/fetch closed document analysis results', async function () {
            await assertWithPoll(
                () => vscode.languages.getDiagnostics(secondaryFileUri),
                15 * 1000,
                500,
                (res) => expect(res.length).toBeGreaterThan(0)
            );
        });
    });

    const describeCondition =
        !isRazorWorkspace(vscode.workspace) &&
        !isSlnWithGenerator(vscode.workspace) &&
        // lsp does pull-based diagnostics. If you ask for a file specifically, you'll get it.
        process.env.OMNISHARP_DRIVER !== 'lsp'
            ? describe
            : describe.skip;

    describeCondition('large workspace (based on maxProjectFileCountForDiagnosticAnalysis setting)', () => {
        beforeAll(async function () {
            await setDiagnosticWorkspaceLimit(1);
            await restartOmniSharpServer();
            await testAssetWorkspace.waitForIdle(activation.eventStream);
        });

        test("When workspace is count as 'large', then only show/fetch diagnostics from open documents", async function () {
            // We are not opening the secondary file so there should be no diagnostics reported for it.
            await vscode.commands.executeCommand('vscode.open', fileUri);

            await assertWithPoll(
                () => vscode.languages.getDiagnostics(fileUri),
                10 * 1000,
                500,
                (openFileDiag) => expect(openFileDiag.length).toBeGreaterThan(0)
            );

            // Ensure that the document is closed for the test.
            await vscode.window.showTextDocument(secondaryFileUri).then(() => {
                return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            });

            await assertWithPoll(
                () => vscode.languages.getDiagnostics(secondaryFileUri),
                10 * 1000,
                500,
                (secondaryDiag) => expect(secondaryDiag.length).toEqual(0)
            );
        });
    });
});
