/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from "path";
import { execChildProcess } from "../common";
import { CoreClrDebugUtil } from "../coreclrDebug/util";

export const MSBUILD_MISSING_MESSAGE = "A valid msbuild installation could not be found.";

let _msbuildVersion: string | undefined;

export async function getMSBuildVersion(): Promise<string | undefined> {
    if (_msbuildVersion !== undefined) {
        return _msbuildVersion;
    }

    const msbuildExeName = join('msbuild', CoreClrDebugUtil.getPlatformExeExtension());

    try {
        const data = await execChildProcess(`${msbuildExeName} -version -nologo`, process.cwd(), process.env);
        const match = /^(\d+\.\d+\.\d+\.\d+)$/.exec(data);
        if (match) {
            _msbuildVersion = match[1];
        }
    }
    catch { /* empty */ }

    return _msbuildVersion;
}
