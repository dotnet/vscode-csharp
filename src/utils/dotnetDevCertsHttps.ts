/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import { getExtensionPath } from '../common';
import { commonOptions, omnisharpOptions } from '../shared/options';

// Will return true if `dotnet dev-certs https --check` succesfully finds a trusted development certificate.
export async function hasDotnetDevCertsHttps(): Promise<ExecReturnData> {
    return await execChildProcess(`${getDotnetCommand()} dev-certs https --check --trust`, process.cwd(), process.env);
}

// Will run `dotnet dev-certs https --trust` to prompt the user to create a trusted self signed certificates. Retruns true if sucessfull.
export async function createSelfSignedCert(): Promise<ExecReturnData> {
    return await execChildProcess(`${getDotnetCommand()} dev-certs https --trust`, process.cwd(), process.env);
}

async function execChildProcess(
    command: string,
    workingDirectory: string = getExtensionPath(),
    env: NodeJS.ProcessEnv = {}
): Promise<ExecReturnData> {
    return new Promise<ExecReturnData>((resolve) => {
        cp.exec(command, { cwd: workingDirectory, maxBuffer: 500 * 1024, env: env }, (error, stdout, stderr) => {
            resolve({ error, stdout, stderr });
        });
    });
}

function getDotnetCommand(): string {
    if (commonOptions.useOmnisharpServer) {
        return omnisharpOptions.dotnetPath ?? 'dotnet';
    } else {
        return 'dotnet';
    }
}

interface ExecReturnData {
    error: cp.ExecException | null;
    stdout: string;
    stderr: string;
}

export enum CertToolStatusCodes {
    CriticalError = -1,
    Success = 0,
    // Following are from trusting the certificate (dotnet dev-certs https --trust)
    ErrorCreatingTheCertificate = 1,
    ErrorSavingTheCertificate = 2,
    ErrorExportingTheCertificate = 3,
    ErrorTrustingTheCertificate = 4,
    UserCancel = 5,
    // Following two are from checking for trust (dotnet dev-certs https --check --trust)
    ErrorNoValidCertificateFound = 6,
    CertificateNotTrusted = 7,
}
