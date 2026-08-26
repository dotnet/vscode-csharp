/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
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

        projectContextChanged?.(createEvent(document, false, true));
        expect(service.current?.state).toBe('unknown');

        languageServer.state = ServerState.ProjectInitializationComplete;
        projectContextChanged?.(createEvent(document, false, true));
        expect(service.current?.state).toBe('limited');

        projectContextChanged?.(createEvent(document, false, false));
        expect(service.current?.state).toBe('full');

        projectContextChanged?.(createEvent(document, false, false, ''));
        expect(service.current?.state).toBe('unknown');

        projectContextChanged?.(createEvent(document, true, true));
        expect(service.current?.state).toBe('limited');

        projectContextChanged?.(createEvent(document, true, false));
        expect(service.current?.state).toBe('full');

        activeEditorChanged?.();
        expect(service.current).toBeUndefined();
        expect(refresh).toHaveBeenCalled();
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

        expect(logError).toHaveBeenCalledWith('Failed to initialize active document language support', error);
        service.dispose();
    });
});

function createEvent(
    document: vscode.TextDocument,
    isVerified: boolean,
    isMiscellaneous: boolean,
    projectId = 'project'
): ProjectContextChangeEvent {
    return {
        document,
        context: {
            _vs_id: projectId,
            _vs_kind: 'CSharp',
            _vs_label: 'Program.cs',
            _vs_is_miscellaneous: isMiscellaneous,
        },
        isVerified,
        hasAdditionalContexts: false,
    };
}
