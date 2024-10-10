/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { ActionOption, showWarningMessage } from '../shared/observers/utils/showMessage';
import { ServerState } from './serverStateChange';
import path = require('path');

const NotifyMiscellaneousFilesOption = 'dotnet.miscellaneousFilesNotification.enabled';
const RecentlyNotifiedDocuments = new Set<vscode.Uri>();
const CooldownTime = 60 * 1000;

export function registerMiscellaneousFileNotifier(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer
) {
    context.workspaceState.update(NotifyMiscellaneousFilesOption, undefined);
    context.globalState.update(NotifyMiscellaneousFilesOption, undefined);

    languageServer._projectContextService.onActiveFileContextChanged((e) => {
        if (RecentlyNotifiedDocuments.has(e.uri)) {
            return;
        }

        if (!e.context._vs_is_miscellaneous || languageServer.state !== ServerState.ProjectInitializationComplete) {
            return;
        }

        if (!context.globalState.get<boolean>(NotifyMiscellaneousFilesOption, true)) {
            return;
        }

        if (!context.workspaceState.get<boolean>(NotifyMiscellaneousFilesOption, true)) {
            return;
        }

        RecentlyNotifiedDocuments.add(e.uri);

        const message = vscode.l10n.t(
            '{0} is not part of the open workspace. Not all language features will be available.',
            path.basename(e.uri.fsPath)
        );
        const dismissItem = vscode.l10n.t('Dismiss');
        const disableWorkspace: ActionOption = {
            title: vscode.l10n.t('Do not show for this workspace'),
            action: async () => {
                context.workspaceState.update(NotifyMiscellaneousFilesOption, false);
            },
        };
        const disableGlobal: ActionOption = {
            title: vscode.l10n.t('Do not show again'),
            action: async () => {
                context.globalState.update(NotifyMiscellaneousFilesOption, false);
            },
        };
        showWarningMessage(vscode, message, disableWorkspace, disableGlobal, dismissItem);

        setTimeout(() => {
            RecentlyNotifiedDocuments.delete(e.uri);
        }, CooldownTime);
    });
}
