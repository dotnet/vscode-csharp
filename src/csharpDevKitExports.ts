/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { IServiceBroker } from '@microsoft/servicehub-framework';

/**
 * Environment overrides required by a selected workspace host. A string sets or replaces a variable; null removes
 * an inherited variable from child processes.
 */
export type WorkspaceDotnetEnvironment = Readonly<Record<string, string | null>>;

export type WorkspaceDotnetHost =
    | {
          readonly status: 'ready';
          readonly dotnetPath: string;
          readonly environment: WorkspaceDotnetEnvironment;
      }
    | { readonly status: 'blocked' }
    | { readonly status: 'not-applicable' };

export interface WorkspaceSdkInfo {
    readonly executablePath: string;
    readonly sdkPath: string;
    readonly sdkVersion: string;
    readonly architecture: string;
    readonly environment: WorkspaceDotnetEnvironment;
}

export interface WorkspaceDotnetService {
    /**
     * Contract version 0.1. Consumers must feature-detect optional members so producers can add compatible 0.1
     * capabilities without breaking older extensions.
     */
    readonly version: '0.1';
    /** Returns the ready workspace SDK, or undefined while selection is unresolved or blocked. */
    getSdkInfo(): WorkspaceSdkInfo | undefined;
    /** Fires when a selection becomes ready or refreshed SDK metadata is available for the same host. */
    readonly onDidChangeSdkInfo: vscode.Event<WorkspaceSdkInfo>;
    /**
     * Resolves the settled workspace host state when supported by the service producer. A ready result identifies
     * the exact executable and environment that consumers must use together.
     */
    getWorkspaceDotnetHost?(): Promise<WorkspaceDotnetHost>;
}

export interface CSharpDevKitExports {
    serviceBroker: IServiceBroker;
    getBrokeredServiceServerPipeName: () => Promise<string>;
    components: Readonly<{ [key: string]: string }>;
    hasServerProcessLoaded: () => boolean;
    serverProcessLoaded: vscode.Event<void>;
    setupTelemetryEnvironmentAsync: (env: NodeJS.ProcessEnv) => Promise<string | undefined>;
    /** The authoritative .NET SDK selected for this workspace. */
    dotnet?: WorkspaceDotnetService;
}
