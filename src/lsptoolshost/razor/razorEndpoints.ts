/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import * as vscode from 'vscode';
import { LogMessageParams, NotificationType } from 'vscode-languageclient';
import { RazorLogger } from '../../razor/src/razorLogger';

export function registerRazorEndpoints(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    razorLogger: RazorLogger
) {
    const logNotificationType = new NotificationType<LogMessageParams>('razor/log');
    languageServer.registerOnNotificationWithParams(logNotificationType, (params) =>
        razorLogger.log(params.message, params.type)
    );
}
