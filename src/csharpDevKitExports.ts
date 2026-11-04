/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { IServiceBroker } from '@microsoft/servicehub-framework';

export interface WorkspaceDotnetStateService {
    readonly version: '1.0';
    getState(): WorkspaceDotnetState;
    readonly onDidChangeState: vscode.Event<WorkspaceDotnetState>;
}

export type WorkspaceDotnetState =
    | { kind: 'resolving'; revision: number }
    | {
          kind: 'ready';
          revision: number;
          host: {
              executablePath: string;
              architecture: 'x86' | 'x64' | 'arm' | 'arm64';
              environment: Readonly<Record<string, string | null>>;
          };
          sdk: { path: string; version: string };
      }
    | { kind: 'blocked'; revision: number }
    | { kind: 'notApplicable'; revision: number };

export interface CSharpDevKitExports {
    serviceBroker: IServiceBroker;
    getBrokeredServiceServerPipeName: () => Promise<string>;
    components: Readonly<{ [key: string]: string }>;
    hasServerProcessLoaded: () => boolean;
    serverProcessLoaded: vscode.Event<void>;
    setupTelemetryEnvironmentAsync: (env: NodeJS.ProcessEnv) => Promise<string | undefined>;
    workspaceDotnet?: WorkspaceDotnetStateService;
}
