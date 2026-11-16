/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { IServiceBroker } from '@microsoft/servicehub-framework';

export interface WorkspaceDotnetHost {
    executablePath: string;
    architecture: string;
    environment: Readonly<Record<string, string | null>>;
}

export interface WorkspaceDotnetSdk {
    path: string;
    version: string;
}

export type WorkspaceDotnetState =
    | { kind: 'resolving'; revision: number }
    | {
          kind: 'ready';
          revision: number;
          host: WorkspaceDotnetHost;
          sdk: WorkspaceDotnetSdk;
      }
    | { kind: 'blocked'; revision: number }
    | { kind: 'notApplicable'; revision: number };

export interface WorkspaceDotnetStateService {
    version: '1.0';
    getState(): WorkspaceDotnetState;
    onDidChangeState: vscode.Event<WorkspaceDotnetState>;
}

export interface CSharpDevKitExports {
    serviceBroker: IServiceBroker;
    getBrokeredServiceServerPipeName: () => Promise<string>;
    components: Readonly<{ [key: string]: string }>;
    hasServerProcessLoaded: () => boolean;
    serverProcessLoaded: vscode.Event<void>;
    setupTelemetryEnvironmentAsync: (env: NodeJS.ProcessEnv) => Promise<string | undefined>;
    workspaceDotnet?: WorkspaceDotnetStateService;
}
