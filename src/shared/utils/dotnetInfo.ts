/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as semver from 'semver';

type RuntimeVersionMap = { [runtime: string]: RuntimeInfo[] };
export interface DotnetInfo {
    CliPath?: string;
    FullInfo: string;
    Version: string;
    /* a runtime-only install of dotnet will not output a runtimeId in dotnet --info. */
    RuntimeId?: string;
    Architecture?: string;
    Runtimes: RuntimeVersionMap;
}

export interface RuntimeInfo {
    Version: semver.SemVer;
    Path: string;
}
