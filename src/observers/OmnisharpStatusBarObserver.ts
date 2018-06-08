/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmnisharpServerOnServerError, BaseEvent, OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, OmnisharpServerOnStop, OmnisharpServerOnStart, DownloadStart, InstallationStart, DownloadProgress, OmnisharpServerOnStdErr } from "../omnisharp/loggingEvents";
import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';

export enum StatusBarColors{
    Red = 'rgb(218,0,0)',
    Green = 'rgb(0,218,0)',
    Yellow = 'rgb(218,218,0)'
}

export class OmnisharpStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpServerOnServerError.name:
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', StatusBarColors.Red, 'Error starting OmniSharp');
                break;
            case OmnisharpServerOnStdErr.name:
                let msg = (<OmnisharpServerOnStdErr>event).message;
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', StatusBarColors.Red, `OmniSharp process errored:${msg}`);
                break;
            case OmnisharpOnBeforeServerInstall.name:
                this.SetAndShowStatusBar('$(flame) Installing OmniSharp...', 'o.showOutput');
                break;
            case OmnisharpOnBeforeServerStart.name:
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', StatusBarColors.Yellow, 'Starting OmniSharp server');
                break;
            case OmnisharpServerOnStop.name:
                this.ResetAndHideStatusBar();
                break;
            case OmnisharpServerOnStart.name:
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', StatusBarColors.Green, 'OmniSharp server is running');
                break;
            case DownloadStart.name:
                this.SetAndShowStatusBar("$(cloud-download) Downloading packages", '', '', `Downloading package '${(<DownloadStart>event).packageDescription}...' `);
                break;
            case InstallationStart.name:
                this.SetAndShowStatusBar("$(desktop-download) Installing packages...", '', '', `Installing package '${(<InstallationStart>event).packageDescription}'`);
                break;
            case DownloadProgress.name:
                let progressEvent = <DownloadProgress>event;
                this.SetAndShowStatusBar("$(cloud-download) Downloading packages", '', '', `Downloading package '${progressEvent.packageDescription}'... ${progressEvent.downloadPercentage}%`);
                break;
        }
    }
}

