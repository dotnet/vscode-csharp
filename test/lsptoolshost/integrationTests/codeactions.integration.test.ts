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
    expectText,
    openFileInWorkspaceAsync,
} from './integrationHelpers';

describe(`Code Actions Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        const fileName = path.join('src', 'app', 'CodeActions.cs');
        await openFileInWorkspaceAsync(fileName);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Lightbulb displays actions', async () => {
        const actions = await getCodeActions(new vscode.Range(0, 0, 0, 12));
        expect(actions.length).toBeGreaterThanOrEqual(3);

        // Verify we have unresolved code actions.
        expect(actions[0].title).toBe('Remove unnecessary usings');
        expect(actions[0].kind).toStrictEqual(vscode.CodeActionKind.QuickFix);
        expect(actions[0].edit).toBeUndefined();
        expect(actions[0].command).toBeUndefined();

        expect(actions[1].title).toBe('Fix All: Remove unnecessary usings');
        expect(actions[1].kind).toStrictEqual(vscode.CodeActionKind.QuickFix);
        expect(actions[1].edit).toBeUndefined();
        expect(actions[1].command).toBeDefined();

        expect(actions[2].title).toBe('Suppress or configure issues');
        expect(actions[2].kind).toStrictEqual(vscode.CodeActionKind.QuickFix);
        expect(actions[2].edit).toBeUndefined();
        expect(actions[2].command).toBeDefined();
    });

    test('Remove unnecessary usings applied', async () => {
        const actions = await getCodeActions(new vscode.Range(0, 0, 0, 12), 10);

        expect(actions[0].title).toBe('Remove unnecessary usings');
        expect(actions[0].edit).toBeDefined();

        await vscode.workspace.applyEdit(actions[0].edit!);

        await expectText(vscode.window.activeTextEditor!.document, [
            'namespace CodeActionsTests;',
            '',
            'class CodeActions',
            '{',
            '    static void Do() { Method(); }',
            '    static void Method()',
            '    {',
            '        var x = 1;',
            '        Do();',
            '    }',
            '}',
        ]);
    });

    test('Add accessibility modifiers applied', async () => {
        const actions = await getCodeActions(new vscode.Range(6, 16, 6, 19), 10);

        expect(actions[0].title).toBe('Add accessibility modifiers');
        expect(actions[0].edit).toBeDefined();

        await vscode.workspace.applyEdit(actions[0].edit!);

        await expectText(vscode.window.activeTextEditor!.document, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'class CodeActions',
            '{',
            '    private static void Do() { Method(); }',
            '    static void Method()',
            '    {',
            '        var x = 1;',
            '        Do();',
            '    }',
            '}',
        ]);
    });

    test('Fix all in document', async () => {
        const action = await getSpecificCodeAction(
            new vscode.Range(6, 16, 6, 19),
            'Fix All: Add accessibility modifiers'
        );

        expect(action.edit).toBeUndefined();
        expect(action.command).toBeDefined();

        await invokeQuickPickAction(action, /*quickPickIndex: Document*/ 0);

        await expectText(vscode.window.activeTextEditor!.document, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'internal class CodeActions',
            '{',
            '    private static void Do() { Method(); }',
            '',
            '    private static void Method()',
            '    {',
            '        var x = 1;',
            '        Do();',
            '    }',
            '}',
        ]);
    });

    test('Fix all in project', async () => {
        const action = await getSpecificCodeAction(
            new vscode.Range(6, 16, 6, 19),
            'Fix All: Add accessibility modifiers'
        );

        expect(action.edit).toBeUndefined();
        expect(action.command).toBeDefined();

        await invokeQuickPickAction(action, /*quickPickIndex: Project*/ 1);

        await expectText(vscode.window.activeTextEditor!.document, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'internal class CodeActions',
            '{',
            '    private static void Do() { Method(); }',
            '',
            '    private static void Method()',
            '    {',
            '        var x = 1;',
            '        Do();',
            '    }',
            '}',
        ]);

        const projectFile = vscode.workspace.textDocuments.find((d) => d.fileName.endsWith('CodeActionsInProject.cs'));
        expect(projectFile).toBeDefined();
        await expectText(projectFile!, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'internal class CodeActionsInProject',
            '{',
            '}',
        ]);
    });

    test('Fix all in solution', async () => {
        const action = await getSpecificCodeAction(
            new vscode.Range(6, 16, 6, 19),
            'Fix All: Add accessibility modifiers'
        );

        expect(action.edit).toBeUndefined();
        expect(action.command).toBeDefined();

        await invokeQuickPickAction(action, /*quickPickIndex: Solution*/ 2);

        await expectText(vscode.window.activeTextEditor!.document, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'internal class CodeActions',
            '{',
            '    private static void Do() { Method(); }',
            '',
            '    private static void Method()',
            '    {',
            '        var x = 1;',
            '        Do();',
            '    }',
            '}',
        ]);

        const currentProjectFile = vscode.workspace.textDocuments.find((d) =>
            d.fileName.endsWith('CodeActionsInProject.cs')
        );
        expect(currentProjectFile).toBeDefined();
        await expectText(currentProjectFile!, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'internal class CodeActionsInProject',
            '{',
            '}',
        ]);

        const otherProjectFile = vscode.workspace.textDocuments.find((d) =>
            d.fileName.endsWith('CodeActionsInSolution.cs')
        );
        expect(otherProjectFile).toBeDefined();
        await expectText(otherProjectFile!, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'internal class CodeActionsInSolution',
            '{',
            '}',
        ]);
    });

    test('Nested action', async () => {
        const action = await getSpecificCodeAction(new vscode.Range(9, 12, 9, 12), 'Convert number');

        expect(action.edit).toBeUndefined();
        expect(action.command).toBeDefined();

        await invokeQuickPickAction(action, /*quickPickIndex: Convert to binary*/ 0);

        await expectText(vscode.window.activeTextEditor!.document, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'class CodeActions',
            '{',
            '    static void Do() { Method(); }',
            '    static void Method()',
            '    {',
            '        var x = 0b1;',
            '        Do();',
            '    }',
            '}',
        ]);
    });

    test('Suppress warning', async () => {
        const action = await getSpecificCodeAction(new vscode.Range(9, 12, 9, 12), 'Suppress or configure issues');

        expect(action.edit).toBeUndefined();
        expect(action.command).toBeDefined();

        await invokeQuickPickAction(action, /*quickPickIndex: Suppress CS0219 -> in Source*/ 0);

        await expectText(vscode.window.activeTextEditor!.document, [
            'using System;',
            '',
            'namespace CodeActionsTests;',
            '',
            'class CodeActions',
            '{',
            '    static void Do() { Method(); }',
            '    static void Method()',
            '    {',
            '#pragma warning disable CS0219 // Variable is assigned but its value is never used',
            '        var x = 1;',
            '#pragma warning restore CS0219 // Variable is assigned but its value is never used',
            '        Do();',
            '    }',
            '}',
        ]);
    });

    test('Configure code style option', async () => {
        const action = await getSpecificCodeAction(new vscode.Range(6, 16, 6, 19), 'Suppress or configure issues');

        expect(action.edit).toBeUndefined();
        expect(action.command).toBeDefined();

        await invokeQuickPickAction(action, /*quickPickIndex: Configure IDE0040 code style -> never*/ 0);

        const editorConfigFile = vscode.workspace.textDocuments.find((d) => d.fileName.endsWith('.editorconfig'));
        expect(editorConfigFile).toBeDefined();
        expect(editorConfigFile!.getText()).toContain('dotnet_style_require_accessibility_modifiers = never');
    });

    test('Configure analyzer severity', async () => {
        const action = await getSpecificCodeAction(new vscode.Range(6, 16, 6, 19), 'Suppress or configure issues');

        expect(action.edit).toBeUndefined();
        expect(action.command).toBeDefined();

        await invokeQuickPickAction(action, /*quickPickIndex: Configure IDE0040 severity -> None*/ 4);

        const editorConfigFile = vscode.workspace.textDocuments.find((d) => d.fileName.endsWith('.editorconfig'));
        expect(editorConfigFile).toBeDefined();
        expect(editorConfigFile!.getText()).toContain('dotnet_diagnostic.IDE0040.severity = none');
    });
});

async function getCodeActions(
    range: vscode.Range,
    resolveCount: number | undefined = undefined
): Promise<vscode.CodeAction[]> {
    const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        vscode.window.activeTextEditor!.document.uri,
        range,
        /** kind **/ undefined,
        resolveCount
    );
    return codeActions;
}

async function getSpecificCodeAction(range: vscode.Range, title: string): Promise<vscode.CodeAction> {
    const codeActions = await getCodeActions(range, 100);
    const action = codeActions.find((action) => action.title === title);
    if (!action) {
        throw new Error(`Code action '${title}' not found in ${codeActions.map((a) => a.title).join(', ')}`);
    }
    return action;
}

async function invokeQuickPickAction(codeAction: vscode.CodeAction, quickPickIndex: number): Promise<void> {
    // Invoke, but do not await the command (the command blocks until a quick pick item is resolved)
    const promise = vscode.commands.executeCommand(codeAction.command!.command, ...codeAction.command!.arguments!);

    // workbench.action.quickOpenSelectNext selects the next quick pick item.
    // It must be called at least once to select the first item.
    for (let i = 0; i <= quickPickIndex; i++) {
        // First call ensures the quick pick is populated with items and the first is selected.
        await vscode.commands.executeCommand('workbench.action.quickOpenSelectNext');
    }

    // Accept the selected item
    await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');

    // Finally wait for the command to complete.
    await promise;
}
