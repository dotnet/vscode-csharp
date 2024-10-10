/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { ActionOption, showWarningMessage } from '../shared/observers/utils/showMessage';
import { ServerState } from './serverStateChange';
import { languageServerOptions } from '../shared/options';

const SuppressMiscellaneousFilesToastsOption = 'dotnet.server.suppressMiscellaneousFilesToasts';
const NotifiedDocuments = new Set<string>();

export function registerMiscellaneousFileNotifier(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer
) {
    context.workspaceState.update(SuppressMiscellaneousFilesToastsOption, undefined);

    languageServer._projectContextService.onActiveFileContextChanged((e) => {
        const hash = createHash(e.uri.toString(/*skipEncoding:*/ true));
        if (NotifiedDocuments.has(hash)) {
            return;
        }

        if (!e.context._vs_is_miscellaneous || languageServer.state !== ServerState.ProjectInitializationComplete) {
            return;
        }

        if (languageServerOptions.suppressMiscellaneousFilesToasts) {
            return;
        }

        if (context.workspaceState.get<boolean>(SuppressMiscellaneousFilesToastsOption, false)) {
            return;
        }

        NotifiedDocuments.add(hash);

        const message = vscode.l10n.t(
            'The active document is not part of the open workspace. Not all language features will be available.'
        );
        const dismissItem = vscode.l10n.t('Dismiss');
        const disableWorkspace: ActionOption = {
            title: vscode.l10n.t('Do not show for this workspace'),
            action: async () => {
                context.workspaceState.update(SuppressMiscellaneousFilesToastsOption, true);
            },
        };
        showWarningMessage(vscode, message, dismissItem, disableWorkspace);
    });
}

function createHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}
