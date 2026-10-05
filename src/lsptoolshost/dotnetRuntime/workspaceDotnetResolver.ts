/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    CSharpDevKitExports,
    WorkspaceDotnetHostV1,
    WorkspaceDotnetSdkV1,
    WorkspaceDotnetStateServiceV1,
    WorkspaceDotnetStateV1,
} from '../../csharpDevKitExports';
import * as semver from 'semver';
import * as vscode from 'vscode';

export interface ResolvedWorkspaceDotnet {
    architecture: string;
    environment: Readonly<Record<string, string | null>>;
    sdk: WorkspaceDotnetSdkV1;
}

export const WorkspaceDotnetFailureReason = {
    Activation: 'activation',
    Provider: 'provider',
    InvalidContract: 'invalidContract',
    Resolving: 'resolving',
    Blocked: 'blocked',
    InvalidState: 'invalidState',
    InvalidMetadata: 'invalidMetadata',
    InvalidEnvironment: 'invalidEnvironment',
} as const;

export type WorkspaceDotnetFailureReason =
    (typeof WorkspaceDotnetFailureReason)[keyof typeof WorkspaceDotnetFailureReason];

export class WorkspaceDotnetResolutionError extends Error {
    constructor(
        message: string,
        public readonly reason: WorkspaceDotnetFailureReason,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = 'WorkspaceDotnetResolutionError';
    }
}

export async function activateAndResolveWorkspaceDotnet(
    devKitExportsPromise: PromiseLike<CSharpDevKitExports | undefined>
): Promise<ResolvedWorkspaceDotnet | undefined> {
    let devKitExports: CSharpDevKitExports;
    try {
        const exports = await devKitExportsPromise;
        if (!exports) {
            return undefined;
        }
        devKitExports = exports;
    } catch (error) {
        throw new WorkspaceDotnetResolutionError(
            'Failed to activate the C# Dev Kit workspace .NET provider.',
            WorkspaceDotnetFailureReason.Activation,
            { cause: error }
        );
    }

    return resolveWorkspaceDotnet(devKitExports.workspaceDotnet);
}

export function resolveWorkspaceDotnet(
    service: WorkspaceDotnetStateServiceV1 | undefined
): ResolvedWorkspaceDotnet | undefined {
    if (!service || service.version !== '1.0') {
        return undefined;
    }

    try {
        return resolveSupportedWorkspaceDotnet(service);
    } catch (error) {
        if (error instanceof WorkspaceDotnetResolutionError) {
            throw error;
        }

        throw new WorkspaceDotnetResolutionError(
            'The C# Dev Kit workspace .NET provider failed.',
            WorkspaceDotnetFailureReason.Provider,
            { cause: error }
        );
    }
}

function resolveSupportedWorkspaceDotnet(service: WorkspaceDotnetStateServiceV1): ResolvedWorkspaceDotnet | undefined {
    if (typeof service.getState !== 'function') {
        throw new WorkspaceDotnetResolutionError(
            'The C# Dev Kit workspace .NET service version 1.0 has an invalid contract.',
            WorkspaceDotnetFailureReason.InvalidContract
        );
    }

    const state = validateState(service.getState());
    if (state.kind === 'notApplicable') {
        return undefined;
    }

    if (state.kind === 'resolving') {
        throw new WorkspaceDotnetResolutionError(
            vscode.l10n.t('C# Dev Kit is still resolving the workspace .NET SDK.'),
            WorkspaceDotnetFailureReason.Resolving
        );
    }

    if (state.kind === 'blocked') {
        throw new WorkspaceDotnetResolutionError(
            vscode.l10n.t('C# Dev Kit blocked workspace .NET SDK resolution.'),
            WorkspaceDotnetFailureReason.Blocked
        );
    }

    return {
        architecture: state.host.architecture,
        environment: state.host.environment,
        sdk: state.sdk,
    };
}

function validateState(state: WorkspaceDotnetStateV1): WorkspaceDotnetStateV1 {
    if (
        !state ||
        !Number.isSafeInteger(state.revision) ||
        state.revision < 0 ||
        !['resolving', 'ready', 'blocked', 'notApplicable'].includes(state.kind)
    ) {
        throw new WorkspaceDotnetResolutionError(
            'The C# Dev Kit workspace .NET service version 1.0 returned an invalid state.',
            WorkspaceDotnetFailureReason.InvalidState
        );
    }

    if (state.kind === 'ready') {
        validateReadyState(state.host, state.sdk);
    }

    return state;
}

function validateReadyState(host: WorkspaceDotnetHostV1, sdk: WorkspaceDotnetSdkV1): void {
    const hasValidHost =
        isNonEmptyString(host?.executablePath) &&
        isNonEmptyString(host?.architecture) &&
        host.environment !== null &&
        typeof host.environment === 'object';
    const hasValidSdk = isNonEmptyString(sdk?.path) && isNonEmptyString(sdk?.version) && semver.valid(sdk.version);
    if (!hasValidHost || !hasValidSdk) {
        throw new WorkspaceDotnetResolutionError(
            'The C# Dev Kit workspace .NET service version 1.0 returned invalid ready metadata.',
            WorkspaceDotnetFailureReason.InvalidMetadata
        );
    }

    for (const value of Object.values(host.environment)) {
        if (value !== null && typeof value !== 'string') {
            throw new WorkspaceDotnetResolutionError(
                'The C# Dev Kit workspace .NET service version 1.0 returned an invalid environment overlay.',
                WorkspaceDotnetFailureReason.InvalidEnvironment
            );
        }
    }
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}
