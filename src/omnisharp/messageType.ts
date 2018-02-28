/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { IObserver } from "rx";
import { Request } from "./requestQueue";

export type MessageObserver = IObserver<Message>;
export enum MessageType {
    OmnisharpInitialisation, OmnisharpLaunch, OmnisharpInstallation, Platform, InstallationFailure, InstallationProgress, InstallationFinished, OmnisharpFailure,
    OmnisharpServerMessage, OmnisharpRequestMessage, OmnisharpServerVerboseMessage, OmnisharpEventPacketReceived
}
export type Message = OmnisharpInitialisation | OmnisharpLaunch | OmnisharpInstallation | Platform | InstallationStep | OmnisharpFailure
    | OmnisharpServerMessage | OmnisharpRequestMessage | OmnisharpEventPacketReceived;

interface OmnisharpInitialisation {
    type: MessageType.OmnisharpInitialisation;
    timeStamp: Date;
    solutionPath: string;
}

interface OmnisharpLaunch {
    type: MessageType.OmnisharpLaunch;
    usingMono: boolean;
    command: string;
    pid: number;
}

interface OmnisharpInstallation {
    type: MessageType.OmnisharpInstallation;
}

interface Platform {
    type: MessageType.Platform;
    info: PlatformInformation;
}

interface InstallationStep {
    type: MessageType.InstallationFailure | MessageType.InstallationProgress | MessageType.InstallationFinished;
    stage: string;
    message: string;
}

interface OmnisharpFailure {
    type: MessageType.OmnisharpFailure;
    message: string;
    error: Error;
}

interface OmnisharpServerMessage {
    type: MessageType.OmnisharpServerMessage | MessageType.OmnisharpServerVerboseMessage;
    message: string;
}

interface OmnisharpRequestMessage {
    type: MessageType.OmnisharpRequestMessage;
    request: Request;
    id: number;
}

export interface OmnisharpEventPacketReceived {
    type: MessageType.OmnisharpEventPacketReceived;
    logLevel: string;
    name: string;
    message: string;
}