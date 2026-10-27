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
    navigate,
    openFileInWorkspaceAsync,
    testIfCSharp,
    testIfDevKit,
    waitForExpectedResult,
} from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';
import { CSharpExtensionExports } from '../../../src/csharpExtensionExports';
import { VSGetProjectContextsRequest } from '../../../src/lsptoolshost/server/roslynProtocol';
import { UriConverter } from '../../../src/lsptoolshost/utils/uriConverter';
import { CancellationToken } from 'vscode-languageclient';

/**
 * For built-in library references, we can get different metadata results depending on the test project TFM and installed SDKs.
 * When the installed SDK matches the project TFM, we can find the implementation assembly and return decompiled source.
 * When the installed SDK does not match, we will get a reference assembly instead and only have metadata available.
 * This happens as our test project targets the lowest supported TFM, but we test against all supported SDKs to ensure compatibility.
 */
function expectDecompiledOrMetadata(): void {
    const text = vscode.window.activeTextEditor?.document.getText();
    expect(
        text?.includes('// Decompiled with ICSharpCode.Decompiler') || text?.includes('microsoft.netcore.app.ref')
    ).toBe(true);
}

describe(`Go To Definition Tests`, () => {
    let exports: CSharpExtensionExports;

    beforeAll(async () => {
        const uri = vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            'src',
            'app',
            'uri encoding # %25.cs'
        );
        await vscode.workspace.fs.writeFile(
            uri,
            Buffer.from('class UriEncoding { public static int Value { get; set; } public int Read() => Value; }')
        );
        exports = await activateCSharpExtension();
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

    test('Round-trips encoded file URIs through standard and custom requests', async () => {
        const uri = await openFileInWorkspaceAsync(path.join('src', 'app', 'uri encoding # %25.cs'));
        const serializedUri = UriConverter.serialize(uri);
        expect(serializedUri).toEqual(uri.toString());
        expect(serializedUri).toContain('uri%20encoding%20%23%20%2525.cs');
        expect(UriConverter.deserialize(serializedUri).fsPath).toEqual(uri.fsPath);

        const ranges = findRangeOfString(vscode.window.activeTextEditor!, 'Value');
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            uri,
            ranges[1].start
        );
        expect(definitions).toHaveLength(1);
        expect(definitions![0].uri.fsPath).toEqual(uri.fsPath);
        expect(definitions![0].range).toStrictEqual(ranges[0]);

        await waitForExpectedResult(
            async () =>
                exports.experimental.sendServerRequest(
                    VSGetProjectContextsRequest.type,
                    { _vs_textDocument: { uri: serializedUri } },
                    CancellationToken.None
                ),
            10 * 1000,
            100,
            (contexts) => {
                expect(contexts._vs_projectContexts.length).toBeGreaterThan(0);
                expect(contexts._vs_projectContexts[contexts._vs_defaultIndex]._vs_is_miscellaneous).toBe(false);
            }
        );
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

    testIfCSharp('Navigates to definition in System', async () => {
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
        expectDecompiledOrMetadata();
    });

    test('Navigates to definition from inside metadata', async () => {
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
        expectDecompiledOrMetadata();
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
