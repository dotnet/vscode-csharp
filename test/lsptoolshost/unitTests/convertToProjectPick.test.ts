/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';

jest.mock('vscode', () => {
    const workspace = {
        _textDocuments: [] as Array<{ languageId: string; uri: { fsPath: string } }>,
        findFiles: jest.fn<(include: string, exclude: string) => Promise<Array<{ fsPath: string }>>>(),
        openTextDocument: jest.fn(),
        asRelativePath: jest.fn<(uri: { fsPath: string }, includeWorkspace?: boolean) => string>(),
    };

    Object.defineProperty(workspace, 'textDocuments', {
        get: () => workspace._textDocuments,
        set: (value) => {
            workspace._textDocuments = value;
        },
    });

    const window = {
        _terminals: [] as Array<{
            name: string;
            show: jest.Mock<(preserveFocus?: boolean) => void>;
            sendText: jest.Mock<(text: string) => void>;
        }>,
        showErrorMessage: jest.fn<(message: string) => void>(),
        showInformationMessage: jest.fn<(message: string) => void>(),
        showQuickPick:
            jest.fn<
                (
                    items: Array<{ label: string; description: string; detail: string }>,
                    options: { placeHolder: string; matchOnDescription: boolean; matchOnDetail: boolean }
                ) => Promise<{ label: string; description: string; detail: string } | undefined>
            >(),
        createTerminal: jest.fn<
            (options: { name: string; cwd: string }) => {
                name: string;
                show: jest.Mock<(preserveFocus?: boolean) => void>;
                sendText: jest.Mock<(text: string) => void>;
            }
        >(),
    };

    Object.defineProperty(window, 'terminals', {
        get: () => window._terminals,
        set: (value) => {
            window._terminals = value;
        },
    });

    return {
        commands: {
            registerCommand: jest.fn((_name: string, _handler: (uri?: { fsPath: string }) => Promise<void>) => ({
                dispose: jest.fn(),
            })),
            executeCommand: jest.fn().mockImplementation(async () => Promise.resolve()),
        },
        workspace,
        window: {
            ...window,
            activeTextEditor: undefined,
            onDidChangeActiveTextEditor: jest.fn(() => ({ dispose: jest.fn() })),
        },
        l10n: {
            t: (message: string) => message,
        },
        Uri: {
            file: (filePath: string) => ({ fsPath: filePath }),
        },
    };
});

import * as vscode from 'vscode';
import {
    convertToProjectCommandName,
    registerConvertToProjectCommands,
} from '../../../src/lsptoolshost/fileBasedApps/convertToProject';

type MockUri = { fsPath: string };
type MockTextDocument = { languageId: string; uri: MockUri };
type MockQuickPickItem = { label: string; description: string; detail: string };
type MockTerminal = {
    name: string;
    show: jest.Mock<(preserveFocus?: boolean) => void>;
    sendText: jest.Mock<(text: string) => void>;
};

type WorkspaceMock = {
    textDocuments: MockTextDocument[];
    openTextDocument: jest.Mock;
    findFiles: jest.Mock<(include: string, exclude: string) => Promise<MockUri[]>>;
    asRelativePath: jest.Mock<(uri: MockUri, includeWorkspace?: boolean) => string>;
};

type WindowMock = {
    showErrorMessage: jest.Mock<(message: string) => void>;
    showInformationMessage: jest.Mock<(message: string) => void>;
    terminals: MockTerminal[];
    createTerminal: jest.Mock<(options: { name: string; cwd: string }) => MockTerminal>;
    showQuickPick: jest.Mock<
        (
            items: MockQuickPickItem[],
            options: { placeHolder: string; matchOnDescription: boolean; matchOnDetail: boolean }
        ) => Promise<MockQuickPickItem | undefined>
    >;
};

const workspaceMock = vscode.workspace as unknown as WorkspaceMock;
const windowMock = vscode.window as unknown as WindowMock;
const registerCommandMock = vscode.commands.registerCommand as unknown as jest.Mock<
    (name: string, handler: (uri?: vscode.Uri) => Promise<void>) => vscode.Disposable
>;

const mockTerminal: MockTerminal = {
    name: 'dotnet project convert',
    show: jest.fn<(preserveFocus?: boolean) => void>(),
    sendText: jest.fn<(text: string) => void>(),
};
const workspaceRoot = path.join(path.sep, 'workspace');

function uri(filePath: string): MockUri {
    return vscode.Uri.file(filePath) as MockUri;
}

function getRegisteredHandler(): (uri?: vscode.Uri) => Promise<void> {
    return registerCommandMock.mock.calls[0][1] as (uri?: vscode.Uri) => Promise<void>;
}

async function invokePickAndConvert(): Promise<void> {
    registerConvertToProjectCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext);
    await getRegisteredHandler()();
}

beforeEach(() => {
    jest.clearAllMocks();

    workspaceMock.textDocuments = [];
    workspaceMock.openTextDocument.mockReset();
    workspaceMock.findFiles.mockReset().mockResolvedValue([] as MockUri[]);
    workspaceMock.asRelativePath
        .mockReset()
        .mockImplementation((fileUri: MockUri) => path.relative(workspaceRoot, fileUri.fsPath));

    windowMock.showErrorMessage.mockReset();
    windowMock.showInformationMessage.mockReset();
    windowMock.terminals = [];
    windowMock.createTerminal.mockReset().mockReturnValue(mockTerminal);
    windowMock.showQuickPick.mockReset();

    mockTerminal.show.mockReset();
    mockTerminal.sendText.mockReset();
});

describe('registerConvertToProjectCommands', () => {
    test('registers the convert-to-project command', () => {
        registerConvertToProjectCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext);

        expect(registerCommandMock).toHaveBeenCalledWith(convertToProjectCommandName, expect.any(Function));
    });
});

describe('pickAndConvertToProject', () => {
    test('shows an info message when no C# files are found', async () => {
        await invokePickAndConvert();

        expect(windowMock.showInformationMessage).toHaveBeenCalledWith('No C# files found in the workspace.');
    });

    test('shows an info message when all C# files are inside project cones', async () => {
        const filePath = path.join(workspaceRoot, 'app', 'Program.cs');
        const projectPath = path.join(workspaceRoot, 'app', 'App.csproj');

        workspaceMock.findFiles.mockResolvedValueOnce([uri(filePath)]).mockResolvedValueOnce([uri(projectPath)]);

        await invokePickAndConvert();

        expect(windowMock.showInformationMessage).toHaveBeenCalledWith(
            'No file-based C# apps were found in the workspace. ' +
                'A file-based app entry point must not be part of any `.csproj` project, ' +
                'unless it contains a top-of-file `#!` or `#:` directive.'
        );
    });

    test('shows a quick pick for file-based apps outside project cones', async () => {
        const filePath = path.join(workspaceRoot, 'scripts', 'Program.cs');

        workspaceMock.findFiles.mockResolvedValueOnce([uri(filePath)]);
        windowMock.showQuickPick.mockResolvedValue(undefined);

        await invokePickAndConvert();

        expect(windowMock.showQuickPick).toHaveBeenCalledWith(
            [{ label: 'Program.cs', description: path.join('scripts', 'Program.cs'), detail: filePath }],
            {
                placeHolder: 'Select a file-based C# app to convert to a project',
                matchOnDescription: true,
                matchOnDetail: true,
            }
        );
    });

    test('adds open C# documents without a .cs extension to the quick-pick candidates', async () => {
        const discoveredPath = path.join(workspaceRoot, 'scripts', 'Program.cs');
        const openPath = path.join(workspaceRoot, 'scripts', 'app');

        workspaceMock.textDocuments = [
            { languageId: 'csharp', uri: uri(discoveredPath) },
            { languageId: 'csharp', uri: uri(openPath) },
            { languageId: 'plaintext', uri: uri(path.join(workspaceRoot, 'notes.txt')) },
        ];
        workspaceMock.findFiles.mockResolvedValueOnce([uri(discoveredPath)]);
        windowMock.showQuickPick.mockResolvedValue(undefined);

        await invokePickAndConvert();

        expect(windowMock.showQuickPick).toHaveBeenCalledWith(
            expect.arrayContaining([{ label: 'app', description: path.join('scripts', 'app'), detail: openPath }]),
            expect.any(Object)
        );
    });

    test('does not run conversion when the user dismisses the quick pick', async () => {
        const filePath = path.join(workspaceRoot, 'scripts', 'Program.cs');

        workspaceMock.findFiles.mockResolvedValueOnce([uri(filePath)]);
        windowMock.showQuickPick.mockResolvedValue(undefined);

        await invokePickAndConvert();

        expect(mockTerminal.sendText).not.toHaveBeenCalled();
    });

    test('runs the convert command when the user picks a file', async () => {
        const filePath = path.join(workspaceRoot, 'scripts', 'Program.cs');

        workspaceMock.findFiles.mockResolvedValueOnce([uri(filePath)]);
        windowMock.showQuickPick.mockResolvedValue({
            label: 'Program.cs',
            description: path.join('scripts', 'Program.cs'),
            detail: filePath,
        });

        await invokePickAndConvert();

        expect(windowMock.createTerminal).toHaveBeenCalledWith({
            name: 'dotnet project convert',
            cwd: path.join(workspaceRoot, 'scripts'),
        });
        expect(mockTerminal.sendText).toHaveBeenCalledTimes(1);
        expect(mockTerminal.sendText).toHaveBeenCalledWith('dotnet project convert "Program.cs"');
    });

    test('does not send any cd command when the user picks a file', async () => {
        const filePath = path.join(workspaceRoot, 'scripts', 'Program.cs');

        workspaceMock.findFiles.mockResolvedValueOnce([uri(filePath)]);
        windowMock.showQuickPick.mockResolvedValue({
            label: 'Program.cs',
            description: path.join('scripts', 'Program.cs'),
            detail: filePath,
        });

        await invokePickAndConvert();

        const sentTexts = mockTerminal.sendText.mock.calls.map((c) => c[0] as string);
        for (const text of sentTexts) {
            expect(text).not.toMatch(/^cd\b/);
        }
    });

    test('always creates a new terminal when converting a picked file', async () => {
        const filePath = path.join(workspaceRoot, 'scripts', 'Program.cs');
        const existingTerminal: MockTerminal = {
            name: 'dotnet project convert',
            show: jest.fn<(preserveFocus?: boolean) => void>(),
            sendText: jest.fn<(text: string) => void>(),
        };

        workspaceMock.findFiles.mockResolvedValueOnce([uri(filePath)]);
        windowMock.terminals = [existingTerminal];
        windowMock.showQuickPick.mockResolvedValue({
            label: 'Program.cs',
            description: path.join('scripts', 'Program.cs'),
            detail: filePath,
        });

        await invokePickAndConvert();

        expect(windowMock.createTerminal).toHaveBeenCalled();
        expect(existingTerminal.sendText).not.toHaveBeenCalled();
    });
});
