/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import {
    convertToProjectCommandName,
    registerConvertToProjectCommands,
} from '../../../src/lsptoolshost/fileBasedApps/convertToProject';

jest.mock('vscode', () => ({
    commands: {
        registerCommand: jest.fn((_name, _handler) => ({ dispose: jest.fn() })),
    },
    workspace: {
        textDocuments: [],
        openTextDocument: jest.fn(),
        findFiles: jest.fn(),
        asRelativePath: jest.fn((uri: { fsPath: string }) => uri.fsPath),
    },
    window: {
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        terminals: [],
        createTerminal: jest.fn(),
        showQuickPick: jest.fn(),
    },
    l10n: {
        t: jest.fn((message: string) => message),
    },
}));

type MockDocument = Pick<vscode.TextDocument, 'uri' | 'languageId'>;
type MockTerminal = Pick<vscode.Terminal, 'name' | 'show' | 'sendText'>;

type WorkspaceMock = {
    textDocuments: MockDocument[];
    openTextDocument: jest.Mock<(uri: vscode.Uri) => Promise<vscode.TextDocument>>;
    findFiles: jest.Mock<(include: string, exclude: string) => Promise<vscode.Uri[]>>;
    asRelativePath: jest.Mock<(uri: { fsPath: string }) => string>;
};

type WindowMock = {
    showErrorMessage: jest.Mock<(message: string) => void>;
    showInformationMessage: jest.Mock<(message: string) => void>;
    terminals: MockTerminal[];
    createTerminal: jest.Mock<(options: { name: string; cwd: string }) => MockTerminal>;
    showQuickPick: jest.Mock;
};

const workspaceMock = vscode.workspace as unknown as WorkspaceMock;
const windowMock = vscode.window as unknown as WindowMock;
const registerCommandMock = vscode.commands.registerCommand as unknown as jest.Mock<
    (name: string, handler: (uri?: vscode.Uri) => Promise<void>) => vscode.Disposable
>;

function createTerminal(name = 'dotnet project convert'): MockTerminal {
    return {
        name,
        show: jest.fn(),
        sendText: jest.fn(),
    };
}

function getRegisteredHandler(): (uri?: vscode.Uri) => Promise<void> {
    return registerCommandMock.mock.calls[0][1] as (uri?: vscode.Uri) => Promise<void>;
}

beforeEach(() => {
    jest.clearAllMocks();
    workspaceMock.textDocuments = [];
    workspaceMock.openTextDocument.mockReset();
    workspaceMock.findFiles.mockReset().mockResolvedValue([] as vscode.Uri[]);
    workspaceMock.asRelativePath.mockReset().mockImplementation((uri: { fsPath: string }) => uri.fsPath);
    windowMock.showErrorMessage.mockReset();
    windowMock.showInformationMessage.mockReset();
    windowMock.terminals = [];
    windowMock.createTerminal.mockReset();
    windowMock.showQuickPick.mockReset();
});

describe('registerConvertToProjectCommands', () => {
    test('registers the command and pushes the disposable onto subscriptions', async () => {
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

        registerConvertToProjectCommands(context);

        expect(registerCommandMock).toHaveBeenCalledWith(convertToProjectCommandName, expect.any(Function));
        expect(context.subscriptions).toContain(registerCommandMock.mock.results[0].value);

        await getRegisteredHandler()();

        expect(workspaceMock.findFiles).toHaveBeenCalledWith('**/*.cs', '**/obj/**');
        expect(windowMock.showInformationMessage).toHaveBeenCalledWith('No C# files found in the workspace.');
    });
});

describe('convertToProject command handler', () => {
    test('uses an already open C# document and creates a new terminal', async () => {
        const uri = { fsPath: '/workspace/app.cs' } as vscode.Uri;
        const document: MockDocument = { uri, languageId: 'csharp' };
        const terminal = createTerminal();
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

        workspaceMock.textDocuments = [document];
        windowMock.createTerminal.mockReturnValue(terminal as vscode.Terminal);

        registerConvertToProjectCommands(context);
        await getRegisteredHandler()(uri);

        expect(workspaceMock.openTextDocument).not.toHaveBeenCalled();
        expect(windowMock.createTerminal).toHaveBeenCalledWith({
            name: 'dotnet project convert',
            cwd: '/workspace',
        });
        expect(terminal.show).toHaveBeenCalledWith(true);
        expect(terminal.sendText).toHaveBeenCalledTimes(1);
        expect(terminal.sendText).toHaveBeenCalledWith('dotnet project convert "app.cs"');
    });

    test('opens a closed C# document and creates a new terminal', async () => {
        const uri = { fsPath: '/workspace/app.cs' } as vscode.Uri;
        const document: MockDocument = { uri, languageId: 'csharp' };
        const terminal = createTerminal();
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

        workspaceMock.openTextDocument.mockResolvedValue(document as vscode.TextDocument);
        windowMock.createTerminal.mockReturnValue(terminal as vscode.Terminal);

        registerConvertToProjectCommands(context);
        await getRegisteredHandler()(uri);

        expect(workspaceMock.openTextDocument).toHaveBeenCalledWith(uri);
        expect(windowMock.createTerminal).toHaveBeenCalledWith({
            name: 'dotnet project convert',
            cwd: '/workspace',
        });
        expect(terminal.show).toHaveBeenCalledWith(true);
        expect(terminal.sendText).toHaveBeenCalledTimes(1);
        expect(terminal.sendText).toHaveBeenCalledWith('dotnet project convert "app.cs"');
    });

    test('always creates a new terminal even when one with the same name already exists', async () => {
        const uri = { fsPath: '/workspace/app.cs' } as vscode.Uri;
        const document: MockDocument = { uri, languageId: 'csharp' };
        const existingTerminal = createTerminal();
        const newTerminal = createTerminal();
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

        workspaceMock.textDocuments = [document];
        windowMock.terminals = [existingTerminal];
        windowMock.createTerminal.mockReturnValue(newTerminal as vscode.Terminal);

        registerConvertToProjectCommands(context);
        await getRegisteredHandler()(uri);

        expect(windowMock.createTerminal).toHaveBeenCalled();
        expect(existingTerminal.sendText).not.toHaveBeenCalled();
        expect(newTerminal.sendText).toHaveBeenCalledTimes(1);
        expect(newTerminal.sendText).toHaveBeenCalledWith('dotnet project convert "app.cs"');
    });

    test('does not send any cd command regardless of platform', async () => {
        const uri = { fsPath: '/workspace/app.cs' } as vscode.Uri;
        const document: MockDocument = { uri, languageId: 'csharp' };
        const terminal = createTerminal();
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

        workspaceMock.textDocuments = [document];
        windowMock.createTerminal.mockReturnValue(terminal as vscode.Terminal);

        registerConvertToProjectCommands(context);
        await getRegisteredHandler()(uri);

        const sentTexts = (terminal.sendText as jest.Mock).mock.calls.map((c) => c[0] as string);
        for (const text of sentTexts) {
            expect(text).not.toMatch(/^cd\b/);
        }
    });

    test('shows an error for a non-C# document and does not run the convert command', async () => {
        const uri = { fsPath: '/workspace/app.cs' } as vscode.Uri;
        const document: MockDocument = { uri, languageId: 'plaintext' };
        const terminal = createTerminal();
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

        workspaceMock.openTextDocument.mockResolvedValue(document as vscode.TextDocument);
        windowMock.createTerminal.mockReturnValue(terminal as vscode.Terminal);

        registerConvertToProjectCommands(context);
        await getRegisteredHandler()(uri);

        expect(windowMock.showErrorMessage).toHaveBeenCalledWith('Only C# files can be converted to a project.');
        expect(windowMock.createTerminal).not.toHaveBeenCalled();
        expect(terminal.show).not.toHaveBeenCalled();
        expect(terminal.sendText).not.toHaveBeenCalled();
    });
});
