/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventStream } from "../EventStream";
import { NetworkSettingsProvider } from "../NetworkSettings";
import { LatestBuildDownloadStart, InstallationFailure } from "./loggingEvents";
import { DownloadFile } from "../packageManager/FileDownloader";

export async function getLatestOmniSharpVersion(url: string, eventStream: EventStream, networkSettingsProvider: NetworkSettingsProvider): Promise<string> {
    let description = "Latest OmniSharp Version Information";
    try {
        eventStream.post(new LatestBuildDownloadStart());
        let versionBuffer = await DownloadFile(description, eventStream, networkSettingsProvider, url);
        return versionBuffer.toString('utf8');
    }
    catch (error) {
        eventStream.post(new InstallationFailure('getLatestVersionInfoFile', error));
        throw error;
    }
}