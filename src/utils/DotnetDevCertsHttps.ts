/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from "path";
import * as cp from 'child_process';
import { getExtensionPath } from "../common";
import { CoreClrDebugUtil } from "../coreclr-debug/util";

// Will return true if `dotnet dev-certs https --check` succesfully finds a development certificate. 
export async function hasDotnetDevCertsHttps(dotNetCliPaths: string[]): Promise<ExecReturnData> {

    let dotnetExecutablePath = getDotNetExecutablePath(dotNetCliPaths);

    return await execChildProcess(`${dotnetExecutablePath ?? 'dotnet'} dev-certs https --check`, process.cwd(), process.env);
}

// Will run `dotnet dev-certs https --trust` to prompt the user to create self signed certificates. Retruns true if sucessfull.
export async function createSelfSignedCert(dotNetCliPaths: string[]): Promise<ExecReturnData> {

    let dotnetExecutablePath = getDotNetExecutablePath(dotNetCliPaths);

    return await execChildProcess(`${dotnetExecutablePath ?? 'dotnet'} dev-certs https --trust`, process.cwd(), process.env);
}

function getDotNetExecutablePath(dotNetCliPaths: string[]): string | undefined{
    let dotnetExeName = `dotnet${CoreClrDebugUtil.getPlatformExeExtension()}`;
    let dotnetExecutablePath: string | undefined;

    for (const dotnetPath of dotNetCliPaths) {
        let dotnetFullPath = join(dotnetPath, dotnetExeName);
        if (CoreClrDebugUtil.existsSync(dotnetFullPath)) {
            dotnetExecutablePath = dotnetFullPath;
            break;
        }
    }
    return dotnetExecutablePath;
}

async function execChildProcess(command: string, workingDirectory: string = getExtensionPath(), env: NodeJS.ProcessEnv = {}): Promise<ExecReturnData> {
    return new Promise<ExecReturnData>((resolve) => {
        cp.exec(command, { cwd: workingDirectory, maxBuffer: 500 * 1024, env: env }, (error, stdout, stderr) => {
            resolve({error, stdout, stderr});
        });
    });
}

interface ExecReturnData {
    error: cp.ExecException | null;
    stdout: string;
    stderr: string;
}