/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    WorkspaceDotnetStateServiceV1,
    WorkspaceDotnetStateV1,
    WorkspaceDotnetHostV1,
    WorkspaceDotnetSdkV1,
} from '../../csharpDevKitExports';
import { HostExecutableInformation } from '../../shared/constants/hostExecutableInformation';
import { DotnetInfo } from '../../shared/utils/dotnetInfo';

export const workspaceDotnetResolutionTimeoutMs = 90_000;

export interface ResolvedWorkspaceDotnet {
    host: HostExecutableInformation;
    dotnetInfo: DotnetInfo;
    sdk: WorkspaceDotnetSdkV1;
}

export async function resolveWorkspaceDotnet(
    service: WorkspaceDotnetStateServiceV1 | undefined,
    timeoutMs = workspaceDotnetResolutionTimeoutMs
): Promise<ResolvedWorkspaceDotnet | undefined> {
    if (!service || service.version !== '1.0') {
        return undefined;
    }

    if (typeof service.getState !== 'function' || typeof service.onDidChangeState !== 'function') {
        throw new Error('C# Dev Kit workspace .NET service version 1.0 has an invalid contract.');
    }

    const pendingStates: WorkspaceDotnetStateV1[] = [];
    let notifyStateChanged: (() => void) | undefined;
    const listener = service.onDidChangeState((state) => {
        pendingStates.push(state);
        notifyStateChanged?.();
    });
    if (!listener || typeof listener.dispose !== 'function') {
        throw new Error('C# Dev Kit workspace .NET service version 1.0 has an invalid event contract.');
    }

    const deadline = Date.now() + timeoutMs;
    try {
        let state = validateState(service.getState());
        state = applyPendingStates(state, pendingStates);

        while (state.kind === 'resolving') {
            const remainingTime = deadline - Date.now();
            if (remainingTime <= 0) {
                throw new Error('Timed out waiting for C# Dev Kit to resolve the workspace .NET SDK.');
            }

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(
                    () => reject(new Error('Timed out waiting for C# Dev Kit to resolve the workspace .NET SDK.')),
                    remainingTime
                );
                notifyStateChanged = () => {
                    clearTimeout(timeout);
                    notifyStateChanged = undefined;
                    resolve();
                };

                if (pendingStates.length > 0) {
                    notifyStateChanged();
                }
            });

            state = applyPendingStates(state, pendingStates);
        }

        if (state.kind === 'notApplicable') {
            return undefined;
        }

        if (state.kind === 'blocked') {
            throw new Error('C# Dev Kit blocked workspace .NET SDK resolution.');
        }

        return {
            host: {
                path: state.host.executablePath,
                version: state.sdk.version,
                env: applyEnvironmentOverlay(state.host.environment),
            },
            dotnetInfo: {
                CliPath: state.host.executablePath,
                FullInfo: '',
                Version: state.sdk.version,
                Architecture: state.host.architecture,
                Runtimes: {},
            },
            sdk: state.sdk,
        };
    } finally {
        notifyStateChanged = undefined;
        listener.dispose();
    }
}

function applyPendingStates(
    currentState: WorkspaceDotnetStateV1,
    pendingStates: WorkspaceDotnetStateV1[]
): WorkspaceDotnetStateV1 {
    let latestState = currentState;
    for (const pendingState of pendingStates.splice(0)) {
        const validatedState = validateState(pendingState);
        if (validatedState.revision >= latestState.revision) {
            latestState = validatedState;
        }
    }

    return latestState;
}

function validateState(state: WorkspaceDotnetStateV1): WorkspaceDotnetStateV1 {
    if (
        !state ||
        !Number.isSafeInteger(state.revision) ||
        state.revision < 0 ||
        !['resolving', 'ready', 'blocked', 'notApplicable'].includes(state.kind)
    ) {
        throw new Error('C# Dev Kit workspace .NET service version 1.0 returned an invalid state.');
    }

    if (state.kind === 'ready') {
        validateReadyState(state.host, state.sdk);
    }

    return state;
}

function validateReadyState(host: WorkspaceDotnetHostV1, sdk: WorkspaceDotnetSdkV1): void {
    if (
        !host ||
        typeof host.executablePath !== 'string' ||
        host.executablePath.length === 0 ||
        typeof host.architecture !== 'string' ||
        host.architecture.length === 0 ||
        !host.environment ||
        typeof host.environment !== 'object' ||
        !sdk ||
        typeof sdk.path !== 'string' ||
        sdk.path.length === 0 ||
        typeof sdk.version !== 'string' ||
        sdk.version.length === 0
    ) {
        throw new Error('C# Dev Kit workspace .NET service version 1.0 returned invalid ready metadata.');
    }

    for (const value of Object.values(host.environment)) {
        if (value !== null && typeof value !== 'string') {
            throw new Error('C# Dev Kit workspace .NET service version 1.0 returned an invalid environment overlay.');
        }
    }
}

function applyEnvironmentOverlay(overlay: Readonly<Record<string, string | null>>): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = { ...process.env };
    for (const [name, value] of Object.entries(overlay)) {
        if (value === null) {
            delete environment[name];
        } else {
            environment[name] = value;
        }
    }

    return environment;
}
