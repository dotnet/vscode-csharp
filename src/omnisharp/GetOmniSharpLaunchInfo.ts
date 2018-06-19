/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import * as path from 'path';
import { OmniSharpLaunchInfo } from "./OmniSharpLaunchInfo";

export function getOmniSharpLaunchInfo(platformInfo: PlatformInformation, basePath: string): OmniSharpLaunchInfo {
    if (platformInfo.isWindows()) {
        return {
            LaunchPath: path.join(basePath, 'OmniSharp.exe')
        };
    }

    return {
        LaunchPath: path.join(basePath, 'run'),
        MonoLaunchPath: path.join(basePath, 'omnisharp', 'OmniSharp.exe')
    };
}