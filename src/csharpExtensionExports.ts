/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Advisor } from './omnisharp/features/diagnosticsProvider';
import { EventStream } from './eventStream';
import TestManager from './omnisharp/features/dotnetTest';
import { GlobalBrokeredServiceContainer } from '@microsoft/servicehub-framework';
import { LanguageServerEvents } from './lsptoolshost/server/languageServerEvents';
import { PartialResultParams, ProtocolRequestType, RequestParam, RequestType } from 'vscode-languageclient';

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
    getActivityLogs(): ActivityLogResult;
}

export interface ActivityLogResult {
    csharpLog: string;
    lspTraceLog: string;
}

/** Roslyn's language-support classification for the active C# document. */
export interface ActiveDocumentLanguageSupport {
    /** Serialized URI of the document to which this snapshot applies. */
    documentUri: string;
    /**
     * `unknown` while the project context is still stabilizing, `full` once Roslyn verifies that
     * full language support is available, or `limited` once Roslyn verifies that it is not.
     */
    state: 'unknown' | 'full' | 'limited';
    /** Labels of the Roslyn project contexts represented by this snapshot. */
    projectLabels: readonly string[];
}

/** Publishes snapshots for the active C# document as Roslyn project information changes. */
export interface ActiveDocumentLanguageSupportService {
    /** Most recently published snapshot, or `undefined` when no relevant document is active. */
    readonly current: ActiveDocumentLanguageSupport | undefined;
    /** Fires when the active document or its Roslyn language-support classification changes. */
    readonly onDidChange: vscode.Event<ActiveDocumentLanguageSupport | undefined>;
}

export interface CSharpExtensionExports {
    isLimitedActivation: false;
    initializationFinished: () => Promise<void>;
    logDirectory: string;
    profferBrokeredServices: (container: GlobalBrokeredServiceContainer) => void;
    determineBrowserType: () => Promise<string | undefined>;
    experimental: CSharpExtensionExperimentalExports;
    getComponentFolder: (componentName: string) => string;
    tryToUseVSDbgForMono: (urlStr: string, projectPath: string) => Promise<[string, number, number]>;
    languageServerProcessId: () => number | undefined;
    captureActivityLogs: () => Promise<ActivityLogCapture>;
}

export interface CSharpExtensionExperimentalExports {
    sendServerRequest: <Params, Response, Error>(
        type: RequestType<Params, Response, Error>,
        params: RequestParam<Params>,
        token: vscode.CancellationToken
    ) => Promise<Response>;
    sendServerRequestWithProgress<
        Params extends PartialResultParams,
        Response,
        PartialResult,
        Error,
        RegistrationOptions,
    >(
        type: ProtocolRequestType<Params, Response, PartialResult, Error, RegistrationOptions>,
        params: RequestParam<Params>,
        onProgress: (p: PartialResult) => Promise<any>,
        token?: vscode.CancellationToken
    ): Promise<Response>;
    languageServerEvents: LanguageServerEvents;
    activeDocumentLanguageSupport: ActiveDocumentLanguageSupportService;
}
