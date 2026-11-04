/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpDevKitExports, WorkspaceDotnetState, WorkspaceDotnetStateService } from '../csharpDevKitExports';
import { getCSharpDevKit } from '../utils/getCSharpDevKit';

export interface WorkspaceDotnetHost {
    readonly executablePath: string;
    readonly architecture: 'x86' | 'x64' | 'arm' | 'arm64';
    readonly environment: Readonly<Record<string, string | null>>;
}

export type WorkspaceDotnetResolution =
    | {
          readonly kind: 'ready';
          readonly host: WorkspaceDotnetHost;
          readonly sdk: { readonly path: string; readonly version: string };
      }
    | { readonly kind: 'blocked' }
    | { readonly kind: 'fallback' };

export const workspaceDotnetTimeoutMilliseconds = 90_000;

export async function resolveWorkspaceDotnet(
    extension: Pick<vscode.Extension<CSharpDevKitExports>, 'activate'> | null | undefined = getCSharpDevKit(),
    timeoutMilliseconds = workspaceDotnetTimeoutMilliseconds
): Promise<WorkspaceDotnetResolution> {
    if (!extension) {
        return { kind: 'fallback' };
    }

    return new Promise<WorkspaceDotnetResolution>((resolve) => {
        let settled = false;
        let stateSubscription: vscode.Disposable | undefined;
        let latestRevision = -1;

        const settle = (result: WorkspaceDotnetResolution) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            stateSubscription?.dispose();
            resolve(result);
        };

        const handleState = (state: WorkspaceDotnetState) => {
            if (settled || state.revision < latestRevision) {
                return;
            }

            latestRevision = state.revision;
            switch (state.kind) {
                case 'resolving':
                    return;
                case 'ready':
                    settle({
                        kind: 'ready',
                        host: {
                            executablePath: state.host.executablePath,
                            architecture: state.host.architecture,
                            environment: state.host.environment,
                        },
                        sdk: state.sdk,
                    });
                    return;
                case 'blocked':
                    settle({ kind: 'blocked' });
                    return;
                case 'notApplicable':
                    settle({ kind: 'fallback' });
                    return;
            }
        };

        const timeout = setTimeout(() => settle({ kind: 'fallback' }), timeoutMilliseconds);
        void extension.activate().then(
            (exports) => {
                if (settled) {
                    return;
                }

                const service = exports?.workspaceDotnet;
                if (!isWorkspaceDotnetV1(service)) {
                    settle({ kind: 'fallback' });
                    return;
                }

                try {
                    const subscription = service.onDidChangeState(handleState);
                    stateSubscription = subscription;
                    if (settled) {
                        subscription.dispose();
                        return;
                    }

                    handleState(service.getState());
                } catch {
                    settle({ kind: 'fallback' });
                }
            },
            () => settle({ kind: 'fallback' })
        );
    });
}

function isWorkspaceDotnetV1(service: WorkspaceDotnetStateService | undefined): service is WorkspaceDotnetStateService {
    return service?.version === '1.0';
}
