/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { beforeAll, afterAll, test, expect } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../../lsptoolshost/integrationTests/integrationHelpers';

integrationHelpers.describeIfDevKit(`Razor Diagnostics ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        await integrationHelpers.activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('CSharp Diagnostics', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        let count = 0;
        let error;

        while (count < 5) {
            try {
                await integrationHelpers.closeAllEditorsAsync();
                await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'Diagnostics.razor'));

                await integrationHelpers.waitForExpectedResult<vscode.Diagnostic[]>(
                    () => vscode.languages.getDiagnostics(vscode.window.activeTextEditor!.document.uri),
                    5000,
                    500,
                    (diagnostics) => {
                        expect(diagnostics.length).toBe(3);

                        expect(diagnostics[0].code).toBe('RZ10012');
                        expect(diagnostics[0].message).toBe(
                            "Found markup element with unexpected name 'TagHelperDoesNotExist'. If this is intended to be a component, add a @using directive for its namespace."
                        );
                        expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
                        expect(diagnostics[0].range).toStrictEqual(new vscode.Range(2, 0, 2, 25));
                        expect(diagnostics[0].source).toBe('Razor');

                        expect(diagnostics[1].message).toBe("The name 'Message' does not exist in the current context");
                        expect(diagnostics[1].severity).toBe(vscode.DiagnosticSeverity.Error);
                        expect(diagnostics[1].range).toStrictEqual(new vscode.Range(6, 9, 6, 16));
                        expect(diagnostics[1].source).toBe(undefined);

                        expect(diagnostics[2].message).toBe(
                            "The type or namespace name 'TypeDoesNotExist' could not be found (are you missing a using directive or an assembly reference?)"
                        );
                        expect(diagnostics[2].severity).toBe(vscode.DiagnosticSeverity.Error);
                        expect(diagnostics[2].range).toStrictEqual(new vscode.Range(15, 20, 15, 36));
                        expect(diagnostics[2].source).toBe(undefined);
                    }
                );

                // If this hits that means the expected results succeeded
                // and we can stop the loop
                return;
            } catch (e) {
                error = e;
            }

            count++;
        }

        throw error;
    });
});
