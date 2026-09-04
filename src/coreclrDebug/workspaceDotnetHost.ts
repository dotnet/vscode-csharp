/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CSharpDevKitExports, WorkspaceDotnetHost } from '../csharpDevKitExports';

export type WorkspaceDotnetHostResolution =
    | { kind: 'standalone' }
    | { kind: 'blocked' }
    | {
          kind: 'ready';
          dotnetPath: string;
          environment?: Readonly<Record<string, string | null>>;
      };

const DEV_KIT_ACTIVATION_TIMEOUT_MS = 90_000;
const timedOut = Symbol('timedOut');

/**
 * Waits for the already-started C# Dev Kit activation without participating in extension activation.
 * Older Dev Kit versions and failed or bounded-out activation preserve standalone C# behavior.
 */
export async function resolveWorkspaceDotnetHost(
    devKitExports: Promise<CSharpDevKitExports | undefined> | undefined,
    timeoutMs = DEV_KIT_ACTIVATION_TIMEOUT_MS
): Promise<WorkspaceDotnetHostResolution> {
    if (!devKitExports) {
        return { kind: 'standalone' };
    }

    const exports = await settleWithin(devKitExports, timeoutMs);
    if (exports === timedOut) {
        // Dev Kit is installed and still activating. Do not race its Workspace Requirements remediation.
        return { kind: 'blocked' };
    }
    if (!exports || typeof exports.getWorkspaceDotnetHost !== 'function') {
        return { kind: 'standalone' };
    }

    const host = await settleWithin(exports.getWorkspaceDotnetHost(), timeoutMs);
    if (host === timedOut) {
        return { kind: 'blocked' };
    }
    return mapWorkspaceDotnetHost(host);
}

function mapWorkspaceDotnetHost(host: WorkspaceDotnetHost | undefined): WorkspaceDotnetHostResolution {
    if (!host || host.status === 'not-applicable') {
        return { kind: 'standalone' };
    }
    if (host.status === 'blocked') {
        return { kind: 'blocked' };
    }
    if (!host.dotnetPath) {
        return { kind: 'standalone' };
    }
    return {
        kind: 'ready',
        dotnetPath: host.dotnetPath,
        environment: host.environment,
    };
}

async function settleWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined | typeof timedOut> {
    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            promise.catch(() => undefined),
            new Promise<typeof timedOut>((resolve) => {
                timer = setTimeout(() => resolve(timedOut), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}
