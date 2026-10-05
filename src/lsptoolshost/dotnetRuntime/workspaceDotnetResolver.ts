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

export class WorkspaceDotnetResolutionError extends Error {
    constructor(message: string, options?: ErrorOptions) {
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
            vscode.l10n.t('Failed to activate the C# Dev Kit workspace .NET provider.'),
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

        throw new WorkspaceDotnetResolutionError(vscode.l10n.t('The C# Dev Kit workspace .NET provider failed.'), {
            cause: error,
        });
    }
}

function resolveSupportedWorkspaceDotnet(service: WorkspaceDotnetStateServiceV1): ResolvedWorkspaceDotnet | undefined {
    if (typeof service.getState !== 'function') {
        throw new WorkspaceDotnetResolutionError(
            vscode.l10n.t('The C# Dev Kit workspace .NET service version 1.0 has an invalid contract.')
        );
    }

    const state = validateState(service.getState());
    if (state.kind === 'notApplicable') {
        return undefined;
    }

    if (state.kind === 'resolving') {
        throw new WorkspaceDotnetResolutionError(
            vscode.l10n.t('C# Dev Kit is still resolving the workspace .NET SDK.')
        );
    }

    if (state.kind === 'blocked') {
        throw new WorkspaceDotnetResolutionError(vscode.l10n.t('C# Dev Kit blocked workspace .NET SDK resolution.'));
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
            vscode.l10n.t('The C# Dev Kit workspace .NET service version 1.0 returned an invalid state.')
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
            vscode.l10n.t('The C# Dev Kit workspace .NET service version 1.0 returned invalid ready metadata.')
        );
    }

    for (const value of Object.values(host.environment)) {
        if (value !== null && typeof value !== 'string') {
            throw new WorkspaceDotnetResolutionError(
                vscode.l10n.t(
                    'The C# Dev Kit workspace .NET service version 1.0 returned an invalid environment overlay.'
                )
            );
        }
    }
}
