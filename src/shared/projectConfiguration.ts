/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';
import { PlatformInformation } from './platform';
import { ITelemetryReporter, getTelemetryProps } from './telemetryReporter';
import { DotnetInfo } from './utils/dotnetInfo';

export interface ProjectConfigurationMessage {
    ProjectId: string;
    SessionId: string;
    OutputKind: number;
    ProjectCapabilities: string[];
    TargetFrameworks: string[];
    References: string[];
    FileExtensions: string[];
    FileCounts: number[];
    SdkStyleProject: boolean;
}

export function reportProjectConfigurationEvent(
    reporter: ITelemetryReporter,
    projectConfig: ProjectConfigurationMessage,
    platformInfo: PlatformInformation,
    dotnetInfo: DotnetInfo | undefined,
    solutionPath?: string,
    useModernNet?: boolean
) {
    let solutionId = '';
    if (solutionPath) {
        solutionId = createSolutionId(solutionPath);
    }

    const telemetryProps = getTelemetryProps(platformInfo);
    telemetryProps['SolutionId'] = solutionId;
    telemetryProps['ProjectId'] = projectConfig.ProjectId;
    telemetryProps['SessionId'] = projectConfig.SessionId;
    telemetryProps['OutputType'] = projectConfig.OutputKind?.toString() ?? '';
    telemetryProps['ProjectCapabilities'] = projectConfig.ProjectCapabilities?.join(' ') ?? '';
    telemetryProps['TargetFrameworks'] = projectConfig.TargetFrameworks.join('|');
    telemetryProps['References'] = projectConfig.References.join('|');
    telemetryProps['FileExtensions'] = projectConfig.FileExtensions.join('|');
    telemetryProps['FileCounts'] = projectConfig.FileCounts?.join('|') ?? '';
    telemetryProps['NetSdkVersion'] = dotnetInfo?.Version ?? '';
    telemetryProps['sdkStyleProject'] = projectConfig.SdkStyleProject.toString();

    if (useModernNet) {
        telemetryProps['useModernNet'] = useModernNet.toString();
    }

    reporter.sendTelemetryEvent('ProjectConfiguration', telemetryProps);
}

function createSolutionId(solutionPath: string) {
    const solutionHash = crypto.createHash('sha256').update(solutionPath).digest('hex');

    const machineId = machineIdSync();
    const machineHash = crypto.createHash('sha256').update(machineId).digest('hex');

    return crypto
        .createHash('sha256')
        .update(solutionHash + machineHash)
        .digest('hex');
}
