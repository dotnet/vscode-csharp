/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execChildProcess } from "../common";

export async function getDotnetInfo(): Promise<string> {
    let dotnetInfo: string;
    try {
        dotnetInfo = await execChildProcess("dotnet --info", process.cwd());
    }
    catch (error) {
        dotnetInfo = "A valid dotnet installation could not be found.";
    }

    return dotnetInfo;
}