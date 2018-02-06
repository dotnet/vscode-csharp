/*---------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as util from './common';
import { PackageManager, Status, PackageError } from './packages';
import { PlatformInformation } from './platform';
import { Logger } from './logger';
import TelemetryReporter from 'vscode-extension-telemetry';

export async function GetDownloadDependencies(reporter: TelemetryReporter, logger: Logger, channel: vscode.OutputChannel, packageJSON: any, platformInfo: PlatformInformation) {
    let packageManager = new PackageManager(platformInfo, packageJSON);
    const config = vscode.workspace.getConfiguration();
    const proxy = config.get<string>('http.proxy');
    const strictSSL = config.get('http.proxyStrictSSL', true);
    return {
        Proxy: proxy, StrictSSL: strictSSL, PackageManager: packageManager
    };
}

export function GetStatus(statusItem: vscode.StatusBarItem): Status {
    let status: Status = {
        setMessage: text => {
            statusItem.text = text;
            statusItem.show();
        },
        setDetail: text => {
            statusItem.tooltip = text;
            statusItem.show();
        }
    };

    return status;
}

export async function GetPlatformInformation(logger: Logger): Promise<PlatformInformation> {
    let platformInfo = await PlatformInformation.GetCurrent();
    logger.appendLine();
    // Display platform information and RID followed by a blank line
    logger.appendLine(`Platform: ${platformInfo.toString()}`);
    logger.appendLine();
    return platformInfo;
}

export function ReportError(logger: Logger, error, telemetryProps: any, installationStage: string) {
    let errorMessage: string;
    if (error instanceof PackageError) {
        // we can log the message in a PackageError to telemetry as we do not put PII in PackageError messages
        telemetryProps['error.message'] = error.message;
        if (error.innerError) {
            errorMessage = error.innerError.toString();
        }
        else {
            errorMessage = error.message;
        }
        if (error.pkg) {
            telemetryProps['error.packageUrl'] = error.pkg.url;
        }
    }
    else {
        // do not log raw errorMessage in telemetry as it is likely to contain PII.
        errorMessage = error.toString();
    }
    
    logger.appendLine(`Failed at stage: ${installationStage}`);
    logger.appendLine(errorMessage);
}

export function SendTelemetry(logger: Logger, reporter: TelemetryReporter, telemetryProps: any, installationStage: string, platformInfo: PlatformInformation, statusItem: vscode.StatusBarItem) {
    telemetryProps['installStage'] = installationStage;
    telemetryProps['platform.architecture'] = platformInfo.architecture;
    telemetryProps['platform.platform'] = platformInfo.platform;
    if (platformInfo.distribution) {
        telemetryProps['platform.distribution'] = platformInfo.distribution.toTelemetryString();
    }
    if (reporter) {
        reporter.sendTelemetryEvent('Acquisition', telemetryProps);
    }

    logger.appendLine();
    installationStage = '';
    logger.appendLine('Finished');

    statusItem.dispose();
}