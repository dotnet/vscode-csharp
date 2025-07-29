/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { AnalysisSetting } from '../../../src/lsptoolshost/diagnostics/buildDiagnosticsService';
import { getCode, setDiagnosticSettings, waitForExpectedDiagnostics } from './diagnosticsHelpers';
import { activateCSharpExtension, describeIfCSharp } from './integrationHelpers';

// Restarting the server is required for these tests, but not supported with C# Dev Kit.
describeIfCSharp(`Workspace Diagnostic Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    describe(`Full solution diagnostics`, () => {
        test('Compiler and analyzer diagnostics reported for closed files when set to FullSolution (reportInformationAsHint: true)', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.FullSolution,
                analyzerScope: AnalysisSetting.FullSolution,
                reportInformationAsHint: true,
            });

            await waitForExpectedDiagnostics((diagnostics) => {
                expect(diagnostics.length).toBeGreaterThan(2);

                const diagnosticsInDiagnosticsCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('diagnostics.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);
                const diagnosticsInCompletionCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('completion.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);

                expect(diagnosticsInDiagnosticsCs).toHaveLength(5);
                expect(diagnosticsInCompletionCs).toHaveLength(5);

                // Compiler diagnostic in diagnostics.cs
                expect(getCode(diagnosticsInDiagnosticsCs[3])).toBe('CS0219');
                expect(diagnosticsInDiagnosticsCs[3].message).toBe(
                    "The variable 'notUsed' is assigned but its value is never used"
                );
                expect(diagnosticsInDiagnosticsCs[3].range).toEqual(new vscode.Range(8, 16, 8, 23));
                expect(diagnosticsInDiagnosticsCs[3].severity).toBe(vscode.DiagnosticSeverity.Warning);

                // Analyzer diagnostic in diagnostics.cs
                expect(getCode(diagnosticsInDiagnosticsCs[2])).toBe('CA1822');
                expect(diagnosticsInDiagnosticsCs[2].message).toBe(
                    "Member 'FooBarBar' does not access instance data and can be marked as static"
                );
                expect(diagnosticsInDiagnosticsCs[2].range).toEqual(new vscode.Range(6, 20, 6, 29));
                expect(diagnosticsInDiagnosticsCs[2].severity).toBe(vscode.DiagnosticSeverity.Hint);

                // Analyzer diagnostic in completion.cs
                expect(getCode(diagnosticsInCompletionCs[0])).toBe('IDE0005');
                expect(diagnosticsInCompletionCs[0].message).toBe('Using directive is unnecessary.');
                expect(diagnosticsInCompletionCs[0].range).toEqual(new vscode.Range(0, 0, 0, 13));
                expect(diagnosticsInCompletionCs[0].severity).toBe(vscode.DiagnosticSeverity.Hint);
            });
        });
        test('Compiler and analyzer diagnostics reported for closed files when set to FullSolution (reportInformationAsHint: false)', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.FullSolution,
                analyzerScope: AnalysisSetting.FullSolution,
                reportInformationAsHint: false,
            });

            await waitForExpectedDiagnostics((diagnostics) => {
                expect(diagnostics.length).toBeGreaterThan(2);

                const diagnosticsInDiagnosticsCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('diagnostics.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);
                const diagnosticsInCompletionCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('completion.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);

                expect(diagnosticsInDiagnosticsCs).toHaveLength(5);
                expect(diagnosticsInCompletionCs).toHaveLength(5);

                // Compiler diagnostic in diagnostics.cs
                expect(getCode(diagnosticsInDiagnosticsCs[3])).toBe('CS0219');
                expect(diagnosticsInDiagnosticsCs[3].message).toBe(
                    "The variable 'notUsed' is assigned but its value is never used"
                );
                expect(diagnosticsInDiagnosticsCs[3].range).toEqual(new vscode.Range(8, 16, 8, 23));
                expect(diagnosticsInDiagnosticsCs[3].severity).toBe(vscode.DiagnosticSeverity.Warning);

                // Analyzer diagnostic in diagnostics.cs
                expect(getCode(diagnosticsInDiagnosticsCs[2])).toBe('CA1822');
                expect(diagnosticsInDiagnosticsCs[2].message).toBe(
                    "Member 'FooBarBar' does not access instance data and can be marked as static"
                );
                expect(diagnosticsInDiagnosticsCs[2].range).toEqual(new vscode.Range(6, 20, 6, 29));
                expect(diagnosticsInDiagnosticsCs[2].severity).toBe(vscode.DiagnosticSeverity.Information);

                // Analyzer diagnostic in completion.cs
                expect(getCode(diagnosticsInCompletionCs[0])).toBe('IDE0005');
                expect(diagnosticsInCompletionCs[0].message).toBe('Using directive is unnecessary.');
                expect(diagnosticsInCompletionCs[0].range).toEqual(new vscode.Range(0, 0, 0, 13));
                expect(diagnosticsInCompletionCs[0].severity).toBe(vscode.DiagnosticSeverity.Hint);
            });
        });

        test('No compiler diagnostics reported for closed files when set to OpenFiles', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.OpenFiles,
                analyzerScope: AnalysisSetting.FullSolution,
                reportInformationAsHint: true,
            });

            await waitForExpectedDiagnostics((diagnostics) => {
                expect(diagnostics.length).toBeGreaterThan(2);

                const diagnosticsInDiagnosticsCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('diagnostics.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);

                expect(diagnosticsInDiagnosticsCs).toHaveLength(4);
                expect(diagnosticsInDiagnosticsCs.some((d) => getCode(d).startsWith('CS'))).toBe(false);
            });
        });

        test('No compiler diagnostics reported for closed files when set to None', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.None,
                analyzerScope: AnalysisSetting.FullSolution,
                reportInformationAsHint: true,
            });

            await waitForExpectedDiagnostics((diagnostics) => {
                expect(diagnostics.length).toBeGreaterThan(2);

                const diagnosticsInDiagnosticsCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('diagnostics.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);

                expect(diagnosticsInDiagnosticsCs).toHaveLength(4);
                expect(diagnosticsInDiagnosticsCs.some((d) => getCode(d).startsWith('CS'))).toBe(false);
            });
        });

        test('No analyzer diagnostics reported for closed files when set to OpenFiles', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.FullSolution,
                analyzerScope: AnalysisSetting.OpenFiles,
                reportInformationAsHint: true,
            });

            await waitForExpectedDiagnostics((diagnostics) => {
                expect(diagnostics.length).toBeGreaterThan(2);

                const diagnosticsInDiagnosticsCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('diagnostics.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);
                const diagnosticsInCompletionCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('completion.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);

                expect(diagnosticsInDiagnosticsCs).toHaveLength(1);
                expect(diagnosticsInCompletionCs).toHaveLength(1);

                expect(
                    diagnosticsInDiagnosticsCs.some((d) => getCode(d).startsWith('IDE') || getCode(d).startsWith('CA'))
                ).toBe(false);

                expect(
                    diagnosticsInCompletionCs.some((d) => getCode(d).startsWith('IDE') || getCode(d).startsWith('CA'))
                ).toBe(false);
            });
        });

        test('No analyzer diagnostics reported for closed files when set to None', async () => {
            await setDiagnosticSettings({
                compilerScope: AnalysisSetting.FullSolution,
                analyzerScope: AnalysisSetting.None,
                reportInformationAsHint: true,
            });

            await waitForExpectedDiagnostics((diagnostics) => {
                expect(diagnostics.length).toBeGreaterThan(2);

                const diagnosticsInDiagnosticsCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('diagnostics.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);
                const diagnosticsInCompletionCs = diagnostics
                    .filter(([uri, _]) => uri.fsPath.endsWith('completion.cs'))
                    .flatMap(([_, diagnostics]) => diagnostics);

                expect(diagnosticsInDiagnosticsCs).toHaveLength(1);
                expect(diagnosticsInCompletionCs).toHaveLength(1);

                expect(
                    diagnosticsInDiagnosticsCs.some((d) => getCode(d).startsWith('IDE') || getCode(d).startsWith('CA'))
                ).toBe(false);

                expect(
                    diagnosticsInCompletionCs.some((d) => getCode(d).startsWith('IDE') || getCode(d).startsWith('CA'))
                ).toBe(false);
            });
        });
    });
});
