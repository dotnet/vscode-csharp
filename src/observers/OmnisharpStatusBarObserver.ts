/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, DownloadStart, InstallationStart, DownloadProgress, OmnisharpServerOnStdErr } from "../omnisharp/loggingEvents";
import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';
import { EventType } from "../omnisharp/EventType";

export enum StatusBarColors {
    Red = 'rgb(218,0,0)',
    Green = 'rgb(0,218,0)',
    Yellow = 'rgb(218,218,0)'
}

export class OmnisharpStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpServerOnServerError:
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', StatusBarColors.Red, 'Error starting OmniSharp');
                break;
            case EventType.OmnisharpServerOnStdErr:
                let msg = (<OmnisharpServerOnStdErr>event).message;
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', StatusBarColors.Red, `OmniSharp process errored:${msg}`);
                break;
            case EventType.OmnisharpOnBeforeServerInstall:
                this.SetAndShowStatusBar('$(flame) Installing OmniSharp...', 'o.showOutput');
                break;
            case EventType.OmnisharpOnBeforeServerStart:
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', StatusBarColors.Yellow, 'Starting OmniSharp server');
                break;
            case EventType.OmnisharpServerOnStop:
                this.ResetAndHideStatusBar();
                break;
            case EventType.OmnisharpServerOnStart:
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', undefined, 'OmniSharp server is running');
                break;
            case EventType.DownloadStart:
                this.SetAndShowStatusBar("$(cloud-download) Downloading packages", '', '', `Downloading package '${(<DownloadStart>event).packageDescription}...' `);
                break;
            case EventType.InstallationStart:
                this.SetAndShowStatusBar("$(desktop-download) Installing packages...", '', '', `Installing package '${(<InstallationStart>event).packageDescription}'`);
                break;
            case EventType.InstallationSuccess:
                this.ResetAndHideStatusBar();
                break;
            case EventType.DownloadProgress:
                let progressEvent = <DownloadProgress>event;
                this.SetAndShowStatusBar("$(cloud-download) Downloading packages", '', '', `Downloading package '${progressEvent.packageDescription}'... ${progressEvent.downloadPercentage}%`);
                break;
        }
    }
}

