/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    findRangeOfString,
    openFileInWorkspaceAsync,
    testIfCSharp,
    testIfDevKit,
} from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';

describe(`Go To Definition Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(path.join('src', 'app', 'definition.cs'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Navigates to definition in same file', async () => {
        const requestPosition = new vscode.Position(10, 31);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                requestPosition
            )
        );
        expect(definitionList.length).toEqual(1);
        expect(definitionList[0].uri.path).toContain('definition.cs');
        expect(definitionList[0].range).toStrictEqual(new vscode.Range(6, 29, 6, 32));
    });

    test('Navigates to definition in different file', async () => {
        const requestPosition = new vscode.Position(16, 19);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                requestPosition
            )
        );
        expect(definitionList.length).toEqual(1);
        expect(definitionList[0].uri.path).toContain('diagnostics.cs');
        expect(definitionList[0].range).toStrictEqual(new vscode.Range(4, 17, 4, 23));

        await navigate(requestPosition, definitionList, 'diagnostics.cs');
    });

    testIfCSharp('Navigates to definition in decompiled source', async () => {
        await openFileInWorkspaceAsync(path.join('test', 'UnitTest1.cs'));

        // Get definitions
        const requestPosition = new vscode.Position(13, 9);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                requestPosition
            )
        );
        expect(definitionList.length).toEqual(1);
        const definitionPath = definitionList[0].uri;
        expect(definitionPath.fsPath).toContain('FactAttribute.cs');

        // Navigate
        await navigate(requestPosition, definitionList, 'FactAttribute.cs');
        expect(vscode.window.activeTextEditor?.document.getText()).toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );
    });

    testIfCSharp('Navigates from definition in decompiled source goes to decompiled source', async () => {
        await openFileInWorkspaceAsync(path.join('test', 'UnitTest1.cs'));

        // Get definitions
        const requestPosition = new vscode.Position(13, 9);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                requestPosition
            )
        );
        expect(definitionList.length).toEqual(1);
        const definitionPath = definitionList[0].uri;
        expect(definitionPath.fsPath).toContain('FactAttribute.cs');

        // Navigate
        await navigate(requestPosition, definitionList, 'FactAttribute.cs');
        expect(vscode.window.activeTextEditor?.document.getText()).toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );

        // Get definitions from inside FactAttribute.cs
        // Rather than hardcoding a location, we find the location by searching the document as different SDKs may have different versions of the source.
        const rangeOfDefinition = findRangeOfString(vscode.window.activeTextEditor!, 'XunitTestCaseDiscoverer')[0];
        const attributeUsageDefinition = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                rangeOfDefinition.start
            )
        );

        expect(attributeUsageDefinition.length).toEqual(1);
        const attributeDefinitionPath = attributeUsageDefinition[0].uri;
        expect(attributeDefinitionPath.fsPath).toContain('XunitTestCaseDiscovererAttribute.cs');

        // Navigate
        await navigate(rangeOfDefinition.start, attributeUsageDefinition, 'XunitTestCaseDiscovererAttribute.cs');
        expect(vscode.window.activeTextEditor?.document.getText()).toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );
    });

    test('Navigates to definition in metadata as source', async () => {
        // Get definitions
        const requestPosition = new vscode.Position(10, 25);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                requestPosition
            )
        );
        expect(definitionList.length).toEqual(1);
        const definitionPath = definitionList[0].uri;
        expect(definitionPath.fsPath).toContain('Console.cs');

        // Navigate
        await navigate(requestPosition, definitionList, 'Console.cs');
        expect(vscode.window.activeTextEditor?.document.getText()).not.toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );
    });

    test('Navigates to definition from inside metadata as source', async () => {
        // Get definitions
        const requestPosition = new vscode.Position(10, 25);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                requestPosition
            )
        );
        expect(definitionList.length).toEqual(1);
        const definitionPath = definitionList[0].uri;
        expect(definitionPath.fsPath).toContain('Console.cs');

        // Navigate
        await navigate(requestPosition, definitionList, 'Console.cs');
        expect(vscode.window.activeTextEditor?.document.getText()).not.toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );

        // Get definitions from inside Console.cs
        // Rather than hardcoding a location, we find the location by searching the document as different SDKs may have different versions of the source.
        const rangeOfDefinition = findRangeOfString(vscode.window.activeTextEditor!, 'ConsoleColor ForegroundColor')[0];
        const consoleColorDefinition = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                rangeOfDefinition.start
            )
        );

        expect(consoleColorDefinition.length).toEqual(1);
        const consoleColorDefinitionPath = consoleColorDefinition[0].uri;
        expect(consoleColorDefinitionPath.fsPath).toContain('ConsoleColor.cs');

        // Navigate
        await navigate(rangeOfDefinition.start, consoleColorDefinition, 'ConsoleColor.cs');
        expect(vscode.window.activeTextEditor?.document.getText()).not.toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );
    });

    test('Returns multiple definitions for partial types', async () => {
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                new vscode.Position(4, 25)
            )
        );
        expect(definitionList.length).toEqual(2);
        expect(definitionList[0].uri.path).toContain('definition.cs');
        expect(definitionList[0].range).toStrictEqual(
            new vscode.Range(new vscode.Position(4, 25), new vscode.Position(4, 35))
        );
        expect(definitionList[1].uri.path).toContain('definition.cs');
        expect(definitionList[1].range).toStrictEqual(
            new vscode.Range(new vscode.Position(14, 25), new vscode.Position(14, 35))
        );
    });

    testIfDevKit('Navigates to definition in source link', async () => {
        await openFileInWorkspaceAsync(path.join('test', 'UnitTest1.cs'));

        // Get definitions
        const requestPosition = new vscode.Position(13, 9);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                requestPosition
            )
        );
        expect(definitionList.length).toEqual(1);
        const definitionPath = definitionList[0].uri;
        expect(definitionPath.fsPath).toContain('FactAttribute.cs');

        // Navigate
        await navigate(requestPosition, definitionList, 'FactAttribute.cs');

        // File should not be decompiled and should come from the symbol cache
        expect(vscode.window.activeTextEditor?.document.getText()).not.toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );
        expect(vscode.window.activeTextEditor?.document.uri.path.toLowerCase()).toContain('symbolcache');
    });

    testIfDevKit('Navigates from definition in source link source goes to source link', async () => {
        await openFileInWorkspaceAsync(path.join('test', 'UnitTest1.cs'));

        // Get definitions
        const requestPosition = new vscode.Position(13, 9);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                requestPosition
            )
        );
        expect(definitionList.length).toEqual(1);
        const definitionPath = definitionList[0].uri;
        expect(definitionPath.fsPath).toContain('FactAttribute.cs');

        // Navigate
        await navigate(requestPosition, definitionList, 'FactAttribute.cs');
        // File should not be decompiled and should come from the symbol cache
        expect(vscode.window.activeTextEditor?.document.getText()).not.toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );
        expect(vscode.window.activeTextEditor?.document.uri.path.toLowerCase()).toContain('symbolcache');

        // Get definitions from inside FactAttribute.cs
        // Rather than hardcoding a location, we find the location by searching the document as different SDKs may have different versions of the source.
        const rangeOfDefinition = findRangeOfString(vscode.window.activeTextEditor!, 'XunitTestCaseDiscoverer')[0];
        const attributeUsageDefinition = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                rangeOfDefinition.start
            )
        );

        expect(attributeUsageDefinition.length).toEqual(1);
        const attributeDefinitionPath = attributeUsageDefinition[0].uri;
        expect(attributeDefinitionPath.fsPath).toContain('XunitTestCaseDiscovererAttribute.cs');

        // Navigate
        await navigate(rangeOfDefinition.start, attributeUsageDefinition, 'XunitTestCaseDiscovererAttribute.cs');
        // File should not be decompiled and should come from the symbol cache
        expect(vscode.window.activeTextEditor?.document.getText()).not.toContain(
            '// Decompiled with ICSharpCode.Decompiler'
        );
        expect(vscode.window.activeTextEditor?.document.uri.path.toLowerCase()).toContain('symbolcache');
    });
});

async function navigate(
    originalPosition: vscode.Position,
    definitionLocations: vscode.Location[],
    expectedFileName: string
): Promise<void> {
    const windowChanged = new Promise<void>((resolve, _) => {
        vscode.window.onDidChangeActiveTextEditor((_e) => {
            if (_e?.document.fileName.includes(expectedFileName)) {
                resolve();
            }
        });
    });

    await vscode.commands.executeCommand(
        'editor.action.goToLocations',
        vscode.window.activeTextEditor!.document.uri,
        originalPosition,
        definitionLocations,
        'goto',
        'Failed to navigate'
    );

    // Navigation happens asynchronously when a different file is opened, so we need to wait for the window to change.
    await windowChanged;

    expect(vscode.window.activeTextEditor?.document.fileName).toContain(expectedFileName);
}
