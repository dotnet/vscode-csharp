/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Advisor } from './omnisharp/features/diagnosticsProvider';
import { EventStream } from './eventStream';
import TestManager from './omnisharp/features/dotnetTest';
import { GlobalBrokeredServiceContainer } from '@microsoft/servicehub-framework';
import { PartialResultParams, ProtocolRequestType, RequestType } from 'vscode-languageclient/node';
import { LanguageServerEvents } from './lsptoolshost/server/languageServerEvents';

export interface LimitedExtensionExports {
    isLimitedActivation: true;
}

export interface OmnisharpExtensionExports {
    isLimitedActivation: false;
    initializationFinished: () => Promise<void>;
    getAdvisor: () => Promise<Advisor>;
    getTestManager: () => Promise<TestManager>;
    eventStream: EventStream;
    logDirectory: string;
}

export interface ActivityLogCapture extends vscode.Disposable {
    getActivityLogs(): { csharpLog: string; lspTraceLog: string; razorLog: string };
}

export interface CSharpExtensionExports {
    isLimitedActivation: false;
    initializationFinished: () => Promise<void>;
    logDirectory: string;
    profferBrokeredServices: (container: GlobalBrokeredServiceContainer) => void;
    determineBrowserType: () => Promise<string | undefined>;
    experimental: CSharpExtensionExperimentalExports;
    getComponentFolder: (componentName: string) => string;
    languageServerProcessId: () => number | undefined;
    captureActivityLogs: () => Promise<ActivityLogCapture>;
}

export interface CSharpExtensionExperimentalExports {
    sendServerRequest: <Params, Response, Error>(
        type: RequestType<Params, Response, Error>,
        params: Params,
        token: vscode.CancellationToken
    ) => Promise<Response>;
    sendServerRequestWithProgress<
        Params extends PartialResultParams,
        Response,
        PartialResult,
        Error,
        RegistrationOptions
    >(
        type: ProtocolRequestType<Params, Response, PartialResult, Error, RegistrationOptions>,
        params: Params,
        onProgress: (p: PartialResult) => Promise<any>,
        token?: vscode.CancellationToken
    ): Promise<Response>;
    languageServerEvents: LanguageServerEvents;
}
