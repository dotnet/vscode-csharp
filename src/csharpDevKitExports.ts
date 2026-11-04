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

export interface WorkspaceDotnetHost {
    readonly executablePath: string;
    readonly architecture: 'x86' | 'x64' | 'arm' | 'arm64';
    readonly environment: WorkspaceDotnetEnvironment;
}

export interface WorkspaceDotnetSdk {
    readonly path: string;
    readonly version: string;
}

export type WorkspaceDotnetState =
    | { readonly kind: 'resolving'; readonly revision: number }
    | {
          readonly kind: 'ready';
          readonly revision: number;
          readonly host: WorkspaceDotnetHost;
          readonly sdk: WorkspaceDotnetSdk;
      }
    | { readonly kind: 'blocked'; readonly revision: number }
    | { readonly kind: 'notApplicable'; readonly revision: number };

export interface WorkspaceDotnetStateService {
    readonly version: '1.0';
    /** Returns the current immutable authoritative workspace .NET state. */
    getState(): WorkspaceDotnetState;
    /** Fires after the authoritative workspace .NET state changes. */
    readonly onDidChangeState: vscode.Event<WorkspaceDotnetState>;
}

export interface WorkspaceSdkInfo {
    readonly executablePath: string;
    readonly sdkPath: string;
    readonly sdkVersion: string;
    readonly architecture: string;
    readonly environment: WorkspaceDotnetEnvironment;
}

export interface WorkspaceDotnetService {
    readonly version: '0.1';
    /** Returns the ready workspace SDK, or undefined while selection is unresolved or blocked. */
    getSdkInfo(): WorkspaceSdkInfo | undefined;
    /** Fires when a selection becomes ready or refreshed SDK metadata is available for the same host. */
    readonly onDidChangeSdkInfo: vscode.Event<WorkspaceSdkInfo>;
}

export interface CSharpDevKitExports {
    serviceBroker: IServiceBroker;
    getBrokeredServiceServerPipeName: () => Promise<string>;
    components: Readonly<{ [key: string]: string }>;
    hasServerProcessLoaded: () => boolean;
    serverProcessLoaded: vscode.Event<void>;
    setupTelemetryEnvironmentAsync: (env: NodeJS.ProcessEnv) => Promise<string | undefined>;
    /** Legacy ready-only workspace SDK projection. */
    dotnet?: WorkspaceDotnetService;
    /** The authoritative observable workspace .NET state. */
    workspaceDotnet?: WorkspaceDotnetStateService;
}
