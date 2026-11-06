/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { IServiceBroker } from '@microsoft/servicehub-framework';

export interface WorkspaceDotnetHostV1 {
    executablePath: string;
    architecture: string;
    environment: Readonly<Record<string, string | null>>;
}

export interface WorkspaceDotnetSdkV1 {
    path: string;
    version: string;
}

export type WorkspaceDotnetStateV1 =
    | { kind: 'resolving'; revision: number }
    | {
          kind: 'ready';
          revision: number;
          host: WorkspaceDotnetHostV1;
          sdk: WorkspaceDotnetSdkV1;
      }
    | { kind: 'blocked'; revision: number }
    | { kind: 'notApplicable'; revision: number };

export interface WorkspaceDotnetStateServiceV1 {
    version: '1.0';
    getState(): WorkspaceDotnetStateV1;
    onDidChangeState: vscode.Event<WorkspaceDotnetStateV1>;
}

export interface CSharpDevKitExports {
    serviceBroker: IServiceBroker;
    getBrokeredServiceServerPipeName: () => Promise<string>;
    components: Readonly<{ [key: string]: string }>;
    hasServerProcessLoaded: () => boolean;
    serverProcessLoaded: vscode.Event<void>;
    setupTelemetryEnvironmentAsync: (env: NodeJS.ProcessEnv) => Promise<string | undefined>;
    workspaceDotnet?: WorkspaceDotnetStateServiceV1;
}
