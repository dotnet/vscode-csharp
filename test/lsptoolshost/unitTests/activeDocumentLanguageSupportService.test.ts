/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import type { ActiveDocumentLanguageSupport } from '../../../src/csharpExtensionExports';
import { ActiveDocumentLanguageSupportService } from '../../../src/lsptoolshost/projectContext/activeDocumentLanguageSupportService';
import type { ProjectContextChangeEvent } from '../../../src/lsptoolshost/projectContext/projectContextService';
import { ServerState } from '../../../src/lsptoolshost/server/languageServerEvents';

describe('ActiveDocumentLanguageSupportService', () => {
    test('tracks changing support for the active document and clears it on editor change', async () => {
        let activeEditorChanged: (() => void) | undefined;
        let projectContextChanged: ((event: ProjectContextChangeEvent) => void) | undefined;
        (vscode.window as any).onDidChangeActiveTextEditor = (listener: () => void) => {
            activeEditorChanged = listener;
            return { dispose: jest.fn() };
        };

        const document = {
            uri: { scheme: 'file', toString: () => 'file:///repo/Program.cs' },
            languageId: 'csharp',
        } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = { document };
        const refresh = jest.fn(async () => {});
        const languageServer = {
            state: ServerState.ProjectInitializationStarted,
            _projectContextService: {
                onActiveFileContextChanged: (listener: (event: ProjectContextChangeEvent) => void) => {
                    projectContextChanged = listener;
                    return { dispose: jest.fn() };
                },
                refresh,
            },
        };
        const service = new ActiveDocumentLanguageSupportService(Promise.resolve(languageServer as any));
        await Promise.resolve();

        projectContextChanged?.(createEvent(document, { isVerified: false, isMiscellaneous: true }));
        expect(service.current?.state).toBe('unknown');

        languageServer.state = ServerState.ProjectInitializationComplete;
        projectContextChanged?.(createEvent(document, { isVerified: false, isMiscellaneous: true }));
        expect(service.current?.state).toBe('limited');

        projectContextChanged?.(createEvent(document, { isVerified: false, isMiscellaneous: false }));
        expect(service.current?.state).toBe('full');

        projectContextChanged?.(createEvent(document, { isVerified: false, isMiscellaneous: false, projectId: '' }));
        expect(service.current?.state).toBe('limited');

        projectContextChanged?.(createEvent(document, { isVerified: true, isMiscellaneous: true }));
        expect(service.current?.state).toBe('limited');

        projectContextChanged?.(createEvent(document, { isVerified: true, isMiscellaneous: false }));
        expect(service.current?.state).toBe('full');

        activeEditorChanged?.();
        expect(service.current).toBeUndefined();
        expect(refresh).toHaveBeenCalled();
        service.dispose();
    });

    test('fires only when the published snapshot changes', async () => {
        let activeEditorChanged: (() => void) | undefined;
        let projectContextChanged: ((event: ProjectContextChangeEvent) => void) | undefined;
        (vscode.window as any).onDidChangeActiveTextEditor = (listener: () => void) => {
            activeEditorChanged = listener;
            return { dispose: jest.fn() };
        };

        const document = {
            uri: { scheme: 'file', toString: () => 'file:///repo/Program.cs' },
            languageId: 'csharp',
        } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = { document };
        const languageServer = {
            state: ServerState.ProjectInitializationComplete,
            _projectContextService: {
                onActiveFileContextChanged: (listener: (event: ProjectContextChangeEvent) => void) => {
                    projectContextChanged = listener;
                    return { dispose: jest.fn() };
                },
                refresh: async () => {},
            },
        };
        const service = new ActiveDocumentLanguageSupportService(Promise.resolve(languageServer as any));
        const fired: (ActiveDocumentLanguageSupport | undefined)[] = [];
        service.onDidChange((value) => fired.push(value));
        await Promise.resolve();

        // A refresh publishes an unverified context followed by a verified one with the same classification.
        projectContextChanged?.(createEvent(document, { isVerified: false, isMiscellaneous: false }));
        projectContextChanged?.(createEvent(document, { isVerified: true, isMiscellaneous: false }));
        projectContextChanged?.(createEvent(document, { isVerified: false, isMiscellaneous: false }));
        projectContextChanged?.(createEvent(document, { isVerified: true, isMiscellaneous: false }));
        expect(fired).toEqual([{ documentUri: 'file:///repo/Program.cs', state: 'full', projectLabel: 'Program.cs' }]);

        projectContextChanged?.(
            createEvent(document, { isVerified: true, isMiscellaneous: false, projectLabel: 'Other.csproj' })
        );
        projectContextChanged?.(createEvent(document, { isVerified: true, isMiscellaneous: true }));
        expect(fired.slice(1)).toEqual([
            { documentUri: 'file:///repo/Program.cs', state: 'full', projectLabel: 'Other.csproj' },
            { documentUri: 'file:///repo/Program.cs', state: 'limited', projectLabel: 'Program.cs' },
        ]);

        activeEditorChanged?.();
        activeEditorChanged?.();
        expect(fired.slice(3)).toEqual([undefined]);

        projectContextChanged?.(createEvent(document, { isVerified: true, isMiscellaneous: true }));
        expect(fired.slice(4)).toEqual([
            { documentUri: 'file:///repo/Program.cs', state: 'limited', projectLabel: 'Program.cs' },
        ]);
        service.dispose();
    });

    test('logs a failure from the initial project context refresh', async () => {
        (vscode.window as any).onDidChangeActiveTextEditor = () => ({ dispose: jest.fn() });
        const error = new Error('refresh failed');
        const logError = jest.fn();
        const languageServer = {
            _projectContextService: {
                onActiveFileContextChanged: () => ({ dispose: jest.fn() }),
                refresh: async () => Promise.reject(error),
            },
        };

        const service = new ActiveDocumentLanguageSupportService(Promise.resolve(languageServer as any), {
            error: logError,
        } as any);
        await new Promise((resolve) => setImmediate(resolve));

        expect(logError).toHaveBeenCalledWith(expect.stringContaining('ActiveDocumentLanguageSupport'), error);
        service.dispose();
    });
});

function createEvent(
    document: vscode.TextDocument,
    args: {
        isVerified: boolean;
        isMiscellaneous: boolean;
        projectId?: string;
        projectLabel?: string;
    }
): ProjectContextChangeEvent {
    return {
        document,
        context: {
            _vs_id: args.projectId === undefined ? 'project' : args.projectId,
            _vs_kind: 'CSharp',
            _vs_label: args.projectLabel ?? 'Program.cs',
            _vs_is_miscellaneous: args.isMiscellaneous,
        },
        isVerified: args.isVerified,
        hasAdditionalContexts: false,
    };
}
