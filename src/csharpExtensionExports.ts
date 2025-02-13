/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Advisor } from './omnisharp/features/diagnosticsProvider';
import { EventStream } from './eventStream';
import TestManager from './omnisharp/features/dotnetTest';
import { GlobalBrokeredServiceContainer } from '@microsoft/servicehub-framework';
import { RequestType } from 'vscode-languageclient/node';
import { LanguageServerEvents } from './lsptoolshost/server/languageServerEvents';

export interface OmnisharpExtensionExports {
    initializationFinished: () => Promise<void>;
    getAdvisor: () => Promise<Advisor>;
    getTestManager: () => Promise<TestManager>;
    eventStream: EventStream;
    logDirectory: string;
}

export interface CSharpExtensionExports {
    initializationFinished: () => Promise<void>;
    logDirectory: string;
    profferBrokeredServices: (container: GlobalBrokeredServiceContainer) => void;
    determineBrowserType: () => Promise<string | undefined>;
    experimental: CSharpExtensionExperimentalExports;
    getComponentFolder: (componentName: string) => string;
}

export interface CSharpExtensionExperimentalExports {
    sendServerRequest: <Params, Response, Error>(
        type: RequestType<Params, Response, Error>,
        params: Params,
        token: vscode.CancellationToken
    ) => Promise<Response>;
    languageServerEvents: LanguageServerEvents;
}
