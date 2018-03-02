/*---------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

import { MessageObserver, MessageType } from './omnisharp/messageType';
import { PackageError, Status } from './packages';

import { Logger } from './logger';
import { PlatformInformation } from './platform';
import TelemetryReporter from 'vscode-extension-telemetry';

export function GetNetworkConfiguration() {
    const config = vscode.workspace.getConfiguration();
    const proxy = config.get<string>('http.proxy');
    const strictSSL = config.get('http.proxyStrictSSL', true);
    return { Proxy: proxy, StrictSSL: strictSSL };
}

export function GetStatus(): Status {
    let statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    let status: Status = {
        setMessage: text => {
            statusItem.text = text;
            statusItem.show();
        },
        setDetail: text => {
            statusItem.tooltip = text;
            statusItem.show();
        },
        dispose: () => {
            statusItem.dispose();
        }
    };

    return status;
}