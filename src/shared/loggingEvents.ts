/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventType } from './eventType';
import { PlatformInformation } from './platform';

export interface BaseEvent {
    type: EventType;
}

export class EventWithMessage implements BaseEvent {
    type = EventType.EventWithMessage;
    constructor(public message: string) {}
}

export class ActivationFailure implements BaseEvent {
    type = EventType.ActivationFailure;
}

export class DebuggerPrerequisiteFailure extends EventWithMessage {
    type = EventType.DebuggerPrerequisiteFailure;
}

export class DebuggerPrerequisiteWarning extends EventWithMessage {
    type = EventType.DebuggerPrerequisiteWarning;
}

export class DebuggerNotInstalledFailure implements BaseEvent {
    type = EventType.DebuggerNotInstalledFailure;
}

export class PackageInstallStart implements BaseEvent {
    type = EventType.PackageInstallStart;
}

export class PackageInstallation implements BaseEvent {
    type = EventType.PackageInstallation;
    constructor(public packageInfo: string) {}
}

export class LogPlatformInfo implements BaseEvent {
    type = EventType.LogPlatformInfo;
    constructor(public info: PlatformInformation) {}
}

export class InstallationStart implements BaseEvent {
    type = EventType.InstallationStart;
    constructor(public packageDescription: string) {}
}

export class InstallationSuccess implements BaseEvent {
    type = EventType.InstallationSuccess;
}

export class InstallationFailure implements BaseEvent {
    type = EventType.InstallationFailure;
    constructor(public stage: string, public error: any) {}
}

export class DownloadStart implements BaseEvent {
    type = EventType.DownloadStart;
    constructor(public packageDescription: string) {}
}

export class DownloadFallBack implements BaseEvent {
    type = EventType.DownloadFallBack;
    constructor(public fallbackUrl: string) {}
}

export class DownloadSuccess extends EventWithMessage {
    type = EventType.DownloadSuccess;
}

export class DownloadFailure extends EventWithMessage {
    type = EventType.DownloadFailure;
}

export class DownloadSizeObtained implements BaseEvent {
    type = EventType.DownloadSizeObtained;
    constructor(public packageSize: number) {}
}

export class DownloadProgress implements BaseEvent {
    type = EventType.DownloadProgress;
    constructor(public downloadPercentage: number, public packageDescription: string) {}
}

export class DownloadValidation implements BaseEvent {
    type = EventType.DownloadValidation;
}

export class ZipError implements BaseEvent {
    type = EventType.ZipError;
    constructor(public message: string) {}
}

export class IntegrityCheckFailure {
    type = EventType.IntegrityCheckFailure;
    constructor(public packageDescription: string, public url: string, public retry: boolean) {}
}

export class IntegrityCheckSuccess {
    type = EventType.IntegrityCheckSuccess;
}
