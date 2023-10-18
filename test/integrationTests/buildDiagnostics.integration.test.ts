/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { AnalysisSetting, BuildDiagnosticsService } from '../../src/lsptoolshost/buildDiagnosticsService';
import * as integrationHelpers from './integrationHelpers';
import path = require('path');
describe(`Build and live diagnostics dedupe ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        await integrationHelpers.openFileInWorkspaceAsync(path.join('src', 'app', 'inlayHints.cs'));
        await integrationHelpers.activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('OpenFiles diagnostics', async () => {
        await setBackgroundAnalysisSetting(
            /*analyzer*/ AnalysisSetting.OpenFiles,
            /*compiler*/ AnalysisSetting.OpenFiles
        );

        const buildOnlyIds = ['CS1001'];
        const diagnostics = [getTestDiagnostic('CS1001'), getTestDiagnostic('CS1002')];

        const displayedBuildResultsClosedFile = BuildDiagnosticsService.filerDiagnosticsFromBuild(
            diagnostics,
            buildOnlyIds,
            false
        );

        const displayedBuildResultsOpenFile = BuildDiagnosticsService.filerDiagnosticsFromBuild(
            diagnostics,
            buildOnlyIds,
            true
        );

        expect(displayedBuildResultsClosedFile.length).toEqual(2);
        expect(displayedBuildResultsOpenFile.length).toEqual(1);
    });

    test('None diagnostics', async () => {
        await setBackgroundAnalysisSetting(/*analyzer*/ AnalysisSetting.None, /*compiler*/ AnalysisSetting.None);

        const buildOnlyIds = ['CS1001'];
        const diagnostics = [getTestDiagnostic('CS1001'), getTestDiagnostic('CS2001'), getTestDiagnostic('SA3001')];

        const displayedBuildResultsOpenFile = BuildDiagnosticsService.filerDiagnosticsFromBuild(
            diagnostics,
            buildOnlyIds,
            true
        );

        const displayedBuildResultsClosedFile = BuildDiagnosticsService.filerDiagnosticsFromBuild(
            diagnostics,
            buildOnlyIds,
            false
        );

        // Both an open and closed file should still show all the build diagnostics
        expect(displayedBuildResultsOpenFile.length).toEqual(3);
        expect(displayedBuildResultsClosedFile.length).toEqual(3);
    });

    test('FullSolution-both diagnostics', async () => {
        await setBackgroundAnalysisSetting(
            /*analyzer*/ AnalysisSetting.FullSolution,
            /*compiler*/ AnalysisSetting.FullSolution
        );

        const buildOnlyIds = ['CS1001'];
        const diagnostics = [getTestDiagnostic('CS1001'), getTestDiagnostic('CS2001'), getTestDiagnostic('SA3001')];

        const displayedBuildResults = BuildDiagnosticsService.filerDiagnosticsFromBuild(
            diagnostics,
            buildOnlyIds,
            false
        );
        expect(displayedBuildResults.length).toEqual(1);
    });

    test('FullSolution-analyzer diagnostics', async () => {
        await setBackgroundAnalysisSetting(
            /*analyzer*/ AnalysisSetting.FullSolution,
            /*compiler*/ AnalysisSetting.OpenFiles
        );

        const buildOnlyIds = ['CS1001'];
        const diagnostics = [getTestDiagnostic('CS1001'), getTestDiagnostic('CS2001'), getTestDiagnostic('SA3001')];

        const displayedBuildResults = BuildDiagnosticsService.filerDiagnosticsFromBuild(
            diagnostics,
            buildOnlyIds,
            false
        );
        expect(displayedBuildResults.length).toEqual(2);
    });

    test('FullSolution-compiler diagnostics', async () => {
        await setBackgroundAnalysisSetting(
            /*analyzer*/ AnalysisSetting.OpenFiles,
            /*compiler*/ AnalysisSetting.FullSolution
        );

        const buildOnlyIds = ['CS1001'];
        const diagnostics = [getTestDiagnostic('CS1001'), getTestDiagnostic('CS2001'), getTestDiagnostic('SA3001')];

        const displayedBuildResults = BuildDiagnosticsService.filerDiagnosticsFromBuild(
            diagnostics,
            buildOnlyIds,
            false
        );

        expect(displayedBuildResults.length).toEqual(2);
        expect(displayedBuildResults).toContain(diagnostics[0]);
    });
});

function getTestDiagnostic(code: string): vscode.Diagnostic {
    const range = new vscode.Range(new vscode.Position(2, 0), new vscode.Position(3, 0));

    const diagnostic = new vscode.Diagnostic(range, 'testMessage');
    diagnostic.code = code;
    return diagnostic;
}

async function setBackgroundAnalysisSetting(analyzerSetting: string, compilerSetting: string): Promise<void> {
    const dotnetConfig = vscode.workspace.getConfiguration('dotnet');

    await dotnetConfig.update('backgroundAnalysis.analyzerDiagnosticsScope', analyzerSetting);
    await dotnetConfig.update('backgroundAnalysis.compilerDiagnosticsScope', compilerSetting);
}
