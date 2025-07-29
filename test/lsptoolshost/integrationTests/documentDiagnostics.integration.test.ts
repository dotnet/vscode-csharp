/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { describe, test, beforeAll, afterAll, expect, beforeEach, afterEach } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { AnalysisSetting } from '../../../src/lsptoolshost/diagnostics/buildDiagnosticsService';
import path from 'path';
import { getCode, setDiagnosticSettings, waitForExpectedDiagnostics } from './diagnosticsHelpers';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    describeIfCSharp,
    openFileInWorkspaceAsync,
} from './integrationHelpers';

// Restarting the server is required for these tests, but not supported with C# Dev Kit.
describeIfCSharp(`Document Diagnostics Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    describe('Open document diagnostics', () => {
        let file: vscode.Uri;
        beforeEach(async () => {
            file = await openFileInWorkspaceAsync(path.join('src', 'app', 'diagnostics.cs'));
        });

        afterEach(async () => {
            await closeAllEditorsAsync();
        });

        test('Compiler and analyzer diagnostics reported for open file when set to OpenFiles (reportInformationAsHint: true)', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.OpenFiles,
                analyzerScope: AnalysisSetting.OpenFiles,
                reportInformationAsHint: true,
            });

            await waitForExpectedFileDiagnostics((diagnostics) => {
                expect(diagnostics).toHaveLength(5);

                expect(getCode(diagnostics[0])).toBe('IDE0005');
                expect(diagnostics[0].message).toBe('Using directive is unnecessary.');
                expect(diagnostics[0].range).toEqual(new vscode.Range(0, 0, 0, 16));
                expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Hint);

                expect(getCode(diagnostics[1])).toBe('IDE0130');
                expect(diagnostics[1].message).toBe('Namespace "Foo" does not match folder structure, expected "app"');
                expect(diagnostics[1].range).toEqual(new vscode.Range(2, 10, 2, 13));
                expect(diagnostics[1].severity).toBe(vscode.DiagnosticSeverity.Hint);

                expect(getCode(diagnostics[2])).toBe('CA1822');
                expect(diagnostics[2].message).toBe(
                    "Member 'FooBarBar' does not access instance data and can be marked as static"
                );
                expect(diagnostics[2].range).toEqual(new vscode.Range(6, 20, 6, 29));
                expect(diagnostics[2].severity).toBe(vscode.DiagnosticSeverity.Hint);

                expect(getCode(diagnostics[3])).toBe('CS0219');
                expect(diagnostics[3].message).toBe("The variable 'notUsed' is assigned but its value is never used");
                expect(diagnostics[3].range).toEqual(new vscode.Range(8, 16, 8, 23));
                expect(diagnostics[3].severity).toBe(vscode.DiagnosticSeverity.Warning);

                expect(getCode(diagnostics[4])).toBe('IDE0059');
                expect(diagnostics[4].message).toBe("Unnecessary assignment of a value to 'notUsed'");
                expect(diagnostics[4].range).toEqual(new vscode.Range(8, 16, 8, 23));
                expect(diagnostics[4].severity).toBe(vscode.DiagnosticSeverity.Hint);
            }, file);
        });

        test('Compiler and analyzer diagnostics reported for open file when set to OpenFiles (reportInformationAsHint: false)', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.OpenFiles,
                analyzerScope: AnalysisSetting.OpenFiles,
                reportInformationAsHint: false,
            });

            await waitForExpectedFileDiagnostics((diagnostics) => {
                expect(diagnostics).toHaveLength(5);

                expect(getCode(diagnostics[0])).toBe('IDE0005');
                expect(diagnostics[0].message).toBe('Using directive is unnecessary.');
                expect(diagnostics[0].range).toEqual(new vscode.Range(0, 0, 0, 16));
                expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Hint);

                expect(getCode(diagnostics[1])).toBe('IDE0130');
                expect(diagnostics[1].message).toBe('Namespace "Foo" does not match folder structure, expected "app"');
                expect(diagnostics[1].range).toEqual(new vscode.Range(2, 10, 2, 13));
                expect(diagnostics[1].severity).toBe(vscode.DiagnosticSeverity.Information);

                expect(getCode(diagnostics[2])).toBe('CA1822');
                expect(diagnostics[2].message).toBe(
                    "Member 'FooBarBar' does not access instance data and can be marked as static"
                );
                expect(diagnostics[2].range).toEqual(new vscode.Range(6, 20, 6, 29));
                expect(diagnostics[2].severity).toBe(vscode.DiagnosticSeverity.Information);

                expect(getCode(diagnostics[3])).toBe('CS0219');
                expect(diagnostics[3].message).toBe("The variable 'notUsed' is assigned but its value is never used");
                expect(diagnostics[3].range).toEqual(new vscode.Range(8, 16, 8, 23));
                expect(diagnostics[3].severity).toBe(vscode.DiagnosticSeverity.Warning);

                expect(getCode(diagnostics[4])).toBe('IDE0059');
                expect(diagnostics[4].message).toBe("Unnecessary assignment of a value to 'notUsed'");
                expect(diagnostics[4].range).toEqual(new vscode.Range(8, 16, 8, 23));
                expect(diagnostics[4].severity).toBe(vscode.DiagnosticSeverity.Information);
            }, file);
        });

        test('Compiler diagnostics reported for open file when set to FullSolution', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.FullSolution,
                analyzerScope: AnalysisSetting.OpenFiles,
                reportInformationAsHint: true,
            });

            await waitForExpectedFileDiagnostics((diagnostics) => {
                expect(diagnostics).toHaveLength(5);

                expect(getCode(diagnostics[3])).toBe('CS0219');
                expect(diagnostics[3].message).toBe("The variable 'notUsed' is assigned but its value is never used");
                expect(diagnostics[3].range).toEqual(new vscode.Range(8, 16, 8, 23));
                expect(diagnostics[3].severity).toBe(vscode.DiagnosticSeverity.Warning);
            }, file);
        });

        test('No compiler diagnostics reported for open file when set to None', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.None,
                analyzerScope: AnalysisSetting.OpenFiles,
                reportInformationAsHint: true,
            });

            await waitForExpectedFileDiagnostics((diagnostics) => {
                expect(diagnostics).toHaveLength(4);

                expect(diagnostics.some((d) => getCode(d).startsWith('CS'))).toBe(false);
            }, file);
        });

        test('Analyzer diagnostics reported for open file when set to FullSolution', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.OpenFiles,
                analyzerScope: AnalysisSetting.FullSolution,
                reportInformationAsHint: true,
            });

            await waitForExpectedFileDiagnostics((diagnostics) => {
                expect(diagnostics).toHaveLength(5);

                expect(getCode(diagnostics[0])).toBe('IDE0005');
                expect(diagnostics[0].message).toBe('Using directive is unnecessary.');
                expect(diagnostics[0].range).toEqual(new vscode.Range(0, 0, 0, 16));
                expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Hint);

                expect(getCode(diagnostics[1])).toBe('IDE0130');
                expect(diagnostics[1].message).toBe('Namespace "Foo" does not match folder structure, expected "app"');
                expect(diagnostics[1].range).toEqual(new vscode.Range(2, 10, 2, 13));
                expect(diagnostics[1].severity).toBe(vscode.DiagnosticSeverity.Hint);

                expect(getCode(diagnostics[2])).toBe('CA1822');
                expect(diagnostics[2].message).toBe(
                    "Member 'FooBarBar' does not access instance data and can be marked as static"
                );
                expect(diagnostics[2].range).toEqual(new vscode.Range(6, 20, 6, 29));
                expect(diagnostics[2].severity).toBe(vscode.DiagnosticSeverity.Hint);

                expect(getCode(diagnostics[4])).toBe('IDE0059');
                expect(diagnostics[4].message).toBe("Unnecessary assignment of a value to 'notUsed'");
                expect(diagnostics[4].range).toEqual(new vscode.Range(8, 16, 8, 23));
                expect(diagnostics[4].severity).toBe(vscode.DiagnosticSeverity.Hint);
            }, file);
        });

        test('No analyzer diagnostics reported for open file when set to None', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.OpenFiles,
                analyzerScope: AnalysisSetting.None,
                reportInformationAsHint: true,
            });

            await waitForExpectedFileDiagnostics((diagnostics) => {
                expect(diagnostics).toHaveLength(1);

                expect(diagnostics.some((d) => getCode(d).startsWith('IDE') || getCode(d).startsWith('CA'))).toBe(
                    false
                );
            }, file);
        });
    });
});

async function waitForExpectedFileDiagnostics(
    assertExpectedDiagnostics: (input: vscode.Diagnostic[]) => void,
    file: vscode.Uri
): Promise<void> {
    return waitForExpectedDiagnostics((diagnostics) => {
        const fileDiagnostics = diagnostics.find((d) => d[0].toString() === file.toString());
        expect(fileDiagnostics).toBeDefined();

        return assertExpectedDiagnostics(fileDiagnostics![1]);
    });
}
