/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as jestLib from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { activateCSharpExtension, openFileInWorkspaceAsync } from './integrationHelpers';
import { TestProgress } from '../../src/lsptoolshost/roslynProtocol';

jestLib.describe(`[${testAssetWorkspace.description}] Test Unit Testing`, function () {
    jestLib.beforeAll(async function () {
        await activateCSharpExtension();
    });

    jestLib.beforeEach(async function () {
        vscode.workspace
            .getConfiguration()
            .update('dotnet.unitTests.runSettingsPath', undefined, vscode.ConfigurationTarget.Workspace);
        const fileName = path.join('test', 'UnitTest1.cs');
        await openFileInWorkspaceAsync(fileName);
    });

    jestLib.afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    jestLib.test('Unit test code lens items are displayed', async () => {
        const codeLenses = await getCodeLensesAsync();
        jestLib.expect(codeLenses).toHaveLength(9);

        const classRange = new vscode.Range(new vscode.Position(5, 17), new vscode.Position(5, 26));

        // Class level debug all tests
        jestLib.expect(codeLenses[1].command?.command).toBe('dotnet.test.run');
        jestLib.expect(codeLenses[1].command?.title).toBe('Debug All Tests');
        jestLib.expect(codeLenses[1].command?.arguments![0].attachDebugger).toBe(true);
        jestLib.expect(codeLenses[1].range).toStrictEqual(classRange);

        // Class level run all tests
        jestLib.expect(codeLenses[2].command?.command).toBe('dotnet.test.run');
        jestLib.expect(codeLenses[2].command?.title).toBe('Run All Tests');
        jestLib.expect(codeLenses[2].command?.arguments![0].attachDebugger).toBe(false);
        jestLib.expect(codeLenses[2].range).toStrictEqual(classRange);

        let methodRange = new vscode.Range(new vscode.Position(8, 20), new vscode.Position(8, 25));
        // Method level run and debug test
        jestLib.expect(codeLenses[4].command?.command).toBe('dotnet.test.run');
        jestLib.expect(codeLenses[4].command?.title).toBe('Debug Test');
        jestLib.expect(codeLenses[4].command?.arguments![0].attachDebugger).toBe(true);
        jestLib.expect(codeLenses[4].range).toStrictEqual(methodRange);
        jestLib.expect(codeLenses[5].command?.command).toBe('dotnet.test.run');
        jestLib.expect(codeLenses[5].command?.title).toBe('Run Test');
        jestLib.expect(codeLenses[5].command?.arguments![0].attachDebugger).toBe(false);
        jestLib.expect(codeLenses[5].range).toStrictEqual(methodRange);

        methodRange = new vscode.Range(new vscode.Position(15, 20), new vscode.Position(15, 25));
        jestLib.expect(codeLenses[7].command?.command).toBe('dotnet.test.run');
        jestLib.expect(codeLenses[7].command?.title).toBe('Debug Test');
        jestLib.expect(codeLenses[7].command?.arguments![0].attachDebugger).toBe(true);
        jestLib.expect(codeLenses[7].range).toStrictEqual(methodRange);
        jestLib.expect(codeLenses[8].command?.command).toBe('dotnet.test.run');
        jestLib.expect(codeLenses[8].command?.title).toBe('Run Test');
        jestLib.expect(codeLenses[8].command?.arguments![0].attachDebugger).toBe(false);
        jestLib.expect(codeLenses[8].range).toStrictEqual(methodRange);
    });

    jestLib.test('Code lens command executes tests', async () => {
        const codeLenses = await getCodeLensesAsync();
        jestLib.expect(codeLenses).toHaveLength(9);

        const runAllTestsCommand = codeLenses[2].command!;
        jestLib.expect(runAllTestsCommand.title).toBe('Run All Tests');

        const testResults = await vscode.commands.executeCommand<TestProgress | undefined>(
            runAllTestsCommand.command,
            runAllTestsCommand.arguments![0]
        );
        jestLib.expect(testResults).toBeDefined();
        jestLib.expect(testResults?.totalTests).toEqual(2);
        jestLib.expect(testResults?.testsPassed).toEqual(2);
        jestLib.expect(testResults?.testsFailed).toEqual(0);
        jestLib.expect(testResults?.testsSkipped).toEqual(0);
    });

    jestLib.test('dotnet.test.runTestsInContext executes tests', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            throw new Error('No active editor');
        }

        // Ensure the method is selected in the editor.
        activeEditor.selection = new vscode.Selection(new vscode.Position(8, 20), new vscode.Position(8, 25));
        const testResults = await vscode.commands.executeCommand<TestProgress | undefined>(
            'dotnet.test.runTestsInContext',
            activeEditor
        );
        jestLib.expect(testResults).toBeDefined();
        jestLib.expect(testResults?.totalTests).toEqual(1);
        jestLib.expect(testResults?.testsPassed).toEqual(1);
        jestLib.expect(testResults?.testsFailed).toEqual(0);
        jestLib.expect(testResults?.testsSkipped).toEqual(0);
    });

    jestLib.test('Run tests uses .runsettings', async () => {
        await vscode.workspace.getConfiguration().update('dotnet.unitTests.runSettingsPath', '.runsettings');

        const codeLenses = await getCodeLensesAsync();
        jestLib.expect(codeLenses).toHaveLength(9);

        const runAllTestsCommand = codeLenses[2].command!;
        jestLib.expect(runAllTestsCommand.title).toBe('Run All Tests');

        const testResults = await vscode.commands.executeCommand<TestProgress | undefined>(
            runAllTestsCommand.command,
            runAllTestsCommand.arguments![0]
        );
        jestLib.expect(testResults).toBeDefined();
        jestLib.expect(testResults?.totalTests).toEqual(1);
        jestLib.expect(testResults?.testsPassed).toEqual(1);
        jestLib.expect(testResults?.testsFailed).toEqual(0);
        jestLib.expect(testResults?.testsSkipped).toEqual(0);
    });
});

async function getCodeLensesAsync(): Promise<vscode.CodeLens[]> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        throw new Error('No active editor');
    }

    // The number of code lens items to resolve.  Set to a high number so we get pretty much everything in the document.
    const resolvedItemCount = 100;

    const codeLenses = <vscode.CodeLens[]>(
        await vscode.commands.executeCommand(
            'vscode.executeCodeLensProvider',
            activeEditor.document.uri,
            resolvedItemCount
        )
    );
    return codeLenses.sort((a, b) => {
        const rangeCompare = a.range.start.compareTo(b.range.start);
        if (rangeCompare !== 0) {
            return rangeCompare;
        }

        return a.command!.title.localeCompare(b.command!.command);
    });
}
