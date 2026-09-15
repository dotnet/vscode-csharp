/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';
import { registerSolutionFileWorkspaceHandler } from '../../../src/solutionFileWorkspaceHandler';

describe('SolutionFileWorkspaceHandler', () => {
    let mockContext: vscode.ExtensionContext;
    let mockChannel: vscode.LogOutputChannel;
    let subscriptions: vscode.Disposable[];
    let executeCommandSpy: jest.SpiedFunction<typeof vscode.commands.executeCommand>;
    let onDidChangeActiveTextEditorHandler: ((editor: vscode.TextEditor | undefined) => void) | undefined;

    beforeEach(() => {
        subscriptions = [];
        mockContext = {
            subscriptions,
        } as unknown as vscode.ExtensionContext;

        mockChannel = {
            info: jest.fn(),
            trace: jest.fn(),
        } as unknown as vscode.LogOutputChannel;

        // Set up spy on executeCommand
        executeCommandSpy = jest
            .spyOn(vscode.commands, 'executeCommand')
            .mockImplementation(async () => Promise.resolve(undefined));

        // Capture the onDidChangeActiveTextEditor handler
        onDidChangeActiveTextEditorHandler = undefined;
        jest.spyOn(vscode.window, 'onDidChangeActiveTextEditor').mockImplementation((handler) => {
            onDidChangeActiveTextEditorHandler = handler as (editor: vscode.TextEditor | undefined) => void;
            return { dispose: jest.fn() } as unknown as vscode.Disposable;
        });

        // Reset workspace state
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(vscode.window, 'activeTextEditor', {
            value: undefined,
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('when no workspace folders exist', () => {
        test('should open solution folder in current window when active document is .sln', async () => {
            const mockDocument = {
                fileName: '/path/to/project.sln',
                uri: vscode.Uri.file('/path/to/project.sln'),
            } as vscode.TextDocument;

            Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: undefined });
            Object.defineProperty(vscode.window, 'activeTextEditor', {
                value: { document: mockDocument },
            });

            registerSolutionFileWorkspaceHandler(mockContext, mockChannel);

            // Give async operation time to complete
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(executeCommandSpy).toHaveBeenCalledWith('vscode.openFolder', expect.anything(), {
                forceReuseWindow: true,
            });
        });

        test('should open solution folder in current window when active document is .slnf', async () => {
            const mockDocument = {
                fileName: '/path/to/project.slnf',
                uri: vscode.Uri.file('/path/to/project.slnf'),
            } as vscode.TextDocument;

            Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: undefined });
            Object.defineProperty(vscode.window, 'activeTextEditor', {
                value: { document: mockDocument },
            });

            registerSolutionFileWorkspaceHandler(mockContext, mockChannel);

            // Give async operation time to complete
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(executeCommandSpy).toHaveBeenCalledWith('vscode.openFolder', expect.anything(), {
                forceReuseWindow: true,
            });
        });

        test('should not open folder for non-solution files', async () => {
            const mockDocument = {
                fileName: '/path/to/file.cs',
                uri: vscode.Uri.file('/path/to/file.cs'),
            } as vscode.TextDocument;

            Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: undefined });
            Object.defineProperty(vscode.window, 'activeTextEditor', {
                value: { document: mockDocument },
            });

            registerSolutionFileWorkspaceHandler(mockContext, mockChannel);

            // Give async operation time to complete
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(executeCommandSpy).not.toHaveBeenCalled();
        });
    });

    describe('when workspace folders exist', () => {
        test('should open new window when solution is outside workspace folders', async () => {
            const workspaceFolders: vscode.WorkspaceFolder[] = [
                { uri: vscode.Uri.file('/workspace/folder'), name: 'workspace', index: 0 },
            ];

            const mockDocument = {
                fileName: '/other/path/project.sln',
                uri: vscode.Uri.file('/other/path/project.sln'),
            } as vscode.TextDocument;

            Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: workspaceFolders });
            Object.defineProperty(vscode.window, 'activeTextEditor', { value: undefined });

            registerSolutionFileWorkspaceHandler(mockContext, mockChannel);

            // Simulate editor change to solution file outside workspace
            expect(onDidChangeActiveTextEditorHandler).toBeDefined();
            onDidChangeActiveTextEditorHandler!({ document: mockDocument } as vscode.TextEditor);

            // Give async operation time to complete
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(executeCommandSpy).toHaveBeenCalledWith('vscode.openFolder', expect.anything(), {
                forceNewWindow: true,
            });
        });

        test('should not open new window when solution is inside workspace folders', async () => {
            const workspaceFolders: vscode.WorkspaceFolder[] = [
                { uri: vscode.Uri.file('/workspace/folder'), name: 'workspace', index: 0 },
            ];

            const mockDocument = {
                fileName: '/workspace/folder/project.sln',
                uri: vscode.Uri.file('/workspace/folder/project.sln'),
            } as vscode.TextDocument;

            Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: workspaceFolders });
            Object.defineProperty(vscode.window, 'activeTextEditor', { value: undefined });

            registerSolutionFileWorkspaceHandler(mockContext, mockChannel);

            // Simulate editor change to solution file inside workspace
            expect(onDidChangeActiveTextEditorHandler).toBeDefined();
            onDidChangeActiveTextEditorHandler!({ document: mockDocument } as vscode.TextEditor);

            // Give async operation time to complete
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(executeCommandSpy).not.toHaveBeenCalled();
        });
    });

    test('should add disposable to context subscriptions', () => {
        registerSolutionFileWorkspaceHandler(mockContext, mockChannel);

        expect(subscriptions.length).toBe(1);
    });
});
