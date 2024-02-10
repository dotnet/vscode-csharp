/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from './platform';

export interface ITelemetryReporter {
    sendTelemetryEvent(
        eventName: string,
        properties?: { [key: string]: string },
        measures?: { [key: string]: number }
    ): void;
    sendTelemetryErrorEvent(
        eventName: string,
        properties?: { [key: string]: string },
        measures?: { [key: string]: number },
        errorProps?: string[]
    ): void;
}

export function getTelemetryProps(platformInfo: PlatformInformation) {
    const telemetryProps: { [key: string]: string } = {
        'platform.architecture': platformInfo.architecture,
        'platform.platform': platformInfo.platform,
    };

    if (platformInfo.distribution) {
        telemetryProps['platform.distribution'] = platformInfo.distribution.toTelemetryString();
    }

    return telemetryProps;
}
