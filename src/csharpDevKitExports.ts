/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { IServiceBroker } from '@microsoft/servicehub-framework';

export type WorkspaceDotnetHost =
    | {
          status: 'ready';
          dotnetPath: string;
          environment?: Readonly<Record<string, string | null>>;
      }
    | { status: 'blocked' }
    | { status: 'not-applicable' };

export interface CSharpDevKitExports {
    serviceBroker: IServiceBroker;
    getBrokeredServiceServerPipeName: () => Promise<string>;
    components: Readonly<{ [key: string]: string }>;
    hasServerProcessLoaded: () => boolean;
    serverProcessLoaded: vscode.Event<void>;
    setupTelemetryEnvironmentAsync: (env: NodeJS.ProcessEnv) => Promise<string | undefined>;
    /** Gets the immutable dotnet host selected for this workspace by C# Dev Kit. */
    getWorkspaceDotnetHost?: () => Promise<WorkspaceDotnetHost>;
}
