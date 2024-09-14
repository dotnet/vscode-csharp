/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    getCodeLensesAsync,
    openFileInWorkspaceAsync,
} from './integrationHelpers';
import { TestProgress } from '../../../src/lsptoolshost/roslynProtocol';

describe(`[${testAssetWorkspace.description}] Test Unit Testing`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        vscode.workspace
            .getConfiguration()
            .update('dotnet.unitTests.runSettingsPath', undefined, vscode.ConfigurationTarget.Workspace);
        const fileName = path.join('test', 'UnitTest1.cs');
        await openFileInWorkspaceAsync(fileName);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Unit test code lens items are displayed', async () => {
        const codeLenses = await getCodeLensesAsync();
        expect(codeLenses).toHaveLength(9);

        const classRange = new vscode.Range(new vscode.Position(5, 17), new vscode.Position(5, 26));

        // Class level debug all tests
        expect(codeLenses[1].command?.command).toBe('dotnet.test.run');
        expect(codeLenses[1].command?.title).toBe('Debug All Tests');
        expect(codeLenses[1].command?.arguments![0].attachDebugger).toBe(true);
        expect(codeLenses[1].range).toStrictEqual(classRange);

        // Class level run all tests
        expect(codeLenses[2].command?.command).toBe('dotnet.test.run');
        expect(codeLenses[2].command?.title).toBe('Run All Tests');
        expect(codeLenses[2].command?.arguments![0].attachDebugger).toBe(false);
        expect(codeLenses[2].range).toStrictEqual(classRange);

        let methodRange = new vscode.Range(new vscode.Position(8, 20), new vscode.Position(8, 25));
        // Method level run and debug test
        expect(codeLenses[4].command?.command).toBe('dotnet.test.run');
        expect(codeLenses[4].command?.title).toBe('Debug Test');
        expect(codeLenses[4].command?.arguments![0].attachDebugger).toBe(true);
        expect(codeLenses[4].range).toStrictEqual(methodRange);
        expect(codeLenses[5].command?.command).toBe('dotnet.test.run');
        expect(codeLenses[5].command?.title).toBe('Run Test');
        expect(codeLenses[5].command?.arguments![0].attachDebugger).toBe(false);
        expect(codeLenses[5].range).toStrictEqual(methodRange);

        methodRange = new vscode.Range(new vscode.Position(15, 20), new vscode.Position(15, 25));
        expect(codeLenses[7].command?.command).toBe('dotnet.test.run');
        expect(codeLenses[7].command?.title).toBe('Debug Test');
        expect(codeLenses[7].command?.arguments![0].attachDebugger).toBe(true);
        expect(codeLenses[7].range).toStrictEqual(methodRange);
        expect(codeLenses[8].command?.command).toBe('dotnet.test.run');
        expect(codeLenses[8].command?.title).toBe('Run Test');
        expect(codeLenses[8].command?.arguments![0].attachDebugger).toBe(false);
        expect(codeLenses[8].range).toStrictEqual(methodRange);
    });

    test('Code lens command executes tests', async () => {
        const codeLenses = await getCodeLensesAsync();
        expect(codeLenses).toHaveLength(9);

        const runAllTestsCommand = codeLenses[2].command!;
        expect(runAllTestsCommand.title).toBe('Run All Tests');

        const testResults = await vscode.commands.executeCommand<TestProgress | undefined>(
            runAllTestsCommand.command,
            runAllTestsCommand.arguments![0]
        );
        expect(testResults).toBeDefined();
        expect(testResults?.totalTests).toEqual(2);
        expect(testResults?.testsPassed).toEqual(2);
        expect(testResults?.testsFailed).toEqual(0);
        expect(testResults?.testsSkipped).toEqual(0);
    });

    test('dotnet.test.runTestsInContext executes tests', async () => {
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
        expect(testResults).toBeDefined();
        expect(testResults?.totalTests).toEqual(1);
        expect(testResults?.testsPassed).toEqual(1);
        expect(testResults?.testsFailed).toEqual(0);
        expect(testResults?.testsSkipped).toEqual(0);
    });

    test('Run tests uses .runsettings', async () => {
        await vscode.workspace.getConfiguration().update('dotnet.unitTests.runSettingsPath', '.runsettings');

        const codeLenses = await getCodeLensesAsync();
        expect(codeLenses).toHaveLength(9);

        const runAllTestsCommand = codeLenses[2].command!;
        expect(runAllTestsCommand.title).toBe('Run All Tests');

        const testResults = await vscode.commands.executeCommand<TestProgress | undefined>(
            runAllTestsCommand.command,
            runAllTestsCommand.arguments![0]
        );
        expect(testResults).toBeDefined();
        expect(testResults?.totalTests).toEqual(1);
        expect(testResults?.testsPassed).toEqual(1);
        expect(testResults?.testsFailed).toEqual(0);
        expect(testResults?.testsSkipped).toEqual(0);
    });
});
