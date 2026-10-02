/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    CSharpDevKitExports,
    WorkspaceDotnetStateServiceV1,
    WorkspaceDotnetStateV1,
    WorkspaceDotnetHostV1,
    WorkspaceDotnetSdkV1,
} from '../../csharpDevKitExports';
import * as vscode from 'vscode';
import * as semver from 'semver';
import { isDeepStrictEqual } from 'util';

export const workspaceDotnetResolutionTimeoutMs = 90_000;

export interface ResolvedWorkspaceDotnet {
    architecture: string;
    environment: Readonly<Record<string, string | null>>;
    sdk: WorkspaceDotnetSdkV1;
}

export class WorkspaceDotnetResolutionError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'WorkspaceDotnetResolutionError';
    }
}

export async function activateAndResolveWorkspaceDotnet(
    devKitExportsPromise: PromiseLike<CSharpDevKitExports | undefined>,
    timeoutMs = workspaceDotnetResolutionTimeoutMs
): Promise<ResolvedWorkspaceDotnet | undefined> {
    let devKitExports: CSharpDevKitExports;
    try {
        const exports = await devKitExportsPromise;
        if (!exports) {
            return undefined;
        }
        devKitExports = exports;
    } catch (error) {
        throw new WorkspaceDotnetResolutionError('Failed to activate C# Dev Kit workspace .NET provider.', {
            cause: error,
        });
    }

    return await resolveWorkspaceDotnet(devKitExports?.workspaceDotnet, timeoutMs);
}

export async function resolveWorkspaceDotnet(
    service: WorkspaceDotnetStateServiceV1 | undefined,
    timeoutMs = workspaceDotnetResolutionTimeoutMs
): Promise<ResolvedWorkspaceDotnet | undefined> {
    if (!service || service.version !== '1.0') {
        return undefined;
    }

    try {
        return await resolveSupportedWorkspaceDotnet(service, timeoutMs);
    } catch (error) {
        if (error instanceof WorkspaceDotnetResolutionError) {
            throw error;
        }

        throw new WorkspaceDotnetResolutionError('C# Dev Kit workspace .NET provider failed.', { cause: error });
    }
}

async function resolveSupportedWorkspaceDotnet(
    service: WorkspaceDotnetStateServiceV1,
    timeoutMs: number
): Promise<ResolvedWorkspaceDotnet | undefined> {
    if (typeof service.getState !== 'function' || typeof service.onDidChangeState !== 'function') {
        throw new WorkspaceDotnetResolutionError(
            'C# Dev Kit workspace .NET service version 1.0 has an invalid contract.'
        );
    }

    const pendingStates: WorkspaceDotnetStateV1[] = [];
    const observedStates = new Map<number, WorkspaceDotnetStateV1>();
    let notifyStateChanged: (() => void) | undefined;
    let listener: vscode.Disposable | undefined;
    const deadline = Date.now() + timeoutMs;
    try {
        // Subscribe before reading so a transition between registration and getState cannot be missed.
        // Revisions reconcile any event queued during that read; equal revisions must describe the same snapshot.
        listener = service.onDidChangeState((state) => {
            pendingStates.push(state);
            notifyStateChanged?.();
        });
        if (!listener || typeof listener.dispose !== 'function') {
            throw new WorkspaceDotnetResolutionError(
                'C# Dev Kit workspace .NET service version 1.0 has an invalid event contract.'
            );
        }

        let state = validateState(service.getState());
        state = applyPendingStates(state, pendingStates, observedStates);

        while (state.kind === 'resolving') {
            const remainingTime = deadline - Date.now();
            if (remainingTime <= 0) {
                throw new WorkspaceDotnetResolutionError(
                    'Timed out waiting for C# Dev Kit to resolve the workspace .NET SDK.'
                );
            }

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(
                    () =>
                        reject(
                            new WorkspaceDotnetResolutionError(
                                'Timed out waiting for C# Dev Kit to resolve the workspace .NET SDK.'
                            )
                        ),
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

            state = applyPendingStates(state, pendingStates, observedStates);
        }

        if (state.kind === 'notApplicable') {
            return undefined;
        }

        if (state.kind === 'blocked') {
            throw new WorkspaceDotnetResolutionError('C# Dev Kit blocked workspace .NET SDK resolution.');
        }

        return {
            architecture: state.host.architecture,
            environment: state.host.environment,
            sdk: state.sdk,
        };
    } finally {
        notifyStateChanged = undefined;
        listener?.dispose();
    }
}

function applyPendingStates(
    currentState: WorkspaceDotnetStateV1,
    pendingStates: WorkspaceDotnetStateV1[],
    observedStates: Map<number, WorkspaceDotnetStateV1>
): WorkspaceDotnetStateV1 {
    recordObservedState(currentState, observedStates);
    let latestState = currentState;
    for (const pendingState of pendingStates.splice(0)) {
        const validatedState = validateState(pendingState);
        recordObservedState(validatedState, observedStates);
        if (validatedState.revision < latestState.revision) {
            continue;
        }

        if (validatedState.revision > latestState.revision) {
            latestState = validatedState;
        }
    }

    return latestState;
}

function recordObservedState(state: WorkspaceDotnetStateV1, observedStates: Map<number, WorkspaceDotnetStateV1>): void {
    const observedState = observedStates.get(state.revision);
    if (observedState && !isDeepStrictEqual(observedState, state)) {
        throw new WorkspaceDotnetResolutionError(
            'C# Dev Kit workspace .NET service version 1.0 returned conflicting states for the same revision.'
        );
    }

    observedStates.set(state.revision, state);
}

function validateState(state: WorkspaceDotnetStateV1): WorkspaceDotnetStateV1 {
    if (
        !state ||
        !Number.isSafeInteger(state.revision) ||
        state.revision < 0 ||
        !['resolving', 'ready', 'blocked', 'notApplicable'].includes(state.kind)
    ) {
        throw new WorkspaceDotnetResolutionError(
            'C# Dev Kit workspace .NET service version 1.0 returned an invalid state.'
        );
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
        !semver.valid(sdk.version)
    ) {
        throw new WorkspaceDotnetResolutionError(
            'C# Dev Kit workspace .NET service version 1.0 returned invalid ready metadata.'
        );
    }

    for (const value of Object.values(host.environment)) {
        if (value !== null && typeof value !== 'string') {
            throw new WorkspaceDotnetResolutionError(
                'C# Dev Kit workspace .NET service version 1.0 returned an invalid environment overlay.'
            );
        }
    }
}
