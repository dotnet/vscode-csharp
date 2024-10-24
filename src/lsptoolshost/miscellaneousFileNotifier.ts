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

const NotificationDelay = 2 * 1000;

let _notifyTimeout: NodeJS.Timeout | undefined;
let _documentUriToNotify: vscode.Uri | undefined;

export function registerMiscellaneousFileNotifier(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer
) {
    languageServer._projectContextService.onActiveFileContextChanged((e) => {
        // Whether we have refreshed the active document's project context.
        let isNotifyPass = false;

        if (_notifyTimeout) {
            // If we have changed active document then do not notify about the previous one.
            clearTimeout(_notifyTimeout);
            _notifyTimeout = undefined;
        }

        if (_documentUriToNotify) {
            if (e.uri.toString() === _documentUriToNotify.toString()) {
                // We have rerequested project contexts for the active document
                // and we can now notify if the document isn't part of the workspace.
                isNotifyPass = true;
            }

            _documentUriToNotify = undefined;
        }

        // Only warn for C# miscellaneous files when the workspace is fully initialized.
        if (
            e.languageId !== 'csharp' ||
            !e.context._vs_is_miscellaneous ||
            languageServer.state !== ServerState.ProjectInitializationComplete
        ) {
            return;
        }

        // Check settings and workspaceState to see if we should suppress the toast.
        if (
            languageServerOptions.suppressMiscellaneousFilesToasts ||
            context.workspaceState.get<boolean>(SuppressMiscellaneousFilesToastsOption, false)
        ) {
            return;
        }

        // Check to see if we have already notified the user about this document.
        const hash = createHash(e.uri.toString(/*skipEncoding:*/ true));
        if (NotifiedDocuments.has(hash)) {
            return;
        }

        if (!isNotifyPass) {
            // Request the active project context be refreshed but delay the request to give
            // time for the project system to update with new files.
            _notifyTimeout = setTimeout(() => {
                _notifyTimeout = undefined;
                _documentUriToNotify = e.uri;

                // Trigger a refresh, but don't block on refresh completing.
                languageServer._projectContextService.refresh().catch((e) => {
                    throw new Error(`Error refreshing project context status ${e}`);
                });
            }, NotificationDelay);

            return;
        }

        const message = vscode.l10n.t(
            'The active document is not part of the open workspace. Not all language features will be available.'
        );
        const dismissItem = vscode.l10n.t('Dismiss');
        // Provide the user a way to easily disable the toast without changing settings.
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
