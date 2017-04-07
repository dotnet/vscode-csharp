/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { PlatformInformation, ILinuxRuntimeIdFallback } from './platform';

/*
 * extension to the PlatformInformation that calls VS Code APIs in order to obtain the runtime id
 * for distributions that the extension doesn't understand
 */
export class VSCodePlatformInformation
{
    public static GetCurrent(): Promise<PlatformInformation> {

        class VSCodeLinuxRuntimeIdFallback implements ILinuxRuntimeIdFallback {
            getFallbackLinuxRuntimeId(): string {
                return VSCodePlatformInformation.fallbackDebuggerLinuxRuntimeId();
            }
        };

        return PlatformInformation.GetCurrent(new VSCodeLinuxRuntimeIdFallback());
    }

    public static isFallbackDebuggerLinuxRuntimeIdSet() : boolean {
        if (VSCodePlatformInformation.fallbackDebuggerLinuxRuntimeId()) {
            return true;
        }

        return false;
    }

    private static fallbackDebuggerLinuxRuntimeId() : string {
        const config = vscode.workspace.getConfiguration('csharp');
        return config.get('fallbackDebuggerLinuxRuntimeId', '');
    }
};

