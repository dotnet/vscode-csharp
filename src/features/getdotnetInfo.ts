/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as cp from "child-process-promise";

export async function getDotnetInfo(): Promise<string> {
    try {
        let result = await cp.exec("dotnet --info");
        return result.stdout;
    }
    catch{
        return "Dotnet info could not be obtained";
    }
}